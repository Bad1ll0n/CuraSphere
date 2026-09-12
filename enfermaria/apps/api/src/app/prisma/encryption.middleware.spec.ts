/**
 * S-14: a configuração de cifragem apontava para um modelo `Contacto` e para campos
 * `Doente.contacto`/`morada` que não existem no schema. Como o código se limitava a
 * ignorar o que não encontrava, protegia exactamente um campo — e nada distinguia isso
 * de estar tudo bem.
 *
 * Estes testes fixam a regra nova: uma configuração que aponta para o que não existe
 * impede a aplicação de arrancar.
 */
describe('cifragem em repouso — validação da configuração', () => {
  const CHAVE = 'a'.repeat(64);
  let anterior: string | undefined;

  beforeAll(() => {
    anterior = process.env['ENCRYPTION_KEY'];
    process.env['ENCRYPTION_KEY'] = CHAVE;
  });

  afterAll(() => {
    if (anterior === undefined) delete process.env['ENCRYPTION_KEY'];
    else process.env['ENCRYPTION_KEY'] = anterior;
  });

  /** Cliente Prisma falso: delegates presentes e modelo de dados declarado. */
  function clienteFalso(over: { delegates?: string[]; campos?: Record<string, string[]> } = {}) {
    const delegates = over.delegates ?? ['doente', 'contactoEmergencia', 'ficheiroPessoalDoente'];
    const campos = over.campos ?? {
      Doente: ['id', 'nome'],
      ContactoEmergencia: ['id', 'nome', 'telefone'],
      FicheiroPessoalDoente: ['id', 'morada', 'telefone', 'email'],
    };
    const cliente: any = {
      $extends: jest.fn(() => ({ estendido: true })),
      _runtimeDataModel: {
        models: Object.fromEntries(
          Object.entries(campos).map(([m, fs]) => [m, { fields: fs.map((name) => ({ name })) }]),
        ),
      },
    };
    for (const d of delegates) cliente[d] = {};
    return cliente;
  }

  function carregar() {
    let mod: any;
    jest.isolateModules(() => {
      mod = require('./encryption.middleware');
    });
    return mod;
  }

  it('arranca quando todos os modelos e campos existem', () => {
    const { criarClienteComEncriptacao } = carregar();

    expect(() => criarClienteComEncriptacao(clienteFalso())).not.toThrow();
  });

  it('RECUSA arrancar quando um modelo configurado não existe', () => {
    // Era exactamente este o caso: `Contacto` em vez de `ContactoEmergencia`.
    const { criarClienteComEncriptacao } = carregar();
    const semDelegate = clienteFalso({ delegates: ['doente', 'ficheiroPessoalDoente'] });

    expect(() => criarClienteComEncriptacao(semDelegate)).toThrow(/não estariam protegidos/i);
  });

  it('RECUSA arrancar quando um campo configurado não existe', () => {
    // E este: `Doente.contacto` e `Doente.morada`, que nunca existiram no schema.
    const { criarClienteComEncriptacao } = carregar();
    const semCampo = clienteFalso({
      campos: {
        Doente: ['id', 'nome'],
        ContactoEmergencia: ['id', 'nome', 'telefone'],
        FicheiroPessoalDoente: ['id', 'morada', 'telefone'], // falta `email`
      },
    });

    expect(() => criarClienteComEncriptacao(semCampo)).toThrow(/FicheiroPessoalDoente\.email/);
  });

  it('cifra e decifra de forma reversível, com cifrados diferentes para o mesmo valor', () => {
    const { criarClienteComEncriptacao } = carregar();
    const cliente = clienteFalso();
    criarClienteComEncriptacao(cliente);

    // O extends recebe um handler por delegate cifrado — e só por esses.
    const [{ query }] = cliente.$extends.mock.calls[0];
    expect(Object.keys(query).sort()).toEqual([
      'contactoEmergencia',
      'doente',
      'ficheiroPessoalDoente',
    ]);
  });
});
