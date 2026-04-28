# CuraSphere — Estado Completo da Aplicação

> Documento de referência: o que existe, como está construído e o que falta.
> Última atualização: Abril 2026

---

## 1. Visão Geral

**CuraSphere** é uma plataforma hospitalar full-stack que cobre gestão clínica, operacional e de TI. Tem três superfícies: uma API REST, uma aplicação web e uma aplicação mobile.

| Dimensão | Detalhe |
|---|---|
| Nome | CuraSphere |
| Tipo | Plataforma de gestão hospitalar multi-role |
| Plataformas | API (REST) · Web (browser) · Mobile (iOS + Android) |
| Base de dados | PostgreSQL |
| Monorepo | Nx Workspace (`pnpm`) |

---

## 2. Stack Tecnológico

| Camada | Tecnologia | Versão aprox. |
|---|---|---|
| **API** | NestJS | v11 |
| **ORM** | Prisma | v6 |
| **Base de dados** | PostgreSQL | — |
| **Web** | Next.js (App Router) + Tailwind CSS | v14 |
| **Mobile** | React Native + Expo | — |
| **Monorepo** | Nx Workspace | — |
| **Auth** | JWT (access + refresh tokens) + bcryptjs | — |
| **Real-time** | Socket.IO | v4 |
| **Segurança API** | Helmet + Throttler (rate limiting) | — |
| **Tipagem partilhada** | TypeScript em todas as camadas | — |

---

## 3. Arquitetura

```
Nx Monorepo (enfermaria/)
├── apps/
│   ├── api/                     ← NestJS REST API
│   │   ├── src/app/             ← módulos de negócio
│   │   └── src/prisma/          ← schema, migrations, seed
│   ├── web/                     ← Next.js (App Router)
│   │   └── src/app/(dashboard)/ ← páginas autenticadas
│   └── mobile/                  ← React Native / Expo
│       └── src/screens/         ← ecrãs da app
└── (libs/ — ainda vazio, para tipos partilhados futuros)
```

### Fluxo de dados
- Web e Mobile comunicam **exclusivamente** com a API via HTTP (axios)
- A API é a única fonte de verdade — sem chamadas directas à BD no frontend
- Refresh automático de token: intercept 401 → renova → retry transparente
- Real-time: Socket.IO para comunicação interna (mensagens + anúncios)

---

## 4. Base de Dados — Todos os Modelos

### Configuração de Roles (dinâmica)
| Modelo | Campos principais | Função |
|---|---|---|
| `RoleConfig` | `chave`, `label`, `categoria`, `ativo`, `ordem` | 10 categorias de role geridas em BD |
| `SubRoleConfig` | `chave`, `label`, `roleChave`, `ativo`, `ordem` | 81 sub-roles geridas em BD |

### Utilizadores
| Modelo | Campos principais | Notas |
|---|---|---|
| `Utilizador` | `nome`, `numeroFuncionario`, `passwordHash`, `role` (string), `subRole` (string?), `servico`, `ordemExperiencia`, `equipa`, `ativo` | Role e subRole são chaves livres (não enum) |
| `RefreshToken` | `token`, `expiresAt`, `revogado` | Rotação de refresh tokens |
| `DispositivoToken` | `token`, `plataforma` | Push notifications (tokens guardados, envio não implementado) |

### Infraestrutura Clínica
| Modelo | Campos principais |
|---|---|
| `Cama` | `numero`, `quarto`, `estado` (livre / ocupada / em_limpeza / reservada) |
| `Doente` | `nome`, `dataNascimento`, `numeroProcesso`, `estado` (estavel/grave/critico/alta_prevista), `diagnosticoPrincipal`, `dataAdmissao`, `dataAltaPrevista`, `dataAlta`, `emIsolamento`, `camaId` |
| `SinalVital` | `pressaoSistolica/Diastolica`, `pulso`, `temperatura`, `saturacaoO2`, `frequenciaRespiratoria`, `peso` |
| `Alergia` | `alergenio`, `tipo`, `severidade` |
| `ContactoEmergencia` | `nome`, `relacao`, `telefone`, `principal` |
| `AlertaClinico` | `tipo`, `mensagem`, `lido` |
| `AvaliacaoRisco` | `tipo`, `pontuacao`, `itens` (JSON), `risco` |
| `SumarioAlta` | `motivoAlta`, `destino`, `resumoClinical`, `prescricaoSaida`, `medicoFamilia` |

