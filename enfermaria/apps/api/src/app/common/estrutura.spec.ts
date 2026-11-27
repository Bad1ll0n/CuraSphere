import { readdirSync, readFileSync, statSync } from 'fs';
import { join, relative } from 'path';

/**
 * Testes estruturais.
 *
 * A auditoria de 2026-09 concluiu que quase todos os defeitos encontrados — o IDOR entre
 * doentes que já foi corrigido três vezes, o `ssrf-guard` aplicado num de três sítios, o
 * `RoleGuard` numa de 81 rotas, os endpoints cujo `@Body()` não era validado — têm a
 * mesma forma: *uma invariante aplicada à mão em muitos sítios, sem nada que verifique
 * que continua a valer em todos*.
 *
 * Mais testes por exemplo não resolvem isso: um teste por exemplo prova que UM caminho
 * está certo. O que faltava era enumerar e falhar no que escapa.
 *
 * As linhas de base abaixo são **dívida declarada**, não permissão. Só podem encolher: se
 * um ficheiro da lista deixar de precisar de lá estar, o teste falha a exigir a remoção —
 * é o que impede uma lista de excepções de apodrecer e passar a esconder o problema.
 */

const RAIZ_APP = join(__dirname, '..');

function ficheiros(dir: string, sufixo: string): string[] {
  const encontrados: string[] = [];
  for (const entrada of readdirSync(dir)) {
    const caminho = join(dir, entrada);
    if (statSync(caminho).isDirectory()) {
      encontrados.push(...ficheiros(caminho, sufixo));
    } else if (entrada.endsWith(sufixo)) {
      encontrados.push(caminho);
    }
  }
  return encontrados;
}

const caminhoRelativo = (f: string) => relative(RAIZ_APP, f).replace(/\\/g, '/');
const ler = (f: string) => readFileSync(f, 'utf8');

/**
 * Código sem comentários.
 *
 * Sem isto, estes testes falham em ficheiros JÁ corrigidos, porque os comentários que
 * explicam o defeito antigo contêm o próprio padrão que se procura. Um teste estrutural
 * com falsos positivos é pior do que não existir: ensina a equipa a ignorá-lo.
 */
const lerCodigo = (f: string) =>
  ler(f)
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/(^|[^:])\/\/.*$/gm, '$1');

const controladores = ficheiros(RAIZ_APP, '.controller.ts').filter((f) => !f.endsWith('.spec.ts'));

/* ------------------------------------------------------------------ *
 * 1. Acesso ao doente (SEC-04 / QA-04 / S-01)
 * ------------------------------------------------------------------ */

/**
 * Até aqui esta secção guardava uma lista de 18 controladores sem verificação de acesso,
 * como dívida declarada. A dívida foi paga de outra forma: em vez de acrescentar a chamada
 * a cada um, a verificação passou a ser global (`AcessoDoenteInterceptor`). O que importa
 * garantir agora é que esse mecanismo continua ligado e que ninguém o contorna mudando o
 * nome do parâmetro.
 *
 * Fica deliberadamente de fora o `doenteId` no CORPO do pedido — ver o comentário do
 * interceptor. Esse é o risco residual conhecido desta secção.
 */
