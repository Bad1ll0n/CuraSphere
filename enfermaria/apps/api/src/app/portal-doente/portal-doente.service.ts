import { Injectable, Logger, NotFoundException, UnauthorizedException, ConflictException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Prisma } from '../../generated/prisma';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';
import { StorageService } from '../common/storage.service';
import { PdfService } from '../common/pdf.service';
import { hashPassword, verifyPassword } from '../common/password';
import { AUD_PORTAL } from '../auth/token-audiences';

// Hash bcrypt fixo (cost 12) usado para equalizar o tempo de resposta quando a conta
// não existe. Mesma constante e mesma técnica do login de pessoal (`auth.service.ts`).
const DUMMY_BCRYPT_HASH = '$2a$12$CwTycUXWue0Thq9StjUM0uJ8L1z/Bm5wQq6zP2N5p8m7rUcD3xK2C';

@Injectable()
export class PortalDoenteService {
  private readonly logger = new Logger(PortalDoenteService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly redis: RedisService,
    private readonly storage: StorageService,
    private readonly pdf: PdfService,
  ) {}

  async criarAcesso(doenteId: string, email: string, senha: string, criadoPorId: string) {
    const doente = await this.prisma.doente.findUnique({ where: { id: doenteId } });
    if (!doente || !doente.ativo) throw new NotFoundException('Doente não encontrado');

    const emailExiste = await this.prisma.portalDoente.findUnique({ where: { email } });
    if (emailExiste && emailExiste.doenteId !== doenteId) {
      throw new ConflictException('Email já utilizado por outro doente');
    }

    const passwordHash = await hashPassword(senha, 12);
    return this.prisma.portalDoente.upsert({
      where: { doenteId },
      create: { doenteId, email, passwordHash, criadoPorId },
      update: { email, passwordHash },
      select: { id: true, doenteId: true, email: true, ativo: true, criadoEm: true },
    });
  }

  /**
   * SEC-06 — login do portal do doente.
   *
   * Replica ponto por ponto o login de pessoal (`AuthService.login`), que é a
   * implementação de referência da casa:
   *   - hash-dummy quando a conta não existe/está inactiva, para equalizar o tempo
   *     de resposta (antes: resposta imediata em ~0 ms para um email inexistente
   *     vs. ~200 ms de bcrypt para um existente → enumeração de utentes por
   *     temporização, e um email é PII do art.º 9.º neste contexto);
   *   - mensagem de erro IDÊNTICA em todos os casos ('Credenciais inválidas') —
   *     antes 'Conta desactivada' confirmava directamente a existência do utente;
   *   - bloqueio temporário da conta após 5 falhas (15 min), contra credential
   *     stuffing. O @Throttle no controlador limita por IP; isto limita por conta,
   *     que é o que trava um ataque distribuído por várias origens.
   */
  async login(email: string, senha: string) {
    const portal = await this.prisma.portalDoente.findUnique({
      where: { email },
      include: { doente: { select: { id: true, nome: true, ativo: true } } },
    });

    if (!portal || !portal.ativo || !portal.doente.ativo) {
      await verifyPassword(senha, DUMMY_BCRYPT_HASH).catch(() => false);
      this.logger.warn('Tentativa de login falhada no portal do doente (conta inexistente ou inactiva)');
      throw new UnauthorizedException('Credenciais inválidas');
    }

    const lockKey = `portal:login:lock:${portal.id}`;
    const failKey = `portal:login:fail:${portal.id}`;
    const lockAtivo = await this.redis.get<string>(lockKey);
    if (lockAtivo) {
      throw new UnauthorizedException('Conta temporariamente bloqueada. Tente novamente em 15 minutos.');
    }

    const valido = await verifyPassword(senha, portal.passwordHash);
    if (!valido) {
      const falhas = (await this.redis.get<number>(failKey) ?? 0) + 1;
      if (falhas >= 5) {
        await this.redis.set(lockKey, '1', 900);
        await this.redis.del(failKey);
        this.logger.warn(`Conta do portal bloqueada por excesso de falhas: ${portal.id}`);
        throw new UnauthorizedException('Conta temporariamente bloqueada. Tente novamente em 15 minutos.');
      }
      await this.redis.set(failKey, falhas, 900);
      this.logger.warn(`Password incorreta no portal do doente (${falhas}/5)`);
      throw new UnauthorizedException('Credenciais inválidas');
    }

    await this.redis.del(failKey);

    // SEC-01: audiência exclusiva do portal — este token deixa de ser aceite pela
    // `JwtStrategy` do pessoal e, com ela, pelos 13 controladores sem `@Roles`.
    const accessToken = this.jwt.sign(
      { sub: portal.id, doenteId: portal.doenteId, tipo: 'portal' },
      { expiresIn: '8h', audience: AUD_PORTAL },
    );
    return { accessToken, doente: portal.doente };
  }

