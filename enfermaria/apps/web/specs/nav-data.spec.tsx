import { destinoPorOmissao, filtrarMenus, itemQueGoverna, rotaPermitida, type UtilizadorNav } from '../src/app/(dashboard)/nav-data';

// Verifica o filtro de menus à granularidade papel × sub-papel × regime — a especificação
// acordada. Cada persona reflete um utilizador real da seed.
const hrefs = (u: UtilizadorNav) => filtrarMenus(u).map((i) => i.href);

describe('filtrarMenus — bloco administrativo por sub-papel', () => {
  it('Rececionista (front_desk) vê o administrativo de balcão, NÃO o de faturação/RH/compras nem clínico', () => {
    const v = hrefs({ role: 'administrativo', subRole: 'front_desk', servico: 'consultas_externas' });
    // Deve ver:
    expect(v).toContain('/doentes-admin');
    expect(v).toContain('/recepcao');
    expect(v).toContain('/registos-administrativos');
    expect(v).toContain('/consultas');
    // NÃO deve ver (o bug reportado):
    expect(v).not.toContain('/faturacao');
    expect(v).not.toContain('/rh');
    expect(v).not.toContain('/fornecedores');
    expect(v).not.toContain('/tabela-atos');
    expect(v).not.toContain('/relatorios-financeiros');
    expect(v).not.toContain('/dashboard-executivo');
    expect(v).not.toContain('/urgencia'); // estado clínico
  });

  it('Faturação (billing_officer) vê faturação, não RH nem fornecedores', () => {
    const v = hrefs({ role: 'administrativo', subRole: 'billing_officer', servico: 'internamento' });
    expect(v).toContain('/faturacao');
    expect(v).toContain('/tabela-atos');
    expect(v).toContain('/relatorios-financeiros');
    expect(v).toContain('/doentes-admin');
    expect(v).not.toContain('/rh');
    expect(v).not.toContain('/fornecedores');
  });

  it('RH (hr_specialist) vê RH e nenhum dado de doente', () => {
    const v = hrefs({ role: 'administrativo', subRole: 'hr_specialist', servico: 'internamento' });
    expect(v).toContain('/rh');
    expect(v).not.toContain('/faturacao');
    expect(v).not.toContain('/doentes-admin');
    expect(v).not.toContain('/urgencia');
  });

  it('Compras (procurement) vê fornecedores/catálogo, não faturação nem RH', () => {
    const v = hrefs({ role: 'administrativo', subRole: 'procurement', servico: 'internamento' });
    expect(v).toContain('/fornecedores');
    expect(v).toContain('/catalogo');
    expect(v).not.toContain('/faturacao');
    expect(v).not.toContain('/rh');
  });

  it('NENHUM sub-papel administrativo vê a Urgência clínica', () => {
    for (const subRole of ['front_desk', 'secretariado', 'scheduling', 'backoffice', 'billing_officer', 'hr_specialist', 'procurement']) {
      const v = hrefs({ role: 'administrativo', subRole, servico: 'urgencia' });
      expect(v).not.toContain('/urgencia');
    }
  });
});

describe('filtrarMenus — Direção não é bloqueada pelo âmbito de sub-papel', () => {
  it('Direção continua a ver RH/relatórios/executivo e Conectores Externos', () => {
    const v = hrefs({ role: 'direcao', subRole: 'ceo_hospitalar', servico: 'internamento' });
    expect(v).toContain('/rh');
    expect(v).toContain('/relatorios-financeiros');
    expect(v).toContain('/tabela-atos');
    expect(v).toContain('/dashboard-executivo');
    expect(v).toContain('/sistemas-externos'); // antes bloqueado pelo AND com it_admin
    // Nota: /faturacao é, por decisão pré-existente, exclusivo do administrativo billing_officer
    // (nunca esteve nos roles da Direção). Fora do âmbito desta alteração.
    expect(v).not.toContain('/faturacao');
  });
});

describe('filtrarMenus — correção do AND global de sub-papel (Guidelines/Conectores/Config)', () => {
  it('Médico vê Guidelines Clínicas (antes bloqueado por it_admin)', () => {
    const v = hrefs({ role: 'medico', subRole: 'clinico_geral', servico: 'internamento' });
    expect(v).toContain('/guidelines');
  });

  it('TI sem it_admin NÃO vê consolas de administração; TI it_admin vê', () => {
    const semAdmin = hrefs({ role: 'ti', subRole: 'security_officer', servico: 'internamento' });
    expect(semAdmin).not.toContain('/configuracoes');
    expect(semAdmin).not.toContain('/utilizadores');
    expect(semAdmin).not.toContain('/sistemas-externos');
    expect(semAdmin).toContain('/pedidos-ti');
    expect(semAdmin).toContain('/auditoria');

    const admin = hrefs({ role: 'ti', subRole: 'it_admin', servico: 'internamento' });
    expect(admin).toContain('/configuracoes');
    expect(admin).toContain('/utilizadores');
    expect(admin).toContain('/sistemas-externos');
  });
});

describe('filtrarMenus — papéis-fantasma corrigidos via sub-papel', () => {
  it('Supervisor de enfermagem vê Risco Clínico e IA Insights; enfermeiro comum não', () => {
    const sup = hrefs({ role: 'enfermeiro', subRole: 'supervisor_enfermagem', servico: 'internamento' });
    expect(sup).toContain('/risco-clinico');
    expect(sup).toContain('/dashboard-qualidade/ia-insights');

    const comum = hrefs({ role: 'enfermeiro', subRole: 'generalista', servico: 'internamento' });
    expect(comum).not.toContain('/risco-clinico');
    expect(comum).not.toContain('/dashboard-qualidade/ia-insights');
  });
});