### Documentação Clínica
| Modelo | Campos principais |
|---|---|
| `NotaClinica` | SOAP: `subjetivo`, `objetivo`, `avaliacao`, `plano` |
| `EscalaClinica` | `tipo` (RASS, CPOT, SOFA, CTG, Apgar, PEWS, FLACC, Barthel, FIM, MRC, FOIS, NRS2002, PHQ9, GAD7), `valores` (JSON), `pontuacao`, `classificacao` |
| `NotaTurno` | `texto`, ligado a doente + turno |
| `PassagemTurno` | Ligação entre turno anterior e atual por doente |

### Medicação
| Modelo | Campos principais |
|---|---|
| `Medicacao` | `nome`, `dose`, `via`, `frequencia`, `estadoValidacao` (pendente/aprovada/rejeitada), `prescritoPorId`, `validadoPorId` |
| `RegistoMedicacao` | `administradoEm`, `observacoes`, `administradoPorId` |

### Tarefas
| Modelo | Campos principais |
|---|---|
| `Tarefa` | `descricao`, `tipo` (clinica/logistica), `prioridade` (baixa/media/alta/urgente), `estado` (pendente/em_progresso/concluida/cancelada), `prazo`, `transitouDeTurno` |

### Turnos e Horários
| Modelo | Campos principais |
|---|---|
| `Turno` | `tipo` (manha/tarde/noite), `dataInicio`, `dataFim`, `chefeTurnoId` |
| `AtribuicaoDoente` | Doente ↔ Enfermeiro ↔ Turno |
| `HorarioEntrada` | Check-in de profissional no turno |
| `Escala` | Escala mensal (`mes`, `ano`) |
| `HorarioTurno` | Entrada da escala: `tipo`, `data`, `escalId` |
| `HorarioTurnoProfissional` | Profissional numa entrada de escala |
| `AtribuicaoHorarioTurno` | Doente atribuído a profissional numa entrada de escala |
| `PedidoTrocaTurno` | `estado` (pendente_destinatario / pendente_chefe / aprovado / rejeitado) |

### Exames e Diagnóstico
| Modelo | Campos principais |
|---|---|
| `Exame` | `tipo` (analise_clinica/rx/eco/tc/rmn/ecg/outro), `descricao`, `urgente`, `estado`, `resultado` |
| `FicheiroExame` | `nome`, `url`, `mimeType` (modelo existe, storage real não implementado) |

### Urgência e Bloco
| Modelo | Campos principais |
|---|---|
| `EpisodioUrgencia` | `queixaPrincipal`, `triagem` (vermelho/laranja/amarelo/verde/azul), `estadoEpisodio`, `sinaisVitaisTriagem` (JSON) |
| `CirurgiaProgramada` | `designacao`, `dataHora`, `duracaoPrevista`, `sala`, `estado`, `equipa` (JSON), `notasPreOperatorio`, `notasPosOperatorio`, `complicacoes` |
| `ChecklistCirurgia` | Checklist WHO: Sign In / Time Out / Sign Out (dados JSON por fase) |

### Consultas e Reabilitação
| Modelo | Campos principais |
|---|---|
| `Consulta` | `especialidade`, `dataHora`, `duracao`, `estado` (agendada/realizada/faltou/cancelada), `diagnostico`, `proximaConsulta` |
| `PlanoReabilitacao` | `objetivos`, `dataInicio`, `dataFimPrevista` |
| `SessaoFisioterapia` | `data`, `duracao`, `descricao`, `evolucao`, `estado` |

### Sala de Espera
| Modelo | Campos principais |
|---|---|
| `CheckinSalaEspera` | `nomeDoente`, `motivo`, `prioridade` (1-5), `estado` (aguardando/em_atendimento/atendido/desistiu/ausente), `chegadaEm`, `chamadoEm`, `atendidoEm` |