  async me(doenteId: string) {
    const doente = await this.prisma.doente.findUnique({
      where: { id: doenteId },
      select: {
        id: true, nome: true, dataNascimento: true, diagnosticoPrincipal: true,
        dataAdmissao: true, dataAltaPrevista: true, estado: true,
      },
    });
    if (!doente) throw new NotFoundException('Doente não encontrado');
    return doente;
  }

  async meusDocumentos(doenteId: string) {
    const docs = await this.prisma.documentoSaude.findMany({
      where: { doenteId },
      orderBy: { dataDocumento: 'desc' },
      select: { id: true, titulo: true, tipo: true, formato: true, origem: true, dataDocumento: true, tamanhoBytes: true, storageKey: true, urlExterna: true },
    });
    return Promise.all(docs.map(async d => ({
      ...d,
      url: d.storageKey ? await this.storage.getSignedUrl(d.storageKey) : d.urlExterna ?? null,
      storageKey: undefined,
    })));
  }

  async minhaMedicacao(doenteId: string) {
    return this.prisma.medicacao.findMany({
      where: { doenteId, ativo: true, deletedAt: null },
      orderBy: { iniciadoEm: 'desc' },
      select: {
        id: true, nome: true, dose: true, via: true, frequencia: true,
        iniciadoEm: true,
      },
    });
  }

  async meuPlanoAlta(doenteId: string) {
    return this.prisma.planoAlta.findFirst({
      where: { doenteId },
      orderBy: { criadoEm: 'desc' },
      select: {
        id: true, dataAlvoDia: true, notas: true, criadoEm: true,
        afebrилApenas24h: true, mobilidadeAdequada: true, alimentacaoOral: true,
        doresControladas: true, familiaInformada: true,
      },
    });
  }

  async exportarDados(doenteId: string): Promise<Buffer> {
    const doente = await this.prisma.doente.findUnique({ where: { id: doenteId } });
    if (!doente) throw new NotFoundException('Doente não encontrado');
    return this.pdf.gerarSumarioAlta(doenteId);
  }

  async exportarJson(doenteId: string) {
    const doente = await this.prisma.doente.findUnique({
      where: { id: doenteId },
      select: {
        id: true, nome: true, dataNascimento: true, numeroProcesso: true,
        diagnosticoPrincipal: true, dataAdmissao: true, dataAltaPrevista: true, estado: true,
      },
    });
    if (!doente) throw new NotFoundException('Doente não encontrado');

    const [medicacao, sinaisVitais, documentos, planoAlta] = await Promise.all([
      this.prisma.medicacao.findMany({
        where: { doenteId, ativo: true, deletedAt: null },
        select: { nome: true, dose: true, via: true, frequencia: true, iniciadoEm: true },
      }),
      this.prisma.sinalVital.findMany({
        where: { doenteId, data: { gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) } },
        orderBy: { data: 'desc' },
        select: { data: true, pressaoSistolica: true, pressaoDiastolica: true, pulso: true, temperatura: true, saturacaoO2: true, frequenciaRespiratoria: true, news2: true },
        take: 100,
      }),
      this.prisma.documentoSaude.findMany({
        where: { doenteId },
        select: { titulo: true, tipo: true, formato: true, origem: true, dataDocumento: true },
        orderBy: { dataDocumento: 'desc' },
      }),
      this.prisma.planoAlta.findFirst({
        where: { doenteId },
        orderBy: { criadoEm: 'desc' },
        select: { dataAlvoDia: true, notas: true, criadoEm: true },
      }),
    ]);