describe('filtrarMenus — regime de trabalho (serviço)', () => {
  it('Médico em Urgência vê a Urgência; em Internamento não (é gated por serviço)', () => {
    expect(hrefs({ role: 'medico', subRole: 'clinico_geral', servico: 'urgencia' })).toContain('/urgencia');
    expect(hrefs({ role: 'medico', subRole: 'clinico_geral', servico: 'internamento' })).not.toContain('/urgencia');
  });
});


// ── Camada 2 do controlo de acessos: a guarda de rota (FE-15) ──────────────────────────
// Antes, esconder o menu era a única defesa no cliente: escrever o URL alcançava tudo.

const ENFERMEIRO: UtilizadorNav = { role: 'enfermeiro', subRole: 'generalista', servico: 'internamento' };
const DIRECAO: UtilizadorNav = { role: 'direcao', subRole: null, servico: 'internamento' };
const TI_ADMIN: UtilizadorNav = { role: 'ti', subRole: 'it_admin', servico: 'internamento' };
const RECECAO: UtilizadorNav = { role: 'administrativo', subRole: 'front_desk', servico: 'consultas_externas' };

describe('rotaPermitida — as fugas reportadas ficam fechadas', () => {
  it('enfermeiro não alcança /dashboard-executivo, /auditoria nem /rh por URL directo', () => {
    expect(rotaPermitida('/dashboard-executivo', ENFERMEIRO)).toBe(false);
    expect(rotaPermitida('/auditoria', ENFERMEIRO)).toBe(false);
    expect(rotaPermitida('/rh', ENFERMEIRO)).toBe(false);
  });

  it('sub-rotas herdam a permissão do item que as governa (/rh/pessoal, /rh/avaliacoes)', () => {
    expect(itemQueGoverna('/rh/pessoal')?.href).toBe('/rh');
    expect(rotaPermitida('/rh/pessoal', ENFERMEIRO)).toBe(false);
    expect(rotaPermitida('/rh/avaliacoes', ENFERMEIRO)).toBe(false);
    expect(rotaPermitida('/rh/pessoal', { role: 'administrativo', subRole: 'hr_specialist', servico: 'internamento' })).toBe(true);
  });

  it('a correspondência é por segmento — /doentes-admin não herda de /doentes', () => {
    expect(itemQueGoverna('/doentes-admin')?.href).toBe('/doentes-admin');
    expect(itemQueGoverna('/doentes-admin/abc')?.href).toBe('/doentes-admin');
    expect(rotaPermitida('/doentes-admin', ENFERMEIRO)).toBe(false);
    expect(rotaPermitida('/doentes/abc/consentimentos', ENFERMEIRO)).toBe(true);
  });

  it('ganha o prefixo mais longo quando há entradas aninhadas mais estreitas', () => {
    expect(itemQueGoverna('/dashboard-qualidade/ia-insights')?.href).toBe('/dashboard-qualidade/ia-insights');
    expect(rotaPermitida('/dashboard-qualidade/ia-insights', ENFERMEIRO)).toBe(false);
    expect(rotaPermitida('/dashboard-qualidade/ia-insights', { role: 'enfermeiro', subRole: 'supervisor_enfermagem', servico: 'internamento' })).toBe(true);
  });

  it('quem tem o papel continua a entrar', () => {
    expect(rotaPermitida('/dashboard-executivo', DIRECAO)).toBe(true);
    expect(rotaPermitida('/auditoria', TI_ADMIN)).toBe(true);
    expect(rotaPermitida('/utilizadores', TI_ADMIN)).toBe(true);
    expect(rotaPermitida('/recepcao', RECECAO)).toBe(true);
  });

  it('o sub-papel errado dentro do papel certo não passa', () => {
    expect(rotaPermitida('/faturacao', RECECAO)).toBe(false);
    expect(rotaPermitida('/utilizadores', { role: 'ti', subRole: 'suporte_n1', servico: 'internamento' })).toBe(false);
  });
});

describe('rotaPermitida — alinhamento com o RolesGuard da API', () => {
  it('o regime de trabalho filtra o menu mas NÃO fecha a rota (a API não conhece serviço)', () => {
    const medicoInternamento: UtilizadorNav = { role: 'medico', subRole: 'clinico_geral', servico: 'internamento' };
    expect(filtrarMenus(medicoInternamento).map((i) => i.href)).not.toContain('/urgencia');
    expect(rotaPermitida('/urgencia', medicoInternamento)).toBe(true);
  });

  it('as rotas universais do shell nunca são recusadas', () => {
    for (const u of [ENFERMEIRO, DIRECAO, TI_ADMIN, RECECAO]) {
      expect(rotaPermitida('/dashboard', u)).toBe(true);
      expect(rotaPermitida('/perfil', u)).toBe(true);
      expect(rotaPermitida('/notificacoes', u)).toBe(true);
    }
  });
});

describe('destinoPorOmissao — não pode haver ciclo de redirecção', () => {
  it('devolve um destino que o próprio utilizador tem permissão para abrir', () => {
    for (const u of [ENFERMEIRO, DIRECAO, TI_ADMIN, RECECAO, { role: 'operacional', subRole: null, servico: 'internamento' }, { role: 'qualidade', subRole: null, servico: 'internamento' }]) {
      const destino = destinoPorOmissao(u as UtilizadorNav);
      expect(rotaPermitida(destino, u as UtilizadorNav)).toBe(true);
    }
  });
});