### Farmácia / Stock
| Modelo | Campos principais |
|---|---|
| `StockItem` | `nome`, `tipo` (medicamento/material/consumivel), `quantidade`, `quantidadeMinima`, `unidade`, `validade` |
| `PedidoFarmacia` | `quantidade`, `servico`, `estado` (pendente/aprovado/dispensado/cancelado) |

### Operacional
| Modelo | Campos principais |
|---|---|
| `PedidoInterno` | `tipo` (transporte/esterilizacao/equipamento/limpeza), `prioridade`, `estado`, `localOrigem`, `localDestino` |
| `Interconsulta` | `especialidadeAlvo`, `motivo`, `urgente`, `estado` (pendente/aceite/respondida/cancelada), `resposta` |
| `DispositivoInvasivo` | `tipo` (10 tipos: CVC, CVP, arterial, vesical, TOT, traqueostomia, dreno, SNG, epidural, outro), `dataInsercao`, `dataRemocao`, `ativo` |

### Comunicação
| Modelo | Campos principais |
|---|---|
| `Anuncio` | `titulo`, `texto`, `servico`, `ativo`, `expiraEm` |
| `MensagemInterna` | `assunto`, `texto`, `lida` — 1-para-1 entre utilizadores |

### TI
| Modelo | Campos principais |
|---|---|
| `IncidenteTI` | `titulo`, `descricao`, `tipo` (infraestrutura/rede/his_erp/base_dados/seguranca/dados_clinicos/outro), `prioridade` (baixa/media/alta/critica), `estado` (aberto/em_analise/resolvido/fechado) |
| `PedidoTI` | `titulo`, `descricao`, `tipo` (listagem_dados/relatorio/acesso_sistema/backup/auditoria_dados/outro), `estado` (pendente/em_curso/concluido/recusado), `urgente` |

### Auditoria
| Modelo | Campos principais |
|---|---|
| `AuditLog` | `acao`, `entidadeTipo`, `entidadeId`, `detalhes`, `ip`, `userAgent` — registo automático de ações |

---

## 5. API — Módulos Existentes

| Módulo (pasta) | Endpoints principais | Observações |
|---|---|---|
| `auth` | POST /auth/login, POST /auth/refresh, POST /auth/logout | JWT + refresh tokens |
| `utilizadores` | CRUD /utilizadores | Role-based; suporta role+subRole |
| `configuracoes` | CRUD /configuracoes/roles, /configuracoes/subroles | Só ti/it_admin |
| `doentes` | CRUD /doentes, /doentes/:id/alta, isolamento | |
| `camas` | CRUD /camas, estado | |
| `turnos` | CRUD /turnos, check-in, passagem de turno | chefeTurnoId no modelo |
| `horarios` | CRUD /horarios (escalas mensais) | |
| `atribuicoes` | CRUD /atribuicoes (doentes ↔ profissionais) | |
| `trocas` | CRUD /trocas, /responder, /aprovar | Chefe por ordemExperiência |
| `tarefas` | CRUD /tarefas, transição de turno | |
| `medicacao` | CRUD /medicacao, /validar, registos | |
| `sinais-vitais` | CRUD /sinais-vitais | |
| `notas-clinicas` | CRUD /notas-clinicas (SOAP) | |
| `escalas-clinicas` | CRUD /escalas-clinicas (14 tipos) | |
| `dispositivos-invasivos` | CRUD /dispositivos-invasivos | |
| `interconsultas` | CRUD /interconsultas, /responder | |
| `exames` | CRUD /exames, resultado | Ficheiros: modelo existe, sem storage real |
| `alergias` | CRUD /alergias | |
| `alertas` | CRUD /alertas, marcar lido | |
| `contactos` | CRUD /contactos-emergencia | |
| `escalas` | CRUD /escalas (avaliações risco + sumário alta) | |
| `urgencia` | CRUD /urgencia (episódios, triagem) | |
| `bloco` | CRUD /bloco (cirurgias, checklist WHO) | |
| `consultas` | CRUD /consultas | |
| `sala-espera` | CRUD /sala-espera (check-ins, chamadas) | |
| `farmacia` | CRUD /farmacia/stock, /farmacia/pedidos | |
| `fisioterapia` | CRUD /fisioterapia/planos, /sessoes | |
| `pedidos-internos` | CRUD /pedidos-internos | |
| `comunicacao` | GET/POST /comunicacao/anuncios, /mensagens | Socket.IO para real-time |
| `incidentes-ti` | CRUD /incidentes-ti | |
| `pedidos-ti` | CRUD /pedidos-ti | |
| `notificacoes` | (módulo existe, endpoints por confirmar) | Push não implementado de facto |
| `dashboard` | GET /dashboard (métricas agregadas) | |
| `auditoria` | GET /auditoria (logs paginados) | |

