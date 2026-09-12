/**
 * URL de um pedido, pronto para ir para os logs.
 *
 * O `redact` do pino actua sobre campos de objectos, não sobre o texto do URL — e há segredos
 * e dados pessoais que viajam no URL: o token do portal da família no caminho (é uma
 * credencial ao portador), o NIF e o código de marcação na query do quiosque, o `code` do
 * retorno OIDC. Guardar só o hash do token na base de dados de pouco servia se o token
 * ficasse em claro em cada linha do log de acessos.
 */
const PARAMETROS_SENSIVEIS = new Set([
  'nif',
  'numerosns',
  'codigo',
  'token',
  'code',
  'state',
  'email',
  'telefone',
]);

const CAMINHOS_COM_SEGREDO = [/(\/familia\/portal\/)[^/?#]+/i];

export function sanitizarUrlParaLog(url: string | undefined): string | undefined {
  if (!url) return url;

  const i = url.indexOf('?');
  let caminho = i === -1 ? url : url.slice(0, i);
  const query = i === -1 ? '' : url.slice(i + 1);

  for (const padrao of CAMINHOS_COM_SEGREDO) {
    caminho = caminho.replace(padrao, '$1[REDACTED]');
  }
  if (!query) return caminho;

  const querySegura = query
    .split('&')
    .map((par) => {
      const nome = par.split('=')[0];
      return PARAMETROS_SENSIVEIS.has(nome.toLowerCase()) ? `${nome}=[REDACTED]` : par;
    })
    .join('&');

  return `${caminho}?${querySegura}`;
}
