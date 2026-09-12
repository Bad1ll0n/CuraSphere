/**
 * Separação de domínios de token (SEC-01 / SEC-03).
 *
 * Antes desta separação os quatro tipos de token emitidos pela API — sessão de pessoal,
 * sessão do portal do doente, desafio de MFA e token de password expirada — eram assinados
 * com o MESMO segredo, `issuer` e `audience` ('curasphere-api' / 'curasphere'). Como a
 * `JwtStrategy` do pessoal só validava assinatura + iss/aud, qualquer um destes tokens
 * era aceite como sessão de pessoal:
 *
 *   - um doente autenticado no portal alcançava os 13 controladores que usam
 *     `@UseGuards(JwtAuthGuard)` sem `@Roles` (contactos, atribuições, escalas, …),
 *     lendo contactos de emergência e dados clínicos de OUTROS doentes;
 *   - quem tivesse apenas a password (mas não o 2.º factor) usava o `mfaChallengeToken`
 *     como token de sessão e contornava o MFA por completo.
 *
 * A separação faz-se em dois eixos, verificados de forma independente:
 *   1. `audience` distinta por tipo — a assinatura deixa de ser suficiente, o token tem de
 *      ter sido emitido PARA aquele consumidor (validado pelo `jsonwebtoken` na estratégia);
 *   2. claim `tipo` explícita — verificada no `validate()` da estratégia e filtrada por
 *      endpoint através de `@TiposToken()` + `JwtAuthGuard`.
 *
 * Regra para código novo: qualquer novo tipo de token declara aqui a sua audiência e o seu
 * `tipo`, e o ponto de consumo valida os DOIS. Nunca reutilizar a audiência do pessoal.
 */

export const JWT_ISSUER = 'curasphere-api';

/** Sessão completa de um funcionário (access token). */
export const AUD_PESSOAL = 'curasphere';
/** Sessão de um doente no portal. */
export const AUD_PORTAL = 'curasphere-portal';
/** Token intermédio: password correcta, 2.º factor por validar. */
export const AUD_MFA_CHALLENGE = 'curasphere-mfa-challenge';
/** Token intermédio: role clínico obrigado a configurar MFA antes de ter sessão. */
export const AUD_MFA_SETUP = 'curasphere-mfa-setup';
/**
 * Bilhete de handshake de websocket. Vida de segundos, finalidade única.
 *
 * O token de sessão do pessoal vive num cookie `httpOnly` e portanto NÃO é legível por
 * JavaScript — de propósito, é o que protege contra XSS. O socket.io precisa de passar
 * algo no handshake, e a saída errada seria expor o token de sessão ao browser.
 * Em vez disso o cliente troca o cookie por este bilhete: sai do servidor, vive um minuto,
 * e está FORA de `AUDIENCIAS_PESSOAL`, por isso não abre uma única rota HTTP.
 */
export const AUD_SOCKET = 'curasphere-socket';

/** Token intermédio: password expirada, só serve para a trocar. */
export const AUD_PASSWORD_EXPIRADA = 'curasphere-password-expirada';

export type TipoToken =
  | 'pessoal'
  | 'portal'
  | 'mfa_challenge'
  | 'mfa_setup'
  | 'password_expirada'
  | 'socket';

/**
 * Audiências que a estratégia JWT do pessoal aceita DESCODIFICAR. Note-se que aceitar
 * descodificar não é aceitar autorizar: o `JwtAuthGuard` filtra depois pelo `tipo` exacto
 * que cada endpoint declara em `@TiposToken()` (por omissão, apenas 'pessoal').
 *
 * `AUD_PORTAL` e `AUD_MFA_CHALLENGE` estão deliberadamente FORA desta lista — não existe
 * nenhum endpoint de pessoal que os deva aceitar, por isso são rejeitados logo na
 * verificação da assinatura/audiência, antes de qualquer lógica aplicacional.
 */
export const AUDIENCIAS_PESSOAL: string[] = [
  AUD_PESSOAL,
  AUD_MFA_SETUP,
  AUD_PASSWORD_EXPIRADA,
];