---

## 6. Web — Páginas Existentes

| Rota (`/dashboard/...`) | Conteúdo | Quem acede |
|---|---|---|
| `/dashboard` | Router → redireciona para dashboard específico do role | Todos |
| `/dashboard-ti` | Incidentes abertos, pedidos pendentes, métricas TI | ti, direcao |
| `/doentes` | Lista de doentes internados, filtros, admissão | medico, enfermeiro, auxiliar, administrativo |
| `/doentes/[id]` | Ficha completa: sinais vitais, medicação, notas SOAP, escalas, dispositivos, interconsultas, tarefas, exames, alergias, alertas, sumário alta | medico, enfermeiro |
| `/camas` | Mapa de camas por quarto, estado, filtros | medico, enfermeiro, auxiliar, administrativo |
| `/turnos` (implícito via horarios) | — | — |
| `/horarios` | Escala mensal, visualização por profissional | Todos clínicos |
| `/atribuicoes` | Atribuição de doentes a profissionais por turno | enfermeiro, medico |
| `/trocas` | Pedidos de troca: meus, para aprovação | Todos clínicos |
| `/tarefas` | Lista de tarefas do turno, criar, concluir | Todos clínicos |
| `/consultas` | Agenda de consultas, criar, resultado | medico, administrativo |
| `/bloco` | Agenda cirúrgica, checklist WHO por cirurgia | medico |
| `/urgencia` | Episódios de urgência, triagem, estado | medico, enfermeiro |
| `/sala-espera` | Fila de espera, chamar doente, registar atendimento | administrativo, medico, enfermeiro |
| `/farmacia` | Stock de itens, pedidos por serviço | farmaceutico, enfermeiro |
| `/fisioterapia` | Planos de reabilitação, sessões | tecnico_saude |
| `/pedidos-internos` | Pedidos de transporte, limpeza, esterilização | operacional, enfermeiro |
| `/iacs` | Infecções Associadas a Cuidados (usa dispositivos invasivos + escalas) | enfermeiro, medico, qualidade |
| `/comunicacao` | Mensagens 1:1 + anúncios do serviço | Todos |
| `/incidentes-ti` | Lista de incidentes TI, criar, atribuir, resolver | ti, direcao |
| `/pedidos-ti` | Pedidos de dados/relatórios ao departamento TI | Todos → processado por ti |
| `/utilizadores` | CRUD de utilizadores (role, subRole, equipa, ordem) | ti, direcao, administrativo |
| `/configuracoes` | Gestão de roles e sub-roles em BD | ti/it_admin exclusivo |
| `/auditoria` | Log de auditoria paginado com filtros | ti, qualidade, direcao, administrativo |
| `/worklist` | (página existe, conteúdo por confirmar) | — |
| `/mar` | MAR — Medication Administration Record (por confirmar estado) | — |

---

## 7. Mobile — Ecrãs Existentes

