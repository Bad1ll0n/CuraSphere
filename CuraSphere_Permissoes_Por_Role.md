# CuraSphere — O Que Cada Role Pode Fazer

> Documento baseado no código real (client-layout, App.tsx, MaisScreen, DoenteDetalheScreen).
> Última atualização: Abril 2026

---

## Como Funciona a Autorização

A visibilidade dos menus depende de **dois fatores combinados**:

1. **Role** (categoria do profissional) — `medico`, `enfermeiro`, `ti`, etc.
2. **Serviço base** do utilizador — `internamento`, `urgencia`, `bloco_operatorio`, `consultas_externas`, `farmacia`, `fisioterapia`, `transporte`, `administrativo`

Alguns menus só aparecem se o utilizador tiver o serviço certo **e** o role certo.
O **sub-role** não filtra menus (exceto `ti/it_admin` que ganha Utilizadores e Configurações), mas distingue especialidades dentro do mesmo role.

---

## Legenda

- ✅ Tem acesso / pode fazer
- ❌ Não tem acesso
- ⚠️ Condicionado ao serviço base do utilizador
- 🔒 Só com sub-role específico

---

## 1. MÉDICO (`role: medico`)

### Sub-roles disponíveis
`clinico_geral` · `cardiologista` · `cirurgiao_geral` · `medico_anestesia` · `medico_imagem` · `anatomia_patologica` · `medico_gestor` · `neurologista` · `pneumologista` · `nefrologista` · `pediatra` · `psiquiatra` · `ortopedista` · `urologista` · `dermatologista` · `oftalmologista` · `otorrinolaringologista` · `reumatologista` · `endocrinologista` · `oncologista` · `hematologista` · `gastroenterologista` · `hepatologista` · `infectologista`

> O sub-role é informativo — não filtra menus. Define a especialidade visível no perfil.

### Web — Menus visíveis

| Menu | Visível? | Condição extra |
|---|---|---|
| Dashboard | ✅ | — |
| Doentes | ✅ | — |
| Camas | ⚠️ | Só se serviço = `internamento` ou `urgencia` |
| Horários | ✅ | — |
| Tarefas | ✅ | — |
| Trocas de Turno | ✅ | — |
| Atribuições | ✅ | — |
| Urgência | ⚠️ | Só se serviço = `urgencia` |
| Bloco Operatório | ⚠️ | Só se serviço = `bloco_operatorio` |
| Consultas | ⚠️ | Só se serviço = `consultas_externas` |
| Worklist (Imagiologia) | ✅ | — |
| IACS | ✅ | — |
| Pedidos Internos | ✅ | — |
| Comunicação | ✅ | — |

### Web — O que pode fazer

**Doentes**
- Ver lista de doentes internados com filtros (estado, serviço)
- Abrir ficha completa do doente

**Ficha do Doente**
- ✅ Alterar estado clínico (estável / grave / crítico / alta prevista)
- ✅ Prescrever medicação (médico é o único que pode prescrever)
- ✅ Dar alta ao doente (com sumário de alta)
- ✅ Escrever notas clínicas SOAP
- ✅ Registar avaliações de risco
- ✅ Solicitar exames (análises, RX, ECO, TC, RMN, ECG)
- ✅ Criar interconsultas para outra especialidade
- ✅ Responder a interconsultas dirigidas a si
- ✅ Ver sinais vitais (não regista — é o enfermeiro)
- ✅ Ver medicação e seus registos de administração
- ✅ Ver escalas clínicas registadas
- ✅ Ver dispositivos invasivos ativos
- ✅ Ver alergias, alertas e contactos de emergência
- ✅ Criar e concluir tarefas clínicas

**Urgência** (se serviço = urgencia)
- ✅ Ver episódios em triagem, sala de espera, em atendimento
- ✅ Assumir episódio como médico responsável
- ✅ Alterar estado do episódio (em atendimento → alta / internado / transferido)
- ✅ Adicionar notas ao episódio

**Bloco Operatório** (se serviço = bloco_operatorio)
- ✅ Ver agenda cirúrgica do dia e semana
- ✅ Criar cirurgia programada
- ✅ Registar checklist WHO (Sign In, Time Out, Sign Out)
- ✅ Registar notas pré e pós-operatórias
- ✅ Registar complicações

