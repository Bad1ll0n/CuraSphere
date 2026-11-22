import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { createHash, randomBytes } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';
import { MailerService } from '../mailer/mailer.service';
import { hashPassword } from '../common/password';
import { exigirPasswordForte } from '../auth/politica-password';
import { escaparHtml } from '../common/escapar-html';

/** Validade do link de recuperação. */
export const VALIDADE_RECUPERACAO_MS = 30 * 60 * 1000;

const hashToken = (token: string) => createHash('sha256').update(token).digest('hex');

/**
 * UX-28 — "Esqueci-me da password" no portal do doente.
 *
 * Antes não havia recuperação: o doente telefonava ao hospital. Regras:
 *  - a resposta ao pedido é sempre a mesma, exista ou não a conta (o email de um doente é dado
 *    de saúde neste contexto: o portal não pode servir para confirmar quem é doente);
 *  - o token só existe no link enviado; na BD fica o SHA-256. Vale 30 min e uma vez; pedir outro
 *    invalida os anteriores;
 *  - redefinir aplica a mesma política de password do resto da aplicação (SEC-25) e levanta o
 *    bloqueio por falhas de login.
 */
@Injectable()
export class PortalRecuperacaoService {
  private readonly logger = new Logger(PortalRecuperacaoService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    private readonly mailer: MailerService,
  ) {}

  async pedir(email: string, origemWeb: string): Promise<{ mensagem: string }> {
    const resposta = { mensagem: 'Se o email tiver acesso ao portal, vai receber uma ligação para definir uma nova password. A ligação é válida durante 30 minutos.' };
    const portal = await this.prisma.portalDoente.findUnique({
      where: { email: email.trim() },
      include: { doente: { select: { ativo: true, nome: true } } },
    });
    if (!portal || !portal.ativo || !portal.doente.ativo) {
      this.logger.log('Pedido de recuperação do portal para um email sem conta ativa (resposta igual)');
      return resposta;
    }

    const token = randomBytes(32).toString('base64url');
    await this.prisma.$transaction([
      this.prisma.recuperacaoPortal.updateMany({ where: { portalId: portal.id, usadoEm: null }, data: { usadoEm: new Date() } }),
      this.prisma.recuperacaoPortal.create({
        data: { portalId: portal.id, tokenHash: hashToken(token), expiraEm: new Date(Date.now() + VALIDADE_RECUPERACAO_MS) },
      }),
    ]);

    const link = `${origemWeb.replace(/\/$/, '')}/portal/login/redefinir?token=${encodeURIComponent(token)}`;
    const primeiroNome = escaparHtml(String(portal.doente.nome ?? '').split(' ')[0] ?? '');
    await this.mailer.enviar({
      para: portal.email,
      assunto: 'Portal do doente — definir nova password',
      html: `<p>Olá${primeiroNome ? `, ${primeiroNome}` : ''}.</p>
<p>Pediu para definir uma nova password no portal do doente. Use esta ligação nos próximos 30 minutos:</p>
<p><a href="${escaparHtml(link)}">Definir nova password</a></p>
<p>Se não foi quem pediu, ignore este email: a sua password atual continua válida.</p>`,
    }).catch((e) => this.logger.warn(`Envio do email de recuperação falhou: ${e?.message ?? e}`));
    return resposta;
  }

  async redefinir(token: string, senha: string): Promise<{ ok: true }> {
    const agora = new Date();
    const pedido = await this.prisma.recuperacaoPortal.findUnique({
      where: { tokenHash: hashToken(token) },
      include: { portal: { include: { doente: { select: { nome: true, ativo: true } } } } },
    });
    if (!pedido || pedido.usadoEm || pedido.expiraEm <= agora || !pedido.portal.ativo || !pedido.portal.doente.ativo) {
      throw new BadRequestException('A ligação expirou ou já foi usada. Peça uma nova.');
    }
    exigirPasswordForte(senha, { email: pedido.portal.email, nome: pedido.portal.doente.nome });
    const passwordHash = await hashPassword(senha, 12);
    // Marcar como usado só se ainda não estiver — dois pedidos simultâneos com o mesmo link: um só ganha.
    const [marcado] = await this.prisma.$transaction([
      this.prisma.recuperacaoPortal.updateMany({ where: { id: pedido.id, usadoEm: null }, data: { usadoEm: agora } }),
    ]);
    if (marcado.count !== 1) throw new BadRequestException('A ligação expirou ou já foi usada. Peça uma nova.');
    await this.prisma.portalDoente.update({ where: { id: pedido.portalId }, data: { passwordHash } });
    // O RedisService já trata a falha do Redis; o bloqueio expira sozinho ao fim de 15 min.
    await this.redis.del(`portal:login:lock:${pedido.portalId}`, `portal:login:fail:${pedido.portalId}`);
    return { ok: true };
  }
}