| Ecrã | Conteúdo | Observações |
|---|---|---|
| `LoginScreen` | Autenticação | |
| `DashboardScreen` | Dashboard clínico: doentes, camas ocupadas, turnos | Para roles clínicos |
| `DashboardTIScreen` | Dashboard TI: incidentes, pedidos | Para role `ti` |
| `DoentesScreen` | Lista de doentes com filtros e pesquisa | |
| `DoenteDetalheScreen` | Ficha do doente: sinais vitais, medicação, tarefas, notas, escalas, dispositivos, interconsultas | Ecrã mais completo do mobile |
| `TurnoScreen` | Turno atual: doentes atribuídos, check-in, notas | |
| `PassagemTurnoScreen` | Passagem de turno para o turno seguinte | |
| `HorariosScreen` | Escala mensal em visualização de calendário | |
| `AtribuicoesScreen` | Atribuição de doentes a profissionais | |
| `TrocasScreen` | Pedidos de troca: criar, responder, aprovar | |
| `TarefasScreen` | Tarefas do turno | |
| `CamasScreen` | Mapa de camas | |
| `UtilizadoresScreen` | CRUD de utilizadores com role + subRole | |
| `PedidosTIScreen` | Pedidos TI: criar e ver estado | |
| `IncidentesSubRoleScreen` | Incidentes TI filtrados por subRole | |
| `AuditoriaScreen` | Log de auditoria | |
| `QRScannerScreen` | Scanner QR (integração por confirmar) | |
| `MaisScreen` | Menu secundário com acessos extras | |
| `PerfilScreen` | Perfil do utilizador autenticado | |

---

## 8. Sistema de Roles e Sub-roles

### 10 Categorias Fixas (em BD)

| Chave | Label | Categoria |
|---|---|---|
| `medico` | Médico | clinico |
| `enfermeiro` | Enfermeiro | clinico |
| `auxiliar` | Auxiliar | clinico |
| `tecnico_saude` | Técnico de Saúde | clinico |
| `farmaceutico` | Farmacêutico | clinico |
| `administrativo` | Administrativo | gestao |
| `operacional` | Operacional | suporte |
| `ti` | Tecnologias de Informação | ti |
| `qualidade` | Qualidade | gestao |
| `direcao` | Direção | gestao |

### 81 Sub-roles (exemplos por categoria)

- **medico**: clinico_geral, cardiologista, cirurgiao_geral, medico_anestesia, medico_imagem, anatomia_patologica, medico_gestor, neurologista, pneumologista, nefrologista, pediatra, psiquiatra, ortopedista, urologista, dermatologista, oftalmologista, otorrinolaringologista, reumatologista, endocrinologista, oncologista, hematologista, gastroenterologista, hepatologista, infectologista…
- **enfermeiro**: generalista, supervisor_enfermagem, uci, bloco_operatorio, urgencia, pediatria, oncologia, triador, instrumentista, reabilitacao…
- **ti**: it_admin, cio, database_admin, security_officer, his_erp, dados_clinicos…
- *(+ sub-roles para todos os outros roles)*

### Lógica de Autorização
- `@Roles('medico', 'enfermeiro')` — guard valida `user.role`
- `@SubRoles('it_admin')` — guard valida `user.subRole` adicionalmente
- Chefe de turno: determinado dinamicamente pelo **menor `ordemExperiencia`** no mesmo role dentro do turno (não é um role fixo)

---

## 9. Autenticação e Segurança

| Feature | Estado |
|---|---|
| Login por `numeroFuncionario` + password | ✅ |
| Hashing de password (bcryptjs) | ✅ |
| JWT access token (curta duração) | ✅ |
| Refresh token com rotação | ✅ |
| Refresh automático no cliente (intercept 401) | ✅ |
| Revogação de refresh tokens | ✅ |
| Guard de role (`@Roles`) | ✅ |
| Guard de sub-role (`@SubRoles`) | ✅ |
| Rate limiting (Throttler) | ✅ |
| Helmet (headers de segurança) | ✅ |
| Audit log automático de ações | ✅ |
| Registo de IP e user agent nos logs | ✅ |
| 2FA / MFA | ❌ Não implementado |
| SSO / OAuth | ❌ Não implementado |
| RBAC granular por recurso (ex: só o médico do doente) | ⚠️ Parcial |

---

## 10. Funcionalidades Implementadas — Checklist Completa

### Gestão de Utilizadores
- [x] CRUD completo (criar, editar, desativar)
- [x] Role + sub-role dinâmicos (carregados da BD)
- [x] Ordem de experiência (define chefe de turno)
- [x] Equipa (A, B, etc.)
- [x] Serviço de base do utilizador

### Doentes e Internamentos
- [x] Admissão com cama, diagnóstico, dados demográficos
- [x] Estados: estável, grave, crítico, alta prevista
- [x] Isolamento (flag + motivo)
- [x] Alta com sumário clínico
- [x] Contactos de emergência
- [x] Alergias com severidade
- [x] Alertas clínicos