**Consultas** (se serviço = consultas_externas)
- ✅ Ver agenda de consultas do dia
- ✅ Criar nova consulta
- ✅ Registar diagnóstico e notas
- ✅ Marcar consulta seguinte
- ✅ Alterar estado (realizada / faltou / cancelada)

**Horários**
- ✅ Ver escala mensal
- ✅ Ver turnos atribuídos

**Trocas de Turno**
- ✅ Pedir troca de turno com colega médico
- ✅ Aceitar/recusar pedidos recebidos
- ✅ Aprovar trocas (se for o médico com menor ordemExperiência no turno = chefe)

**Worklist**
- ✅ Ver lista de exames de imagiologia pendentes

**IACS**
- ✅ Ver dispositivos invasivos ativos por serviço
- ✅ Registar e remover dispositivos invasivos

### Mobile — Tabs disponíveis

`Dashboard` · `Doentes` · `[QR Scan]` · `Tarefas` · `Mais`

**Tab Mais contém:**
- Turno (doentes e tarefas do turno atual)
- Passagem de Turno
- Horários
- Atribuições
- Camas
- Trocas de Turno

**Mobile — O que pode fazer na ficha do doente (scan QR ou lista):**
- ✅ Todas as mesmas ações que na web (ver supra)

---

## 2. ENFERMEIRO (`role: enfermeiro`)

### Sub-roles disponíveis
`generalista` · `supervisor_enfermagem` · `uci` · `bloco_operatorio` · `urgencia` · `pediatria` · `oncologia` · `triador` · `instrumentista` · `reabilitacao` · `cuidados_paliativos` · `saude_materna` · `saude_mental` · `dermatologia_clinica`

> `supervisor_enfermagem` é informativo (era `chefe_enfermeiros`). O chefe de turno é determinado automaticamente por `ordemExperiencia`.

### Web — Menus visíveis

| Menu | Visível? | Condição extra |
|---|---|---|
| Dashboard | ✅ | — |
| Doentes | ✅ | — |
| Camas | ⚠️ | Só se serviço = `internamento` ou `urgencia` |
| Horários | ✅ | — |
| Tarefas | ✅ | — |
| Trocas de Turno | ✅ | — |
| Atribuições | ✅ | — |
| Urgência | ⚠️ | Só se serviço = `urgencia` |
| Bloco Operatório | ⚠️ | Só se serviço = `bloco_operatorio` |
| MAR (Medication Administration Record) | ✅ | — |
| IACS | ✅ | — |
| Sala de Espera | ⚠️ | Só se serviço = `urgencia` |
| Pedidos Internos | ✅ | — |
| Comunicação | ✅ | — |

### Web — O que pode fazer

**Ficha do Doente**
- ✅ Alterar estado clínico
- ✅ Registar administração de medicação
- ✅ Registar sinais vitais (7 parâmetros)
- ✅ Preencher escalas clínicas (RASS, CPOT, Barthel, etc.)
- ✅ Inserir/remover dispositivos invasivos
- ✅ Escrever notas de turno
- ✅ Criar e concluir tarefas
- ❌ Prescrever medicação (só médico)
- ❌ Dar alta (só médico)

**MAR — Medication Administration Record**
- ✅ Ver todas as medicações ativas por doente
- ✅ Registar administração com hora e observações
- ✅ Ver histórico de administrações do turno

**Urgência** (se serviço = urgencia)
- ✅ Realizar triagem (atribuir cor de prioridade)
- ✅ Registar sinais vitais na triagem
- ✅ Registar chegada e estado do episódio

**Bloco Operatório** (se serviço = bloco_operatorio)
- ✅ Ver agenda cirúrgica
- ✅ Participar no checklist WHO (Sign In, Time Out, Sign Out)
- ✅ Registar como instrumentista

**Sala de Espera** (se serviço = urgencia)
- ✅ Registar check-in de doente
- ✅ Chamar doente da fila
- ✅ Ver tempos de espera

**IACS**
- ✅ Ver e registar dispositivos invasivos
- ✅ Ver escalas de risco de infeção

**Trocas de Turno**
- ✅ Pedir troca com colega enfermeiro
- ✅ Aceitar/recusar pedidos
- ✅ Aprovar trocas (se tiver menor ordemExperiência no turno = chefe)

### Mobile — Tabs

`Dashboard` · `Doentes` · `[QR Scan]` · `Tarefas` · `Mais`

