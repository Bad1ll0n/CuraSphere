/**
 * ARQ-24 — a matriz de permissões por funcionalidade, numa só fonte.
 *
 * Estava em três sítios que divergiam: o menu da web (nav-data.tsx, que também alimenta a guarda
 * de rota), o menu "Mais" do mobile (regras escritas à mão, item a item) e as constantes de papéis
 * repetidas no App do mobile. Agora web e mobile lêem daqui: as constantes de papéis, a regra de
 * cada rota (papel, sub-papel por papel, exclusões) e a função que a avalia.
 *
 * Quem decide de facto é a API (@Roles em cada endpoint) — isto decide o que se MOSTRA e que rotas
 * da web se abrem, e segue a API: não se mostra o que a API recusa, e mostra-se a quem a API deixa
 * agir. As regras alinhadas com a API levam o endpoint em comentário. Uma rota nova entra aqui; o
 * menu da web e o do mobile usam a mesma regra.
 */
export const ROLES_MEDICO     = ['medico'];
export const ROLES_ENFERMAGEM = ['enfermeiro', 'auxiliar'];
export const ROLES_SAUDE      = ['tecnico_saude'];
export const ROLES_FARMACIA   = ['farmaceutico'];
export const ROLES_ADMIN      = ['administrativo'];
export const ROLES_OPERACIONAL = ['operacional'];
export const ROLES_TI         = ['ti'];
export const ROLES_QUALIDADE  = ['qualidade'];
export const ROLES_DIRECAO    = ['direcao'];
export const ROLES_CLINICO    = [...ROLES_MEDICO, ...ROLES_ENFERMAGEM, ...ROLES_SAUDE, ...ROLES_FARMACIA];

/**
 *  - `roles`          → papel OU sub-papel (espelha o RolesGuard da API).
 *  - `subRolesByRole` → restrição de sub-papel com âmbito por papel (só esse papel é restringido).
 *  - `subRoles`       → restrição global de sub-papel (legado; só em regras de papel único).
 *  - `excludeSubRoles`→ sub-papéis excluídos.
 */
export interface RegraAcesso {
  roles?: string[] | null; // null = todos os papéis
  subRolesByRole?: Record<string, string[]>;
  subRoles?: string[];
  excludeSubRoles?: string[];
}

export interface UtilizadorComPapel { role: string; subRole?: string | null }

export function papelPermitido(regra: RegraAcesso, u: UtilizadorComPapel): boolean {
  const roleOk = !regra.roles || regra.roles.includes(u.role) || (!!u.subRole && regra.roles.includes(u.subRole));
  const scoped = regra.subRolesByRole?.[u.role];
  const subRoleOk = scoped
    ? (!!u.subRole && scoped.includes(u.subRole))
    : (!regra.subRoles || regra.subRoles.includes(u.subRole as string));
  const notExcluded = !regra.excludeSubRoles || !regra.excludeSubRoles.includes(u.subRole as string);
  return roleOk && subRoleOk && notExcluded;
}

