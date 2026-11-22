import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { TenantContextService } from '../prisma/tenant-context.service';
import { filtroPesquisaNome } from '../prisma/encryption.middleware';
import { visaoAdministrativa } from './visao-administrativa';
import { filtroHorarioTurnoAtivo } from '../common/turno-em-curso';

/** Papéis que só veem, na lista, os doentes que lhes estão atribuídos no turno. */
export const PAPEIS_LISTA_RESTRITA = ['enfermeiro', 'medico', 'auxiliar', 'chefe_turno', 'chefe_enfermeiros', 'chefe_medicos'];
/** Papéis que, na lista, só recebem a identificação e o internamento (QA-11). */
const PAPEIS_SO_IDENTIFICACAO = ['administrativo', 'ti'];
const MAX_TERMO = 100;

export interface OpcoesListagem { page?: number; limit?: number; search?: string }

/**
 * PERF-05 — a listagem (e a pesquisa) de doentes, no servidor.
 *
 * Antes a pesquisa nunca chegava aqui: o controlador não lia `search`, por isso a web filtrava
 * só a página que tinha (25 doentes) e as listas de seleção ficavam truncadas. Agora:
 *  - papéis de supervisão (ou `todos=true` autorizado) pesquisam por nome, processo e diagnóstico;
 *  - administrativo e TI pesquisam por nome e processo e recebem só a visão administrativa;
 *  - clínicos pesquisam os seus doentes do turno por nome, processo e diagnóstico, e encontram os
 *    restantes internados só pelo nome ou processo, com a identificação e a cama
 *    (`atribuido: false`) — o necessário para abrir a ficha e pedir acesso, nada clínico.
 */
@Injectable()
export class ListagemDoentesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenantContext: TenantContextService,
  ) {}

  async listar(utilizadorId: string, role: string, { page = 1, limit = 25, search }: OpcoesListagem = {}) {
    const limitSeguro = Math.min(Math.max(limit, 1), 100);
    const pagina = Math.max(1, page);
    const skip = (pagina - 1) * limitSeguro;
    const termo = (search ?? '').trim().slice(0, MAX_TERMO);

    // O nome está cifrado: pesquisa-se no índice cego (QA-05), não com `contains` sobre `nome`.
    const porNome = termo ? filtroPesquisaNome(termo) : null;
    const porProcesso = { numeroProcesso: { contains: termo, mode: 'insensitive' as const } };
    const porIdentificacao = { OR: [...(porNome ? [porNome] : []), porProcesso] };
    const porTermoClinico = { OR: [...porIdentificacao.OR, { diagnosticoPrincipal: { contains: termo, mode: 'insensitive' as const } }] };
    const base = { tenantId: this.tenantContext.tenantId, ativo: true };

    const pagina$ = async (where: any) => {
      // PERF-19: sem transacção — numa lista não é preciso consistência estrita entre página e total.
      const [data, total] = await Promise.all([
        this.prisma.doente.findMany({ where, include: { cama: true }, orderBy: { dataAdmissao: 'desc' }, take: limitSeguro, skip }),
        this.prisma.doente.count({ where }),
      ]);
      return { data: data as any[], total, page: pagina, limit: limitSeguro, totalPaginas: Math.ceil(total / limitSeguro) };
    };

    if (!PAPEIS_LISTA_RESTRITA.includes(role)) {
      const soIdentificacao = PAPEIS_SO_IDENTIFICACAO.includes(role);
      const filtro = termo ? (soIdentificacao ? porIdentificacao : porTermoClinico) : {};
      const r = await pagina$({ ...base, estadoRegisto: { not: 'pendente_cama' }, ...filtro });
      return soIdentificacao ? { ...r, data: r.data.map(visaoAdministrativa) } : r;
    }

    const meus = { atribuicoesHorario: { some: { utilizadorId, horarioTurno: filtroHorarioTurnoAtivo() } } };
    const where = termo
      ? { ...base, estadoRegisto: 'internado', OR: [{ AND: [meus, porTermoClinico] }, porIdentificacao] }
      : { ...base, estadoRegisto: 'internado', ...meus };
    const r = await pagina$(where);
    if (!termo) return { ...r, data: r.data.map((d) => ({ ...d, atribuido: true })) };

    const ids = r.data.map((d) => d.id);
    const atribuidos = ids.length
      ? new Set((await this.prisma.doente.findMany({ where: { id: { in: ids }, ...meus }, select: { id: true } })).map((d: any) => d.id))
      : new Set<string>();
    return {
      ...r,
      data: r.data.map((d) => (atribuidos.has(d.id) ? { ...d, atribuido: true } : { ...visaoAdministrativa(d), atribuido: false })),
    };
  }
}

/** UX-12: substituído por `turnoEmCurso` (common/turno-em-curso.ts), a regra única dos turnos. */
export { turnoEmCurso as turnoActual } from '../common/turno-em-curso';