**Tab Mais contém:**
- Turno · Passagem de Turno · Horários · Atribuições · Camas · Trocas de Turno

---

## 3. AUXILIAR (`role: auxiliar`)

### Sub-roles disponíveis
`apoio_geral`

### Web — Menus visíveis

| Menu | Visível? |
|---|---|
| Dashboard | ✅ |
| Doentes | ✅ |
| Camas | ⚠️ internamento/urgencia |
| Horários | ✅ |
| Tarefas | ✅ |
| Trocas de Turno | ✅ |
| MAR | ✅ |
| Pedidos Internos | ✅ |
| Comunicação | ✅ |

### Web — O que pode fazer

**Ficha do Doente**
- ✅ Registar administração de medicação
- ✅ Alterar estado clínico
- ✅ Ver informação clínica
- ❌ Prescrever medicação
- ❌ Dar alta
- ❌ Notas SOAP (só médico)

**MAR**
- ✅ Registar administração de medicação

### Mobile — Tabs
`Dashboard` · `Doentes` · `[QR Scan]` · `Tarefas` · `Mais`

**Tab Mais:** Turno · Horários · Camas · Trocas de Turno

---

## 4. TÉCNICO DE SAÚDE (`role: tecnico_saude`)

### Sub-roles disponíveis
`tae` · `reabilitacao_fisica` (Fisioterapeuta) · `reabilitacao_fala` (Terapeuta da Fala) · `nutricao_clinica` · `psicologia_clinica`

### Web — Menus visíveis

| Menu | Visível? |
|---|---|
| Dashboard | ✅ |
| Doentes | ✅ |
| Horários | ✅ |
| Tarefas | ✅ |
| Trocas de Turno | ✅ |
| Fisioterapia | ✅ |
| Worklist (Imagiologia) | ✅ |
| Pedidos Internos | ✅ |
| Comunicação | ✅ |

### Web — O que pode fazer

**Fisioterapia**
- ✅ Criar plano de reabilitação para doente
- ✅ Registar sessões de fisioterapia com evolução
- ✅ Ver histórico de sessões por doente
- ✅ Fechar/cancelar sessões

**Worklist**
- ✅ Ver exames de imagiologia pendentes
- ✅ Registar resultado (TAE/Radiologista)

**Ficha do Doente**
- ✅ Ver informação clínica
- ✅ Criar tarefas
- ❌ Prescrever medicação
- ❌ Alterar estado clínico

### Mobile — Tabs
`Dashboard` · `Doentes` · `[QR Scan]` · `Tarefas` · `Mais`

**Tab Mais:** Turno · Horários · Trocas de Turno

---

## 5. FARMACÊUTICO (`role: farmaceutico`)

### Sub-roles disponíveis
`farmaceutico_hospitalar` · `farmaceutico_oncologico` · `tecnico_farmacia_assist`

### Web — Menus visíveis

| Menu | Visível? |
|---|---|
| Dashboard | ✅ |
| Farmácia | ✅ |
| Horários | ✅ |
| Trocas de Turno | ✅ |
| Pedidos Internos | ✅ |
| Comunicação | ✅ |

### Web — O que pode fazer

**Farmácia**
- ✅ Ver stock de medicamentos, materiais e consumíveis por serviço
- ✅ Registar entrada de stock
- ✅ Ver alertas de stock mínimo
- ✅ Processar pedidos de reposição (aprovar / dispensar / cancelar)
- ✅ Validar prescrições médicas (aprovar / rejeitar com motivo)

> A validação farmacêutica bloqueia a administração até o farmacêutico aprovar.

### Mobile — Tabs
`Dashboard` · `Doentes` · `[QR Scan]` · `Tarefas` · `Mais`

**Tab Mais:** Horários · Trocas de Turno

---

## 6. ADMINISTRATIVO (`role: administrativo`)

### Sub-roles disponíveis
`front_desk` (Rececionista) · `secretariado` · `backoffice` · `scheduling` · `billing_officer` · `hr_specialist` · `procurement`

### Web — Menus visíveis

| Menu | Visível? | Condição extra |
|---|---|---|
| Dashboard | ✅ | — |
| Doentes | ✅ | — |
| Camas | ⚠️ | internamento ou urgencia |
| Horários | ✅ | — |
| Urgência | ⚠️ | Só se serviço = `urgencia` |
| Consultas | ⚠️ | Só se serviço = `consultas_externas` |
| Sala de Espera | ⚠️ | Só se serviço = `urgencia` |
| Pedidos Internos | ✅ | — |
| Comunicação | ✅ | — |

