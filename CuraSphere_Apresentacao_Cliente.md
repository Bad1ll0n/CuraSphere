---
marp: true
theme: default
paginate: true
backgroundColor: #ffffff
color: #0f172a
style: |
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800;900&display=swap');

  * { box-sizing: border-box; }

  section {
    font-family: 'Inter', 'Segoe UI', sans-serif;
    padding: 52px 60px;
    font-size: 15px;
    line-height: 1.6;
    background: #ffffff;
    color: #0f172a;
  }

  section.capa {
    background: linear-gradient(135deg, #0f172a 0%, #1e3a5f 60%, #0f172a 100%);
    color: #ffffff;
    display: flex;
    flex-direction: column;
    justify-content: center;
    align-items: flex-start;
    padding: 64px 72px;
  }

  section.secao {
    background: linear-gradient(135deg, #1e40af 0%, #1d4ed8 100%);
    color: #ffffff;
    display: flex;
    flex-direction: column;
    justify-content: center;
    align-items: flex-start;
    padding: 64px 72px;
  }

  section.secao-dark {
    background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%);
    color: #ffffff;
    display: flex;
    flex-direction: column;
    justify-content: center;
    align-items: flex-start;
    padding: 64px 72px;
  }

  section.final {
    background: linear-gradient(135deg, #064e3b 0%, #065f46 100%);
    color: #ffffff;
    display: flex;
    flex-direction: column;
    justify-content: center;
    align-items: center;
    text-align: center;
    padding: 64px 72px;
  }

  h1 {
    font-size: 2.6rem;
    font-weight: 800;
    line-height: 1.15;
    margin: 0 0 0.4em 0;
    letter-spacing: -0.02em;
  }

  h2 {
    font-size: 1.7rem;
    font-weight: 700;
    line-height: 1.2;
    margin: 0 0 0.6em 0;
    letter-spacing: -0.01em;
    color: #0f172a;
  }

  h3 {
    font-size: 1.1rem;
    font-weight: 700;
    color: #1d4ed8;
    margin: 0.8em 0 0.4em 0;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    font-size: 0.78rem;
  }

  p { margin: 0.4em 0; }

  ul {
    padding-left: 1.2em;
    margin: 0.3em 0;
  }

  li {
    margin-bottom: 0.35em;
    line-height: 1.5;
  }

  strong { color: #1d4ed8; font-weight: 700; }

  .secao h1, .secao h2, .secao h3,
  .secao-dark h1, .secao-dark h2, .secao-dark h3,
  .capa h1, .capa h2, .capa h3,
  .final h1, .final h2, .final h3 {
    color: #ffffff;
  }

  .secao strong, .secao-dark strong, .capa strong, .final strong {
    color: #93c5fd;
  }

  table {
    width: 100%;
    border-collapse: collapse;
    font-size: 0.82rem;
    margin-top: 0.6em;
  }

  th {
    background: #1e40af;
    color: #fff;
    padding: 9px 14px;
    text-align: left;
    font-weight: 600;
    font-size: 0.75rem;
    text-transform: uppercase;
    letter-spacing: 0.04em;
  }

  td {
    padding: 8px 14px;
    border-bottom: 1px solid #e2e8f0;
    vertical-align: top;
  }

  tr:nth-child(even) td { background: #f8fafc; }

  blockquote {
    border: none;
    background: #eff6ff;
    border-left: 4px solid #2563eb;
    padding: 14px 18px;
    border-radius: 0 10px 10px 0;
    margin: 1em 0;
    font-style: normal;
    color: #1e3a5f;
    font-size: 0.88rem;
  }

  code {
    background: #f1f5f9;
    color: #0369a1;
    padding: 2px 7px;
    border-radius: 4px;
    font-size: 0.82em;
    font-family: 'JetBrains Mono', 'Fira Code', monospace;
  }

  .grid-2 {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 20px;
    margin-top: 16px;
  }

  .grid-3 {
    display: grid;
    grid-template-columns: 1fr 1fr 1fr;
    gap: 16px;
    margin-top: 16px;
  }

  .card {
    background: #f8fafc;
    border: 1px solid #e2e8f0;
    border-radius: 14px;
    padding: 18px 20px;
  }

  .card-blue {
    background: #eff6ff;
    border: 1px solid #bfdbfe;
    border-radius: 14px;
    padding: 18px 20px;
  }

  .card-dark {
    background: rgba(255,255,255,0.10);
    border: 1px solid rgba(255,255,255,0.18);
    border-radius: 14px;
    padding: 18px 20px;
  }

  .card-title {
    font-weight: 700;
    font-size: 0.88rem;
    margin-bottom: 8px;
    display: block;
  }

  .pill {
    display: inline-block;
    padding: 3px 10px;
    border-radius: 20px;
    font-size: 0.72rem;
    font-weight: 600;
    margin: 2px 2px;
  }

  .pill-blue  { background: #dbeafe; color: #1d4ed8; }
  .pill-green { background: #dcfce7; color: #166534; }
  .pill-violet { background: #ede9fe; color: #6d28d9; }
  .pill-teal  { background: #ccfbf1; color: #0f766e; }
  .pill-rose  { background: #ffe4e6; color: #be123c; }
  .pill-amber { background: #fef3c7; color: #92400e; }
  .pill-slate { background: #f1f5f9; color: #475569; }

  .badge-done { color: #16a34a; font-weight: 700; }
  .badge-soon { color: #d97706; font-weight: 700; }
  .badge-future { color: #94a3b8; }

  .num-big {
    font-size: 2.8rem;
    font-weight: 800;
    color: #1d4ed8;
    line-height: 1;
    display: block;
  }

  .num-label {
    font-size: 0.78rem;
    color: #64748b;
    font-weight: 500;
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }

  .secao .num-big, .secao-dark .num-big, .capa .num-big {
    color: #93c5fd;
  }

  .secao .num-label, .secao-dark .num-label, .capa .num-label {
    color: #bfdbfe;
  }

  .role-badge {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 5px 12px;
    border-radius: 8px;
    font-size: 0.78rem;
    font-weight: 600;
    margin: 3px;
  }

  section::after {
    font-size: 11px;
    color: #94a3b8;
  }

  .capa section::after, .secao section::after,
  .secao-dark section::after, .final section::after {
    color: rgba(255,255,255,0.35);
  }
---

<!-- _class: capa -->
<!-- _paginate: false -->

<br>

# CuraSphere

### Plataforma Integrada de Gestão Hospitalar

<br>

> **Web · Mobile · Tempo Real**
> Uma solução para toda a equipa — clínica, operacional e de TI

<br><br>

<span style="font-size:0.85rem; color: #94a3b8;">Apresentação Comercial · Abril 2026</span>

---

<!-- _class: secao -->
<!-- _paginate: false -->

<br>

# O Desafio

### Os hospitais de hoje gerem dezenas de sistemas diferentes

---

## O Problema da Fragmentação

<div class="grid-2">

<div class="card-dark" style="background:rgba(255,255,255,0.08)">
<span class="card-title" style="color:#f87171">❌ Sem integração</span>

- Folhas de cálculo para escalas
- WhatsApp para comunicação clínica
- Email para pedidos internos
- Papel para passagem de turno
- Sistemas isolados por departamento

</div>

<div class="card-dark" style="background:rgba(255,255,255,0.08)">
<span class="card-title" style="color:#f87171">❌ Riscos operacionais</span>

- Informação perdida entre turnos
- Sem rastreabilidade de ações clínicas
- Medicação sem validação formal
- Ausência de alertas em tempo real
- Erros de comunicação críticos

</div>

</div>

<br>

> **O resultado:** equipas sobrecarregadas, dados dispersos e risco clínico elevado.

---

<!-- _class: secao-dark -->
<!-- _paginate: false -->

<br>

# A Solução

### Uma plataforma única. Para toda a equipa. Em qualquer dispositivo.

---

## O Que é o CuraSphere

<div class="grid-3">

<div class="card-blue">
<span class="card-title">🌐 Aplicação Web</span>

Interface completa para desktop. Dashboards, fichas clínicas, gestão de escalas, relatórios. Acesso por browser, sem instalação.

</div>

<div class="card-blue">
<span class="card-title">📱 Aplicação Mobile</span>

iOS e Android nativos. Ao lado do doente, no corredor, ou em deslocação. Scanner QR para acesso imediato à ficha.

</div>

<div class="card-blue">
<span class="card-title">⚡ Tempo Real</span>

Mensagens internas instantâneas. Alertas clínicos. Comunicação entre serviços sem sair da plataforma.

</div>

</div>

<br>

<div class="grid-3" style="text-align:center; margin-top:8px;">

<div>
<span class="num-big">10</span>
<span class="num-label">Tipos de profissionais</span>
</div>

<div>
<span class="num-big">35+</span>
<span class="num-label">Módulos funcionais</span>
</div>

<div>
<span class="num-big">81</span>
<span class="num-label">Especializações configuráveis</span>
</div>

</div>

---

<!-- _class: secao -->
<!-- _paginate: false -->

<br>

# Adaptado a Cada Profissional

### Cada utilizador vê e faz exatamente o que a sua função exige — nada mais, nada menos

---

## 10 Perfis Profissionais

<div class="grid-2">

<div>

<div style="display:flex; flex-wrap:wrap; gap:6px; margin-bottom:16px;">
<span class="role-badge" style="background:#ede9fe; color:#6d28d9;">👨‍⚕️ Médico</span>
<span class="role-badge" style="background:#ccfbf1; color:#0f766e;">🩺 Enfermeiro</span>
<span class="role-badge" style="background:#f1f5f9; color:#475569;">🤝 Auxiliar</span>
<span class="role-badge" style="background:#e0f2fe; color:#0369a1;">🔬 Técnico de Saúde</span>
<span class="role-badge" style="background:#dcfce7; color:#166534;">💊 Farmacêutico</span>
</div>

<div style="display:flex; flex-wrap:wrap; gap:6px;">
<span class="role-badge" style="background:#fce7f3; color:#9d174d;">📋 Administrativo</span>
<span class="role-badge" style="background:#fef3c7; color:#92400e;">🔧 Operacional</span>
<span class="role-badge" style="background:#cffafe; color:#0e7490;">💻 TI</span>
<span class="role-badge" style="background:#e0e7ff; color:#3730a3;">✔️ Qualidade</span>
<span class="role-badge" style="background:#fef9c3; color:#713f12;">🏛️ Direção</span>
</div>

</div>

<div class="card-blue">
<span class="card-title">Como funciona</span>

- Login com número de funcionário
- O sistema reconhece o perfil automaticamente
- Sidebar e tabs adaptadas ao role
- Menus adicionais conforme o serviço (Urgência, Bloco, Consultas…)
- Especializações configuráveis sem tocar no código

</div>

</div>

---

## O Médico

<div class="grid-2">

<div>

**O que vê no menu:**
- Dashboard clínico (ocupação, estados)
- Lista de doentes internados
- Horários e escalas
- Tarefas e atribuições
- Trocas de turno

**Módulos por serviço:**
- 🏥 Internamento → Camas, fichas completas
- 🚨 Urgência → Episódios e triagem
- 🔪 Bloco → Agenda cirúrgica + Checklist WHO
- 📅 Consultas → Agenda de consultas

</div>

<div class="card-blue">
<span class="card-title">O que pode registar / fazer</span>

- ✅ Prescrever medicação
- ✅ Escrever notas SOAP
- ✅ Solicitar exames (RX, TC, análises…)
- ✅ Criar interconsultas
- ✅ Registar avaliações de risco
- ✅ Dar alta com sumário clínico
- ✅ Alterar estado clínico do doente
- ✅ Aceder por QR Code na cama

<br>

**81+ especializações:** Cardiologista, Cirurgião, Anestesista, Radiologista, Oncologista…

</div>

</div>

---

## O Enfermeiro

<div class="grid-2">

<div>

**O que vê no menu:**
- Dashboard clínico
- Doentes e camas
- **MAR** — Mapa de Administração de Registos
- IACS — Controlo de infeções
- Sala de Espera (se urgência)
- Bloco Operatório (se bloco)

</div>

<div class="card-blue">
<span class="card-title">O que pode registar / fazer</span>

- ✅ Registar sinais vitais (7 parâmetros)
- ✅ Administrar medicação prescrita
- ✅ Preencher escalas clínicas (RASS, SOFA, Barthel, CPOT…)
- ✅ Inserir / remover dispositivos invasivos
- ✅ Realizar triagem (5 cores Manchester)
- ✅ Passagem de turno digital
- ✅ Solicitar pedidos internos

<br>

**Chefe de turno** definido automaticamente por nível de experiência — sem role extra

</div>

</div>

---

## Equipa de Suporte Clínico

<div class="grid-3">

<div class="card">
<span class="card-title" style="color:#0369a1">💊 Farmacêutico</span>

- Gestão de stock (medicamentos, materiais, consumíveis)
- **Validação de prescrições médicas** — aprovação ou rejeição com motivo
- Pedidos de reposição por serviço
- Alertas de stock mínimo

</div>

<div class="card">
<span class="card-title" style="color:#0f766e">🔬 Técnico de Saúde</span>

- Planos de reabilitação com objetivos
- Sessões de fisioterapia com registo de evolução
- Worklist de imagiologia
- Notas e escalas específicas (FIM, MRC, FOIS…)

</div>

<div class="card">
<span class="card-title" style="color:#9d174d">📋 Administrativo</span>

- Admissão de doentes
- Agendamento de consultas
- Gestão da sala de espera
- Controlo de camas
- Pedidos internos

</div>

</div>

---

## Operacional, TI e Gestão

<div class="grid-3">

<div class="card">
<span class="card-title" style="color:#92400e">🔧 Operacional</span>

- Pedidos de transporte, limpeza, esterilização e equipamento
- Tarefas logísticas atribuídas por prioridade
- Execução e confirmação de pedidos

</div>

<div class="card">
<span class="card-title" style="color:#0e7490">💻 TI</span>

- Dashboard com métricas de incidentes
- Gestão de incidentes (aberto → resolvido)
- Pedidos de dados, acessos e relatórios
- **IT Admin:** gestão de utilizadores e configurações

</div>

<div class="card">
<span class="card-title" style="color:#3730a3">✔️ Qualidade / Direção</span>

- Log de auditoria completo de todas as ações
- Dados IACS (infeções associadas a cuidados)
- Métricas e indicadores hospitalares
- Acesso de leitura sem interferência clínica

</div>

</div>

---

<!-- _class: secao -->
<!-- _paginate: false -->

<br>

# Módulos Clínicos

### Cobertura completa do ciclo clínico do doente

---

## Da Admissão à Alta

<div class="grid-2">

<div>

**Internamento**
- Admissão com cama, diagnóstico e dados demográficos
- Estados: estável, grave, crítico, alta prevista
- Isolamento com motivo registado
- Contactos de emergência e alergias
- Alta com sumário clínico completo

**Documentação Clínica**
- Notas SOAP (Subjetivo, Objetivo, Avaliação, Plano)
- 14 escalas clínicas especializadas
- Sinais vitais com 7 parâmetros
- Avaliações de risco estruturadas
- Alertas clínicos ativos

</div>

<div>

**Medicação**
- Prescrição médica digital
- Validação farmacêutica obrigatória
- Registo de administração com hora e técnico
- Histórico completo por doente

**Exames e Procedimentos**
- Solicitação de 7 tipos de exame (análises, RX, TC, RMN, ECO, ECG…)
- Resultados registados diretamente
- Interconsultas entre especialidades
- 10 tipos de dispositivos invasivos monitorados

</div>

</div>

---

## Urgência, Bloco e Consultas

<div class="grid-3">

<div class="card-blue">
<span class="card-title">🚨 Urgência</span>

- Triagem pelo **sistema de Manchester** (5 cores)
- Sinais vitais na triagem
- Gestão de episódios em tempo real
- Estados: triagem → atendimento → alta / internado / transferido
- Médico responsável atribuído ao episódio

</div>

<div class="card-blue">
<span class="card-title">🔪 Bloco Operatório</span>

- Agenda cirúrgica com sala, cirurgião e anestesista
- Equipa cirúrgica configurável
- **Checklist WHO** completo — Sign In, Time Out, Sign Out
- Notas pré e pós-operatórias
- Registo de complicações

</div>

<div class="card-blue">
<span class="card-title">📅 Consultas Externas</span>

- Agenda por especialidade e médico
- Duração configurável
- Estados: agendada, realizada, faltou, cancelada
- Diagnóstico e notas da consulta
- Marcação de próxima consulta

</div>

</div>

---

<!-- _class: secao -->
<!-- _paginate: false -->

<br>

# Gestão de Turnos

### Escalas, trocas e passagens de turno — tudo digital

---

## Turnos e Escalas

<div class="grid-2">

<div class="card-blue">
<span class="card-title">📅 Escalas Mensais</span>

- Criação da escala mês a mês
- Turnos manhã / tarde / noite
- Profissionais atribuídos por turno
- Doentes atribuídos a cada profissional
- Check-in digital no início do turno

</div>

<div class="card-blue">
<span class="card-title">🔄 Trocas de Turno</span>

- Pedido entre colegas do mesmo perfil
- Notificação ao destinatário para aceitar / recusar
- Aprovação pelo chefe de turno
- **Troca automática** no horário após aprovação
- Histórico de todos os pedidos

</div>

</div>

<br>

> O **chefe de turno** é determinado automaticamente pelo sistema — o profissional com maior experiência no grupo, sem necessidade de atribuição manual.

---

## Passagem de Turno e Tarefas

<div class="grid-2">

<div>

**Passagem de Turno Digital**
- Informação estruturada do turno anterior
- Estado de cada doente atribuído
- Alertas e pendências destacados
- Confirmação de receção

<br>

**Tarefas Clínicas e Logísticas**
- Prioridade: baixa, média, alta, urgente
- Atribuição a profissional ou grupo
- Transição automática para o turno seguinte
- Histórico de conclusão

</div>

<div class="card">
<span class="card-title">No Mobile</span>

O ecrã de **Turno** mostra ao profissional:
- Os doentes atribuídos a si neste turno
- As tarefas pendentes
- Botão de passagem de turno direta

O botão **QR** no centro da tab bar abre a câmara — basta apontar para o QR da cama para abrir a ficha do doente em segundos.

</div>

</div>

---

<!-- _class: secao-dark -->
<!-- _paginate: false -->

<br>

# Comunicação e Colaboração

### Toda a equipa ligada, em tempo real

---

## Comunicação Interna

<div class="grid-2">

<div class="card-dark">
<span class="card-title" style="color:#93c5fd">💬 Mensagens Diretas</span>

- Mensagens 1-para-1 entre qualquer profissional
- Histórico completo por conversa
- Marcação como lida
- Tempo real via Socket.IO

</div>

<div class="card-dark">
<span class="card-title" style="color:#93c5fd">📢 Anúncios de Serviço</span>

- Publicados por qualquer profissional autorizado
- Visíveis para todo o serviço ou hospital
- Data de expiração configurável
- Visíveis em web e mobile

</div>

</div>

<br>

<div class="card-dark">
<span class="card-title" style="color:#93c5fd">🔧 Pedidos Internos</span>

Qualquer serviço pode solicitar diretamente ao operacional: **transporte de doente, limpeza de quarto, esterilização de material ou equipamento urgente** — com prioridade, destino e estado em tempo real.

</div>

---

<!-- _class: secao -->
<!-- _paginate: false -->

<br>

# Segurança e Conformidade

### Auditoria total. Acesso controlado. Dados protegidos.

---

## Segurança de Ponta a Ponta

<div class="grid-2">

<div>

**Autenticação**
- Login por número de funcionário + password
- Tokens JWT com rotação automática
- Sessão expira após 15 min de inatividade (mobile)
- Alteração de password pelo próprio utilizador

**Controlo de Acessos**
- Cada profissional vê apenas o que lhe compete
- Menus filtrados por role e serviço
- Ações protegidas por guards no servidor
- Sub-roles com permissões adicionais

</div>

<div>

**Auditoria Completa**
- Todas as ações registadas automaticamente
- IP e dispositivo de cada acesso
- Filtros por utilizador, ação, data, entidade
- Não é possível apagar registos de auditoria

**Infraestrutura**
- Headers de segurança (Helmet)
- Rate limiting contra ataques de força bruta
- Base de dados PostgreSQL com migrações versionadas
- Passwords com hash bcrypt (irreversível)

</div>

</div>

---

<!-- _class: secao-dark -->
<!-- _paginate: false -->

<br>

# Tecnologia

### Moderno, escalável e preparado para crescer

---

## Stack Tecnológico

<div class="grid-2">

<div>

| Componente | Tecnologia |
|---|---|
| **API REST** | NestJS (Node.js) |
| **Base de Dados** | PostgreSQL + Prisma ORM |
| **Aplicação Web** | Next.js 14 + Tailwind CSS |
| **Aplicação Mobile** | React Native + Expo |
| **Monorepo** | Nx Workspace |
| **Comunicação** | Socket.IO (real-time) |
| **Linguagem** | TypeScript em toda a stack |

</div>

<div class="card-dark">
<span class="card-title" style="color:#93c5fd">Porquê esta stack?</span>

**TypeScript em toda a stack** — um único modelo de dados partilhado entre API, Web e Mobile elimina inconsistências.

**Next.js 14 App Router** — Server-side rendering, performance máxima, SEO, sem configuração extra.

**React Native + Expo** — Um único codebase para iOS e Android, distribuição simplificada.

**Nx Monorepo** — Web, Mobile e API no mesmo repositório, com builds otimizados e dependências partilhadas.

</div>

</div>

---

<!-- _class: secao -->
<!-- _paginate: false -->

<br>

# Estado Atual

### O que está construído e o que está a caminho

---

## O Que Está Pronto Hoje

<div class="grid-3" style="font-size:0.82rem;">

<div class="card">
<span class="card-title">✅ Clínico</span>

- Doentes e internamentos
- Fichas completas com notas SOAP
- Sinais vitais (7 parâmetros)
- 14 escalas clínicas
- Medicação com validação farmacêutica
- Exames e resultados
- Interconsultas
- Dispositivos invasivos
- Avaliações de risco
- Alta com sumário clínico

</div>

<div class="card">
<span class="card-title">✅ Operacional</span>

- Urgência e triagem Manchester
- Bloco com checklist WHO
- Consultas externas
- Sala de espera
- Farmácia e stock
- Fisioterapia
- Pedidos internos
- Escalas e trocas de turno
- Passagem de turno digital
- Atribuições doente ↔ profissional

</div>

<div class="card">
<span class="card-title">✅ Gestão</span>

- 10 roles + 81 sub-roles configuráveis
- Auditoria completa de todas as ações
- Dashboard TI (incidentes, pedidos)
- Incidentes e pedidos TI
- Comunicação real-time
- IACS
- Utilizadores: CRUD completo
- Configurações via UI

</div>

</div>

---

## Roadmap — O Que Está a Vir

<div class="grid-2">

<div>

**🔶 Alta Prioridade**

| Feature | Estimativa |
|---|---|
| Notificações push (iOS + Android) | Em breve |
| Upload de ficheiros de exames | Em breve |
| Pesquisa global (doentes, profissionais) | Em breve |
| Dashboard executivo para Direção | Em breve |

</div>

<div>

**🔷 Médio Prazo**

| Feature | Estimativa |
|---|---|
| Relatórios PDF (alta, escala, auditoria) | Q3 2026 |
| Consentimentos informados digitais | Q3 2026 |
| Agenda visual de consultas (calendário) | Q3 2026 |
| Mobile: Bloco, Urgência, Consultas | Q3 2026 |
| Notificações in-app (sino com badge) | Q3 2026 |

</div>

</div>

---

<!-- _class: secao-dark -->
<!-- _paginate: false -->

<br>

# Porquê CuraSphere?

---

## 6 Razões para Escolher o CuraSphere

<div class="grid-2">

<div class="card-dark">
<span class="card-title" style="color:#93c5fd">🎯 Tudo numa plataforma</span>

Web + Mobile + Real-time. Da triagem à alta, do stock à auditoria — sem saltar entre sistemas.

</div>

<div class="card-dark">
<span class="card-title" style="color:#93c5fd">👤 Experiência adaptada</span>

Cada profissional vê apenas o que precisa. Sem ruído, sem informação desnecessária.

</div>

<div class="card-dark">
<span class="card-title" style="color:#93c5fd">📱 Mobile-first</span>

Ao lado do doente com o telemóvel. Scanner QR direto à ficha. Sem papéis, sem espera.

</div>

<div class="card-dark">
<span class="card-title" style="color:#93c5fd">🔒 Seguro e auditável</span>

Cada ação registada. Acessos controlados ao detalhe. Conformidade com regulamentação.

</div>

<div class="card-dark">
<span class="card-title" style="color:#93c5fd">⚙️ Configurável sem código</span>

Roles, sub-roles e especializações geridas pela equipa de TI via interface — sem deployments.

</div>

<div class="card-dark">
<span class="card-title" style="color:#93c5fd">🚀 Moderno e escalável</span>

Arquitetura preparada para crescer. Novos módulos adicionados sem impacto no que já existe.

</div>

</div>

---

<!-- _class: final -->
<!-- _paginate: false -->

<br>

# Obrigado

<br>

### Estamos prontos para demonstrar o CuraSphere em ambiente real

<br>

---

<div style="display:flex; gap:40px; justify-content:center; flex-wrap:wrap; margin-top:8px;">

<div>
<div style="font-size:0.8rem; color:rgba(255,255,255,0.6); margin-bottom:4px;">EMAIL</div>
<div style="font-size:1rem; font-weight:600;">xfilipe7@gmail.com</div>
</div>

</div>

<br><br>

<span style="font-size:0.75rem; color:rgba(255,255,255,0.35);">CuraSphere · Plataforma de Gestão Hospitalar · 2026</span>