### Documentação Clínica
- [x] Notas clínicas SOAP
- [x] Sinais vitais (7 parâmetros)
- [x] 14 tipos de escalas clínicas (RASS, SOFA, Barthel, etc.)
- [x] Avaliações de risco
- [x] Dispositivos invasivos (10 tipos) com data inserção/remoção
- [x] Interconsultas com resposta
- [x] Exames complementares (7 tipos) + resultado

### Medicação
- [x] Prescrição médica
- [x] Validação farmacêutica (aprovada/rejeitada com motivo)
- [x] Registo de administração por enfermeiro
- [x] Histórico completo

### Turnos e Escalas
- [x] Escala mensal (criar, visualizar)
- [x] Turnos manhã/tarde/noite com chefe
- [x] Check-in de profissional no turno
- [x] Passagem de turno
- [x] Atribuição de doentes a profissionais

### Trocas de Turno
- [x] Pedido de troca entre colegas do mesmo role
- [x] Aprovação pelo destinatário
- [x] Aprovação pelo chefe de turno (por ordemExperiência)
- [x] Troca efectiva de profissional no horário após aprovação

### Tarefas
- [x] Criar tarefas (clínicas e logísticas)
- [x] Prioridade (baixa/média/alta/urgente)
- [x] Transição automática para o turno seguinte
- [x] Atribuição a profissional ou grupo

### Urgência
- [x] Triagem (5 cores: vermelho, laranja, amarelo, verde, azul)
- [x] Episódio com médico responsável
- [x] Estados de episódio (triagem → internado/alta/transferido)
- [x] Sinais vitais na triagem

### Bloco Operatório
- [x] Agenda cirúrgica com cirurgião + anestesista
- [x] Checklist WHO (Sign In / Time Out / Sign Out)
- [x] Notas pré e pós-operatórias
- [x] Complicações

### Consultas
- [x] Agendamento com especialidade e duração
- [x] Estados (agendada/realizada/faltou/cancelada)
- [x] Diagnóstico e próxima consulta

### Sala de Espera
- [x] Check-in de doente
- [x] Prioridade e ordem de chamada
- [x] Estados (aguardando → em atendimento → atendido)
- [x] Registo de tempos (chegada, chamada, atendimento)

### Farmácia
- [x] Stock de medicamentos, materiais e consumíveis
- [x] Alertas de stock mínimo
- [x] Pedidos por serviço com aprovação/dispensa

### Fisioterapia
- [x] Planos de reabilitação com objetivos
- [x] Sessões com evolução
- [x] Estados de sessão

### Pedidos Internos
- [x] Transporte, esterilização, equipamento, limpeza
- [x] Prioridade e atribuição a executor

### Comunicação
- [x] Mensagens internas 1:1
- [x] Anúncios de serviço com expiração
- [x] Real-time via Socket.IO

### TI
- [x] Incidentes com tipo, prioridade, estado e responsável
- [x] Pedidos TI (dados, relatórios, acessos, backups)
- [x] Dashboard TI com métricas

### Configurações e Administração
- [x] Gestão de roles em BD (criar, editar, desativar)
- [x] Gestão de sub-roles em BD
- [x] Log de auditoria de todas as ações
- [x] Filtros de auditoria por utilizador, ação, data

---

## 11. O Que Está em Falta / Pode Melhorar

### ❌ Funcionalidades Completamente Ausentes

| Funcionalidade | Impacto | Notas |
|---|---|---|
| **Notificações push reais** | Alto | Tokens guardados na BD mas sem envio real (Firebase/Expo Notifications) |
| **Upload e storage de ficheiros** | Alto | Modelo `FicheiroExame` existe mas sem implementação (S3/MinIO/Azure Blob) |
| **Relatórios e exportação PDF/Excel** | Alto | Nenhum módulo de geração de documentos |
| **Consentimentos Informados** | Médio | Nenhum modelo/ecrã para consentimentos do doente |
| **Faturação** | Médio | Nenhum módulo de billing/faturação |
| **Referenciações / Transferências** | Médio | Sem modelo para transferir doentes entre hospitais ou serviços externos |
| **Telemedicina / Teleconsulta** | Baixo | Sem video ou integração externa |
| **Prescrição Eletrónica (ePrescription)** | Médio | A medicação existe mas sem integração com sistemas externos (SPMS, etc.) |
| **Receitas / Tratamentos ambulatórios** | Médio | Só internamento — sem prescrições para ambulatório |
| **Agenda de médicos (calendário visual)** | Médio | Consultas existem mas sem vista de calendário/agenda |
| **2FA / MFA** | Médio | Autenticação só por password |
| **SSO / Active Directory** | Baixo | Sem integração com AD hospitalar |
| **QR Code funcional** | Baixo | Ecrã existe no mobile mas integração não confirmada |