### Web — O que pode fazer

**Doentes**
- ✅ Admitir novo doente (criar ficha + atribuir cama)
- ✅ Ver lista de internados
- ✅ Ver ficha básica (sem dados clínicos detalhados)

**Consultas** (se serviço = consultas_externas)
- ✅ Agendar consulta para doente
- ✅ Ver agenda do dia / semana
- ✅ Cancelar ou remarcar consulta

**Sala de Espera** (se serviço = urgencia)
- ✅ Registar check-in de doente na sala de espera
- ✅ Chamar doente
- ✅ Ver fila ordenada por prioridade e tempo de espera

**Urgência** (se serviço = urgencia)
- ✅ Ver episódios abertos
- ✅ Registar dados administrativos do episódio

### Mobile — Tabs
`Doentes` · `Tarefas` · `Mais`

**Tab Mais:** Horários · Camas

---

## 7. OPERACIONAL (`role: operacional`)

### Sub-roles disponíveis
`transporte_interno` (Maqueiro) · `cssd` (Esterilização) · `higiene_hospitalar` · `gestao_textil` · `equipamentos_medicos` · `facilities` · `vigilancia` · `seguranca_trabalho`

### Web — Menus visíveis

| Menu | Visível? |
|---|---|
| Tarefas | ✅ |
| Pedidos Internos | ✅ |
| Comunicação | ✅ |

### Web — O que pode fazer

**Tarefas**
- ✅ Ver tarefas logísticas atribuídas ao grupo operacional
- ✅ Alterar estado (em progresso / concluída)

**Pedidos Internos**
- ✅ Ver pedidos do tipo que lhe corresponde (transporte, limpeza, esterilização)
- ✅ Assumir pedido como executor
- ✅ Marcar como concluído

### Mobile — Tabs
`Tarefas` · `Mais`

---

## 8. TI (`role: ti`)

### Sub-roles e o que muda por sub-role

| Sub-role | Label | Menus extra |
|---|---|---|
| `it_admin` | IT Admin | ✅ **Utilizadores** + **Configurações** |
| `cio` | CIO | ❌ (igual a ti base) |
| `his_erp` | HIS/ERP | ❌ |
| `database_admin` | DBA | ❌ |
| `security_officer` | Cibersegurança | ❌ |
| `dados_clinicos` | BI/Dados | ❌ |

### Web — Menus visíveis (todos os sub-roles TI)

| Menu | Visível? | Condição |
|---|---|---|
| Dashboard TI | ✅ | — |
| Incidentes TI | ✅ | — |
| Pedidos TI | ✅ | — |
| Auditoria | ✅ | — |
| Comunicação | ✅ | — |
| Utilizadores | 🔒 | Só `it_admin` |
| Configurações | 🔒 | Só `it_admin` |

### Web — O que pode fazer

**Dashboard TI**
- ✅ Ver métricas: incidentes abertos por prioridade, pedidos pendentes, tempo médio de resolução

**Incidentes TI**
- ✅ Ver todos os incidentes (filtro por tipo, prioridade, estado)
- ✅ Criar novo incidente
- ✅ Atribuir incidente a técnico responsável
- ✅ Alterar estado (aberto → em análise → resolvido → fechado)

**Pedidos TI**
- ✅ Ver pedidos de outros serviços (dados, relatórios, acessos, backups)
- ✅ Atribuir pedido a responsável TI
- ✅ Marcar como em curso / concluído / recusado

**Auditoria**
- ✅ Ver log completo de todas as ações do sistema
- ✅ Filtrar por utilizador, ação, entidade, data

**Utilizadores** 🔒 `it_admin` only
- ✅ Criar novos utilizadores (todos os roles)
- ✅ Editar role, sub-role, serviço, equipa, ordem de experiência
- ✅ Desativar utilizador

**Configurações** 🔒 `it_admin` only
- ✅ Criar, editar e desativar roles (categorias)
- ✅ Criar, editar e desativar sub-roles
- ✅ Alterar label, categoria e ordem de roles e sub-roles

### Mobile — Tabs
`Dashboard TI` · `Incidentes` · `Pedidos` · `Mais`