describe('estrutura — acesso a dados de um doente', () => {
  const porDoente = controladores.filter((f) => lerCodigo(f).includes(':doenteId'));

  it('há controladores por doente para verificar (a busca não ficou vazia por engano)', () => {
    expect(porDoente.length).toBeGreaterThan(20);
  });

  it('a verificação de acesso ao doente está registada como interceptor GLOBAL', () => {
    const modulo = lerCodigo(join(RAIZ_APP, 'doentes', 'doentes.module.ts'));

    expect(modulo).toMatch(/provide:\s*APP_INTERCEPTOR,\s*useClass:\s*AcessoDoenteInterceptor/);
  });

  it('o interceptor lê o doente do caminho, da query, do corpo e de entidades clínicas', () => {
    const codigo = lerCodigo(join(RAIZ_APP, 'doentes', 'acesso-doente.interceptor.ts'));

    expect(codigo).toContain('params?.doenteId');
    expect(codigo).toContain('query?.doenteId');
    expect(codigo).toContain('doentesNoCorpo(req)');
    expect(codigo).toContain('ACESSO_DOENTE_POR');
    expect(codigo).toContain('assertAcessoDoente');
  });

  /**
   * QA-01/02/12 (revisão de 2026-11): `/medicacao/:id/administrar`, `/alergias/:id` e
   * `/contactos/:id` identificavam a entidade e não o doente, e passavam sem verificação.
   * Nestes controladores clínicos, cada parâmetro de rota que identifica uma entidade tem de
   * estar coberto por `@AcessoDoentePor` com esse parâmetro (na classe ou no método).
   */
  const CLINICOS_POR_ENTIDADE = [
    'alergias/alergias.controller.ts',
    'balanco-hidrico/balanco-hidrico.controller.ts',
    'bloco/bloco.controller.ts',
    'consentimentos/consentimentos.controller.ts',
    'contactos/contactos.controller.ts',
    'dispositivos-invasivos/dispositivos-invasivos.controller.ts',
    'documentos-saude/documentos-saude.controller.ts',
    'especialidades/especialidades.controller.ts',
    'exames/exames.controller.ts',
    'feridas/feridas.controller.ts',
    'fisioterapia/fisioterapia.controller.ts',
    'maternidade/maternidade.controller.ts',
    'medicacao/medicacao.controller.ts',
    'notas-clinicas/notas-clinicas.controller.ts',
    'oncologia/oncologia.controller.ts',
    'protocolos/protocolos.controller.ts',
    'reconciliacao-medicacao/reconciliacao-medicacao.controller.ts',
    'sepsis/sepsis.controller.ts',
    'sinalizacoes/sinalizacoes.controller.ts',
    'tarefas/tarefas.controller.ts',
    'transfusao/transfusao.controller.ts',
  ];

  /**
   * Entidades clínicas cujo acesso NÃO se faz por atribuição de internamento — dívida
   * declarada até haver um modelo de acesso próprio (episódio, ver PROD-02):
   *  - consultas: o médico de ambulatório não tem atribuição ao doente;
   *  - interconsultas e radiologia: quem responde/relata é de outro serviço;
   *  - alertas: o SOS é difundido ao serviço; acusar a receção não é acesso ao processo;
   *  - urgência e IACS: atuam antes de qualquer atribuição ou sobre o hospital inteiro.
   */
  const POR_ENTIDADE_SEM_REGIME = [
    'alertas/alertas.controller.ts',
    'consultas/consultas.controller.ts',
    'iacs/iacs.controller.ts',
    'interconsultas/interconsultas.controller.ts',
    'radiologia/radiologia.controller.ts',
    'urgencia/urgencia.controller.ts',
  ];

  /**
   * Parâmetros subordinados a outro já verificado na mesma rota: o serviço recusa (404) se
   * a entidade não pertencer à do parâmetro verificado.
   */
  const PARAMETROS_SUBORDINADOS: Record<string, string[]> = {
    // analisarFoto: `foto.avaliacaoId !== avaliacaoId` → 404; a avaliação é verificada.
    'feridas/feridas.controller.ts': ['fotoId'],
  };

  const parametroDe = (args: string) => {
    const partes = args.split(',').map((p) => p.trim().replace(/^'|'$/g, ''));
    return partes[1] || 'id';
  };

  it('nos controladores clínicos, toda a rota por id de entidade declara @AcessoDoentePor', () => {
    const infratores: string[] = [];
    for (const rel of CLINICOS_POR_ENTIDADE) {
      const linhas = lerCodigo(join(RAIZ_APP, rel)).split('\n');
      const iControlador = linhas.findIndex((l) => l.trim().startsWith('@Controller('));
      const daClasse = linhas
        .slice(0, iControlador)
        .map((l) => l.match(/@AcessoDoentePor\(([^)]*)\)/))
        .filter(Boolean)
        .map((m) => parametroDe(m![1]));

      linhas.forEach((linha, i) => {
        const rota = linha.match(/@(Get|Post|Patch|Put|Delete)\(\s*'([^']*)'/);
        if (!rota || i < iControlador) return;
        const parametros = [...rota[2].matchAll(/:(\w+)/g)].map((m) => m[1]).filter((p) => p !== 'doenteId');
        // Os decorators de um método ficam nas linhas imediatamente acima (bloco contíguo).
        const doMetodo: string[] = [];
        for (let k = i - 1; k >= 0 && linhas[k].trim().startsWith('@'); k--) {
          const m = linhas[k].match(/@AcessoDoentePor\(([^)]*)\)/);
          if (m) doMetodo.push(parametroDe(m[1]));
        }
        for (const p of parametros) {
          const subordinado = (PARAMETROS_SUBORDINADOS[rel] ?? []).includes(p) && doMetodo.length > 0;
          if (!daClasse.includes(p) && !doMetodo.includes(p) && !subordinado) {
            infratores.push(`${rel}:${i + 1} ${rota[1]} '${rota[2]}' (:${p})`);
          }
        }
      });
    }

    expect(infratores).toEqual([]);
  });

  it('a lista de controladores sem regime por entidade só encolhe', () => {
    const jaComRegime = POR_ENTIDADE_SEM_REGIME.filter((rel) =>
      lerCodigo(join(RAIZ_APP, rel)).includes('@AcessoDoentePor('),
    );

    expect(jaComRegime).toEqual([]);
  });

  it('as isenções da verificação do doente no corpo são as declaradas', () => {
    // Cada isenção é uma decisão de segurança: uma nova tem de aparecer aqui em revisão.
    const isencoes = controladores
      .flatMap((f) => (lerCodigo(f).match(/@AcessoDoenteIsento\(/g) ?? []).map(() => caminhoRelativo(f)))
      .sort();

    expect(isencoes).toEqual([
      'atribuicoes/atribuicoes.controller.ts',
      'bloco/bloco.controller.ts',
      'break-glass/break-glass.controller.ts',
      'eventos-adversos/eventos-adversos.controller.ts',
      'fisioterapia/fisioterapia.controller.ts',
      'turnos/turnos.controller.ts',
      'urgencia/urgencia.controller.ts',
      'urgencia/urgencia.controller.ts',
      'urgencia/urgencia.controller.ts',
    ]);
  });

  it('nenhuma rota usa outro nome de parâmetro para o doente, fugindo ao interceptor', () => {
    // O interceptor procura `doenteId`. Uma rota com `:pacienteId` ou `:utenteId` escaparia
    // em silêncio — é exactamente a forma dos defeitos que esta secção existe para impedir.
    const nomesAlternativos = /@(Get|Post|Patch|Put|Delete)\(\s*'[^']*:(pacienteId|idDoente|doente_id|patientId|utenteId)\b/;

    const infratores = controladores
      .filter((f) => nomesAlternativos.test(lerCodigo(f)))
      .map(caminhoRelativo)
      .sort();

    expect(infratores).toEqual([]);
  });

  it('nenhuma rota identifica o doente como `:id`', () => {
    // `doente/:id` tem o mesmo URL que `doente/:doenteId`, mas o interceptor procura
    // `doenteId`. Havia sete rotas assim, e seis liam ou escreviam dados de qualquer doente
    // sem verificação nenhuma — entre elas a exportação FHIR completa e os documentos de saúde.
    const doenteComoId = /@(Get|Post|Patch|Put|Delete|Sse)\(\s*'[^']*doentes?\/:id\b/;

    const infratores = controladores
      .filter((f) => doenteComoId.test(lerCodigo(f)))
      .map(caminhoRelativo)
      .sort();

    expect(infratores).toEqual([]);
  });
});

