import { createPrivateKey, createPublicKey, sign, verify } from 'node:crypto';
import type { JwtModuleOptions } from '@nestjs/jwt';
import { JWT_ISSUER } from './token-audiences';

/**
 * SEC-11 — assinatura dos tokens com um par de chaves (ES256) em vez de um segredo partilhado.
 *
 * Com HS256 o mesmo `JWT_SECRET` assina e verifica, e o contentor web tinha-o (o middleware do
 * Next verifica o cookie de sessão): quem comprometesse o web podia FORJAR uma sessão de
 * qualquer pessoa, com qualquer papel. Com ES256 a API assina com a chave privada
 * (`JWT_PRIVATE_KEY`) e o web só recebe a pública (`JWT_PUBLIC_KEY`) — verifica, não assina.
 *
 * Em produção o par é obrigatório. Fora dela, sem chaves, mantém-se o HS256 com `JWT_SECRET`
 * (desenvolvimento e testes). As chaves aceitam-se em PEM, com quebras de linha reais ou `\n`.
 *
 *   openssl ecparam -name prime256v1 -genkey -noout | openssl pkcs8 -topk8 -nocrypt -out jwt-privada.pem
 *   openssl ec -in jwt-privada.pem -pubout -out jwt-publica.pem
 */
export type AlgoritmoJwt = 'ES256' | 'HS256';

export interface ChavesJwt {
  algoritmo: AlgoritmoJwt;
  /** Chave privada (ES256) ou segredo (HS256) — só a API a tem. */
  assinatura: string;
  /** Chave pública (ES256) ou o mesmo segredo (HS256). */
  verificacao: string;
}

const pem = (v: string | undefined) => v?.trim().replace(/\\n/g, '\n') || undefined;

export function chavesJwt(env: NodeJS.ProcessEnv = process.env): ChavesJwt {
  const privada = pem(env['JWT_PRIVATE_KEY']);
  const publica = pem(env['JWT_PUBLIC_KEY']);
  if (privada || publica) {
    if (!privada || !publica) throw new Error('SEGURANÇA: JWT_PRIVATE_KEY e JWT_PUBLIC_KEY definem-se juntas');
    validarPar(privada, publica);
    return { algoritmo: 'ES256', assinatura: privada, verificacao: publica };
  }
  if (env['NODE_ENV'] === 'production') {
    throw new Error('SEGURANÇA: em produção os tokens são assinados com ES256 — defina JWT_PRIVATE_KEY e JWT_PUBLIC_KEY (o web só recebe a pública).');
  }
  const segredo = env['JWT_SECRET'];
  if (!segredo) throw new Error('SEGURANÇA: JWT_SECRET não configurado');
  return { algoritmo: 'HS256', assinatura: segredo, verificacao: segredo };
}

/** O par tem de ser EC P-256 e as duas metades têm de corresponder (assina e verifica um teste). */
function validarPar(privada: string, publica: string): void {
  let kPriv, kPub;
  try {
    kPriv = createPrivateKey(privada);
    kPub = createPublicKey(publica);
  } catch {
    throw new Error('SEGURANÇA: JWT_PRIVATE_KEY/JWT_PUBLIC_KEY não são chaves PEM válidas');
  }
  if (kPriv.asymmetricKeyType !== 'ec' || kPriv.asymmetricKeyDetails?.namedCurve !== 'prime256v1') {
    throw new Error('SEGURANÇA: a chave dos tokens tem de ser EC P-256 (prime256v1), para ES256');
  }
  const amostra = Buffer.from('curasphere-jwt');
  if (!verify('sha256', amostra, kPub, sign('sha256', amostra, kPriv))) {
    throw new Error('SEGURANÇA: JWT_PUBLIC_KEY não corresponde a JWT_PRIVATE_KEY');
  }
}

/** Opções do JwtModule (assinatura e verificação) para o algoritmo em uso. */
export function opcoesModuloJwt(expiresIn: string, audience = 'curasphere', env: NodeJS.ProcessEnv = process.env): JwtModuleOptions {
  const c = chavesJwt(env);
  const chaves = c.algoritmo === 'ES256' ? { privateKey: c.assinatura, publicKey: c.verificacao } : { secret: c.assinatura };
  return {
    ...chaves,
    signOptions: { expiresIn: expiresIn as any, algorithm: c.algoritmo, issuer: JWT_ISSUER, audience },
    verifyOptions: { algorithms: [c.algoritmo], issuer: JWT_ISSUER, audience },
  };
}
