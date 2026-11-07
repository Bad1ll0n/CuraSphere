import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { Prisma } from '../../generated/prisma';

/**
 * PROD-02 — regras do episódio de internamento, partilhadas pela admissão, alta, pedido de
 * cama, transferência e reinternamento. Recebem o cliente da transacção: abrir/fechar um
 * episódio acontece SEMPRE na mesma transacção que muda a cama e o doente.
 */
type Tx = Prisma.TransactionClient;

export type OrigemEpisodio = 'admissao' | 'registo' | 'urgencia' | 'reinternamento' | 'pedido_cama';

export function episodioAtivo(tx: Tx, doenteId: string) {
  return tx.episodioInternamento.findFirst({ where: { doenteId, estado: 'ativo' }, orderBy: { numero: 'desc' } });
}

/** O episódio em curso ou, se o doente já teve alta, o último. */
export async function episodioAtualOuUltimo(tx: Tx, doenteId: string) {
  // Só pode haver um activo, e é sempre o de número mais alto; o último fechado vem a seguir.
  return tx.episodioInternamento.findFirst({ where: { doenteId }, orderBy: { numero: 'desc' } });
}

export async function abrirEpisodio(tx: Tx, dados: {
  doenteId: string;
  origem: OrigemEpisodio;
  camaId?: string | null;
  servico?: string | null;
  diagnosticoPrincipal?: string | null;
  icd10Code?: string | null;
  criadoPorId?: string | null;
  episodioUrgenciaId?: string | null;
  pedidoCamaId?: string | null;
  alergiasRevistas?: boolean;
}) {
  const ativo = await episodioAtivo(tx, dados.doenteId);
  if (ativo) throw new ConflictException(`O doente já tem um internamento em curso (episódio n.º ${ativo.numero}).`);
  const ultimo = await tx.episodioInternamento.findFirst({
    where: { doenteId: dados.doenteId }, orderBy: { numero: 'desc' }, select: { numero: true },
  });
  const agora = new Date();
  const episodio = await tx.episodioInternamento.create({
    data: {
      doenteId: dados.doenteId,
      numero: (ultimo?.numero ?? 0) + 1,
      origem: dados.origem,
      camaId: dados.camaId ?? null,
      servico: dados.servico ?? null,
      diagnosticoPrincipal: dados.diagnosticoPrincipal ?? null,
      icd10Code: dados.icd10Code ?? null,
      criadoPorId: dados.criadoPorId ?? null,
      episodioUrgenciaId: dados.episodioUrgenciaId ?? null,
      pedidoCamaId: dados.pedidoCamaId ?? null,
      dataAdmissao: agora,
      // Um primeiro internamento não tem alergias "de antes" por rever.
      ...(dados.alergiasRevistas !== false && { alergiasRevistasEm: agora, alergiasRevistasPorId: dados.criadoPorId ?? null }),
    },
  });
  await tx.planoAlta.create({ data: { doenteId: dados.doenteId, episodioId: episodio.id } });
  return episodio;
}

/** Fecha o episódio em curso; se não houver (registo antigo), cria-o já fechado. */
export async function fecharEpisodio(tx: Tx, doenteId: string, dados: { motivoAlta?: string | null; destinoAlta?: string | null; criadoPorId?: string | null }) {
  const agora = new Date();
  const ativo = await episodioAtivo(tx, doenteId);
  if (ativo) {
    return tx.episodioInternamento.update({
      where: { id: ativo.id },
      data: { estado: 'alta', dataAlta: agora, motivoAlta: dados.motivoAlta ?? null, destinoAlta: dados.destinoAlta ?? null },
    });
  }
  const doente = await tx.doente.findUnique({ where: { id: doenteId }, select: { dataAdmissao: true, diagnosticoPrincipal: true } });
  if (!doente) throw new NotFoundException(`Doente (ID ${doenteId}) não encontrado`);
  const aberto = await abrirEpisodio(tx, { doenteId, origem: 'registo', diagnosticoPrincipal: doente.diagnosticoPrincipal, criadoPorId: dados.criadoPorId });
  return tx.episodioInternamento.update({
    where: { id: aberto.id },
    data: { estado: 'alta', dataAdmissao: doente.dataAdmissao, dataAlta: agora, motivoAlta: dados.motivoAlta ?? null, destinoAlta: dados.destinoAlta ?? null },
  });
}

/**
 * Ocupa uma cama de forma atómica (só se estiver livre, ou reservada para este pedido).
 * Devolve a cama. Lança 404/400 com mensagens claras.
 */
export async function ocuparCama(tx: Tx, camaId: string, pedidoCamaId?: string | null) {
  // Reservada sem pedido (reserva manual), ou com a reserva expirada, conta como disponível.
  const livreParaTodos: Prisma.CamaWhereInput[] = [
    { estado: 'livre' },
    { estado: 'reservada', reservadaPedidoId: null },
    { estado: 'reservada', reservadaAte: { lt: new Date() } },
  ];
  const condicao: Prisma.CamaWhereInput = {
    id: camaId,
    OR: pedidoCamaId ? [...livreParaTodos, { estado: 'reservada', reservadaPedidoId: pedidoCamaId }] : livreParaTodos,
  };
  const r = await tx.cama.updateMany({ where: condicao, data: { estado: 'ocupada', reservadaPedidoId: null, reservadaAte: null } });
  if (r.count !== 1) {
    const existe = await tx.cama.findUnique({ where: { id: camaId }, select: { estado: true, reservadaPedidoId: true } });
    if (!existe) throw new NotFoundException(`Cama (ID ${camaId}) não encontrada`);
    if (existe.estado === 'reservada') throw new BadRequestException('A cama está reservada para outro pedido');
    throw new BadRequestException('Cama não está disponível');
  }
  return tx.cama.findUniqueOrThrow({ where: { id: camaId } });
}

/**
 * PROD-03 — compatibilidade doente/cama. Devolve os problemas (vazio = compatível):
 * sexo da enfermaria e necessidade de isolamento.
 */
export function problemasCompatibilidade(
  cama: { sexo: string | null; isolamento: boolean },
  doente: { sexo?: string | null; emIsolamento?: boolean | null },
): string[] {
  const p: string[] = [];
  if (cama.sexo && doente.sexo && doente.sexo !== 'indeterminado' && cama.sexo !== doente.sexo) {
    p.push(`a cama é de enfermaria ${cama.sexo === 'feminino' ? 'feminina' : 'masculina'}`);
  }
  if (doente.emIsolamento && !cama.isolamento) p.push('o doente está em isolamento e o quarto não tem condições de isolamento');
  return p;
}

/** Recusa (409) se houver problemas, salvo justificação explícita (≥ 10 caracteres). */
export function exigirCompatibilidade(problemas: string[], justificacao?: string | null) {
  if (!problemas.length) return null;
  if (justificacao && justificacao.trim().length >= 10) return justificacao.trim();
  throw new ConflictException(`CAMA_INCOMPATIVEL: ${problemas.join('; ')}. Escolha outra cama ou justifique a excepção.`);
}