/* ------------------------------------------------------------------ *
 * 2. Autenticação por controlador
 * ------------------------------------------------------------------ */

/**
 * Controladores deliberadamente sem autenticação. Cada entrada é uma decisão, não um
 * esquecimento — e é isso que esta lista torna visível em revisão de código.
 */
const PUBLICOS_POR_DESENHO = [
  'app.controller.ts', // health, métricas e csrf-token
  'auth/auth.controller.ts', // login, refresh: são a porta de entrada
  'portal-doente/portal-doente.controller.ts', // tem o seu próprio PortalJwtGuard
  'tickets/quiosque.controller.ts', // tem o seu próprio QuiosqueGuard
  'common/csp-report.controller.ts', // recebe relatórios de CSP enviados pelo browser
  'triagem-portal/triagem-portal.controller.ts', // orientador de sintomas: sem PHI, sem estado, throttle apertado
];

describe('estrutura — autenticação', () => {
  it('todo o controlador exige um guard, ou está declarado como público', () => {
    const semGuard = controladores
      .filter((f) => !/@UseGuards\(/.test(lerCodigo(f)))
      .map(caminhoRelativo)
      .filter((f) => !PUBLICOS_POR_DESENHO.includes(f))
      .sort();

    expect(semGuard).toEqual([]);
  });
});

/* ------------------------------------------------------------------ *
 * 3. Validação de corpo em runtime (BE-01)
 * ------------------------------------------------------------------ */

/**
 * `@Body()` anotado com um tipo TypeScript inline — `@Body() dto: { nome: string }` — faz
 * o Nest emitir o metatype `Object`, e a `ValidationPipe` global não valida nada. O tipo
 * dá uma falsa sensação de segurança: existe na compilação e desaparece em execução.
 * A forma correcta é sempre uma classe DTO com decoradores do class-validator.
 */
const CORPO_CRU_POR_DESENHO = [
  'hl7/hl7.controller.ts', // recebe uma mensagem HL7 em texto
  'fhir/fhir.controller.ts', // recebe um recurso FHIR arbitrário
  'common/csp-report.controller.ts', // o corpo é definido pelo browser, não por nós
  'auth/sso/sso.controller.ts', // callback SAML: o corpo vem do fornecedor de identidade
];

describe('estrutura — validação de corpo', () => {
  it('nenhum @Body() usa um tipo inline em vez de uma classe DTO', () => {
    // Apanha `@Body() x: { ... }` e `@Body() x: Partial<...>`, que desactivam a pipe.
    const inline = /@Body\(\s*\)\s*\w+\s*:\s*(\{|Partial<|Record<)/;

    const infratores = controladores
      .filter((f) => inline.test(lerCodigo(f)))
      .map(caminhoRelativo)
      .filter((f) => !CORPO_CRU_POR_DESENHO.includes(f))
      .sort();

    expect(infratores).toEqual([]);
  });
});

/* ------------------------------------------------------------------ *
 * 4. Saídas de rede com destino do utilizador (SEC-05)
 * ------------------------------------------------------------------ */

describe('estrutura — pedidos de saída', () => {
  it('todo o serviço ou controlador que faz fetch valida o destino contra endereços internos', () => {
    // Varria só `.service.ts` — e o `fetch` do callback OIDC, que vive num controlador,
    // escapava-lhe sem timeout nem guarda. Uma regra que só olha para metade dos sítios
    // repete o defeito que existe para impedir.
    const servicos = [
      ...ficheiros(RAIZ_APP, '.service.ts'),
      ...ficheiros(RAIZ_APP, '.controller.ts'),
    ].filter((f) => !f.endsWith('.spec.ts'));

    // Só interessa o `fetch` cujo destino NÃO é um literal do próprio código: um URL
    // fixo (a API de push do Expo, por exemplo) não é uma primitiva de SSRF. O que é
    // perigoso é o destino vir de um registo que um utilizador criou.
    const destinoVariavel = /\bfetch\s*\(\s*(?!['"`]https?:\/\/)/;

    const semGuarda = servicos
      .filter((f) => destinoVariavel.test(lerCodigo(f)))
      .filter((f) => !lerCodigo(f).includes('assertUrlDestinoPublico'))
      .map(caminhoRelativo)
      .sort();

    expect(semGuarda).toEqual([]);
  });
});

/* ------------------------------------------------------------------ *
 * 4b. Difusão em tempo real (S-09)
 * ------------------------------------------------------------------ */

describe('estrutura — difusão em tempo real', () => {
  const fontes = ficheiros(RAIZ_APP, '.ts').filter((f) => !f.endsWith('.spec.ts'));

  it('ninguém emite para o namespace inteiro do websocket', () => {
    // `server.emit(...)` sem sala chega a TODOS os sockets ligados, de qualquer papel. Era
    // assim que o alerta de sépsis, com o nome do doente, chegava a qualquer sessão aberta.
    const semSala = /\bserver\s*\??\.\s*emit\s*\(/;

    const infratores = fontes
      .filter((f) => semSala.test(lerCodigo(f)))
      .map(caminhoRelativo)
      .sort();

    expect(infratores).toEqual([]);
  });

  it('só o gateway emite para salas partilhadas (geral, papel, serviço)', () => {
    // Nestas salas está gente sem relação com o doente. É o gateway que decide o que cada
    // uma pode receber; um serviço que lá emita directamente contorna essa decisão. A sala
    // `doente:` fica fora da regra: só lá entra quem passou a verificação de acesso.
    const salaPartilhada = /\.to\(\s*\[?\s*['"`](geral|role:|servico:)/;

    const infratores = fontes
      .filter((f) => caminhoRelativo(f) !== 'gateway/events.gateway.ts')
      .filter((f) => salaPartilhada.test(lerCodigo(f)))
      .map(caminhoRelativo)
      .sort();

    expect(infratores).toEqual([]);
  });

  it('as duas regras apanham de facto o que dizem apanhar', () => {
    // Uma regra estrutural que nunca dispara é indistinguível de uma regra partida — foi
    // assim que um carácter invisível desligou em silêncio a regra de SSRF deste ficheiro.
    const semSala = /\bserver\s*\??\.\s*emit\s*\(/;
    const salaPartilhada = /\.to\(\s*\[?\s*['"`](geral|role:|servico:)/;

    expect(semSala.test("this.gateway.server?.emit('sos:alerta', {})")).toBe(true);
    expect(semSala.test("this.server.to('doente:1').emit('x', {})")).toBe(false);
    expect(salaPartilhada.test("gateway.server.to('role:medico').emit('x')")).toBe(true);
    expect(salaPartilhada.test("server.to(['role:medico', 'role:enfermeiro'])")).toBe(true);
    expect(salaPartilhada.test('server.to(`doente:${id}`)')).toBe(false);
  });
});

/* ------------------------------------------------------------------ *
 * 4c. Aleatoriedade (S-02 / S-13)
 * ------------------------------------------------------------------ */

/**
 * O mesmo defeito apareceu duas vezes: nomes de anexos e códigos de marcação gerados com
 * `Math.random()`, que não é criptográfico — o estado do gerador reconstrói-se a partir de
 * alguns valores observados. Identificadores e segredos saem de `crypto`.
 */
const MATH_RANDOM_POR_DESENHO = [
  'sns-pem/pem-client.ts', // cliente de sandbox: números de receita fictícios, sem valor de segredo
];

describe('estrutura — aleatoriedade', () => {
  const usaMathRandom = (f: string) => /\bMath\.random\s*\(/.test(lerCodigo(f));

  it('nenhum código da aplicação usa Math.random', () => {
    const infratores = ficheiros(RAIZ_APP, '.ts')
      .filter((f) => !f.endsWith('.spec.ts'))
      .filter(usaMathRandom)
      .map(caminhoRelativo)
      .filter((f) => !MATH_RANDOM_POR_DESENHO.includes(f))
      .sort();

    expect(infratores).toEqual([]);
  });

  it('a lista só encolhe — remover daqui quem já não usa Math.random', () => {
    const jaResolvidos = MATH_RANDOM_POR_DESENHO.filter((f) => !usaMathRandom(join(RAIZ_APP, f)));

    expect(jaResolvidos).toEqual([]);
  });
});

/* ------------------------------------------------------------------ *
 * 5. Fronteiras de dia (BE-03)
 * ------------------------------------------------------------------ */

describe('estrutura — fronteiras de dia', () => {
  it('ninguém deriva uma chave de dia a partir de toISOString()', () => {
    // `toISOString().split('T')[0]` sobre uma data construída em hora local devolve o dia
    // errado sempre que o fuso do hospital não é UTC. Usar `chaveDiaClinico`.
    const fontes = ficheiros(RAIZ_APP, '.ts').filter(
      (f) => !f.endsWith('.spec.ts') && !f.includes('dia-clinico'),
    );

    const infratores = fontes
      .filter((f) => /toISOString\(\)\s*\.split\('T'\)\[0\]/.test(lerCodigo(f)))
      .map(caminhoRelativo)
      .sort();

    expect(infratores).toEqual([]);
  });
});

/* ------------------------------------------------------------------ *
 * 6. Soft-delete coerente (BE-04)
 * ------------------------------------------------------------------ */

/**
 * Modelos que hoje carregam DUAS convenções de remoção lógica ao mesmo tempo: `ativo`
 * (usada, viva) e `deletedAt` (coluna + índices criados, mas que nenhum código escreve).
 *
 * É uma armadilha adormecida, não um bug activo: como `deletedAt` está sempre nulo, as
 * consultas que só filtram `ativo` devolvem hoje o resultado certo. No dia em que alguém
 * implementar a escrita — a coluna e os índices convidam a isso — as consultas que ficaram
 * a filtrar só `ativo` passam a mostrar registos removidos, e as que filtram só `deletedAt`
 * passam a mostrar registos inactivos. Em `Medicacao`, isso é medicação de um doente a
 * aparecer ou desaparecer da lista de administração do turno.
 *
 * A resolução é escolher UMA convenção por modelo e apagar a outra do schema. Enquanto
 * isso não acontecer, esta lista impede que a armadilha se espalhe a modelos novos.
 */
const DUAS_CONVENCOES_DE_REMOCAO = ['Doente', 'Medicacao'];

/* ------------------------------------------------------------------ *
 * Cifragem de dados pessoais (ARQ-01 / QA-03 / QA-05)
 * ------------------------------------------------------------------ */

describe('estrutura — cifragem de dados pessoais', () => {
  it('o PrismaService troca TODOS os delegates pelo cliente cifrado, gerados do próprio cliente', () => {
    // A versão anterior trocava à mão `doente` e `contacto` — e `contacto` não existia, por
    // isso contactos de emergência e fichas pessoais eram gravados em claro.
    const codigo = lerCodigo(join(RAIZ_APP, 'prisma', 'prisma.service.ts'));

    expect(codigo).toContain('delegatesDoCliente(this)');
    expect(codigo).not.toMatch(/\(this as any\)\.(doente|contacto\w*|ficheiroPessoal\w*)\s*=/);
  });

  it('nenhum serviço filtra o nome de um doente com contains — o nome está cifrado', () => {
    // `nome: { contains }` sobre `Doente` nunca encontra nada (QA-05). Usa-se o índice cego,
    // `filtroPesquisaNome`. Os outros modelos com `nome` (equipamentos, etc.) não são cifrados.
    const infratores = ficheiros(RAIZ_APP, '.service.ts')
      .filter((f) => !f.endsWith('.spec.ts'))
      .filter((f) => /prisma\.doente\.|tx\.doente\./.test(lerCodigo(f)))
      .filter((f) => /\bnome:\s*\{\s*contains/.test(lerCodigo(f)))
      .map(caminhoRelativo);

    expect(infratores).toEqual([]);
  });
});

describe('estrutura — soft-delete', () => {
  const schema = readFileSync(join(RAIZ_APP, '..', '..', 'prisma', 'schema.prisma'), 'utf8');

  const comAmbas = [...schema.matchAll(/model (\w+) \{([^]*?)\n\}/g)]
    .filter((m) => /\n\s+ativo\s+Boolean/.test(m[2]) && m[2].includes('deletedAt'))
    .map((m) => m[1])
    .sort();

  it('nenhum modelo NOVO nasce com duas convenções de remoção', () => {
    const novos = comAmbas.filter((m) => !DUAS_CONVENCOES_DE_REMOCAO.includes(m));

    expect(novos).toEqual([]);
  });

  it('a lista só encolhe — remover daqui quem já tiver uma convenção só', () => {
    const jaResolvidos = DUAS_CONVENCOES_DE_REMOCAO.filter((m) => !comAmbas.includes(m));

    expect(jaResolvidos).toEqual([]);
  });

  it('nenhuma leitura de alergias inclui as removidas (QA-02)', () => {
    // Uma alergia removida que ainda conte (ou uma ativa que deixe de contar) muda o que o
    // médico vê ao prescrever. Toda a leitura filtra `deletedAt: null`.
    const infratores: string[] = [];
    for (const f of ficheiros(RAIZ_APP, '.service.ts').filter((x) => !x.endsWith('.spec.ts'))) {
      const linhas = lerCodigo(f).split('\n');
      linhas.forEach((linha, i) => {
        const leitura = /\.alergia\.(findMany|findFirst|count)\(/.test(linha) || /\balergias:\s*(true|\{)/.test(linha);
        if (!leitura) return;
        const janela = linhas.slice(i, i + 3).join(' ');
        if (!janela.includes('deletedAt: null')) infratores.push(caminhoRelativo(f) + ':' + (i + 1));
      });
    }

    expect(infratores).toEqual([]);
  });

  it('nas consultas de Medicacao as duas colunas andam sempre juntas', () => {
    // O caminho clínico mais perigoso da armadilha, e o único que a auditoria apanhou:
    // metade das consultas de medicação filtrava só `ativo`, incluindo a lista de
    // administração do turno e a verificação de interacções medicamentosas.
    const infratores: string[] = [];

    for (const f of ficheiros(RAIZ_APP, '.service.ts').filter((x) => !x.endsWith('.spec.ts'))) {
      const linhas = lerCodigo(f).split('\n');
      linhas.forEach((linha, i) => {
        if (!/(prisma|tx)\.medicacao\.(findMany|findFirst|count)/.test(linha)) return;
        // Um `ativo` dentro de uma relação (`doente: { ativo: true }`) é de OUTRO
        // modelo e não conta para esta regra.
        // A janela fecha na consulta SEGUINTE, senão apanha o `where` de outra query —
        // foi o que fez esta regra acusar um `doente.count` que estava três linhas abaixo.
        const seguintes = [];
        for (let k = i; k < Math.min(i + 4, linhas.length); k++) {
          if (k > i && /(prisma|tx)\.\w+\.(findMany|findFirst|findUnique|count|create|update)/.test(linhas[k])) break;
          seguintes.push(linhas[k]);
        }
        const janela = seguintes.join(' ').replace(/doente:\s*\{[^}]*\}/g, '');
        if (/\bativo:\s*true\b/.test(janela) && !janela.includes('deletedAt')) {
          infratores.push(caminhoRelativo(f) + ':' + (i + 1));
        }
      });
    }

    expect(infratores).toEqual([]);
  });
});

describe('estrutura — assinaturas clínicas e carta de alta', () => {
  // O otplib v13 deixou de exportar `authenticator`: quem o usasse assinava sempre com erro
  // 500. As assinaturas passam todas por `verificarTotpAssinatura` (anti-replay durável).
  it('ninguém usa o `authenticator` do otplib (removido na v13)', () => {
    const infratores = ficheiros(RAIZ_APP, '.ts')
      .filter((f) => !f.endsWith('.spec.ts'))
      .filter((f) => /\bauthenticator\s*\.\s*(verify|check|generate)\b/.test(lerCodigo(f)))
      .map(caminhoRelativo);
    expect(infratores).toEqual([]);
  });

  // PROD-11: o PDF da carta só existe depois de revista e assinada por um médico.
  it('o PDF da carta de alta passa por garantirAssinada', () => {
    const controller = ler(join(RAIZ_APP, 'doentes', 'doentes.controller.ts'));
    const rota = controller.slice(controller.indexOf("@Get(':id/carta-alta/pdf')"));
    const corpo = rota.slice(0, rota.indexOf('\n  }'));
    expect(corpo).toContain('garantirAssinada(');
  });

  // PROD-11: a IA escreve um rascunho — sem medicação inventada e sem assinar pelo produto.
  it('o prompt da carta de alta não pede medicação nem assina pelo produto', () => {
    const servico = ler(join(RAIZ_APP, 'ai-clinico', 'ai-clinico.service.ts'));
    const inicio = servico.indexOf('async gerarCartaAlta(');
    const metodo = servico.slice(inicio, servico.indexOf('\n  }\n', inicio));
    expect(metodo).not.toMatch(/medicação de saída \(com doses/);
    expect(metodo).not.toMatch(/Assina como/);
    expect(metodo).toContain("cartaAltaEstado: 'rascunho'");
  });
});

describe('estrutura — registos clínicos não se apagam (ARQ-04)', () => {
  // Modelos clínicos com remoção lógica (`deletedAt` + `removidoPorId` + `motivoRemocao`).
  const MODELOS = ['balancoHidrico', 'documentoSaude', 'notaTurno', 'fotoFerida', 'contactoEmergencia', 'alergia'];
  // Nomes das relações que os leem por `include`/`select`.
  const RELACOES = ['balancosHidricos', 'documentosSaude', 'notasTurno', 'fotos', 'contactosEmergencia', 'alergias'];

  it('nenhum destes modelos é apagado fisicamente', () => {
    const infratores: string[] = [];
    for (const f of ficheiros(RAIZ_APP, '.ts').filter((x) => !x.endsWith('.spec.ts'))) {
      const codigo = lerCodigo(f);
      for (const m of MODELOS) {
        if (new RegExp(`\\.${m}\\.(delete|deleteMany)\\(`).test(codigo)) infratores.push(`${caminhoRelativo(f)} → ${m}`);
      }
    }
    expect(infratores).toEqual([]);
  });

  it('todas as leituras filtram os removidos (deletedAt: null)', () => {
    const infratores: string[] = [];
    const leituraDirecta = new RegExp(`\\.(${MODELOS.join('|')})\\.(findMany|findFirst|count|aggregate|groupBy)\\(`);
    const leituraRelacao = new RegExp(`\\b(${RELACOES.join('|')}):\\s*(true|\\{)`);
    for (const f of ficheiros(RAIZ_APP, '.service.ts').filter((x) => !x.endsWith('.spec.ts'))) {
      const linhas = lerCodigo(f).split('\n');
      linhas.forEach((linha, i) => {
        if (!leituraDirecta.test(linha) && !leituraRelacao.test(linha)) return;
        const janela = linhas.slice(i, i + 4).join(' ');
        if (!janela.includes('deletedAt: null')) infratores.push(`${caminhoRelativo(f)}:${i + 1}`);
      });
    }
    expect(infratores).toEqual([]);
  });
});

describe('estrutura — cascatas no schema (ARQ-03)', () => {
  // Apagar um utilizador ou um doente não pode levar histórico clínico atrás. Só os
  // dados que pertencem à própria conta/sessão podem ir em cascata.
  const CASCADE_PERMITIDO = new Set([
    'PresencaOnline.utilizador', 'DispositivoToken.utilizador', 'NotificacaoInApp.utilizador',
    'RefreshToken.utilizador', 'DashboardConfig.utilizador', 'WebAuthnCredential.utilizador',
    'PortalDoente.doente',
  ]);

  it('nenhuma relação com Utilizador ou Doente apaga em cascata, fora da lista', () => {
    const schema = readFileSync(join(RAIZ_APP, '..', '..', 'prisma', 'schema.prisma'), 'utf8');
    const infratores: string[] = [];
    let modelo = '';
    for (const linha of schema.split(/\r?\n/)) {
      const m = /^model (\w+) \{/.exec(linha);
      if (m) { modelo = m[1]; continue; }
      const r = /^\s+(\w+)\s+(Utilizador|Doente)\??\s+@relation\(([^)]*)\)/.exec(linha);
      if (r && /onDelete:\s*Cascade/.test(r[3]) && !CASCADE_PERMITIDO.has(`${modelo}.${r[1]}`)) {
        infratores.push(`${modelo}.${r[1]}`);
      }
    }
    expect(infratores).toEqual([]);
  });
});
