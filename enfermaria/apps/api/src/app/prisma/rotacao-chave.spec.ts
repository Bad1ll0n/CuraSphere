import { recifrarLinha } from '../../prisma/rodar-chave-cifragem';

/**
 * OPS-20 — rotação da ENCRYPTION_KEY. O módulo de cifragem lê as chaves ao ser importado, por isso
 * cada cenário carrega-o isolado com o ambiente certo.
 */
const ANTIGA = 'a'.repeat(64);
const NOVA = 'b'.repeat(64);

function carregar(env: Record<string, string>) {
  const antes = { ...process.env };
  Object.assign(process.env, env);
  let m: any;
  jest.isolateModules(() => { m = require('./encryption.middleware'); });
  process.env = antes;
  return m;
}

describe('rotação da chave de cifragem (OPS-20)', () => {
  const antigo = carregar({ ENCRYPTION_KEY: ANTIGA, ENCRYPTION_KEYS_ANTERIORES: '' });
  const cifradoAntigo = antigo.cifrarSegredo('Zulmira Antunes');
  const indiceNifAntigo = antigo.indiceNif('123456789');
  const filtroNomeAntigo = antigo.filtroPesquisaNome('zulmira');

  it('sem a chave antiga, o valor antigo não se lê', () => {
    const so = carregar({ ENCRYPTION_KEY: NOVA, ENCRYPTION_KEYS_ANTERIORES: '' });
    expect(so.decifrarSegredo(cifradoAntigo)).toBe(cifradoAntigo);
  });

  it('com a antiga em ENCRYPTION_KEYS_ANTERIORES: lê o antigo, cifra com a nova', () => {
    const m = carregar({ ENCRYPTION_KEY: NOVA, ENCRYPTION_KEYS_ANTERIORES: ANTIGA });
    expect(m.decifrarSegredo(cifradoAntigo)).toBe('Zulmira Antunes');
    const novo = m.cifrarSegredo('Outro');
    expect(carregar({ ENCRYPTION_KEY: NOVA, ENCRYPTION_KEYS_ANTERIORES: '' }).decifrarSegredo(novo)).toBe('Outro');
    expect(m.claroSeChaveAntiga(cifradoAntigo)).toBe('Zulmira Antunes');
    expect(m.claroSeChaveAntiga(novo)).toBeNull(); // já está com a atual
    expect(m.claroSeChaveAntiga('em claro')).toBeNull();
  });

  it('durante a rotação, a pesquisa por nome e NIF procura também nos índices antigos', () => {
    const m = carregar({ ENCRYPTION_KEY: NOVA, ENCRYPTION_KEYS_ANTERIORES: ANTIGA });
    const nome = m.filtroPesquisaNome('zulmira');
    expect(nome.OR).toHaveLength(2);
    expect(nome.OR).toContainEqual(filtroNomeAntigo);
    expect(m.filtroNif('123456789').nifBusca.in).toContain(indiceNifAntigo);
  });

  it('o script recifra só o que está com a chave antiga, e recalcula os índices', () => {
    const m = carregar({ ENCRYPTION_KEY: NOVA, ENCRYPTION_KEYS_ANTERIORES: ANTIGA });
    const patch = recifrarLinha('doente', { id: 'd1', nome: cifradoAntigo }, m)!;
    expect(m.claroSeChaveAntiga(patch['nome'])).toBeNull();
    expect(m.decifrarSegredo(patch['nome'] as string)).toBe('Zulmira Antunes');
    expect(patch['nomeBusca']).toBe(m.tokensDeBuscaNome('Zulmira Antunes'));
    const nif = recifrarLinha('ficheiroPessoalDoente', { id: 'f1', nif: antigo.cifrarSegredo('123456789'), morada: m.cifrarSegredo('Rua') }, m)!;
    expect(Object.keys(nif).sort()).toEqual(['nif', 'nifBusca']);
    expect(nif['nifBusca']).toBe(m.indiceNif('123456789'));
    expect(recifrarLinha('doente', { id: 'd2', nome: m.cifrarSegredo('Já nova') }, m)).toBeNull();
  });
});
