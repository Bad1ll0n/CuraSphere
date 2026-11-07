import {
  CallHandler,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  NestInterceptor,
  NotFoundException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Observable } from 'rxjs';
import { DoenteService } from './doentes.service';
import { PrismaService } from '../prisma/prisma.service';
import { AcessoLeituraService } from '../common/acesso-leitura.service';
import { AnomalyDetectionService } from '../common/anomaly-detection.service';
import { idCorrelacaoDoPedido } from '../common/correlacao';
import {
  ACESSO_DOENTE_ISENTO,
  ACESSO_DOENTE_POR,
  AcessoDoentePorMeta,
} from './acesso-doente.decorator';

/**
 * Verificação de acesso ao doente aplicada a TODAS as rotas (S-01).
 *
 * O `assertAcessoDoente` é um bom controlo — papéis de supervisão passam, clínicos precisam
 * de atribuição ou de break-glass activo. O problema nunca foi a regra: foi estar aplicada
 * à mão, controlador a controlador. Estava em 26 de 44. Nos restantes, um auxiliar lia e
 * apagava os contactos de emergência de qualquer doente, e o mesmo em alergias, exames e
 * documentos. Este projecto já corrigiu este defeito três vezes, sempre caso a caso — e o
 * caso seguinte voltava a escapar.
 *
 * Por isso a verificação deixou de depender de alguém se lembrar dela. O doente pode chegar
 * por três vias, e todas passam por aqui:
 *  - `doenteId` no caminho ou na query;
 *  - `doenteId` no corpo do pedido. Foi por esta via que a revisão de 2026-11 encontrou um
 *    enfermeiro sem atribuição a prescrever, administrar e criar acessos ao portal de
 *    qualquer doente (QA-01, QA-10, SEC-01). Os fluxos em que a relação ainda não existe
 *    (admissão, auto-atribuição, break-glass, urgência) declaram-se com `@AcessoDoenteIsento`;
 *  - o id de uma entidade clínica (`/medicacao/:id`, `/alergias/:id`), declarado com
 *    `@AcessoDoentePor`: o interceptor resolve a entidade até ao doente (QA-01, QA-02, QA-12).
 *
 * Porquê interceptor e não guard: na ordem de execução do Nest, um guard global corre ANTES
 * do `JwtAuthGuard` de cada controlador — ainda não haveria utilizador para verificar. Um
 * interceptor corre depois de todos os guards, com a identidade já resolvida, e continua a
 * poder recusar antes de o handler executar.
 *
 * A activação de break-glass faz-se por `POST /break-glass`, isenta da verificação do corpo.
 */
@Injectable()
export class AcessoDoenteInterceptor implements NestInterceptor {
  constructor(
    private readonly doentes: DoenteService,
    private readonly reflector: Reflector,
    private readonly prisma: PrismaService,
    private readonly leituras: AcessoLeituraService,
    private readonly anomalia: AnomalyDetectionService,
  ) {}

  /**
   * SEC-09: "quem viu que doente". Antes só `GET /doentes/:id` ficava registado; as outras 57
   * rotas clínicas por doente (sinais vitais, medicação, alergias, notas, exames, IA, FHIR…)
   * não deixavam rasto, e um acesso recusado aparecia como acesso. Regista-se aqui — onde o
   * doente de qualquer rota já está resolvido — e com o resultado.
   */
  private registarLeitura(req: any, utilizador: any, doentes: string[], resultado: 'concedido' | 'negado') {
    if (req.method !== 'GET' && req.method !== 'HEAD') return;
    const rota = `${req.method} ${String(req.originalUrl ?? req.url ?? '').split('?')[0]}`;
    for (const doenteId of new Set(doentes)) {
      this.leituras.registar({
        utilizadorId: utilizador.sub ?? null,
        utilizadorNome: utilizador.nome ?? null,
        utilizadorRole: utilizador.tipo === 'portal' ? 'portal' : (utilizador.role ?? null),
        entidadeTipo: 'doentes',
        entidadeId: doenteId,
        rota,
        ip: req.ip ?? null,
        correlationId: idCorrelacaoDoPedido(req), // OPS-07: nunca o cabeçalho cru
        resultado,
      });
      if (resultado === 'concedido' && utilizador.sub && utilizador.tipo !== 'portal') {
        this.anomalia.rastrearAcessoDoente(utilizador.sub, doenteId);
      }
    }
  }