    return {
      exportadoEm: new Date().toISOString(),
      regulamento: 'RGPD Art. 20 — Direito à portabilidade dos dados',
      doente,
      medicacaoActiva: medicacao,
      sinaisVitaisUltimos30Dias: sinaisVitais,
      documentosClinicosListagem: documentos,
      planoAlta,
    };
  }

  async teleconsultas(portalId: string) {
    const portal = await this.prisma.portalDoente.findUnique({ where: { id: portalId } });
    if (!portal) throw new UnauthorizedException();
    return this.prisma.consulta.findMany({
      where: { doenteId: portal.doenteId, tipo: 'teleconsulta' as any, estado: 'agendada' },
      orderBy: { dataHora: 'asc' },
      include: { medico: { select: { id: true, nome: true, subRole: true } } },
    });
  }

  async entrarVideoPortal(consultaId: string, portalId: string) {
    const portal = await this.prisma.portalDoente.findUnique({ where: { id: portalId } });
    if (!portal) throw new UnauthorizedException();
    const consulta = await this.prisma.consulta.findFirst({
      where: { id: consultaId, doenteId: portal.doenteId },
    });
    if (!consulta) throw new NotFoundException('Consulta não encontrada');
    const roomId: string | null = (consulta as any).videoRoomId ?? null;
    if (!roomId) throw new NotFoundException('Chamada ainda não iniciada');
    const server = process.env['JITSI_SERVER'] ?? 'https://meet.jit.si';
    return { roomUrl: `${server}/${roomId}`, videoRoomId: roomId };
  }

  async enviarMensagem(doenteId: string, conteudo: string) {
    const doente = await this.prisma.doente.findUnique({
      where: { id: doenteId },
      select: { nome: true },
    });
    // Criar mensagem interna com remetente virtual "Portal do Doente"
    // Destinatários: utilizadores do serviço internamento com role enfermeiro/chefe_enfermeiros
    const equipa = await this.prisma.utilizador.findMany({
      where: { role: { in: ['enfermeiro', 'chefe_enfermeiros', 'medico'] }, servico: 'internamento', ativo: true },
      select: { id: true },
      take: 10,
    });

    const mensagens = equipa.map(u =>
      this.prisma.mensagemInterna.create({
        data: {
          assunto: `Mensagem do Portal — ${doente?.nome ?? 'Doente'}`,
          texto: conteudo,
          remetenteId: equipa[0]?.id ?? u.id, // remetente interno fictício (primeiro da equipa)
          destinatarioId: u.id,
          lida: false,
        },
      }),
    );
    await Promise.all(mensagens);
    return { mensagem: 'Mensagem enviada à equipa' };
  }

  // ── PRO — Patient-Reported Outcomes ──────────────────────────────────────────

  async listarTemplatesPRO() {
    return this.prisma.templatePRO.findMany({ where: { ativo: true }, orderBy: { nome: 'asc' } });
  }

  async criarTemplatePRO(nome: string, campos: object[]) {
    return this.prisma.templatePRO.create({ data: { nome, campos } });
  }

  async submeterPRO(doenteId: string, templateId: string, respostas: Record<string, unknown>) {
    return this.prisma.registoPRO.create({
      data: { doenteId, templateId, respostas: respostas as Prisma.InputJsonValue },
      include: { template: { select: { nome: true } } },
    });
  }

  async historicoPRO(doenteId: string, templateId?: string) {
    return this.prisma.registoPRO.findMany({
      where: { doenteId, ...(templateId ? { templateId } : {}) },
      include: { template: { select: { nome: true, campos: true } } },
      orderBy: { criadoEm: 'desc' },
      take: 50,
    });
  }

  async historicoPRODoente(doenteId: string) {
    return this.historicoPRO(doenteId);
  }
}
