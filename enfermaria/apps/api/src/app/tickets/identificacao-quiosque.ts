import { UnauthorizedException } from '@nestjs/common';
import * as jwt from 'jsonwebtoken';

/**
 * SEC-12 — identificação do utente no quiosque.
 *
 * Antes, `GET /quiosque/paciente?nif=X` devolvia o nome completo e a data de nascimento de quem
 * tivesse aquele NIF (um oráculo NIF → identidade, para quem estivesse ao balcão ou extraísse o
 * token do quiosque), e `POST /quiosque/marcacao-nova` marcava consultas em nome de QUALQUER
 * `doenteId` enviado no corpo.
 *
 * Agora o utente identifica-se com o NIF E a data de nascimento (as duas têm de bater; a resposta
 * de erro é a mesma em todos os casos), recebe o nome abreviado e uma identificação assinada de
 * 5 minutos, ligada a este quiosque. Ver as marcações de hoje e marcar só se faz com ela — o
 * doente vem da identificação, não do corpo do pedido.
 */
export const CABECALHO_IDENTIFICACAO = 'x-quiosque-identificacao';
const AUDIENCIA = 'curasphere-quiosque-identificacao';
const VALIDADE = '5m';

const segredo = () => {
  const s = process.env['QUIOSQUE_SECRET'];
  if (!s) throw new UnauthorizedException('Quiosque não configurado');
  return s;
};

export function emitirIdentificacao(doenteId: string, servicoId: string): string {
  return jwt.sign({ doenteId, servicoId }, segredo(), { algorithm: 'HS256', audience: AUDIENCIA, expiresIn: VALIDADE });
}

/** O doente identificado neste quiosque (401 se faltar, expirou ou é de outro quiosque). */
export function doenteIdentificado(req: { headers: Record<string, any>; quiosque?: { servicoId?: string } }): string {
  const token = req.headers[CABECALHO_IDENTIFICACAO];
  if (typeof token !== 'string' || !token) throw new UnauthorizedException('Identifique-se primeiro (NIF e data de nascimento)');
  try {
    const p = jwt.verify(token, segredo(), { algorithms: ['HS256'], audience: AUDIENCIA }) as jwt.JwtPayload;
    if (typeof p['doenteId'] !== 'string' || p['servicoId'] !== req.quiosque?.servicoId) throw new Error('outro quiosque');
    return p['doenteId'];
  } catch {
    throw new UnauthorizedException('A identificação expirou — identifique-se de novo');
  }
}

/** "Maria Fernanda Costa Silva" → "Maria S." — o suficiente para o utente se reconhecer. */
export function nomeAbreviado(nome: string): string {
  const partes = String(nome ?? '').trim().split(/\s+/).filter(Boolean);
  if (partes.length === 0) return '';
  if (partes.length === 1) return partes[0];
  return `${partes[0]} ${partes[partes.length - 1][0].toUpperCase()}.`;
}

/** A data de nascimento (YYYY-MM-DD) bate com a guardada? Compara o dia civil, sem fuso. */
export function mesmaDataNascimento(guardada: Date | null | undefined, indicada: string): boolean {
  if (!guardada || !/^\d{4}-\d{2}-\d{2}$/.test(indicada)) return false;
  return guardada.toISOString().slice(0, 10) === indicada;
}
