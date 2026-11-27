import { ServiceUnavailableException } from '@nestjs/common';
import { randomBytes } from 'crypto';
import * as jwt from 'jsonwebtoken';

/**
 * SEC-16 — teleconsulta.
 *
 * Antes: `meet.jit.si` público por omissão, sala `curasphere-<8 hex do id>` (32 bits,
 * adivinhável a partir do id) e sem autenticação. Quem soubesse ou adivinhasse o nome
 * entrava na consulta.
 *
 * Agora:
 *  - em produção só um servidor próprio (JITSI_SERVER, nunca meet.jit.si) com autenticação
 *    por token (JITSI_APP_ID + JITSI_APP_SECRET, plugin `token` do Prosody);
 *  - nome de sala aleatório de 128 bits, gerado em cada início;
 *  - cada participante recebe um JWT só para aquela sala, com validade curta. O médico é
 *    moderador e o doente não.
 * Em desenvolvimento, sem configuração, usa meet.jit.si sem token (com aviso).
 */
const PUBLICO = /(^|\.)jit\.si$/i;
const VALIDADE_TOKEN = '3h';

export interface ConfigJitsi { servidor: string; host: string; appId?: string; segredo?: string }

const producao = () => process.env['NODE_ENV'] === 'production';

/** Problema de configuração (para o arranque) ou null. Sem JITSI_SERVER a teleconsulta fica desligada. */
export function problemaConfigJitsi(): string | null {
  const servidor = process.env['JITSI_SERVER']?.trim();
  if (!servidor || !producao()) return null;
  let host: string;
  try { host = new URL(servidor).host; } catch { return `JITSI_SERVER inválido: ${servidor}`; }
  if (PUBLICO.test(host)) return 'JITSI_SERVER aponta para o Jitsi público (meet.jit.si) — proibido em produção (dados de saúde).';
  if (!process.env['JITSI_APP_ID'] || !process.env['JITSI_APP_SECRET']) {
    return 'JITSI_APP_ID e JITSI_APP_SECRET são obrigatórios em produção (salas autenticadas por token).';
  }
  return null;
}

export function configJitsi(): ConfigJitsi {
  const bruto = process.env['JITSI_SERVER']?.trim();
  if (!bruto) {
    if (producao()) throw new ServiceUnavailableException('Teleconsulta indisponível: servidor de vídeo não configurado (JITSI_SERVER).');
    return { servidor: 'https://meet.jit.si', host: 'meet.jit.si' };
  }
  const problema = problemaConfigJitsi();
  if (problema) throw new ServiceUnavailableException(`Teleconsulta indisponível: ${problema}`);
  const servidor = bruto.replace(/\/+$/, '');
  return {
    servidor,
    host: new URL(servidor).host,
    appId: process.env['JITSI_APP_ID'] || undefined,
    segredo: process.env['JITSI_APP_SECRET'] || undefined,
  };
}

/** 128 bits aleatórios; não deriva de nada conhecido. */
export function novaSalaJitsi(): string {
  return 'cs-' + randomBytes(16).toString('hex');
}

/** JWT do Jitsi (formato do plugin `token` do Prosody), limitado a uma sala. */
export function tokenJitsi(cfg: ConfigJitsi, sala: string, participante: { nome: string; moderador: boolean; id?: string }): string | undefined {
  if (!cfg.appId || !cfg.segredo) return undefined;
  return jwt.sign(
    {
      aud: 'jitsi',
      iss: cfg.appId,
      sub: cfg.host,
      room: sala,
      moderator: participante.moderador,
      context: { user: { id: participante.id, name: participante.nome, moderator: participante.moderador ? 'true' : 'false' } },
    },
    cfg.segredo,
    { algorithm: 'HS256', expiresIn: VALIDADE_TOKEN },
  );
}

export function dadosSala(cfg: ConfigJitsi, sala: string, token: string | undefined) {
  return {
    videoRoomId: sala,
    servidor: cfg.servidor,
    jwt: token ?? null,
    roomUrl: `${cfg.servidor}/${sala}${token ? `?jwt=${encodeURIComponent(token)}` : ''}`,
  };
}