### ⚠️ Funcionalidades Parciais ou Por Confirmar

| Funcionalidade | Estado | O que falta |
|---|---|---|
| **IACs (página web `/iacs`)** | Página existe | Confirmar se usa dados reais de dispositivos invasivos ou tem lógica própria |
| **Worklist (página web `/worklist`)** | Página existe | Confirmar conteúdo e propósito |
| **MAR — Medication Administration Record (`/mar`)** | Página existe | Confirmar se está implementada ou é placeholder |
| **Notificações in-app** | Alertas clínicos guardados | Sem UI de notificação tipo "sino" com contador |
| **Pesquisa global** | Sem implementação | Sem pesquisa cross-módulo (doente por nome/número, etc.) |
| **QR de doente/cama** | Ecrã mobile existe | Sem fluxo definido (admissão rápida? check-in?) |
| **Validação de medicação farmacêutica** | API implementada | Confirmar se a UI web/mobile expõe este fluxo completo |

### 📱 Gaps Web vs Mobile

| Módulo | Web | Mobile |
|---|---|---|
| Fisioterapia | ✅ | ❌ |
| Consultas | ✅ | ❌ |
| Bloco Operatório | ✅ | ❌ |
| Sala de Espera | ✅ | ❌ |
| Urgência | ✅ | ❌ |
| Pedidos Internos | ✅ | ❌ |
| IACs | ✅ | ❌ |
| Worklist | ✅ | ❌ |
| MAR | ✅ | ❌ |
| Comunicação (anúncios) | ✅ | ⚠️ Parcial |

### 🔧 Melhorias Técnicas

| Área | Situação | Sugestão |
|---|---|---|
| **Testes** | Nenhum teste automatizado (só specs vazios) | Adicionar testes unitários e e2e |
| **Documentação API** | Sem Swagger/OpenAPI | Adicionar `@nestjs/swagger` |
| **Validação de DTOs** | Parcial | Completar com `class-validator` em todos os endpoints |
| **Paginação consistente** | Inconsistente entre módulos | Standardizar cursor/page pagination |
| **Error handling** | Básico | Filtro global de exceções com mensagens i18n |
| **Logging** | Audit log existe | Adicionar logging estruturado da API (Winston/Pino) |
| **Ambiente de staging** | Um único ambiente | Separar dev/staging/prod com variáveis |
| **CI/CD** | Sem pipeline | GitHub Actions para lint + test + build |
| **Shared types (libs/)** | Pasta vazia | Extrair interfaces partilhadas para `libs/types` |

---

## 12. Prioridades Sugeridas

### Alta prioridade (impacto imediato no uso)
1. Confirmar e completar **MAR**, **Worklist** e **IACs** (já existem no menu)
2. Implementar **notificações push** (Expo + Firebase)
3. Adicionar **pesquisa global** (pelo menos doentes + utilizadores)
4. **Upload de ficheiros** (pelo menos para exames)

### Média prioridade (completar a plataforma)
5. Ecrãs mobile para **fisioterapia, consultas, bloco, urgência**
6. **Relatórios PDF** (sumário de alta, escala mensal, auditoria)
7. **Consentimentos informados**
8. **Calendário/agenda** visual para consultas
9. **Notificação in-app** (sino com badge)

### Baixa prioridade / futuro
10. **Faturação** e integração SPMS
11. **SSO / Active Directory**
12. **Telemedicina**
13. **Referenciações externas**
14. **Testes automatizados** e CI/CD
