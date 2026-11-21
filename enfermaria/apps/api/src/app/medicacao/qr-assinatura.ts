import * as crypto from 'crypto';

/**
 * Assinatura (HMAC-SHA256) das etiquetas QR de medicação — sem ela o payload do QR era JSON
 * produzido pelo cliente e qualquer pessoa podia fabricar um. Em produção o segredo é próprio e
 * obrigatório (ARQ-20: MEDICACAO_QR_SECRET); fora dela cai no JWT_SECRET.
 */
function segredoQR(): string {
  const secret = process.env['MEDICACAO_QR_SECRET'] || process.env['JWT_SECRET'];
  if (!secret) throw new Error('MEDICACAO_QR_SECRET/JWT_SECRET não configurado');
  return secret;
}

export function assinarQR(corpo: string): string {
  return crypto.createHmac('sha256', segredoQR()).update(corpo).digest('base64url');
}