**Tab Mais contém:**
- Utilizadores (só `it_admin`)
- Auditoria

---

## 9. QUALIDADE (`role: qualidade`)

### Sub-roles disponíveis
`quality_manager` · `compliance` · `infection_control` · `internal_audit` · `dpo_role` · `compliance_director`

### Web — Menus visíveis

| Menu | Visível? |
|---|---|
| IACS | ✅ |
| Auditoria | ✅ |
| Comunicação | ✅ |

> Role com acesso muito limitado na plataforma atual — essencialmente leitura de dados de qualidade e auditoria.

### Web — O que pode fazer

**IACS**
- ✅ Ver dispositivos invasivos ativos por serviço
- ✅ Ver taxas e tendências de IACS

**Auditoria**
- ✅ Ver log de auditoria completo (read-only)
- ✅ Filtrar por utilizador, ação, data

### Mobile — Tabs
`Auditoria` · `Mais`

---

## 10. DIREÇÃO (`role: direcao`)

### Sub-roles disponíveis
`ceo_hospitalar` · `diretor_medico` · `head_nurse` · `cfo` · `coo` · `hr_director`

### Web — Menus visíveis

| Menu | Visível? |
|---|---|
| Dashboard TI | ✅ |
| Comunicação | ✅ |

> A direção vê atualmente o mesmo dashboard que o TI (incidentes e pedidos). Não tem dashboard executivo/clínico próprio.

### Mobile — Tabs
`Dashboard TI` · `Mais`

---

## 11. O Que Todos Podem Fazer (universal)

Independentemente do role:
- ✅ **Login** com número de funcionário + password
- ✅ **Alterar a própria password**
- ✅ **Comunicação** — enviar mensagens internas e ver anúncios do serviço
- ✅ **Logout**
- ✅ **Ver perfil** (nome, role, sub-role, serviço, número de funcionário)

---

## 12. Resumo Visual por Role

| | Doentes | Medicação | Turno/Escala | Trocas | Urgência | Bloco | Farmácia | TI | Admin |
|---|---|---|---|---|---|---|---|---|---|
| **Médico** | ✅ Ver+Prescrever+Alta | ✅ Prescreve | ✅ | ✅ | ⚠️ | ⚠️ | ❌ | ❌ | ❌ |
| **Enfermeiro** | ✅ Ver+Administrar | ✅ Administra | ✅ | ✅ | ⚠️ | ⚠️ | ❌ | ❌ | ❌ |
| **Auxiliar** | ✅ Ver+Administrar | ✅ Administra | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| **Tec. Saúde** | ✅ Ver | ❌ | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| **Farmacêutico** | ❌ | ✅ Valida | ✅ | ✅ | ❌ | ❌ | ✅ Stock | ❌ | ❌ |
| **Administrativo** | ✅ Admissão | ❌ | ✅ | ❌ | ⚠️ | ❌ | ❌ | ❌ | ✅ Agenda |
| **Operacional** | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ Pedidos |
| **TI** | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ Total | ✅ Utilizadores* |
| **Qualidade** | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ Auditoria |
| **Direção** | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ Leitura | ❌ |

*Utilizadores só para `ti/it_admin`

---

## 13. Limitações Atuais e Sugestões

| Role | Limitação atual | Sugestão |
|---|---|---|
| **Direção** | Só vê dashboard TI, sem dashboard executivo clínico | Criar dashboard direção com KPIs (ocupação, altas, urgência) |
| **Qualidade** | Acesso muito reduzido (só IACS + auditoria) | Dar acesso a relatórios, indicadores de qualidade, métricas IACS |
| **Administrativo** | Sem dashboard próprio (usa o clínico) | Dashboard com agendamentos, admissões, faturação |
| **Farmacêutico** | Sem acesso à ficha do doente | Considerar acesso read-only a alergias e medicação ativa |
| **Operacional** | Só tarefas e pedidos, sem dashboard | Dashboard de pedidos pendentes por tipo |
| **Médico** | Não vê consultas se serviço ≠ consultas_externas | Considerar acesso universal a consultas para todos os médicos |
| **Todos** | Sem notificações push reais | Implementar Firebase/Expo push para alertas de trocas, tarefas urgentes, incidentes |
| **Direção/Qualidade** | Mobile muito limitado | Adicionar ecrãs de relatórios e indicadores no mobile |
