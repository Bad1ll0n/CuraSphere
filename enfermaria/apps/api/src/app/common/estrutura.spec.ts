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

  it('o interceptor lê o doente do caminho E da query', () => {
    const codigo = lerCodigo(join(RAIZ_APP, 'doentes', 'acesso-doente.interceptor.ts'));

    expect(codigo).toContain('params?.doenteId');
    expect(codigo).toContain('query?.doenteId');
    expect(codigo).toContain('assertAcessoDoente');
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
    const destinoVariavel = /\bfetch\s*\(\s*(?!['\"`]https?:\/\/)/;

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