  async intercept(context: ExecutionContext, next: CallHandler): Promise<Observable<unknown>> {
    if (context.getType() !== 'http') return next.handle();

    const req = context.switchToHttp().getRequest();
    const alvos: string[] = doentesReferidos(req);

    const isento = this.reflector.getAllAndOverride<string>(ACESSO_DOENTE_ISENTO, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!isento) alvos.push(...doentesNoCorpo(req));

    const porEntidade = this.reflector.getAllAndOverride<AcessoDoentePorMeta>(ACESSO_DOENTE_POR, [
      context.getHandler(),
      context.getClass(),
    ]);
    const idEntidade = porEntidade ? req.params?.[porEntidade.parametro] : undefined;

    const unicos = [...new Set(alvos)];

    // SEC-09: o portal lê sempre os dados do próprio doente pela sessão (`req.user.doenteId`),
    // nunca pela rota — as consultas ao portal (incluindo as exportações) não deixavam rasto.
    const sessaoPortal = req.user?.tipo === 'portal' ? req.user : null;
    if (sessaoPortal?.doenteId && unicos.length === 0 && typeof idEntidade !== 'string') {
      this.registarLeitura(req, sessaoPortal, [sessaoPortal.doenteId], 'concedido');
      return next.handle();
    }

    if (unicos.length === 0 && typeof idEntidade !== 'string') return next.handle();

    const utilizador = req.user;

    // Sem identidade: rota pública ou autenticada por outro mecanismo (o quiosque coloca
    // `req.quiosque`, não `req.user`). A responsabilidade é do guard dessa rota — e o teste
    // estrutural garante que nenhum controlador existe sem guard ou declaração de público.
    if (!utilizador) return next.handle();

    if (porEntidade && typeof idEntidade === 'string') {
      const doenteId = await this.doenteDaEntidade(porEntidade, idEntidade);
      if (doenteId) unicos.push(doenteId);
    }
    if (unicos.length === 0) return next.handle();

    // Sessão do portal do doente: só o próprio doente.
    if (utilizador.tipo === 'portal') {
      if (unicos.some((id) => id !== utilizador.doenteId)) {
        this.registarLeitura(req, utilizador, unicos, 'negado');
        throw new ForbiddenException('Sem acesso aos dados de outro doente');
      }
      this.registarLeitura(req, utilizador, unicos, 'concedido');
      return next.handle();
    }

    // Tokens intermédios (MFA por configurar, password expirada) nunca têm razão para ler
    // um doente. O `JwtAuthGuard` já os filtra; isto é a segunda camada, e falha fechado.
    if (utilizador.tipoToken !== 'pessoal') {
      throw new ForbiddenException('Sessão incompleta — conclua a autenticação');
    }

    try {
      for (const doenteId of new Set(unicos)) {
        await this.doentes.assertAcessoDoente(utilizador.sub, utilizador.role, doenteId);
      }
    } catch (e) {
      this.registarLeitura(req, utilizador, unicos, 'negado');
      throw e;
    }
    this.registarLeitura(req, utilizador, unicos, 'concedido');

    return next.handle();
  }

  /**
   * Resolve `id` da entidade até ao `doenteId`, seguindo uma relação quando o campo é
   * `relacao.doenteId`. Entidade inexistente → 404 aqui, antes do handler: assim a resposta
   * é a mesma com ou sem acesso, e não se revela a existência a quem não tem acesso.
   * Entidade sem doente (ex.: consulta ainda sem doente associado) → sem verificação.
   */
  private async doenteDaEntidade(meta: AcessoDoentePorMeta, id: string): Promise<string | null> {
    const delegate = (this.prisma as any)[meta.modelo];
    if (!delegate?.findUnique) {
      // Erro de programação (nome do modelo errado no decorator): falhar fechado.
      throw new ForbiddenException('Verificação de acesso mal configurada');
    }
    const partes = meta.campo.split('.');
    const select = partes.reduceRight<Record<string, unknown>>(
      (dentro, parte, i) => ({ [parte]: i === partes.length - 1 ? true : { select: dentro } }),
      {},
    );
    const entidade = await delegate.findUnique({ where: { id }, select });
    if (!entidade) throw new NotFoundException('Registo não encontrado');

    const valor = partes.reduce<any>((obj, parte) => obj?.[parte], entidade);
    return typeof valor === 'string' && valor.length > 0 ? valor : null;
  }
}

/** Identificadores de doente no caminho e na query, sem repetições. */
function doentesReferidos(req: any): string[] {
  const valores: unknown[] = [req.params?.doenteId];
  const daQuery = req.query?.doenteId;
  // `?doenteId=a&doenteId=b` chega como array: verificam-se todos, não só o primeiro.
  if (Array.isArray(daQuery)) valores.push(...daQuery);
  else valores.push(daQuery);

  return [
    ...new Set(valores.filter((v): v is string => typeof v === 'string' && v.length > 0)),
  ];
}

/** `doenteId` (ou lista `doenteIds`) no corpo do pedido. */
function doentesNoCorpo(req: any): string[] {
  const corpo = req.body;
  if (!corpo || typeof corpo !== 'object') return [];
  const valores: unknown[] = [corpo.doenteId];
  if (Array.isArray(corpo.doenteIds)) valores.push(...corpo.doenteIds);
  return valores.filter((v): v is string => typeof v === 'string' && v.length > 0);
}