/** Regra de acesso de cada rota (a mesma rota na web e o mesmo ecrã no mobile). */
export const REGRAS_ROTA: Record<string, RegraAcesso> = {
  '/dashboard': { roles: [...ROLES_CLINICO, ...ROLES_ADMIN] },
  '/dashboard-executivo': { roles: [...ROLES_DIRECAO] },
  '/dashboard-ti': { roles: [...ROLES_TI, ...ROLES_DIRECAO] },
  '/dashboard-qualidade': { roles: [...ROLES_QUALIDADE, ...ROLES_DIRECAO, ...ROLES_MEDICO, 'enfermeiro'] },
  '/dashboard-qualidade/ia-insights': { roles: [...ROLES_QUALIDADE, ...ROLES_DIRECAO, 'supervisor_enfermagem'] },
  '/risco-clinico': { roles: [...ROLES_MEDICO, 'supervisor_enfermagem', ...ROLES_DIRECAO] },
  '/doentes': { roles: [...ROLES_MEDICO, ...ROLES_ENFERMAGEM, ...ROLES_SAUDE, ...ROLES_FARMACIA] },
  '/doentes-admin': { roles: [...ROLES_ADMIN], subRolesByRole: { administrativo: ['front_desk', 'secretariado', 'scheduling', 'backoffice', 'billing_officer'] } },
  // API: GET /urgencia/lista = enfermeiro, medico, administrativo (o auxiliar recebia 403). O quadro
  // clínico não é para o administrativo (minimização): ele trabalha a urgência pela sala de espera.
  '/urgencia': { roles: [...ROLES_MEDICO, 'enfermeiro'] },
  // API: o médico chama e conclui (PATCH :id/chamar).
  '/sala-espera': { roles: [...ROLES_MEDICO, ...ROLES_ENFERMAGEM, ...ROLES_ADMIN], subRolesByRole: { administrativo: ['front_desk', 'scheduling'] } },
  // API: o administrativo cria camas e muda o estado (POST /camas, PATCH :id/estado).
  '/camas': { roles: [...ROLES_MEDICO, ...ROLES_ENFERMAGEM, ...ROLES_ADMIN] },
  '/meu-turno': { roles: [...ROLES_ENFERMAGEM, ...ROLES_MEDICO] },
  '/mar': { roles: [...ROLES_ENFERMAGEM] },
  '/consultas': { roles: [...ROLES_MEDICO, ...ROLES_ADMIN], subRolesByRole: { administrativo: ['front_desk', 'secretariado', 'scheduling', 'billing_officer'] } },
  '/bloco': { roles: [...ROLES_MEDICO, ...ROLES_ENFERMAGEM] },
  '/worklist': { roles: [...ROLES_SAUDE, ...ROLES_MEDICO] },
  '/interconsultas': { roles: [...ROLES_MEDICO] },
  '/tarefas': { roles: [...ROLES_MEDICO, ...ROLES_ENFERMAGEM, ...ROLES_SAUDE, ...ROLES_OPERACIONAL] },
  '/iacs': { roles: [...ROLES_MEDICO, ...ROLES_QUALIDADE, 'enfermeiro', 'auxiliar'] },
  // API: qualquer profissional notifica (POST sem @Roles); a lista é só de gestão — a página já o separa.
  '/eventos-adversos': { roles: [...ROLES_QUALIDADE, ...ROLES_DIRECAO, ...ROLES_CLINICO] },
  '/fisioterapia': { roles: [...ROLES_SAUDE] },
  // API: @Roles('tecnico_saude') na classe, sem sub-papel.
  '/especialidades': { roles: [...ROLES_SAUDE] },
  '/farmacia': { roles: [...ROLES_FARMACIA] },
  '/banco-sangue': { roles: [...ROLES_MEDICO, ...ROLES_ENFERMAGEM, ...ROLES_FARMACIA, ...ROLES_TI] },
  '/catalogo': { roles: [...ROLES_FARMACIA, ...ROLES_ADMIN, ...ROLES_MEDICO, ...ROLES_ENFERMAGEM], subRolesByRole: { administrativo: ['procurement', 'billing_officer'] } },
  '/fornecedores': { roles: [...ROLES_FARMACIA, ...ROLES_ADMIN], subRolesByRole: { administrativo: ['procurement'] } },
  '/operacional': { roles: [...ROLES_OPERACIONAL] },
  // API: GET /equipamentos = operacional, ti, direcao, administrativo, enfermeiro, medico (reportam avarias).
  '/equipamentos': { roles: [...ROLES_OPERACIONAL, ...ROLES_TI, ...ROLES_DIRECAO, ...ROLES_ADMIN, 'enfermeiro', ...ROLES_MEDICO] },
  '/recepcao': { roles: [...ROLES_ADMIN], subRolesByRole: { administrativo: ['front_desk', 'secretariado', 'scheduling'] } },
  '/registos-administrativos': { roles: [...ROLES_ADMIN], subRolesByRole: { administrativo: ['front_desk', 'secretariado', 'backoffice'] } },
  '/faturacao': { roles: [...ROLES_ADMIN], subRolesByRole: { administrativo: ['billing_officer'] } },
  '/rh': { roles: [...ROLES_ADMIN, ...ROLES_DIRECAO], subRolesByRole: { administrativo: ['hr_specialist'] } },
  '/relatorios-financeiros': { roles: [...ROLES_ADMIN, ...ROLES_DIRECAO], subRolesByRole: { administrativo: ['billing_officer'] } },
  '/tabela-atos': { roles: [...ROLES_ADMIN, ...ROLES_DIRECAO], subRolesByRole: { administrativo: ['billing_officer'] } },
  // API: AuditController @Roles('ti', 'qualidade', 'direcao').
  '/conformidade': { roles: [...ROLES_QUALIDADE, ...ROLES_DIRECAO, ...ROLES_TI] },
  '/pedidos-internos': { roles: [...ROLES_CLINICO, ...ROLES_ADMIN, ...ROLES_OPERACIONAL] },
  '/pedidos-ti': { roles: [...ROLES_TI] },
  '/incidentes-ti': { roles: [...ROLES_TI] },
  '/acessos-emergencia': { roles: [...ROLES_DIRECAO, ...ROLES_QUALIDADE, 'enfermeiro'], subRolesByRole: { enfermeiro: ['chefe_enfermeiros'] } },
  '/auditoria': { roles: [...ROLES_TI, ...ROLES_QUALIDADE] },
  '/utilizadores': { roles: [...ROLES_TI], subRolesByRole: { ti: ['it_admin'] } },
  '/configuracoes': { roles: [...ROLES_TI], subRolesByRole: { ti: ['it_admin'] } },
  '/sistemas-externos': { roles: [...ROLES_TI, ...ROLES_DIRECAO], subRolesByRole: { ti: ['it_admin'] } },
  '/guidelines': { roles: [...ROLES_TI, ...ROLES_DIRECAO, ...ROLES_MEDICO, 'supervisor_enfermagem'], subRolesByRole: { ti: ['it_admin'] } },
  '/atribuicoes': { roles: [...ROLES_MEDICO, ...ROLES_ENFERMAGEM] },
  '/passagem-turno': { roles: [...ROLES_MEDICO, ...ROLES_ENFERMAGEM] },
  '/turno/medicacoes': { roles: [...ROLES_MEDICO, 'enfermeiro', ...ROLES_FARMACIA] },
  '/farmacia-clinica': { roles: [...ROLES_FARMACIA, ...ROLES_MEDICO] },
  // API: trocas sem @Roles — qualquer profissional com turnos.
  '/trocas': { roles: [...ROLES_CLINICO] },
  '/horarios': { roles: [...ROLES_CLINICO, ...ROLES_ADMIN] },
  '/ferias': { roles: null },
  '/comunicacao': { roles: null },
  '/relatorios': { roles: [...ROLES_DIRECAO, ...ROLES_ADMIN, ...ROLES_TI], subRolesByRole: { administrativo: ['backoffice'] } },
  // API: GET /dietas/hoje = medico, enfermeiro, auxiliar, administrativo, operacional.
  '/dietas': { roles: [...ROLES_MEDICO, ...ROLES_ENFERMAGEM, ...ROLES_ADMIN, ...ROLES_OPERACIONAL] },
};

/** O utilizador pode ver a funcionalidade desta rota? (rota desconhecida = não) */
export function podeVerRota(rota: string, u: UtilizadorComPapel): boolean {
  const regra = REGRAS_ROTA[rota];
  return !!regra && papelPermitido(regra, u);
}
