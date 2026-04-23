---
marp: true
theme: default
paginate: true
backgroundColor: #f8fafc
color: #1e293b
style: |
  section {
    font-family: 'Segoe UI', sans-serif;
    padding: 48px 56px;
  }
  h1 { color: #0f172a; font-size: 2rem; margin-bottom: 0.3em; }
  h2 { color: #1e40af; font-size: 1.5rem; border-bottom: 2px solid #bfdbfe; padding-bottom: 8px; }
  h3 { color: #1d4ed8; font-size: 1.1rem; margin-bottom: 0.3em; }
  strong { color: #1d4ed8; }
  ul { line-height: 1.8; }
  li { margin-bottom: 2px; }
  table { width: 100%; border-collapse: collapse; font-size: 0.85rem; }
  th { background: #1e40af; color: white; padding: 8px 12px; text-align: left; }
  td { padding: 7px 12px; border-bottom: 1px solid #e2e8f0; }
  tr:nth-child(even) td { background: #f1f5f9; }
  .capa { text-align: center; display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100%; }
  code { background: #e0f2fe; padding: 2px 6px; border-radius: 4px; font-size: 0.85em; color: #075985; }
  blockquote { border-left: 4px solid #3b82f6; background: #eff6ff; padding: 12px 16px; border-radius: 0 8px 8px 0; font-style: normal; }
---

<!-- _backgroundColor: #0f172a -->
<!-- _color: #f8fafc -->

<br><br>

# CuraSphere

### Plataforma de Gestão Hospitalar

<br>

> Sistema integrado para gestão clínica, operacional e de TI

<br><br>

**Abril 2026**

---

## Visão Geral

**CuraSphere** é uma plataforma hospitalar full-stack que unifica a gestão de doentes, profissionais, turnos e operações numa única solução — acessível em web e mobile.

<br>

| Dimensão | Detalhe |
|----------|---------|
| **Tipo** | Plataforma hospitalar multi-role |
| **Plataformas** | Web (browser) + Mobile (iOS / Android) |
| **Utilizadores** | Médicos, Enfermeiros, Administrativos, TI, Direção… |
| **Base de dados** | PostgreSQL com migrações versionadas |
| **Autenticação** | JWT com guard de role + sub-role |

---

## Stack Tecnológico

<br>

| Camada | Tecnologia |
|--------|-----------|
| **API** | NestJS · Prisma ORM · PostgreSQL |
| **Web** | Next.js 14 (App Router) · Tailwind CSS |
| **Mobile** | React Native · Expo |
| **Monorepo** | Nx Workspace |
| **Auth** | JWT (access + refresh tokens) · bcryptjs |
| **Real-time** | Socket.IO (comunicação interna) |
| **Segurança** | Helmet · Throttler · Rate limiting |

---

## Arquitetura

```
Nx Monorepo
├── apps/
│   ├── api/          ← NestJS REST API (porta 3000)
│   │   ├── src/app/  ← módulos: auth, doentes, turnos, trocas…
│   │   └── src/prisma/ ← schema, migrations, seed
│   ├── web/          ← Next.js (porta 4200)
│   │   └── src/app/(dashboard)/
│   └── mobile/       ← React Native / Expo
│       └── src/screens/
└── libs/             ← shared types (futuro)
```

<br>

> A API é a única fonte de verdade. Web e Mobile consomem os mesmos endpoints REST.

---

## Sistema de Roles

10 categorias fixas em base de dados + **81 sub-roles** dinâmicas (geríveis via UI)

<br>

| Role | Label | Exemplos de Sub-role |
|------|-------|----------------------|
| `medico` | Médico | Cardiologista, Cirurgião, Anestesia |
| `enfermeiro` | Enfermeiro | Generalista, UCI, Instrumentista |
| `auxiliar` | Auxiliar | Apoio Geral |
| `tecnico_saude` | Técnico de Saúde | Fisioterapeuta, Nutricionista |
| `farmaceutico` | Farmacêutico | Hospitalar, Oncológico |
| `administrativo` | Administrativo | Rececionista, Faturação, RH |
| `operacional` | Operacional | Limpeza, Manutenção, Segurança |
| `ti` | TI | **IT Admin**, Cibersegurança, DBA |
| `qualidade` | Qualidade | DPO, Controlo Infeção |
| `direcao` | Direção | CEO, Diretor Clínico, CFO |

---

## Autenticação & Autorização

<br>

- **Login** por `numeroFuncionario` + `password`
- **JWT** com `access_token` (curta duração) + `refresh_token` (longa duração)
- **Guards**: `@Roles('medico', 'enfermeiro')` + `@SubRoles('it_admin')`
- **Refresh automático** no cliente (intercept 401 → renova token → retry)

<br>

```
Utilizador { role: 'ti', subRole: 'it_admin' }
   → acede a Configurações, Utilizadores, Dashboard TI
   
Utilizador { role: 'medico', subRole: 'cardiologista' }
   → acede a Doentes, Bloco, Consultas, Prescrições
```

---

## Módulos Clínicos

<br>

| Módulo | Funcionalidades |
|--------|----------------|
| **Doentes** | Admissão, ficha clínica, alta |
| **Internamentos** | Camas, ocupação, transferências |
| **Consultas** | Agendamento, notas clínicas |
| **Bloco Operatório** | Agenda cirúrgica, checklist WHO |
| **Farmácia** | Prescrições, validação, dispensa |
| **IACs** | Registo de infeções associadas a cuidados |
| **Sala de Espera** | Triagem, tempos de espera, prioridade |
| **Urgência** | Fluxo de atendimento urgente |

---

## Módulos Operacionais & Clínicos (continuação)

<br>

| Módulo | Funcionalidades |
|--------|----------------|
| **Turnos / Horários** | Escala mensal, visualização por serviço |
| **Trocas de Turno** | Pedido → Aprovação destinatário → Aprovação chefe |
| **Atribuições** | Doentes atribuídos por turno e profissional |
| **Tarefas** | Checklist de tarefas por turno |
| **Comunicação** | Mensagens internas em tempo real (Socket.IO) |
| **Auditoria** | Log de todas as ações por utilizador |

---

## Módulos de TI & Gestão

<br>

| Módulo | Funcionalidades |
|--------|----------------|
| **Incidentes TI** | Registo, prioridade, estado, resolução |
| **Pedidos TI** | Pedidos de equipamento/acesso, aprovação |
| **Utilizadores** | CRUD completo, role + sub-role, equipa, experiência |
| **Configurações** | Gestão de roles e sub-roles (só `ti/it_admin`) |

<br>

> O Dashboard TI agrega incidentes abertos, pedidos pendentes e métricas de resolução

---

## Funcionalidade: Trocas de Turno

Fluxo de 3 etapas com validação automática de chefe:

<br>

```
Solicitante
  → pede troca com Colega (mesmo role, mesmo turno)
  
Destinatário
  → aceita ou recusa

Chefe de Turno (determinado por menor ordemExperiência no role)
  → aprova → profissionais trocam automaticamente no horário
  → rejeita → pedido encerrado
```

<br>

> O chefe não é um role fixo — é determinado dinamicamente pelo nível de experiência dentro do turno

---

## Plataforma Web

**Next.js 14** com App Router

- Dashboard adaptado ao role do utilizador (clínico / TI / direção / administrativo)
- Sidebar dinâmica com itens visíveis conforme permissões
- Tabelas com filtros, paginação e ações inline
- Modais para criar/editar entidades
- Formulários com validação client-side

<br>

**Dashboards por role:**

| Role | Dashboard |
|------|-----------|
| Médico / Enfermeiro | Doentes, camas, turnos |
| TI | Incidentes, pedidos, métricas |
| Administrativo | Agenda, faturação, admissões |
| Direção | Indicadores globais |

---

## Plataforma Mobile

**React Native + Expo**

- Navegação baseada em `grupoRole` do utilizador autenticado
- Ecrãs otimizados para uso em contexto clínico (touch-friendly)
- Pull-to-refresh em todos os ecrãs de listagem
- Modais nativos para criar/editar (chips de role, pickers, etc.)

<br>

**Ecrãs disponíveis:**

`Doentes` · `Turno atual` · `Horários` · `Trocas` · `Atribuições` · `Camas` · `Utilizadores` · `Pedidos TI` · `Perfil` · `Comunicação`

---

## Estado Atual

<br>

| Área | Estado |
|------|--------|
| API — todos os módulos | ✅ Completo |
| Migração role/sub-role | ✅ Aplicada |
| Seed (10 roles + 81 sub-roles) | ✅ Executado |
| Web — todos os módulos | ✅ Completo |
| Mobile — role checks e ecrãs | ✅ Completo |
| Mobile — subRole em criar/editar utilizador | ✅ Completo |
| Configurações roles via UI | ✅ Funcional |

---

<!-- _backgroundColor: #0f172a -->
<!-- _color: #f8fafc -->

<br><br><br>

# CuraSphere

### Plataforma de Gestão Hospitalar

<br>

> Gestão clínica, operacional e de TI numa única plataforma

<br><br>

**xfilipe7@gmail.com**
