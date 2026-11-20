/**
 * SEC-20 — exportação dos dados do titular (art.º 15.º e 20.º RGPD), completa.
 *
 * A exportação do portal levava só a medicação ativa, os sinais vitais dos últimos 30 dias, a
 * lista de documentos e o último plano de alta — e cada tabela nova ficava de fora até alguém se
 * lembrar dela. Aqui percorre-se o modelo de dados: todos os modelos com `doenteId` (mais o próprio
 * `Doente`) entram, e fica de fora apenas o que não é dado do titular ou é segredo técnico:
 *  - campos de autenticação e de pesquisa (hashes, tokens, índices cegos);
 *  - modelos que são credenciais ou mensagens técnicas em bruto.
 * Os acessos ao processo (quem consultou) vão à parte, em `acessos`.
 */

/** Modelos com `doenteId` que NÃO são dados do titular para exportar (credenciais, tráfego técnico). */
export const MODELOS_EXCLUIDOS = new Set([
  'PortalDoente', // credenciais do portal (hash da password, tokens)
  'Hl7Mensagem', // mensagens HL7 em bruto, de/para o HIS
  'AcessoLeitura', // vai em `acessos`, no formato do titular (sem IP nem rota)
  'AuditLog',
]);

/** Campos técnicos/secretos retirados de qualquer linha. */
const CAMPO_EXCLUIDO = /(hash|token|segredo|secret|password|busca$|^tenantId$)/i;

export interface ModeloRuntime { fields?: { name: string; kind: string; type: string }[] }

/** Modelos com uma coluna escalar `doenteId`, por ordem alfabética (estável). */
export function modelosDoTitular(modelos: Record<string, ModeloRuntime>): string[] {
  return Object.entries(modelos)
    .filter(([nome, def]) => !MODELOS_EXCLUIDOS.has(nome) && (def.fields ?? []).some((f) => f.name === 'doenteId' && f.kind === 'scalar'))
    .map(([nome]) => nome)
    .sort();
}

export function limparLinha<T extends Record<string, unknown>>(linha: T): Partial<T> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(linha ?? {})) if (!CAMPO_EXCLUIDO.test(k)) out[k] = v;
  return out as Partial<T>;
}

const delegate = (modelo: string) => modelo[0].toLowerCase() + modelo.slice(1);

/**
 * Lê tudo o que é do titular. `prisma` é o PrismaService (decifra o que estiver cifrado).
 * Uma tabela que falhe não estraga a exportação: fica listada em `incompletas`.
 */
export async function recolherDadosDoTitular(prisma: any, doenteId: string) {
  const modelos: Record<string, ModeloRuntime> = prisma._runtimeDataModel?.models ?? {};
  const titular = await prisma.doente.findUnique({ where: { id: doenteId } });
  const dados: Record<string, unknown[]> = {};
  const incompletas: string[] = [];
  for (const modelo of modelosDoTitular(modelos)) {
    const d = prisma[delegate(modelo)];
    if (!d?.findMany) continue;
    try {
      const linhas: Record<string, unknown>[] = await d.findMany({ where: { doenteId } });
      if (linhas.length) dados[modelo] = linhas.map(limparLinha);
    } catch {
      incompletas.push(modelo);
    }
  }
  return { titular: titular ? limparLinha(titular) : null, dados, incompletas };
}
