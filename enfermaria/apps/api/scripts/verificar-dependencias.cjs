// OPS-16 — corre no build da imagem (apps/api/Dockerfile), depois da poda das ferramentas de
// build: carrega todas as dependências de produção e o cliente Prisma gerado. Falha o build se
// alguma deixar de carregar.
//
// `@prisma/client` (o ponto de entrada por omissão) não carrega de propósito: a app usa o cliente
// gerado em ./generated/prisma, que se verifica à parte.
const { dependencies } = require(process.cwd() + '/package.json');
const ESPERADAS = new Set(['@prisma/client']);
const falhas = [];
for (const dep of Object.keys(dependencies)) {
  if (dep.startsWith('@types/') || ESPERADAS.has(dep)) continue;
  try {
    require(require.resolve(dep, { paths: [process.cwd()] }));
  } catch (e) {
    if (e.code === 'ERR_PACKAGE_PATH_NOT_EXPORTED') continue; // pacote só com subcaminhos
    falhas.push(`${dep}: ${e.code ?? ''} ${String(e.message).split('\n')[0]}`);
  }
}
try {
  require(process.cwd() + '/generated/prisma');
} catch (e) {
  falhas.push(`generated/prisma: ${String(e.message).split('\n')[0]}`);
}
if (falhas.length) {
  console.error('Dependências de produção que não carregam:\n  ' + falhas.join('\n  '));
  process.exit(1);
}
console.log(`OPS-16: ${Object.keys(dependencies).length} dependências de produção verificadas.`);
