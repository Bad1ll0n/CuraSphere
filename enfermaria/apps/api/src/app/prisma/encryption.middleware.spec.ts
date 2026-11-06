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

  /** Cliente falso com relações: Medicacao → doente (Doente) → contactos (ContactoEmergencia). */
  function clienteComRelacoes() {
    const cliente = clienteFalso();
    const m = cliente._runtimeDataModel.models;
    m.Doente.fields.push({ name: 'contactos', kind: 'object', type: 'ContactoEmergencia' });
    m.Medicacao = { fields: [{ name: 'id' }, { name: 'doente', kind: 'object', type: 'Doente' }, { name: 'prescritoPor', kind: 'object', type: 'Utilizador' }] };
    m.Utilizador = { fields: [{ name: 'id' }, { name: 'nome' }] };
    return cliente;
  }

  function handlerDe(cliente: any) {
    const [{ query }] = cliente.$extends.mock.calls[0];
    return query.$allModels.$allOperations as (p: any) => Promise<any>;
  }

  it('um só handler para todos os modelos', () => {
    const { criarClienteComEncriptacao } = carregar();
    const cliente = clienteFalso();
    criarClienteComEncriptacao(cliente);

    const [{ query }] = cliente.$extends.mock.calls[0];
    expect(Object.keys(query)).toEqual(['$allModels']);
  });

  it('cifra ContactoEmergencia e FicheiroPessoalDoente ao escrever (ARQ-01/QA-03)', async () => {
    const { criarClienteComEncriptacao } = carregar();
    const cliente = clienteFalso();
    criarClienteComEncriptacao(cliente);
    const handler = handlerDe(cliente);

    let gravado: any;
    await handler({
      model: 'ContactoEmergencia', operation: 'create',
      args: { data: { nome: 'Maria Silva', telefone: '910000000', relacao: 'filha' } },
      query: async (a: any) => { gravado = { ...a.data }; return a.data; },
    });
    expect(gravado.nome).toMatch(/^enc:/);
    expect(gravado.telefone).toMatch(/^enc:/);
    expect(gravado.relacao).toBe('filha');

    await handler({
      model: 'FicheiroPessoalDoente', operation: 'upsert',
      args: { where: { doenteId: 'd1' }, create: { morada: 'Rua A' }, update: { email: 'a@b.pt' } },
      query: async (a: any) => { gravado = a; return {}; },
    });
    expect(gravado.create.morada).toMatch(/^enc:/);
    expect(gravado.update.email).toMatch(/^enc:/);
  });

  it('não volta a cifrar um valor já cifrado', async () => {
    const { criarClienteComEncriptacao } = carregar();
    const cliente = clienteFalso();
    criarClienteComEncriptacao(cliente);
    const handler = handlerDe(cliente);

    let primeiro = '';
    await handler({ model: 'ContactoEmergencia', operation: 'update', args: { data: { nome: 'X' } },
      query: async (a: any) => { primeiro = a.data.nome; return {}; } });
    let segundo = '';
    await handler({ model: 'ContactoEmergencia', operation: 'update', args: { data: { nome: primeiro } },
      query: async (a: any) => { segundo = a.data.nome; return {}; } });
    expect(segundo).toBe(primeiro);
  });

  it('decifra campos cifrados que chegam por relações (QA-04)', async () => {
    const { criarClienteComEncriptacao } = carregar();
    const cliente = clienteComRelacoes();
    criarClienteComEncriptacao(cliente);
    const handler = handlerDe(cliente);

    // Obter cifrados reais pelo próprio handler.
    let nomeCifrado = '';
    await handler({ model: 'Doente', operation: 'create', args: { data: { nome: 'Zulmira Teste' } },
      query: async (a: any) => { nomeCifrado = a.data.nome; return {}; } });
    let contactoCifrado = '';
    await handler({ model: 'ContactoEmergencia', operation: 'create', args: { data: { nome: 'João' } },
      query: async (a: any) => { contactoCifrado = a.data.nome; return {}; } });

    const resultado = await handler({
      model: 'Medicacao', operation: 'findMany', args: {},
      query: async () => [{
        id: 'm1',
        doente: { nome: nomeCifrado, contactos: [{ nome: contactoCifrado }] },
        prescritoPor: { nome: 'enc:nao-e-pii-de-doente' },
      }],
    });
    expect(resultado[0].doente.nome).toBe('Zulmira Teste');
    expect(resultado[0].doente.contactos[0].nome).toBe('João');
    // Utilizador não tem campos cifrados: não se toca.
    expect(resultado[0].prescritoPor.nome).toBe('enc:nao-e-pii-de-doente');
  });

  describe('índice cego do nome (QA-05)', () => {
    it('o doente gravado fica com tokens de busca, e o nome cifrado', async () => {
      const { criarClienteComEncriptacao } = carregar();
      const cliente = clienteFalso();
      criarClienteComEncriptacao(cliente);
      const handler = handlerDe(cliente);

      let gravado: any;
      await handler({ model: 'Doente', operation: 'create', args: { data: { nome: 'Zulmira Conceição' } },
        query: async (a: any) => { gravado = a.data; return {}; } });
      expect(gravado.nome).toMatch(/^enc:/);
      expect(gravado.nomeBusca).toMatch(/^ ([0-9a-f]{16} )+$/);
      expect(gravado.nomeBusca).not.toMatch(/zulmira/i);
    });

    it('encontra por palavra, por prefixo e sem acentos; não encontra o que não está no nome', () => {
      const { tokensDeBuscaNome, filtroPesquisaNome } = carregar();
      const indice: string = tokensDeBuscaNome('Zulmira Conceição Teste');
      const encontra = (pesquisa: string) =>
        (filtroPesquisaNome(pesquisa).AND as any[]).every((c) => indice.includes(c.nomeBusca.contains));

      expect(encontra('Zulmira')).toBe(true);
      expect(encontra('zulm')).toBe(true);
      expect(encontra('conceicao')).toBe(true);
      expect(encontra('Zulmira Teste')).toBe(true);
      expect(encontra('Zulmira Silva')).toBe(false);
      expect(encontra('ulmira')).toBe(false); // só prefixos, não substrings no meio
    });
  });
});
