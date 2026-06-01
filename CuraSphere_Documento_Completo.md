# CuraSphere — Documento Completo da Aplicação

> **Última actualização:** 2026-06-01 (sessão 45)
> **Estado geral:** Em desenvolvimento activo — backend completo, infraestrutura de produção pronta, web e mobile funcionais

---

## Índice

1. [Visão Geral](#1-visão-geral)
2. [Arquitectura Técnica](#2-arquitectura-técnica)
3. [Autenticação e Segurança](#3-autenticação-e-segurança)
4. [Sistema de Roles e Sub-roles](#4-sistema-de-roles-e-sub-roles)
5. [API — Módulos Implementados](#5-api--módulos-implementados)
6. [Web — Páginas Implementadas](#6-web--páginas-implementadas)
7. [Mobile — Screens Implementados](#7-mobile--screens-implementados)
8. [Tabela de Permissões por Role](#8-tabela-de-permissões-por-role)
9. [Funcionalidades Implementadas ✅](#9-funcionalidades-implementadas-)
10. [O Que Falta / Está Incompleto ❌](#10-o-que-falta--está-incompleto-)
11. [Prioridades de Desenvolvimento](#11-prioridades-de-desenvolvimento)
12. [Modelos de Dados (Prisma)](#12-modelos-de-dados-prisma)

---

## 1. Visão Geral

**CuraSphere** é uma plataforma hospitalar integrada que cobre:
- Gestão clínica (doentes, camas, medicação, sinais vitais, notas SOAP, escalas, exames)
- Logística hospitalar (turnos, trocas, atribuições, tarefas, pedidos internos)
- Serviços especializados (urgência, bloco operatório, consultas externas, farmácia, fisioterapia)
- Infraestrutura TI (incidentes, pedidos TI, gestão de utilizadores)
- Qualidade e compliance (IACS, auditoria, alertas)
- Comunicação interna (mensagens, anúncios)

**Plataformas:**
| Plataforma | Tecnologia | Porta | Estado |
|------------|-----------|-------|--------|
| API (backend) | NestJS + Prisma + PostgreSQL | 3000 | ✅ Completo |
| Web (frontend) | Next.js 14 App Router + Tailwind | 4200 | ✅ Maioria funcional |
| Mobile | React Native + Expo | — | ✅ Funcional (subset) |

---

## 2. Arquitectura Técnica

```
┌─────────────────────────────────────────────────────┐
│                    CuraSphere                        │
├──────────────┬──────────────────┬───────────────────┤
│  Mobile App  │    Web App       │    REST API        │
│  React Native│    Next.js 14    │    NestJS          │
│  Expo        │    App Router    │    Prisma ORM      │
│              │    Tailwind CSS  │    PostgreSQL       │
└──────────────┴──────────────────┴───────────────────┘
                         │
              ┌──────────┴──────────┐
              │    PostgreSQL DB     │
              │    (via Prisma)      │
              └─────────────────────┘
```

**Estrutura Nx Monorepo:**
```
enfermaria/
├── apps/
│   ├── api/          NestJS API
│   ├── web/          Next.js Web
│   └── mobile/       React Native / Expo
└── libs/
    ├── shared/       @org/shared — tipos TypeScript partilhados (Utilizador, Doente, Tarefa, Medicacao, Turno, Horario, AlertaClinico, Notificacao…)
    └── ui/           @org/ui — componentes React web partilhados (StatusBadge, EmptyState, LoadingSpinner, PageShell)
```

**Comandos de arranque:**
```bash
# API
cd apps/api && npx prisma migrate deploy --schema prisma/schema.prisma
cd apps/api && npx ts-node src/prisma/seed.ts

# Web
pnpm nx serve web

# Mobile
cd apps/mobile && npx expo start
```

---

## 3. Autenticação e Segurança

### Mecanismo (sessão 9 — actualizado)
- **JWT Access Token** em cookie `httpOnly; Secure; SameSite=Lax` (1h) + **Refresh Token** em cookie httpOnly (7d)
- Tokens **nunca expostos a JavaScript** — elimina risco de XSS com roubo de token
- Login: `POST /auth/login` → define cookies server-side via `@Res({ passthrough: true })` + `Set-Cookie`
- Se MFA activo: devolve `{ mfaPendente: true, mfaChallengeToken }` — token JWT de 5 min sem acesso a dados
- Renovação automática via `POST /auth/refresh` — lê cookie, emite novos cookies
- Logout via `POST /auth/logout` — invalida refresh token em BD + `clearCookie`
- Validação de sessão via `GET /auth/me`
- Axios web com `withCredentials: true` — cookies enviados automaticamente; interceptor de 401 faz refresh e retry

### MFA — Autenticação de 2 Fatores (sessão 9)
- **TOTP** compatível com Google Authenticator / Microsoft Authenticator (`otplib`)
- Activação: `GET /auth/mfa/setup` → devolve `secret` + QR code base64; `POST /auth/mfa/ativar` confirma com código 6 dígitos
- Login com MFA: 2 steps — credenciais → `mfaChallengeToken` (5min) → `POST /auth/mfa/verificar` → cookies
- Desactivação: `POST /auth/mfa/desativar` exige código TOTP válido
- Campos no modelo `Utilizador`: `mfaSecret String?`, `mfaAtivo Boolean @default(false)`
- Página `/perfil` com UI completa de setup/activação/desactivação + QR code
- Rate limit MFA: 10 tentativas / 10 minutos

### Proteção de Endpoints
```ts
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('medico', 'enfermeiro')         // role obrigatória
@SubRoles('it_admin')                  // sub-role adicional (opcional)
```

### Rate Limiting (sessão 9)
| Endpoint | Limite |
|---|---|
| `POST /auth/login` | 5 tentativas / 10 min |
| `POST /auth/mfa/verificar` | 10 tentativas / 10 min |
| Todos os outros | 60 req / 60s |
| Nginx (login) | 5 req/min (zona adicional) |

### Timeout de Sessão (Mobile)
- 15 minutos de inactividade em background → logout automático

### Refresh Token (BD)
- Modelo `RefreshToken` com `expiresAt`, `revogado`, `utilizadorId`
- Tokens expirados são limpos periodicamente

### Auditoria
- Middleware `AuditLog` regista todas as mutações (POST/PATCH/DELETE)
- Campos: `utilizadorId`, `acao`, `entidade`, `entidadeId`, `detalhes`, `ip`, `createdAt`
- Consultável via `GET /audit` (apenas `ti` e `qualidade`)

---

## 3B. Infraestrutura de Produção (sessão 9)

### Docker Compose (produção)
Ficheiro: `docker-compose.prod.yml` — 5 serviços na rede interna `curasphere-internal`:

| Serviço | Imagem | Função |
|---|---|---|
| `postgres` | postgres:16-alpine | Base de dados com volume persistente |
| `backup` | postgres:16-alpine | pg_dump diário às 2h, retenção 30 dias |
| `redis` | redis:7-alpine | Cache (256MB, `allkeys-lru`) |
| `api` | Dockerfile multi-stage | NestJS API |
| `web` | Dockerfile multi-stage | Next.js (standalone output) |
| `nginx` | nginx:1.27-alpine | Reverse proxy + SSL termination |

### Redis Cache
- `catalogo:todos` — TTL 1h (sem pesquisa); invalidado em criar/atualizar/desativar
- `camas:lista` — TTL 30s; invalidado em criar/atualizarEstado
- `camas:ocupacao` — TTL 30s; invalidado em criar/atualizarEstado
- Degradação silenciosa: se Redis cair, app continua a funcionar (queries diretas à BD)
- `RedisService` global com `connected` flag e try/catch em todos os métodos

### Nginx
- Reverse proxy: `/api/` → NestJS:3333, `/` → Next.js:3000
- Rate limiting: `login` (5r/m), `mfa/verificar` (10r/m), geral (60r/s)
- WebSocket upgrade para `/api/socket.io/`
- TLS 1.2/1.3 + HSTS + ssl_stapling
- Cache estático `/_next/static/` 365 dias

### Health Check
- `GET /health` — `@nestjs/terminus` verifica BD (Prisma ping) + Redis
- Docker healthcheck nos containers `api` e `web`
- Usado pelo `deploy.sh` para confirmar que API ficou healthy

### Deploy
- Script: `scripts/deploy.sh` — git pull → build → down → up -d → pg_trgm → wait healthy → ps
- `scripts/pg-trgm.sql` — `CREATE EXTENSION pg_trgm` + GIN indexes (idempotente)
- `scripts/backup-db.sh` — manual pg_dump com retenção 30 dias

### Soft Delete (sessão 9)
Campos `deletedAt DateTime?` adicionados a modelos críticos para rastreabilidade legal:
- `Doente`, `Medicacao`, `NotaClinica`, `RegistoMedicacao`
- Índice `@@index([deletedAt])` em cada modelo para filtros eficientes

### Pesquisa Full-Text (pg_trgm)
- Extensão `pg_trgm` para pesquisa fuzzy em PostgreSQL
- Índices GIN: `Doente.nome`, `CatalogoMedicamento.dci`, `CatalogoMedicamento.nomeMarca`
- Query de pesquisa com `ILIKE '%termo%'` beneficia automaticamente dos índices trigram

---

## 4. Sistema de Roles e Sub-roles

### 10 Roles-categoria (fixas)

| Role | Label | Grupo |
|------|-------|-------|
| `medico` | Médico | Clínico |
| `enfermeiro` | Enfermeiro | Clínico |
| `auxiliar` | Auxiliar | Clínico |
| `tecnico_saude` | Técnico de Saúde | Clínico |
| `farmaceutico` | Farmacêutico | Clínico |
| `administrativo` | Administrativo | Gestão |
| `operacional` | Operacional | Suporte |
| `ti` | TI | Tecnologia |
| `qualidade` | Qualidade | Compliance |
| `direcao` | Direção | Gestão |

### Sub-roles (81 dinâmicas, armazenadas em BD)

| Role | Sub-roles disponíveis |
|------|-----------------------|
| medico | clinico_geral, cardiologista, neurologista, ortopedista, pediatra, oncologista, pneumologista, gastroenterologista, nefrologista, dermatologista, psiquiatra, endocrinologista, reumatologista, cirurgiao_geral, cirurgiao_vascular, cirurgiao_toracico, neurocirurgiao, cirurgiao_pediatrico, medico_anestesia, medico_imagem, anatomia_patologica, medico_gestor, diretor_medico |
| enfermeiro | generalista, enf_bloco, enf_uci, enf_urgencia, enf_pediatria, enf_oncologia, enf_saude_mental, enf_geriatria, enf_neonatologia, supervisor_enfermagem, triador, instrumentista, head_nurse |
| auxiliar | apoio_geral |
| tecnico_saude | tae, reabilitacao_fisica, reabilitacao_fala, nutricao_clinica, psicologia_clinica, medico_trabalho |
| farmaceutico | farmaceutico_hospitalar, farmaceutico_oncologico, tecnico_farmacia_assist |
| administrativo | front_desk, secretariado, backoffice, scheduling, billing_officer, hr_specialist, procurement, cfo, coo, hr_director |
| operacional | transporte_interno, apoio_geral, cssd, higiene_hospitalar, gestao_textil, equipamentos_medicos, facilities, vigilancia, seguranca_trabalho |
| ti | it_admin, cio, his_erp, database_admin, security_officer, dados_clinicos |
| qualidade | quality_manager, compliance, infection_control, internal_audit, dpo_role, compliance_director |
| direcao | ceo_hospitalar, diretor_medico, head_nurse, cfo, coo, hr_director |

### Tabelas em BD
- `RoleConfig`: chave, label, categoria, ativo, ordem
- `SubRoleConfig`: chave, label, roleChave (FK → RoleConfig.chave), ativo, ordem

### Chefe de Turno
- Não é role nem sub-role
- Determinado pelo campo `chefeTurnoId` no modelo `Turno`
- Fallback: utilizador com menor `ordemExperiencia` no mesmo grupo de role do turno

---

## 5. API — Módulos Implementados

### 5.1 Auth
```
POST /auth/login          → login (email + password)
POST /auth/refresh        → renovar access token
POST /auth/logout         → invalidar refresh token
GET  /auth/me             → dados do utilizador autenticado
```

### 5.2 Utilizadores
```
GET    /utilizadores                   → lista (ti/it_admin)
POST   /utilizadores                   → criar utilizador
GET    /utilizadores/:id               → detalhe
PATCH  /utilizadores/:id               → editar
DELETE /utilizadores/:id               → desactivar
GET    /utilizadores/perfil            → perfil próprio
PATCH  /utilizadores/perfil            → editar perfil próprio
PATCH  /utilizadores/:id/password      → alterar password
```

### 5.3 Doentes
```
GET    /doentes                        → lista (com filtros: servico, estado, search)
POST   /doentes                        → admitir doente
GET    /doentes/:id                    → ficha completa
PATCH  /doentes/:id                    → editar dados
PATCH  /doentes/:id/alta               → dar alta
PATCH  /doentes/:id/transferir         → transferir serviço
PATCH  /doentes/:id/isolamento         → activar/desactivar isolamento
GET    /doentes/iacs/isolados          → doentes em isolamento activo
GET    /doentes/:id/timeline           → timeline clínica unificada (cronológica: admissão, sinais vitais, prescrições, administrações MAR, notas SOAP, tarefas, alertas, exames)
GET    /doentes/:id/alta/pdf           → PDF da nota de alta (dados, alergias, medicação, sinais vitais, notas clínicas)
```

### 5.4 Camas
```
GET    /camas                          → lista todas as camas (com filtros)
POST   /camas                          → criar cama
PATCH  /camas/:id                      → editar (estado, doente, etc.)
PATCH  /camas/:id/ocupar               → associar doente
PATCH  /camas/:id/libertar             → desocupar
```

### 5.5 Medicação
```
GET    /medicacao/:doenteId            → lista prescrições do doente
POST   /medicacao                      → prescrever medicamento
PATCH  /medicacao/:id                  → editar prescrição
DELETE /medicacao/:id                  → cancelar prescrição
POST   /medicacao/:id/administrar      → registar administração
GET    /medicacao/mar                  → MAR global (todas as medicações activas)
GET    /medicacao/interacoes?doenteId=&nome= → verificar interacções medicamentosas
```
**Verificação de alergias:** `prescrever()` consulta alergias activas antes de criar prescrição. Se houver correspondência, lança `409 ConflictException` com detalhes da alergia. Pode ser sobreposto com `forcarApesarDeAlergia=true`.
**Verificação de interacções:** `interacoes.json` com 50 pares de interacções medicamentosas; warning não-bloqueante retornado em `POST /medicacao` e consultável via `GET /medicacao/interacoes`.

### 5.6 Sinais Vitais
```
GET    /sinais-vitais/:doenteId        → histórico
POST   /sinais-vitais                  → registar (TA, FC, FR, SpO2, Temp, Peso, AVPU, Notas)
```
**NEWS2 automático:** após cada registo, o score NEWS2 (National Early Warning Score 2) é calculado automaticamente a partir de FR, SpO2, Temperatura, TA sistólica, Pulso e AVPU. Score ≥5 gera `AlertaClinico` + push notification; score ≥7 com prioridade crítica. Campo `avpu` (A/V/P/U) e `news2` adicionados ao modelo `SinalVital`.

### 5.7 Notas Clínicas (SOAP)
```
GET    /notas-clinicas/:doenteId       → lista notas
POST   /notas-clinicas                 → criar nota (Subjectivo, Objectivo, Avaliação, Plano)
```

### 5.8 Escalas Clínicas
```
GET    /escalas-clinicas/:doenteId     → lista avaliações
POST   /escalas-clinicas               → registar (14 tipos: Braden, Glasgow, Morse, MRC, NIHSS, Apgar, etc.)
```

### 5.9 Dispositivos Invasivos
```
GET    /dispositivos-invasivos/:doenteId
POST   /dispositivos-invasivos          → inserir (10 tipos: CVC, SNG, SV, SVP, O2, TET, etc.)
PATCH  /dispositivos-invasivos/:id      → actualizar (data_remocao, etc.)
DELETE /dispositivos-invasivos/:id      → remover
```

### 5.10 Exames
```
GET    /exames/:doenteId               → exames do doente
POST   /exames                         → solicitar exame
PATCH  /exames/:id/estado              → actualizar estado
PATCH  /exames/:id/resultado           → registar resultado
GET    /exames/worklist                → worklist global (todos os exames pendentes/em progresso)
POST   /exames/:id/ficheiros           → upload de ficheiro (PDF, imagem)
```

### 5.11 Interconsultas
```
GET    /interconsultas/:doenteId
POST   /interconsultas                 → solicitar interconsulta
PATCH  /interconsultas/:id/resposta    → responder interconsulta
```

### 5.12 Alergias
```
GET    /alergias/:doenteId
POST   /alergias
DELETE /alergias/:id
```

### 5.13 Alertas Clínicos
```
GET    /alertas/:doenteId
POST   /alertas
PATCH  /alertas/:id/resolver
```
**SOS contextual:** `acionarSOS()` carrega em paralelo os últimos sinais vitais, medicações activas, alergias e diagnóstico principal. Push notification inclui NEWS2, TA, FC, SpO₂, lista de medicações e alergias. Campo `pushData.contextoClinico` transporta o pacote clínico completo.

### 5.14 Tarefas
```
GET    /tarefas                        → lista (com filtro por utilizador, estado, prioridade)
POST   /tarefas                        → criar
PATCH  /tarefas/:id                    → editar
PATCH  /tarefas/:id/concluir           → concluir
DELETE /tarefas/:id                    → apagar
```

### 5.15 Turnos e Horários
```
GET    /turnos                         → lista turnos (por data, serviço)
POST   /turnos                         → criar turno
PATCH  /turnos/:id                     → editar
DELETE /turnos/:id                     → remover
PATCH  /turnos/:id/chefe               → definir chefe de turno (chefeTurnoId)
GET    /horarios                       → horário semanal
POST   /horarios                       → criar horário
```

### 5.16 Trocas de Turno
```
GET    /trocas                         → lista pedidos (filtrado por role/chefe)
POST   /trocas                         → solicitar troca
PATCH  /trocas/:id/aceitar             → aceitar (utilizador visado)
PATCH  /trocas/:id/recusar             → recusar (utilizador visado)
PATCH  /trocas/:id/aprovar-chefe       → aprovar como chefe de turno
PATCH  /trocas/:id/rejeitar-chefe      → rejeitar como chefe de turno
```

### 5.17 Atribuições
```
GET    /atribuicoes                    → lista atribuições activas
POST   /atribuicoes                    → atribuir doente a profissional
DELETE /atribuicoes/:id                → remover atribuição
```

### 5.18 Urgência
```
GET    /urgencia                       → episódios de urgência activos
POST   /urgencia                       → criar episódio
PATCH  /urgencia/:id                   → actualizar (triagem, estado)
PATCH  /urgencia/:id/alta              → alta urgência
```

### 5.19 Sala de Espera
```
GET    /sala-espera                    → fila de espera actual
POST   /sala-espera/checkin            → registar chegada
PATCH  /sala-espera/:id/chamar         → chamar doente
PATCH  /sala-espera/:id/atendido       → marcar atendido
```

### 5.20 Bloco Operatório
```
GET    /bloco                          → cirurgias programadas
POST   /bloco                          → agendar cirurgia
PATCH  /bloco/:id                      → editar
PATCH  /bloco/:id/estado               → actualizar estado (programada → em_curso → concluída)
POST   /bloco/:id/checklist            → preencher checklist (WHO Surgical Safety Checklist)
```

### 5.21 Consultas Externas
```
GET    /consultas                      → lista consultas
POST   /consultas                      → agendar
PATCH  /consultas/:id                  → editar
PATCH  /consultas/:id/realizar         → marcar realizada
PATCH  /consultas/:id/cancelar         → cancelar
```

### 5.22 Farmácia
```
GET    /farmacia/stock                        → inventário de stock (inclui catalogo.dci, precoUnitario)
POST   /farmacia/stock                        → criar item (aceita catalogoId?, precoUnitario?)
PATCH  /farmacia/stock/:id                    → ajustar quantidade (exige motivo + tipo + utilizadorId)
GET    /farmacia/stock/:id/historico          → histórico de ajustes (AjusteStock ordenado por data)
POST   /farmacia/stock/:id/transferir         → solicitar transferência entre serviços
GET    /farmacia/transferencias               → lista transferências (filtro por serviço)
PATCH  /farmacia/transferencias/:id/confirmar → confirmar transferência (debita origem, credita destino)
PATCH  /farmacia/transferencias/:id/cancelar  → cancelar transferência pendente
GET    /farmacia/relatorio-gastos             → custo total por item (δ negativos × precoUnitario)
GET    /farmacia/pedidos                      → pedidos de medicação
POST   /farmacia/pedidos                      → criar pedido
PATCH  /farmacia/pedidos/:id/estado           → aprovar/recusar/dispensar
```

### 5.23 Catálogo de Medicamentos
```
GET    /catalogo                       → lista medicamentos activos (filtro: search por DCI/marca/classe)
POST   /catalogo                       → criar entrada (farmaceutico, administrativo)
PATCH  /catalogo/:id                   → editar entrada
DELETE /catalogo/:id                   → desactivar (ativo=false)
```

### 5.24 Fornecedores e Encomendas
```
GET    /fornecedores                           → lista fornecedores activos
POST   /fornecedores                           → criar fornecedor (farmaceutico, administrativo)
PATCH  /fornecedores/:id                       → editar fornecedor
DELETE /fornecedores/:id                       → desactivar fornecedor
GET    /fornecedores/encomendas?estado=        → lista encomendas (inclui fornecedor, stockItem, recebioPor)
POST   /fornecedores/encomendas                → criar encomenda (associar fornecedor + stockItem)
PATCH  /fornecedores/encomendas/:id/receber    → receber encomenda (incrementa stock + cria AjusteStock)
```

### 5.25 Equipamentos
```
GET    /equipamentos                         → lista equipamentos (filtros: search, estado)
POST   /equipamentos                         → criar equipamento (operacional, ti)
PATCH  /equipamentos/:id                     → actualizar equipamento/estado
GET    /equipamentos/alertas-manutencao      → equipamentos com proximaManutencao ≤ 30 dias
GET    /equipamentos/manutencoes             → lista todas as manutenções
GET    /equipamentos/:id/manutencoes         → manutenções de um equipamento específico
POST   /equipamentos/:id/manutencoes         → criar pedido de manutenção
PATCH  /equipamentos/manutencoes/:id         → actualizar estado de manutenção (operacional, ti)
```

### 5.26 Fisioterapia
```
GET    /fisioterapia/planos/:doenteId  → planos de reabilitação
POST   /fisioterapia/planos            → criar plano
POST   /fisioterapia/sessoes           → registar sessão
GET    /fisioterapia/sessoes/:planoId  → sessões de um plano
```

### 5.27 Pedidos Internos
```
GET    /pedidos-internos               → lista (por departamento / criador)
POST   /pedidos-internos               → criar pedido (material, manutenção, limpeza, etc.)
PATCH  /pedidos-internos/:id/estado    → actualizar estado
```

### 5.28 Comunicação
```
GET    /comunicacao/mensagens          → inbox do utilizador
POST   /comunicacao/mensagens          → enviar mensagem
GET    /comunicacao/mensagens/:id      → detalhe de conversa
GET    /comunicacao/anuncios           → anúncios activos
POST   /comunicacao/anuncios           → criar anúncio (ti/it_admin ou direcao)
```

### 5.29 Incidentes TI
```
GET    /incidentes-ti                  → lista (filtros: estado, prioridade, tipo)
POST   /incidentes-ti                  → reportar incidente
PATCH  /incidentes-ti/:id              → editar / atribuir / resolver
PATCH  /incidentes-ti/:id/estado       → actualizar estado
```

### 5.30 Pedidos TI
```
GET    /pedidos-ti                     → lista pedidos
POST   /pedidos-ti                     → criar pedido
PATCH  /pedidos-ti/:id/estado          → actualizar estado
PATCH  /pedidos-ti/:id/atribuir        → atribuir técnico
```

### 5.31 Configurações (Roles)
```
GET    /configuracoes/roles                  → lista roles activas (auth req)
POST   /configuracoes/roles                  → criar role (ti/it_admin)
PATCH  /configuracoes/roles/:id              → editar
DELETE /configuracoes/roles/:id              → desactivar

GET    /configuracoes/roles/:chave/subroles  → sub-roles de uma role
GET    /configuracoes/subroles               → todos os sub-roles activos
POST   /configuracoes/subroles               → criar sub-role (ti/it_admin)
PATCH  /configuracoes/subroles/:id           → editar
DELETE /configuracoes/subroles/:id           → desactivar
```

### 5.32 Dashboard
```
GET    /dashboard                      → KPIs clínicos (camas, doentes, alertas)
GET    /dashboard/ti                   → KPIs TI (incidentes, pedidos, uptime)
```

### 5.33 Auditoria
```
GET    /audit                          → log de auditoria (ti, qualidade)
```

### 5.36 Reconciliação Clínica MAR↔Farmácia
```
GET    /reconciliacao                  → pendências detectadas (prescrições sem validação farmácia >2h, medicações activas sem registo MAR em 24h, pedidos farmácia pendentes >1h)
```
**Auto-verificação** a cada 30 minutos via `setInterval`. Gera alertas automáticos ao detectar divergências.

### 5.37 Relatórios PDF
```
GET    /doentes/:id/alta/pdf           → nota de alta em PDF (pdfmake)
GET    /turnos/:id/relatorio/pdf       → relatório de turno em PDF (doentes, tarefas, notas)
```
Serviço partilhado em `apps/api/src/app/common/pdf.service.ts` usando `pdfmake`.

### 5.34 Notificações Push
```
POST   /notificacoes/registar-token    → registar token Expo push
```

### 5.35 Contactos de Emergência
```
GET    /contactos/:doenteId
POST   /contactos
PATCH  /contactos/:id
DELETE /contactos/:id
```

---

## 6. Web — Páginas Implementadas

### 6.1 Autenticação
| Página | Rota | Estado |
|--------|------|--------|
| Login | `/login` | ✅ Completo |

### 6.2 Dashboard
| Página | Rota | Roles | Estado |
|--------|------|-------|--------|
| Dashboard Clínico | `/dashboard` | clínico + admin | ✅ KPIs, alertas |
| Dashboard TI | `/dashboard-ti` | ti + direcao | ✅ KPIs TI |
| Dashboard Qualidade | `/dashboard-qualidade` | qualidade, direcao, medico, enfermeiro | ✅ IACS, alertas, riscos, ocupação, taxa alta |
| Faturação | `/faturacao` | administrativo | ✅ Lista episódios + detalhe com itens/pagamentos + estados |
| Receção | `/recepcao` | administrativo | ✅ Gestão de filas em tempo real — chamar, re-chamar, concluir, stats |
| Quiosque | `/quiosque` | público (sem auth) | ✅ Tirar senha self-service — 7 serviços, prioridade, nome + "Já tenho marcação" com check-in por código |
| Painel de Chamadas | `/painel` | público (sem auth) | ✅ SSE em tempo real — número chamado + balcão + fila em espera |

### 6.3 Internamento / Clínico
| Página | Rota | Roles | Serviço | Estado |
|--------|------|-------|---------|--------|
| Lista de Doentes | `/doentes` | medico, enfermeiro, auxiliar, tecnico_saude, admin | todos | ✅ |
| Ficha do Doente | `/doentes/[id]` | clínico | todos | ✅ Full (sinais vitais, SOAP, medicação, escalas, dispositivos, exames, interconsultas, alertas) |
| Admitir Doente | `/doentes/admitir` | medico, enfermeiro, admin | todos | ✅ |
| Imprimir Ficha | `/doentes/[id]/print` | clínico | todos | ✅ |
| Gestão de Camas | `/camas` | medico, enfermeiro, auxiliar, admin | internamento, urgência | ✅ Grid visual |
| Horários | `/horarios` | clínico + admin | todos | ✅ Calendário + geração automática de escala mensal |
| Tarefas | `/tarefas` | medico, enfermeiro, auxiliar, tecnico_saude, operacional | todos | ✅ Kanban-like |
| Trocas de Turno | `/trocas` | clínico | todos | ✅ Pedidos + aprovação chefe |
| Atribuições | `/atribuicoes` | medico, enfermeiro | todos | ✅ |
| MAR | `/mar` | enfermeiro, auxiliar | todos | ✅ Tabela global + administrar |
| IACS | `/iacs` | medico, qualidade, enfermeiro | todos | ✅ Doentes isolados + gestão |
| Worklist | `/worklist` | tecnico_saude, medico | todos | ✅ Exames + resultados |

### 6.4 Serviços Especializados
| Página | Rota | Roles | Serviço | Estado |
|--------|------|-------|---------|--------|
| Urgência | `/urgencia` | medico, enfermeiro, auxiliar, admin | urgencia | ✅ |
| Bloco Operatório | `/bloco` | medico, enfermeiro | bloco_operatorio | ✅ Checklist WHO |
| Consultas Externas | `/consultas` | medico, admin | consultas_externas | ✅ Marcações com picker de slots + agenda semanal por médico + check-in + código de marcação |
| Sala de Espera | `/sala-espera` | enfermeiro, auxiliar, admin | urgencia | ✅ Fila triagem |
| Farmácia | `/farmacia` | farmaceutico | todos | ✅ Stock + pedidos + ajuste c/ motivo + histórico + transferências + relatório de gastos |
| Catálogo de Medicamentos | `/catalogo` | farmaceutico, admin, medico, enfermeiro | todos | ✅ Lista DCI/classe/forma; modal criar/editar; pesquisa |
| Fornecedores | `/fornecedores` | farmaceutico, admin | todos | ✅ Tab Fornecedores + Tab Encomendas; receber encomenda com increment automático de stock |
| Fisioterapia | `/fisioterapia` | tecnico_saude | todos | ✅ Planos + sessões |

### 6.5 Gestão e Suporte
| Página | Rota | Roles | Estado |
|--------|------|-------|--------|
| Comunicação | `/comunicacao` | todos | ✅ Mensagens + anúncios + **picker de destinatário com pesquisa** |
| Pedidos Internos | `/pedidos-internos` | clínico + admin + operacional | ✅ |
| Equipamentos | `/equipamentos` | operacional, ti, direcao | ✅ Lista + manutenções + **Tab Alertas** (badge por urgência); React Query |
| Pedidos TI | `/pedidos-ti` | ti | ✅ |
| Incidentes TI | `/incidentes-ti` | ti | ✅ |
| Utilizadores | `/utilizadores` | ti (subRole: it_admin) | ✅ CRUD + subRole dinâmico |
| Configurações | `/configuracoes` | ti (subRole: it_admin) | ✅ CRUD roles/sub-roles |
| Auditoria | `/auditoria` | ti + qualidade | ✅ Log de auditoria |

---

## 7. Mobile — Screens Implementados

### 7.1 Estrutura de Navegação por Role

| Grupo | Roles | Tabs na barra inferior |
|-------|-------|------------------------|
| Clínico | medico, enfermeiro, auxiliar, tecnico_saude, farmaceutico | Dashboard · Doentes · QR Scan · Tarefas · Mais |
| TI | ti | Dashboard TI · Incidentes · Pedidos · Mais |
| Administrativo | administrativo | Doentes · Tarefas · Mais |
| Operacional | operacional | Tarefas · Mais |
| Direção | direcao | Dashboard TI · Mais |
| Qualidade | qualidade | Auditoria · Mais |

### 7.2 Screens Disponíveis

| Screen | Acesso | Funcionalidades |
|--------|--------|-----------------|
| `LoginScreen` | Todos | Login com email + password |
| `DashboardScreen` | Clínico | KPIs, alertas, doentes do dia |
| `DashboardTIScreen` | TI + Direção | KPIs TI, incidentes abertos |
| `DoentesScreen` | Clínico + Admin | Lista doentes por serviço |
| `DoenteDetalheScreen` | Clínico | Ficha completa: sinais vitais, medicação, SOAP, escalas, dispositivos, exames; acções por role |
| `QRScannerScreen` | Clínico | Scanner de código QR do doente → abre DoenteDetalheScreen |
| `CamasScreen` | Clínico + Admin | Grid de camas, estado |
| `TarefasScreen` | Clínico + Operacional + Admin | Lista de tarefas, filtros |
| `TurnoScreen` | Clínico | Turno actual, membros |
| `HorariosScreen` | Clínico + Admin | Horário mensal + badge férias + criação/edição de turnos; profissionais em férias bloqueados |
| `TrocasScreen` | Clínico | Pedidos de troca + aprovação chefe |
| `AtribuicoesScreen` | Medico + Enfermeiro | Doentes atribuídos |
| `PassagemTurnoScreen` | Medico + Enfermeiro | Registo de passagem de turno |
| `PedidosTIScreen` | TI | Lista e gestão de pedidos TI |
| `IncidentesSubRoleScreen` | TI | Incidentes filtrados por sub-role |
| `UtilizadoresScreen` | TI (it_admin) | CRUD utilizadores + sub-roles dinâmicos |
| `AuditoriaScreen` | TI + Qualidade | Log de auditoria |
| `MaisScreen` | Todos | Menu extra — items visíveis por role |
| `PerfilScreen` | Todos | Perfil do utilizador, editar |
| `FeriasScreen` | Todos | Saldo de férias, pedidos, aprovação chefe |
| `PedidosInternosScreen` | Clínico + Admin + Operacional | Pedidos internos por prioridade/estado; aceitar/concluir para operacional |
| `InterconsultasScreen` | Medico | Interconsultas recebidas/enviadas + resposta clínica |
| `WorklistScreen` | Tecnico Saúde + Medico | Lista de trabalho por estado; iniciar/concluir |
| `EspecialidadesScreen` | Tecnico Saúde | Sessões de especialidade; registar evolução |
| `BlocoScreen` | Medico + Enfermeiro | Cirurgias agendadas por estado; detalhes de equipa |
| `CatalogoScreen` | Farmacêutico + Admin + Medico + Enfermeiro | Catálogo de medicamentos; CRUD para farmacêutico/admin |

### 7.3 Menu "Mais" — Items por Role

| Item | Roles que vêem |
|------|----------------|
| Utilizadores | ti (it_admin) |
| Auditoria | ti, qualidade |
| Comunicação | todos |
| Meu Turno | clínico |
| Passagem de Turno | medico, enfermeiro |
| Horários | clínico + admin |
| Atribuições | medico, enfermeiro |
| Camas | medico, enfermeiro, admin |
| Trocas de Turno | clínico |
| IACS | medico, enfermeiro, qualidade |
| MAR | enfermeiro |
| Urgência | medico, enfermeiro, admin |
| Sala de Espera | enfermeiro, admin |
| Consultas | medico, admin |
| Farmácia | farmaceutico, medico |
| Fisioterapia | tecnico_saude, medico |
| **As Minhas Férias** | **todos** |
| **Pedidos Internos** | **clínico + admin + operacional** |
| **Interconsultas** | **medico** |
| **Worklist** | **tecnico_saude + medico** |
| **Especialidades** | **tecnico_saude** |
| **Bloco Operatório** | **medico + enfermeiro** |
| **Catálogo** | **farmaceutico + admin + medico + enfermeiro** |
| Terminar Sessão | todos |

### 7.4 Permissões Clínicas no DoenteDetalheScreen

| Ação | Roles |
|------|-------|
| Prescrever medicação | medico |
| Registar administração | enfermeiro, auxiliar |
| Alterar estado do doente | medico, enfermeiro |
| Registar sinais vitais | enfermeiro, auxiliar, tecnico_saude |
| Criar nota SOAP | medico, enfermeiro |
| Aplicar escala clínica | medico, enfermeiro, tecnico_saude |
| Inserir/remover dispositivo | medico, enfermeiro |
| Solicitar exame | medico |
| Registar resultado exame | tecnico_saude |

---

## 8. Tabela de Permissões por Role

### 8.1 Web — Menus visíveis

| Menu | medico | enfermeiro | auxiliar | tecnico_saude | farmaceutico | admin | operacional | ti | qualidade | direcao |
|------|:------:|:----------:|:--------:|:-------------:|:------------:|:-----:|:-----------:|:--:|:---------:|:-------:|
| Dashboard Clínico | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | — | — | — | — |
| Doentes | ✅ | ✅ | ✅ | ✅ | — | ✅ | — | — | — | — |
| Camas* | ✅ | ✅ | ✅ | — | — | ✅ | — | — | — | — |
| Horários | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | — | — | — | — |
| Tarefas | ✅ | ✅ | ✅ | ✅ | — | — | ✅ | — | — | — |
| Trocas de Turno | ✅ | ✅ | ✅ | ✅ | ✅ | — | — | — | — | — |
| Atribuições | ✅ | ✅ | — | — | — | — | — | — | — | — |
| Urgência** | ✅ | ✅ | ✅ | — | — | ✅ | — | — | — | — |
| Bloco Operatório*** | ✅ | ✅ | — | — | — | — | — | — | — | — |
| Consultas**** | ✅ | — | — | — | — | ✅ | — | — | — | — |
| Farmácia | — | — | — | — | ✅ | — | — | — | — | — |
| Catálogo | ✅ | ✅ | — | — | ✅ | ✅ | — | — | — | — |
| Fornecedores | — | — | — | — | ✅ | ✅ | — | — | — | — |
| Fisioterapia | — | — | — | ✅ | — | — | — | — | — | — |
| MAR | — | ✅ | ✅ | — | — | — | — | — | — | — |
| IACS | ✅ | ✅ | — | — | — | — | — | — | ✅ | — |
| Worklist | ✅ | — | — | ✅ | — | — | — | — | — | — |
| Sala de Espera** | — | ✅ | ✅ | — | — | ✅ | — | — | — | — |
| Equipamentos | — | — | — | — | — | — | ✅ | ✅ | — | ✅ |
| Pedidos Internos | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | — | — | — |
| Comunicação | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Dashboard TI | — | — | — | — | — | — | — | ✅ | — | ✅ |
| Pedidos TI | — | — | — | — | — | — | — | ✅ | — | — |
| Incidentes TI | — | — | — | — | — | — | — | ✅ | — | — |
| Utilizadores | — | — | — | — | — | — | — | it_admin | — | — |
| Configurações | — | — | — | — | — | — | — | it_admin | — | — |
| Auditoria | — | — | — | — | — | — | — | ✅ | ✅ | — |

> *Camas: apenas serviços internamento e urgência
> **Urgência e Sala de Espera: apenas serviço urgência
> ***Bloco: apenas serviço bloco_operatorio
> ****Consultas: apenas serviço consultas_externas

### 8.2 Serviços disponíveis

```
internamento | urgencia | bloco_operatorio | consultas_externas
uci | neonatologia | pediatria | psiquiatria | oncologia
ortopedia | cardiologia | neurologia | laboratorio | imagiologia
```

---

## 9. Funcionalidades Implementadas ✅

### Backend (API)
- [x] Autenticação JWT + Refresh Token com revogação em BD
- [x] Sistema de roles + sub-roles dinâmicos (BD) — 10 roles + 81 sub-roles
- [x] Guard de roles + sub-roles (`RolesGuard`)
- [x] Auditoria automática de todas as mutações
- [x] CRUD completo de utilizadores (com role/subRole dinâmico)
- [x] Gestão de doentes: admissão, alta, transferência, isolamento
- [x] Gestão de camas: ocupar, libertar, estados
- [x] Prescrição e administração de medicação (com MAR + **5 Corretas** + **Não Administrada com motivo** via `POST /medicacao/:id/nao-administrar`; campos `naoAdministrada Boolean` + `motivoNaoAdmin String?` em `RegistoMedicacao`)
- [x] Registo de sinais vitais (TA, FC, FR, SpO2, Temp, Peso, AVPU) + **NEWS2 automático** (score calculado após registo; alertas ≥5/≥7; campos `avpu` + `news2` em `SinalVital`)
- [x] Notas clínicas SOAP
- [x] Escalas clínicas (14 tipos: Braden, Glasgow, Morse, NIHSS, MRC, etc.)
- [x] Dispositivos invasivos (10 tipos: CVC, SNG, SV, etc.)
- [x] Exames: solicitar, worklist, resultados, upload de ficheiros
- [x] Interconsultas (pedido + resposta)
- [x] Alergias e alertas clínicos
- [x] Tarefas (CRUD + conclusão + **editar descrição/prioridade/prazo/grupo** via `PATCH /tarefas/:id`)
- [x] Turnos e horários com chefeTurnoId
- [x] Trocas de turno (pedido → aceitação → aprovação chefe)
- [x] Atribuições doente–profissional
- [x] Urgência (episódios, triagem, alta; **atribuir médico responsável** via `PATCH /urgencia/:id/atribuir-medico`)
- [x] Sala de espera (check-in, chamada, atendimento)
- [x] Bloco operatório (agendamento, checklist WHO)
- [x] Consultas externas (agendamento, realização, cancelamento)
- [x] Farmácia: stock e pedidos de medicação; **histórico de ajustes** com motivo/tipo/utilizador; **transferências entre serviços** (pendente → confirmada → decrementar origem / upsert destino); **relatório de gastos** por serviço/período (δ negativos × precoUnitario); `AjusteStock` criado atomicamente em $transaction
- [x] **Catálogo de Medicamentos** — modelo `CatalogoMedicamento` com DCI, formaFarmaceutica, classeTerap, concentração, código ATC; CRUD via `/catalogo` (farmaceutico, administrativo)
- [x] **Fornecedores e Encomendas** — modelos `Fornecedor` + `EncomendaFornecedor`; receber encomenda incrementa `StockItem.quantidade` e cria `AjusteStock` tipo='encomenda' em $transaction
- [x] Equipamentos: gestão de equipamentos e manutenções; **alertas de manutenção preventiva** (`GET /equipamentos/alertas-manutencao`) — equipamentos com `proximaManutencao` ≤ 30 dias, excluindo estado 'abatido'
- [x] Fisioterapia: planos de reabilitação e sessões
- [x] Especialidades clínicas: `SessaoEspecialidade` — Nutrição Clínica, Psicologia Clínica, Terapia da Fala, TAE; `GET/POST /especialidades`, `PATCH /especialidades/:id/realizar|cancelar`
- [x] RH expandido: `AvaliacaoDesempenho` + `DadosContratuais`; endpoints para avaliações, pessoal, saldo de férias, contratos; `POST /rh/ausencias` notifica quando tipo=férias; `GET /rh/ausencias/para-aprovar` para chefes
- [x] Férias universal: `chefeId` em Utilizador (self-relation ChefeSubordinado); `GET /rh/saldo-ferias` calcula dias usados vs. direito anual
- [x] Conformidade/RGPD: `GET /audit/conformidade` agrega acessos a dados de doentes, ações de alto risco e gráfico de acessos por dia
- [x] Pedidos internos (material, manutenção, etc.)
- [x] Comunicação interna (mensagens + anúncios)
- [x] Incidentes TI e Pedidos TI (**atribuir responsável** TI via dropdown; **notas/comentários por incidente** — `GET/POST /incidentes-ti/:id/notas`; `NotaIncidenteTI` model)
- [x] Configurações (CRUD de roles e sub-roles via API)
- [x] Dashboard KPIs (clínico + TI + Qualidade)
- [x] Geração automática de escala mensal (`POST /horarios/gerar-automatico`) — round-robin por médicos/enfermeiros/auxiliares
- [x] Ficha pessoal do doente (`FicheiroPessoalDoente`) — modelo separado com NIF, SNS, morada, seguro; acesso restrito a `administrativo` via `GET/PATCH /doentes/:id/ficha-pessoal`
- [x] Módulo de Faturação — `EpisodioFaturacao`, `ItemFatura`, `Pagamento`; endpoints completos; estados: pendente→emitida→paga/isenta/anulada
- [x] Sistema de Tickets / Filas — modelo `Ticket` (sequência diária por tipo, prioridade); `QuiosqueController` público com SSE; `TicketsController` autenticado; fila prioritário→sénior→normal FIFO
- [x] Notificações push com trigger real — TrocasService (novo pedido, aceitação, aprovação chefe) + TarefasService (nova tarefa atribuída) + **Tarefas urgentes pendentes >30min** (verificação a cada 10 min via `OnApplicationBootstrap`, notifica atribuído + criador)
- [x] **Verificação de alergias na prescrição** — `medicacao.service.ts:prescrever()` cruza com alergias activas antes de criar; lança `409 ConflictException` com detalhes; override via `forcarApesarDeAlergia=true`
- [x] **Verificação de interacções medicamentosas** — `interacoes.json` com 50 pares; warning não-bloqueante em `prescrever()`; endpoint `GET /medicacao/interacoes?doenteId=&nome=`
- [x] **JWT httpOnly cookies** (sessão 9) — tokens em cookies `httpOnly; Secure; SameSite=Lax`; axios com `withCredentials`; refresh automático por interceptor; JWT nunca exposto a JS
- [x] **MFA TOTP** (sessão 9) — Google/Microsoft Authenticator; setup via QR code em `/perfil`; 2-step login com challenge token 5min; rate limit 10 tentativas/10min
- [x] **Infraestrutura Docker de Produção** (sessão 9) — `docker-compose.prod.yml` com postgres, backup, redis, api, web, nginx; `scripts/deploy.sh` automatizado; `scripts/pg-trgm.sql` idempotente
- [x] **Backup automático BD** (sessão 9) — pg_dump diário às 2h via cron no container `backup`; retenção 30 dias; `find /backups -mtime +30 -delete`
- [x] **Redis Cache** (sessão 9) — catálogo medicamentos TTL 1h, camas TTL 30s; `RedisService` global com degradação silenciosa; invalidação em mutações
- [x] **pg_trgm full-text search** (sessão 9) — extensão PostgreSQL + GIN indexes em `Doente.nome`, `CatalogoMedicamento.dci/nomeMarca`; aplicado automaticamente no deploy
- [x] **Soft delete** (sessão 9) — `deletedAt DateTime?` + índice em `Doente`, `Medicacao`, `NotaClinica`, `RegistoMedicacao`
- [x] **Health endpoint** (sessão 9) — `GET /health` com `@nestjs/terminus`; verifica BD (Prisma ping) + Redis; usado por Docker healthcheck
- [x] **Análise de Tendência Clínica** (sessão 9) — `GET /sinais-vitais/:id/tendencia`; regressão linear nos últimos 6 registos; detecta queda de SpO₂, subida de FC/FR, queda de TA, score NEWS2 agravante; devolve `risco: baixo|moderado|alto` + recomendação
- [x] **PWA (Progressive Web App)** (sessão 9) — `manifest.json`, service worker (`public/sw.js`): cache-first para assets `/_next/static/`, network-first para API, stale-while-revalidate para páginas; ícones 192/512/180px PNG gerados de logo.svg; instalável em Android/iOS; `PwaRegister` client component; `viewport.themeColor=#1e40af`
- [x] **Paginação generalizada** (sessão 9) — `GET /comunicacao/mensagens?page=N` (inbox + enviadas, 20/pág); `GET /doentes/registos-administrativos?page=N&limit=N`; audit logs já tinham paginação
- [x] **SOS contextual com dados clínicos** — `alertas.service.ts:acionarSOS()` carrega últimos sinais vitais, medicações activas, alergias e diagnóstico em paralelo; push notification body inclui NEWS2, TA, FC, SpO₂, lista de medicações e alergias; `pushData.contextoClinico` com pacote clínico completo
- [x] **Reconciliação Clínica MAR↔Farmácia** — módulo `reconciliacao/`; verifica prescrições sem validação farmácia >2h, medicações sem registo MAR em 24h, pedidos pendentes >1h; executa automaticamente a cada 30 min; endpoint `GET /reconciliacao`
- [x] **Geração de PDF** — `common/pdf.service.ts` com `pdfmake`; nota de alta (`GET /doentes/:id/alta/pdf`) e relatório de turno (`GET /turnos/:id/relatorio/pdf`)
- [x] **Timeline clínica unificada** — `GET /doentes/:id/timeline` devolve lista cronológica de todos os eventos: admissão, sinais vitais, prescrições, administrações MAR, notas SOAP, tarefas, alertas, exames
- [x] Paginação em Utilizadores (`page`, `limit`, `totalPaginas`)
- [x] Seed de dados de demo (`seed-demo.ts`) — 17 utilizadores, 13 camas, 8 doentes, sinais vitais, tarefas, stock, incidentes, anúncios
- [x] Contactos de emergência do doente
- [x] Migração de dados: todos os utilizadores convertidos para nova taxonomia de roles

### Web Frontend
- [x] **Sistema de Toast Universal** — `components/toast.tsx` com `ToastProvider` + hook `useToast`; integrado em `client-layout.tsx`; `onSuccess`/`onError` em todas as páginas com mutações (mar, tarefas, passagem-turno, doentes/[id], farmácia, férias, urgência, equipamentos, fornecedores, catálogo, dashboard, operacional, especialidades, eventos-adversos, rh/formações, rh/ausências, interconsultas)
- [x] **Componentes partilhados — Acessibilidade e UI (sessão 8)**
  - `components/confirm-modal.tsx` — substitui todos os `confirm()` nativos; `role="dialog"`, focus trap, tecla Escape, focus inicial no botão Cancelar, backdrop blur; 6 ocorrências substituídas em `doentes/[id]/page.tsx`
  - `components/breadcrumb.tsx` — navegação semântica com `aria-label="Localização"` e `aria-current="page"` no último item; usado em `doentes/[id]/page.tsx` em substituição do link "← Voltar a Doentes"
  - `components/page-header.tsx` — título `<h1>` padronizado com slot de acções; garante hierarquia de headings consistente
- [x] **Acessibilidade WCAG AA (sessão 8)**
  - Todos os botões de ícone têm `aria-label` explícito (fechar modais, limpar pesquisa, remover alergia/contacto, apagar nota)
  - Tabelas com `scope="col"` nos cabeçalhos (`doentes/page.tsx`, sinais vitais em `doentes/[id]/page.tsx`)
  - Formulários com `htmlFor`/`id` explícitos (modal de password, filtros, modal de alergia, modal de dispositivo)
  - Loading states com `role="status" aria-live="polite"` (doentes, MAR, tarefas)
  - Modal de password com `role="dialog"`, campos com IDs correctos, mensagem de sucesso inline em vez de `alert()` nativo
  - Botões desactivados com contraste visível: `disabled:bg-slate-200 disabled:text-slate-400`
- [x] **Standardização de UI (sessão 8)**
  - Botão primário: `bg-blue-600 hover:bg-blue-700` em toda a app (farmácia migrada de `bg-emerald-*` para `bg-blue-*`)
  - Todos os modais com `backdropFilter: blur(4px)` para consistência visual
  - Títulos de página: `text-2xl` uniforme (eliminado mix com `text-3xl`)
  - Tabelas: cabeçalho `bg-slate-50` e texto `text-slate-600` (maior contraste que `text-slate-400` anterior)
- [x] **Sidebar mobile (sessão 8)** — `client-layout.tsx`: botão hamburger (`md:hidden`), aside com `fixed md:relative`, overlay backdrop escurecido, fecho automático ao clicar em item de navegação
- [x] **Gráfico de Sinais Vitais** — `doentes/[id]/page.tsx` com Recharts `LineChart` mostrando TA, Pulso, SpO₂, Temperatura ao longo do tempo; banner NEWS2 visível quando score ≥5
- [x] Login + gestão de sessão (refresh automático)
- [x] Sidebar dinâmico por role + serviço + sub-role
- [x] Dashboard clínico e TI
- [x] Ficha completa do doente (todos os módulos clínicos)
- [x] Admissão de doentes
- [x] Impressão da ficha do doente
- [x] Grid de camas com estados visuais
- [x] MAR (Mapa de Administração de Medicação) global
- [x] Worklist de exames
- [x] IACS — doentes em isolamento
- [x] Urgência, Bloco, Consultas, Sala de Espera
- [x] Farmácia — ajuste c/ motivo/tipo obrigatório; modal histórico de ajustes; modal transferir entre serviços; Tab Transferências (confirmar/cancelar); Tab Relatório de Gastos com filtros serviço + período
- [x] Catálogo de Medicamentos (`/catalogo`) — tabela DCI/marca/forma/classe/ATC; pesquisa; modal criar/editar (farmaceutico, administrativo)
- [x] Fornecedores (`/fornecedores`) — Tab Fornecedores (cards); Tab Encomendas (filtro estado, modal Nova Encomenda, modal Receber)
- [x] Equipamentos (`/equipamentos`) — **botão Editar** (`PATCH /equipamentos/:id`); **dropdown técnico** na modal de manutenção (`PATCH /equipamentos/manutencoes/:id` com `tecnicoId`); Tab Alertas com badges por urgência
- [x] Fisioterapia (planos + sessões)
- [x] Especialidades clínicas (`/especialidades`) — página genérica adaptada ao sub-role: Nutrição, Psicologia, Terapia da Fala, TAE; agendar, registar evolução, cancelar sessões
- [x] Dashboard Operacional (`/operacional`) — resume tarefas, pedidos internos e equipamentos em manutenção adaptado ao sub-role operacional
- [x] Conformidade/RGPD (`/conformidade`) — registo de acessos, checklist **sincronizado com backend** (`GET/PATCH /audit/checklist`; `ConformidadeChecklistItem`); timestamp de última actualização; exportação CSV
- [x] RH expandido — `/rh/pessoal` (**pesquisa por nome + filtro serviço**), `/rh/avaliacoes` (**filtro por colaborador**)
- [x] Férias/Ausências (`/ferias`) — saldo, pedir férias, **outros tipos de ausência** (baixa médica, formação, licença…); secção "Para Aprovar" para chefes
- [x] Horários com calendário + geração automática + **aviso de conflito** ao atribuir profissionais já com turno no mesmo dia
- [x] Dashboard Qualidade — IACS por agente, tendência 7 dias, alertas clínicos, avaliações de risco, ocupação, taxa de completitude de alta
- [x] Faturação — lista episódios, criar episódio, adicionar itens, registar pagamentos, emitir/anular; **resumo financeiro** (totalFaturado/pago/pendente/anulado) via `GET /faturacao/resumo`
- [x] Receção / Gestão de Filas — painel front-desk com SSE em tempo real; chamar próximo por prioridade; re-chamar; concluir; stats diárias por tipo
- [x] Quiosque self-service — página pública; 7 tipos de serviço; checkbox prioritário/sénior; nome opcional; senha emitida instantaneamente
- [x] Painel de Chamadas — página pública com `EventSource`; flash no número chamado; fila lateral; histórico; reconexão automática
- [x] Ficha do doente: secção "Dados Administrativos" para role `administrativo` (NIF, SNS, morada, seguro) — invisível a clínicos
- [x] Tarefas — **botão Editar** (descrição/prioridade/prazo/grupo) + **filtros** por estado/prioridade/grupo
- [x] Doentes lista — **filtros por estado e serviço**
- [x] Doentes ficha — **badge de isolamento + toggle activar/desactivar** (`PATCH /doentes/:id/isolamento`)
- [x] Farmácia — **campo catalogoId** no modal "Novo Item" (auto-preenchimento nome/unidade do catálogo)
- [x] Urgência — **botão "Atribuir Médico"** por episódio com dropdown de médicos
- [x] Incidentes TI — **dropdown "Atribuir Responsável"** no detalhe expandido (só visível ao role `ti`)
- [x] MAR — **botão "Não administrada"** com selecção de motivo; registo guardado em `RegistoMedicacao.naoAdministrada`
- [x] Conformidade — checklist regulatório **persistido em localStorage**
- [x] Camas — **filtro por quarto** na barra de legenda
- [x] Auditoria — **filtro por tipo de entidade** + **exportar CSV** (com BOM UTF-8)
- [x] Comunicação — **tab "Enviadas"** (`GET /comunicacao/mensagens/enviadas`)
- [x] Passagem de turno — **banner de alertas clínicos** (doentes em estado crítico/grave)
- [x] Trocas de turno
- [x] Atribuições
- [x] Seed: corrigidos roles inválidos (00001→enfermeiro/supervisor_enfermagem; 00003→ti/it_admin); adicionado OP001 (operacional/facilities)
- [x] Utilizadores (CRUD + roles dinâmicos + sub-roles)
- [x] Configurações de roles e sub-roles
- [x] Auditoria log
- [x] Logo CuraSphere no header
- [x] SOS banner no dashboard (médico + enfermeiro) — recebe evento `sos:alerta` via WebSocket em tempo real; link directo para ficha; botão "Acusar"; múltiplos alertas simultâneos
- [x] Botão SOS na ficha do doente — countdown 3s anti-acidental, cancelar, confirmar; chama `POST /alertas/:id/sos`
- [x] Dispositivos Invasivos na ficha do doente — lista activos com dias de inserção, registar novo, remover
- [x] Pré-notificação ambulância na página de Urgência — banner "Em Trânsito" com countdown ETA, modal de registo, botão "Chegou"
- [x] WebSocket em tempo real — hook `useSocket` partilhado; eventos: `urgencia:update`, `urgencia:ambulancia`, `sos:alerta`, `alerta:novo`, `doente:estado`; invalidação automática de queries ao receber eventos
- [x] **Validação de negócio na admissão** (sessão 32) — NIF e SNS únicos verificados com `findFirst` + `ConflictException 409`; cama disponível verificada antes de criar episódio
- [x] **Padronização de erros API** (sessão 32) — `ErrorCodes` enum + `AppException` + `GlobalExceptionFilter`; todas as respostas de erro com `{ statusCode, errorCode, message, details? }`
- [x] **Comunicação — anexos em mensagens** (sessão 32) — `POST /comunicacao/mensagens/:id/anexo`; FileInterceptor com diskStorage; validação tipo MIME + limite 10 MB; modelo `AnexoMensagem`
- [x] **Ficha doente — 12 painéis independentes** (sessão 32) — `doentes/[id]/page.tsx` de 3852L → 1121L; componentes `sinais-vitais`, `risco-escalas`, `exames`, `notas-clinicas`, `escalas-clinicas`, `alergias-contactos`, `notas-turno`, `medicacao`, `tarefas`, `interconsultas`, `problemas`, `dispositivos`
- [x] **client-layout.tsx refactorizado** (sessão 32) — `modal-configuracoes.tsx` + `modal-alterar-password.tsx` extraídos; layout reduzido a ~130L de pura orquestração
- [x] **Custom hooks `@/lib/hooks`** — `useNotificacoes`, `useNaoLidasCount`, `useMarcarLida`, `useMarcarTodasLidas`, `useDoentes`, `useDoente`, `useTarefasPorDoente`, `useUtilizadores`, `useAlertasPorDoente`; `notificacoes/page.tsx` + `client-layout.tsx` migrados para hooks (sessão 33)

### Mobile
- [x] Login com token persistente (**`expo-secure-store`** — encriptado no dispositivo, não legível em root/backup)
- [x] Refresh token automático (interceptor com queue — comportamento idêntico ao web)
- [x] React Query global (`QueryClientProvider` na raiz — cache 30s entre ecrãs)
- [x] Timeout de sessão (15 min inactividade)
- [x] Navegação adaptada por grupo de role
- [x] QR Scanner → abre ficha do doente
- [x] Ficha do doente com módulos clínicos (sinais vitais, medicação, SOAP, escalas, dispositivos, exames)
- [x] Permissões clínicas por role no DoenteDetalheScreen
- [x] Dashboard clínico e TI
- [x] Lista de doentes
- [x] Camas, Tarefas, Horários
- [x] Trocas de turno com aprovação de chefe
- [x] Atribuições, Passagem de turno (**resumo estruturado**: painel 4 KPIs, badges inline por doente, tarefas com chips de estado, botão "Fechar Turno" com modal + copiar resumo para clipboard)
- [x] Pedidos TI, Incidentes TI
- [x] Utilizadores com sub-roles dinâmicos (carregados da API)
- [x] Auditoria
- [x] Notificações push (registo de token)
- [x] Perfil do utilizador
- [x] Farmácia (pedidos + stock, dispensar)
- [x] Fisioterapia (planos + sessões com barra de progresso)
- [x] Consultas Externas (filtros por estado, marcar como realizada)
- [x] Urgência (triagem Manchester, cores, tempo de espera)
- [x] Sala de Espera (chamar + atendido)
- [x] IACS (**3 tabs**: isolamentos com levantar isolamento; culturas microbiológicas com resultado; surtos com estado/casos/medidas)
- [x] MAR — Mapa de Administração de Medicação
- [x] Comunicação (mensagens + anúncios com badge de não lidos)
- [x] **Assinatura Digital de Prescrições e Notas Clínicas** (sessão 10) — challenge TOTP via MFA já configurado; `POST /medicacao/:id/assinar` + `POST /notas-clinicas/:id/assinar`; campos `assinadoEm`/`assinadoPorId` no schema; `AuditLog` com ação `ASSINATURA_DIGITAL`
- [x] **Break-Glass Access** (sessão 10) — módulo `break-glass/`; `POST /break-glass { doenteId, motivo }`; acesso de emergência com TTL de 4h; notificação imediata a role `ti` + chefes de turno/enfermeiros/direção; registo em `AuditLog` com ação `BREAK_GLASS_ACTIVADO`
- [x] **Consentimento Informado Digital** (sessão 10) — módulo `consentimentos/`; tipos: cirurgia, procedimento invasivo, anestesia, transfusão, outro; endpoints criar/assinar/recusar; campo `motivoRecusa` obrigatório na recusa; página `/doentes/[id]/consentimentos` com modais
- [x] **Protocolo Clínico Automático** (sessão 10) — módulo `protocolos/`; bundle Sepsis (5 itens com prazos 30–180min) ativado automaticamente quando NEWS2 ≥7 em `sinais-vitais.service.ts`; bundle AVC (6 itens) ativado por CID-10 I63/I64; `ativarSeNaoAtivo()` evita duplicados; checklist com `concluirItem()`
- [x] **Workflow de Limpeza de Camas** (sessão 10) — `alta` → cama passa a `em_limpeza` + notificação push ao role `auxiliar`; `PATCH /camas/:id/confirmar-limpeza` (auxiliar/enfermeiro) → estado `livre`; campos `servico` e `piso` adicionados ao modelo `Cama`
- [x] **Dietética** (sessão 10) — módulo `dietas/`; tipos: normal, hipocalórica, diabética, renal, hepática, líquida, jejum; restrições: glúten, lactose, sal, potássio, fósforo, proteína, gordura, açúcar; `GET /dietas/hoje` devolve todas as dietas de doentes internados (vista cozinha); página `/dietas` com grid de cards e formulário de prescrição
- [x] **Relatórios DGS/SNS** (sessão 10) — módulo `relatorios/`; 5 relatórios com filtro de período: demora média de internamento, taxa de ocupação, top 20 diagnósticos CID-10, top 20 medicamentos consumidos, episódios de urgência por triagem; export CSV via `Accept: text/csv`; acesso restrito a direcao/administrativo/ti; página `/relatorios`

---

## 10. O Que Falta / Está Incompleto ❌

### 10.1 Funcionalidades Completamente Ausentes

| Feature | Prioridade | Notas |
|---------|-----------|-------|
| ~~Relatórios e exportação PDF~~ | ~~Média~~ | ✅ Implementado: nota de alta PDF, relatório de turno PDF via pdfmake + **relatórios de produtividade** (sessão 28): `GET /relatorios/produtividade` com `groupBy` em 4 modelos; frontend com totais 4-KPI e tabela por profissional |
| ~~Relatórios DGS/SNS~~ | ~~Alta~~ | ✅ Implementado (sessão 10): 5 relatórios com export CSV — internamento, ocupação, diagnósticos, medicamentos, urgência |
| ~~Assinatura digital de prescrições~~ | ~~Alta~~ | ✅ Implementado (sessão 10): challenge TOTP em `/medicacao/:id/assinar` + `/notas-clinicas/:id/assinar` |
| ~~Consentimento informado digital~~ | ~~Alta~~ | ✅ Implementado (sessão 10): módulo `consentimentos/`; criar/assinar/recusar + página `/doentes/[id]/consentimentos` |
| ~~Break-glass access~~ | ~~Alta~~ | ✅ Implementado (sessão 10): módulo `break-glass/`; TTL 4h; auditoria + notificação chefes/TI |
| ~~Protocolo clínico (Sepsis/AVC)~~ | ~~Alta~~ | ✅ Implementado (sessão 10): ativação automática por NEWS2 ≥7 (Sepsis) ou CID-10 I63/I64 (AVC); checklist com prazos |
| ~~Dietética~~ | ~~Média~~ | ✅ Implementado (sessão 10): módulo `dietas/`; 7 tipos + 8 restrições; vista cozinha `/dietas` |
| ~~Workflow limpeza de camas~~ | ~~Média~~ | ✅ Implementado (sessão 10): alta → `em_limpeza` + notificação auxiliares; `confirmar-limpeza` → `livre` |
| ~~Agenda de bloco (calendário)~~ | ~~Média~~ | ✅ Implementado (sessão 22): tab "Calendário" com grelha mensal, navegação mês a mês, badges de cirurgias por dia + sala colorida; click → filtra agenda diária |
| ~~Dashboard Qualidade mobile~~ | ~~Alta~~ | ✅ Implementado (sessão 23): `DashboardQualidadeScreen` com 4 KPI cards, ocupação, tendência IACS 7d, alertas recentes, riscos por tipo, completitude de alta, eventos adversos por tipo/gravidade |
| ~~Broadcast por serviço~~ | ~~Média~~ | ✅ Implementado (sessão 25): `POST /comunicacao/broadcast` com filtros `servicoAlvo` + `roleAlvo`; botão "Broadcast" na página de comunicação; modal com selectors + aviso; `createMany` atómico; tab Enviadas com ícone lida/não lida por mensagem |
| ~~Trocas de dia de folga~~ | ~~Média~~ | ✅ Implementado (sessão 24): modelo `TrocaFolga` no schema + `db push`; 6 endpoints REST (`POST`, `GET minhas`, `GET para-aprovar`, `PATCH aceitar/recusar/aprovar/cancelar`); UI em horários — painéis "Trocas para Aprovar" (chefe) + "Minhas Trocas" + modal picker + botão "↔ Pedir troca" no painel de dia |
| ~~Aprovação de pedidos farmácia pelo médico~~ | ~~Alta~~ | ✅ Backend + Frontend: fluxo pendente→aprovado→dispensado; tab "Aprovação Médica" na farmácia; proposta de prescrição por enfermeiro com aprovação/rejeição pelo médico na ficha do doente |
| ~~Ficha pessoal no formulário de admissão~~ | ~~Média~~ | ✅ Campos NIF, SNS, morada, CP, localidade, telefone opcionais na admissão; `$transaction` cria `FicheiroPessoalDoente` se preenchidos |
| ~~Painel de BI / Analytics~~ | ~~Baixa~~ | ✅ Dashboard executivo enriquecido (sessão 26) + relatórios de produtividade (sessão 28) |
| Controlo de stock em tempo real (barcode) | Baixa | Stock gerido manualmente; sem leitura de código de barras |
| Módulo de RH / gestão de férias | ~~Baixa~~ | ✅ Implementado: `/rh/pessoal`, `/rh/avaliacoes`, `/ferias` com workflow de aprovação por chefe |
| Telemedicina / Videochamada | Baixa | Fora de âmbito actual |
| Integrações externas (HL7, FHIR) | Baixa | Exportação de dados clínicos para sistemas externos |

### 10.2 Features Parciais ou Incompletas

| Feature | O que existe | O que falta |
|---------|-------------|------------|
| Push notifications | Trigger em Trocas + Tarefas + **Tarefas urgentes pendentes** + **SOS contextual** + **NEWS2 ≥5/≥7** (sessão 7) + **NotificacoesScreen mobile + leitura confirmada individual/todas** (sessão 27) | — |
| Comunicação | Mensagens 1-a-1 + anúncios + **tab Enviadas** (sessão 6) + **broadcast por serviço/role + leitura confirmada** (sessão 25) + **anexos em mensagens** (sessão 32) | — |
| Dashboard Direção | Acede a Dashboard TI + Qualidade + **Dashboard Executivo enriquecido** (sessão 26): tendência ocupação 14d (AreaChart), faturação 6 meses (BarChart), urgência hoje, bloco operatório mês, ausências activas | — |
| Horários | Calendário + geração automática + **aviso conflito ao atribuir** (sessão 6) + **gestão de folgas** (sessão 20) + **trocas de folga** (sessão 24) | — |
| Bloco Operatório | ✅ Lista + checklist + **vista de sala em tempo real** (sessão 15) | — |
| Urgência | Episódios + triagem Manchester + mobile + **atribuir médico** (sessão 6) + **Manchester completo no mobile** (sessão 21) | — |
| IACS | Lista isolados + activar/desactivar + **culturas microbiológicas + surtos** (sessão 16) | — |
| Exames | Solicitar + resultado texto | Falta visualizador DICOM integrado para imagiologia |
| Worklist mobile | ✅ WorklistScreen (filtros + executar) | — |
| Pedidos Internos mobile | ✅ PedidosInternosScreen (criar + aceitar + concluir) | — |
| Bloco Operatório mobile | ✅ BlocoScreen (filtros + equipa) | — |
| MAR | Administrar + **Não Administrada com motivo** (sessão 6) | — |
| Incidentes TI | Lista + workflow estados + **atribuir responsável** + **notas/comentários** (sessão 17) | — |
| Conformidade checklist | RGPD/DGS/ACSS/SNS + **sincronizado com backend** (sessão 18) | — |

### 10.3 Divergências Web vs. Mobile

| Módulo | Web | Mobile |
|--------|-----|--------|
| Farmácia | ✅ Completo | ✅ FarmaciaScreen (pedidos + stock) |
| Fisioterapia | ✅ Completo | ✅ FisioterapiaScreen (planos + sessões) |
| Consultas Externas | ✅ Completo | ✅ ConsultasScreen (filtros + realizar) |
| Urgência | ✅ Completo | ✅ UrgenciaScreen (Manchester + tempo espera) |
| Bloco Operatório | ✅ Completo | ✅ BlocoScreen (filtros por estado + equipa) |
| Sala de Espera | ✅ Completo | ✅ SalaEsperaScreen (chamar + atendido) |
| Comunicação | ✅ Completo | ✅ ComunicacaoScreen (mensagens + anúncios) |
| Pedidos Internos | ✅ Completo | ✅ PedidosInternosScreen (criar + aceitar + concluir) |
| IACS | ✅ Completo | ✅ IACSScreen (3 tabs: isolamentos + culturas + surtos) |
| Worklist | ✅ Completo | ✅ WorklistScreen (filtros + executar + concluir) |
| MAR | ✅ Completo | ✅ MARScreen (pendentes + administrar) |
| Interconsultas | ✅ (na ficha) | ✅ `InterconsultasScreen` (lista recebidas/enviadas, nova IC, aceitar, responder) |
| Dashboard Qualidade | ✅ Completo | ✅ DashboardQualidadeScreen (KPIs, IACS, alertas, riscos, alta, eventos adversos) |
| Dietas | ✅ Completo | ✅ DietasScreen (sessão 34): vista cozinha, dietas por doente, prescrever |
| Eventos Adversos | ✅ Completo | ✅ EventosAdversosScreen (sessão 34): lista filtrada, registar, atualizar estado/ação |
| Equipamentos | ✅ Completo | ✅ EquipamentosScreen (sessão 35): inventário, alertas manutenção, reportar, atualizar estado |
| Consentimentos | ✅ Web completa | ✅ ConsentimentosScreen (sessão 35): seletor de doente, lista, criar, assinar, recusar |
| RH | ✅ Completo | ✅ RHScreen (sessão 36): 4 tabs — Dashboard KPIs, Ausências (aprovar/rejeitar), Formações, Avaliações |
| Faturação | ✅ Completo | ✅ FaturacaoScreen (sessão 36): resumo KPIs + lista por estado |
| Dashboard Executivo | ✅ Completo | ✅ DashboardExecutivoScreen (sessão 36): doentes, camas, faturação, urgência, bloco, pessoal |
| Relatórios DGS/SNS | ✅ Completo | ✅ RelatoriosScreen (sessão 36): 6 tabs com lazy loading — internamento, ocupação, diagnósticos, medicamentos, urgência, produtividade |
| Conformidade | ✅ Completo | ✅ ConformidadeScreen (sessão 36): checklist RGPD/DGS/ACSS/SNS (interactiva), acessos 30d, alto risco |

### 10.4 Dívida Técnica

| Área | Problema |
|------|---------|
| Testes | ✅ 95 testes unitários a passar (10 suites: AppController, AppService, DoenteService, MedicacaoService, FaturacaoService, AuthService, CamasService, AlertasService, SinaisVitaisService, TurnosService); e2e por escrever |
| Validação de input | ✅ DTOs completos (0 `body: any` na API) + validações de negócio implementadas: NIF/SNS únicos com `findFirst` + `ConflictException`; cama disponível verificada em `admitir()` |
| Erro handling | ✅ Padronizado (sessão 32): `ErrorCodes` enum centralizado em `common/error-codes.ts`; `AppException extends HttpException` com `{ statusCode, errorCode, message, details? }`; `GlobalExceptionFilter` formata todas as respostas de erro uniformemente |
| Paginação | Doentes: paginação já existia; **pesquisa server-side adicionada** (sessão 31) com debounce 300ms — procura em nome, processo e diagnóstico; clínicos sem search vêem só os seus doentes do turno, com search vêem todos os internados |
| SSE / Tempo Real | Tickets + **Camas** (sessão 29) + **Tarefas** (sessão 30) usam SSE; outros módulos ainda sem actualizações em tempo real |
| Seed de dados de teste | `seed-demo.ts` criado com dados hospitalares realistas |
| Documentação API (Swagger) | ✅ `/api/docs` (SwaggerModule + addCookieAuth) |
| ~~Acessibilidade (WCAG AA)~~ | ✅ Resolvido (sessão 8): `aria-label`, `scope="col"`, `htmlFor`/`id`, `role="dialog"`, `aria-live="polite"`, `confirm()` → `<ConfirmModal>`, contraste de botões desactivados |

---

## 11. Prioridades de Desenvolvimento

### ✅ Completado na Sessão 9 (2026-05-24)
- ~~JWT httpOnly cookies~~ — ✅ Migração completa (localStorage → httpOnly cookie)
- ~~MFA TOTP~~ — ✅ Google/Microsoft Authenticator + UI no perfil
- ~~Docker + SSL + Nginx~~ — ✅ docker-compose.prod.yml completo
- ~~Backup automático BD~~ — ✅ pg_dump diário cron container
- ~~Redis cache~~ — ✅ catálogo 1h + camas 30s + degradação silenciosa
- ~~pg_trgm full-text search~~ — ✅ script + deploy automático
- ~~Soft delete~~ — ✅ deletedAt nos 4 modelos críticos
- ~~Health endpoint~~ — ✅ terminus + Docker healthcheck
- ~~Rate limit diferenciado~~ — ✅ login 5/10min + MFA 10/10min
- ~~Verificador interacções medicamentosas~~ — ✅ 50 pares + warning prescrição
- ~~Análise tendência deterioração clínica~~ — ✅ regressão linear + risco baixo/moderado/alto
- ~~Aprovação de pedidos farmácia pelo médico~~ — ✅ fluxo `pendente→aprovado→dispensado`; proposta de prescrição por enfermeiro (`pendente_medico`); notificações push ao solicitante/prescritor

### Prioridade Alta — Próximas 2 semanas
1. ~~**Aprovação de pedidos farmácia pelo médico**~~ — ✅ Concluído: `PATCH /farmacia/pedido/:id/aprovar`, `PATCH /farmacia/pedido/:id/rejeitar`, `GET /farmacia/pedidos/pendentes-aprovacao` (para `medico`/`direcao`); `POST /medicacao/propor` (enfermeiro propõe), `GET /medicacao/pendentes-aprovacao-medico`, `PATCH /medicacao/:id/aprovar-medico`, `PATCH /medicacao/:id/rejeitar-medico`; notificações automáticas ao solicitante/prescritor
2. ~~**Paginação nos restantes endpoints**~~ — ✅ Concluído (comunicação inbox/enviadas + registos administrativos)
3. ~~**PWA**~~ — ✅ Concluído (manifest.json, service worker, ícones PNG, PwaRegister)

### ✅ Completado na Sessão 10 (2026-05-24 — continuação)
- ~~**Frontend farmácia — Aprovação médica**~~ — ✅ Tab "Aprovação Médica" para `medico`/`direcao`; lista pedidos `pendente`; botões Aprovar/Rejeitar (com motivo); "Dispensar" só aparece para `aprovado`
- ~~**Frontend doentes — Proposta enfermeiro**~~ — ✅ Botão "Propor" (violeta) para enfermeiro; modal completo; secção de propostas pendentes para médico com Aprovar/Rejeitar inline
- ~~**Expiração de password**~~ — ✅ `passwordExpiresAt` no schema; 90 dias na criação/alteração; `/auth/password-status`; banner de aviso no layout quando < 10 dias
- ~~**Reconciliação MAR↔Farmácia push**~~ — ✅ `NotificacoesService` injectado; push para farmacêuticos quando problemas detectados
- ~~**Notificações in-app com leitura confirmada**~~ — ✅ Modelo `NotificacaoInApp` (schema + `db push`); `enviarParaUtilizador` persiste em DB; `GET /notificacoes` com paginação; `PATCH /notificacoes/:id/ler`; `PATCH /notificacoes/marcar-todas-lidas`; página `/notificacoes`; sino no sidebar com badge de não lidas
- ~~**Bloco Operatório mobile**~~ — ✅ `BlocoScreen.tsx` existia e está ligado em MaisScreen (medico/enfermeiro)
- ~~**Worklist mobile**~~ — ✅ `WorklistScreen.tsx` existia e está ligado em MaisScreen (tecnico_saude/medico)
- ~~**Dashboard executivo**~~ — ✅ Já completo (`/dashboard-executivo`) — KPIs internamento, camas, faturação, consultas, pessoal

### ✅ Completado na Sessão 11 (2026-05-25)
- ~~**Restrição de rede hospitalar**~~ — ✅ Nginx `allow 192.168.0.0/16; allow 10.0.0.0/8; deny all;` no bloco HTTPS; apenas LAN hospitalar e VPN acedem à plataforma
- ~~**Passagem de turno com presença real**~~ — ✅ Modelo `PresencaOnline` (upsert/delete no WebSocket connect/disconnect); novos campos em `PassagemTurno` (`estadoDesafio`, `desafioEnviadoEm`, `desafioAceitoEm`, `desafioExpiradoEm`); `POST /turnos/iniciar-passagem` verifica presença online e emite desafio WS `turno:passagem-desafio`; receptor aceita via `turno:passagem-aceite`; timeout 5min marca `expirado` e notifica
- ~~**Monitorização de presença e check-in com GPS**~~ — ✅ Modelo `RegistoCheckin` com lat/lon/distância/dentroGeofence/IP; `checkIn` captura GPS ou verifica IP interno; alerta ao chefe de turno se fora da geofence; `GET /turnos/ativo/inatividade` lista profissionais sem actividade > 2h
- ~~**Mobile GPS check-in**~~ — ✅ `TurnoScreen` com botão "📍 Fazer Check-in" usa `expo-location`; botão "🔄 Passar Turno" inicia desafio de passagem; aviso visual se fora do hospital

### ✅ Completado na Sessão 12 (2026-05-26) — Avaliação Arquitectural + Correcções
- ~~**Páginas em falta: Dietas e Consentimentos**~~ — ✅ `dietas/page.tsx` (prescrição + vista cozinha) e `doentes/[id]/consentimentos/page.tsx` (criar/assinar/recusar modais) implementadas
- ~~**Segurança RBAC — endpoints sem `@Roles`**~~ — ✅ Adicionados `@Roles` a 15+ endpoints sem restrição de role: `break-glass`, `sinais-vitais:POST`, `alergias:POST/DELETE`, `notificacoes`, `doentes:nota/alta/tarefa`, `tarefas:POST/PATCH`
- ~~**`recepcao/page.tsx` — `fetch()` directo + `localStorage`**~~ — ✅ Substituídas todas as 9 chamadas `fetch()` + header `Authorization: Bearer` pelo `api` axios (httpOnly cookies); removidos `const API` e `const token`; SSE mantido com `SSE_BASE`
- ~~**Mobile — URL hardcoded**~~ — ✅ `const API_URL = 'http://localhost:3333'` → `process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:3333'` em `apps/mobile/src/lib/api.ts`
- ~~**`schema.prisma` fora da convenção NestJS**~~ — ✅ Movido de `apps/api/src/prisma/` para `apps/api/prisma/`; `output` actualizado para `../src/generated/prisma`; Dockerfile actualizado
- ~~**`.catch(() => {})` silenciosos**~~ — ✅ Substituídos em 17 ficheiros de serviço/gateway por `.catch((err) => this.logger.warn('Notificação falhou', err?.message ?? String(err)))`; `Logger` injectado nos 15 serviços que não o tinham
- ~~**`app.module.ts` — 52 imports flat**~~ — ✅ Agrupados em 6 secções comentadas: Infra, Gestão Utilizadores/RH, Clínico—Doente&Cama, Clínico—Terapêutica, Clínico—Serviços Especializados, Operacional, Analytics
- ~~**Transacções em falta**~~ — ✅ `$transaction()` adicionado a `dietas:prescrever()` (deactivate+create atómico), `exames:registarResultado()` (auto-faturação atómica), `bloco:registarNotasPos()` (auto-faturação atómica); os restantes serviços críticos (`doentes`, `faturacao`, `horarios`, `farmacia`) já tinham transacções correctas
- ~~**Custom hooks de data fetching**~~ — ✅ Criados `src/lib/hooks/`: `use-doentes.ts`, `use-tarefas.ts`, `use-notificacoes.ts`, `use-utilizadores.ts`, `use-alertas.ts` (React Query + barrel `index.ts`)

### ✅ Completado na Sessão 14 (2026-05-26) — DTOs API + Swagger
- ~~**DTOs em todos os módulos**~~ — ✅ 69 ficheiros DTO criados em 25 módulos; 0 `@Body() dto: any` restantes em qualquer controller
  - Validação activa: `ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true })` já estava configurado globalmente em `main.ts`
  - `@ApiProperty` / `@ApiPropertyOptional` em todos os DTOs para geração automática do Swagger
- ~~**Configurar Swagger/OpenAPI**~~ — ✅ `SwaggerModule` configurado em `main.ts`; documentação disponível em `/api/docs`
  - Auth via cookie (`addCookieAuth('access_token')`)
  - Título: "CuraSphere API"; versão 1.0

### ✅ Completado na Sessão 13 (2026-05-26) — Decomposição client-layout.tsx + doentes/[id]/page.tsx
- ~~**Decompor `client-layout.tsx`**~~ — ✅ 1077L → 265L; extraídos 3 ficheiros:
  - `nav-data.tsx` (634L) — ROLES constants, `navItems` array (45 itens com ícones SVG), `roleLabel`, `subRoleLabel`, `servicoLabel`, `roleColor` maps, `Avatar` component
  - `sos-banner.tsx` (37L) — componente puro; props `{ sosAlerta, onClose }`
  - `sidebar-nav.tsx` (164L) — sidebar completa; props `{ utilizador, itemsVisiveis, naoLidas, pathname, sidebarAberta, onCloseSidebar, onOpenConfig, onLogout }`
  - `client-layout.tsx` reduzido a orquestração: state, hooks (`useSocket`, `useQuery`), `useEffect`, modais de config/password
- ~~**Decompor `doentes/[id]/page.tsx`**~~ — ✅ 3852L → 2624L; criados 5 componentes em `doentes/[id]/components/`:
  - `sinais-vitais-panel.tsx` (277L) — gráfico de sinais vitais (recharts), banner NEWS2, tabela com highlighting de valores críticos, modal de registo; props `{ doenteId, utilizador }`
  - `risco-escalas-panel.tsx` (164L) — Escalas de Braden e Morse (risco úlceras + queda), modal de avaliação por itens; props `{ doenteId, utilizador }`
  - `exames-panel.tsx` (234L) — lista de exames por tipo, registo de resultados, cancelamento; props `{ doenteId, utilizador }`
  - `notas-clinicas-panel.tsx` (189L) — Notas SOAP (Subjetivo/Objetivo/Avaliação/Plano), edição inline, delete; props `{ doenteId, utilizador }`
  - `escalas-clinicas-panel.tsx` (375L) — ESCALA_CONFIG (13 escalas: RASS, CPOT, SOFA, Apgar, PEWS, FLACC, CTG, Barthel, MRC, NRS2002, PHQ9, GAD7, FOIS), pontuação + classificação automática; props `{ doenteId, utilizador }`

### ✅ Completado na Sessão 14 cont. (2026-05-27) — Activar `libs/shared`
- ~~**Activar `libs/shared`**~~ — ✅ Tipos actualizados e apps a importar de `@org/shared`
  - `utilizador.types.ts`: `Role` expandido para 10 roles; `Utilizador` com `subRole`, `servico`, `email`, `mfaAtivo`
  - `doente.types.ts`: datas como `string` (API response); adicionados `DoenteListItem` e `DoentesPaginados`; `estadoRegisto` incluído
  - `tarefa.types.ts`: datas como `string`; adicionados campos de relação `responsavel`, `criadoPor`, `doente`
  - `medicacao.types.ts`: datas como `string`; campos opcionais alinhados com API
  - `turno.types.ts`: datas como `string`; campos opcionais onde a API pode omitir
  - `horario.types.ts`: data como `string`
  - Ficheiros migrados para `import from '@org/shared'`:
    - `apps/web/src/lib/auth-context.tsx` — `Utilizador`
    - `apps/web/src/lib/hooks/use-doentes.ts` — `DoenteListItem`, `DoentesPaginados`
    - `apps/web/src/lib/hooks/use-tarefas.ts` — `Tarefa`
    - `apps/web/src/lib/hooks/use-utilizadores.ts` — `Utilizador`
    - `apps/mobile/src/lib/auth.ts` — `Utilizador`
  - Re-exportações preservadas (`export type { X }`) para compatibilidade com importadores existentes

### ✅ Completado na Sessão 14 cont. (2026-05-27) — Sub-agrupamento de rotas web
- ~~**Sub-agrupar rotas web**~~ — ✅ 43 pastas reorganizadas em 4 grupos de domínio dentro de `(dashboard)/`
  - `(clinico)/` — workflow clínico diário: doentes, mar, tarefas, passagem-turno, atribuicoes, interconsultas, especialidades, fisioterapia, bloco, urgencia, worklist, iacs, camas
  - `(administrativo)/` — recepção e administração: recepcao, sala-espera, doentes-admin, faturacao, tabela-atos, relatorios-financeiros, registos-administrativos, catalogo, fornecedores, consultas
  - `(gestao)/` — gestão e RH: rh (+ subpastas), horarios, ferias, trocas, operacional, utilizadores, dashboards executivo/qualidade, eventos-adversos, conformidade, auditoria, relatorios, comunicacao
  - `(suporte)/` — TI e suporte: dashboard-ti, incidentes-ti, pedidos-ti, pedidos-internos, equipamentos, dietas, farmacia
  - Raiz: dashboard/, notificacoes/, perfil/, configuracoes/ (transversais)
  - 61 ficheiros `.tsx` migrados de imports relativos (`../../../lib/`) para aliases absolutos (`@/lib/`, `@/components/`)
  - URLs não foram alterados (route groups Next.js são transparentes ao router)

### Dívida Técnica Arquitectural — CONCLUÍDA
Todos os 5 itens de alta/média prioridade do roadmap foram resolvidos.

### ✅ Completado na Sessão 15 (2026-05-27) — Vista de Sala do Bloco + Fix tsconfig
- ~~**Vista de sala do bloco (disponibilidade em tempo real)**~~ — ✅ Implementado
  - Backend: `GET /bloco/salas/status` — devolve todas as salas conhecidas com `status: livre|em_uso|proxima_cirurgia`, cirurgia activa e próxima cirurgia do dia; cirurgias `em_curso` de dias anteriores incluídas
  - `EventsGateway.emitirBlocoUpdate()` — emite `bloco:update` para sala geral ao actualizar estado de cirurgia
  - `BlocoModule` importa `GatewayModule`; `BlocoService` injeta `EventsGateway`
  - Frontend: tab "Vista de Sala" na página `/bloco` com grid de cards por sala; cores: vermelho pulsante (em_uso), âmbar (próxima), verde (livre); barra de progresso da cirurgia em curso; polling 30s + botão de actualização manual; WebSocket `bloco:update` dispara re-fetch
  - `use-socket.ts`: adicionado `'bloco:update'` ao tipo `SocketEvent`
- **Fix tsconfig web** — `composite: false` + `declarationMap: false` adicionados ao tsconfig do web para permitir importar de `@org/shared` (fora de `src/`); zero erros de TypeScript após fix

### ✅ Completado na Sessão 16 (2026-05-27) — Culturas Microbiológicas e Surtos IACS
- **Módulo `iacs/`** — registo e listagem de culturas microbiológicas e surtos IACS
  - Novos modelos Prisma: `CulturaMicrobiologica` + `SurtoIACS` + enums `ResultadoCultura` + `EstadoSurto`
  - `GET /iacs/dashboard` — contagem de isolados activos, culturas positivas/pendentes, surtos activos + últimas 5 culturas positivas
  - `POST /iacs/cultura` — registar colheita (tipoAmostra, agente?, antibiograma JSON, resultado, serviço); roles: medico, enfermeiro, tecnico_saude
  - `GET /iacs/culturas` — listar com filtros `doenteId`, `agente` (insensitive), `resultado`
  - `PATCH /iacs/cultura/:id` — actualizar resultado/antibiograma/observações
  - `POST /iacs/surto` — registar surto (agente, serviço, dataInicio, numCasos, medidas JSON); roles: medico, enfermeiro, qualidade
  - `GET /iacs/surtos` — listar com filtro `estado`
  - `PATCH /iacs/surto/:id` — actualizar estado/numCasos/dataFim/medidas
  - `IacsModule` registado em `AppModule`; DB actualizada via `prisma db push`
  - Zero erros de TypeScript

### ✅ Completado na Sessão 17 (2026-05-27) — Notas em Incidentes TI + Mobile IACSScreen
- ~~**Incidentes TI — notas/comentários**~~ — ✅ Implementado
  - Novo modelo Prisma `NotaIncidenteTI` com `onDelete: Cascade`; `db push` aplicado
  - `GET /incidentes-ti/:id/notas` — lista notas ordenadas por data (inclui `autor`)
  - `POST /incidentes-ti/:id/notas` — adicionar nota; `AdicionarNotaDto` com validação (MinLength 1, MaxLength 2000)
  - Web: secção "Notas (N)" no painel expandido de cada incidente; lista de notas com autor + timestamp; textarea + botão "Adicionar"; carregamento lazy quando expandido
- ~~**Mobile IACSScreen — Culturas + Surtos**~~ — ✅ `IACSScreen.tsx` reescrito com 3 abas
  - Tab "Isolamentos" — lista doentes em isolamento com botão "Levantar" (médico/enfermeiro/qualidade)
  - Tab "Culturas" — lista culturas microbiológicas com badge de resultado colorido; agente; data colheita; serviço
  - Tab "Surtos" — lista surtos com badge de estado (activo/controlado/encerrado); número de casos; medidas; duração
  - Todas as 3 abas carregam em paralelo (`Promise.all`) no `useFocusEffect`

### ✅ Completado na Sessão 18 (2026-05-27) — Conformidade Backend + Ficha Pessoal na Admissão
- ~~**Conformidade checklist — sincronização com backend**~~ — ✅ Implementado
  - Novo modelo Prisma `ConformidadeChecklistItem` (itemKey único, estado, atualizadoEm, atualizadoPorId); `db push` aplicado
  - `GET /audit/checklist` — devolve os 8 itens (com defaults `verificar` para os ainda não persistidos)
  - `PATCH /audit/checklist/:itemKey` — upsert do estado; gravado com `atualizadoPorId` do utilizador autenticado
  - Web: `useQuery` para checklist da API; `useMutation` para toggle (3 estados em ciclo: verificar → conforme → nao_conforme); timestamp "Actualizado DD/MM/AAAA" visível; removido localStorage
- ~~**Ficha pessoal no formulário de admissão**~~ — ✅ Implementado
  - `AdmitirDoenteDto` expandido com campos opcionais: `nif`, `numeroSNS`, `morada`, `codigoPostal`, `localidade`, `telefone`
  - `admitir()` no service cria `FicheiroPessoalDoente` dentro do mesmo `$transaction` se qualquer campo admin estiver preenchido
  - Web: nova secção "Dados Administrativos" na página `/doentes/admitir` com 6 campos opcionais (NIF, SNS, telefone, localidade, morada, código postal); nota informativa que pode ser preenchido depois

### ✅ Completado na Sessão 22 (2026-05-29) — Bloco: Calendário Mensal
- ~~**Agenda de bloco (calendário visual)**~~ — ✅ Implementado
  - Backend: `GET /bloco/agenda/mes?mes=M&ano=Y` — consulta mês completo, agrupa cirurgias por dia (`{ dia, total, cirurgias[] }`)
  - Frontend: nova tab "Calendário" (entre "Agenda Diária" e "Vista de Sala")
  - Grelha 7 colunas com navegação ← mês → e botão "Hoje"
  - Cada célula de dia: count badge "N cirurgia(s)" + até 3 itens (hora + designação) com cores por sala (Bloco 1=azul, Bloco 2=violeta, Bloco 3=laranja, etc.)
  - Ponto colorido por estado (agendada=azul, em_curso=âmbar, concluida=verde, cancelada=vermelho, adiada=cinza)
  - Dia de hoje com círculo azul; "+N mais" quando > 3 cirurgias no mesmo dia
  - Click num dia → muda para tab "Agenda Diária" com `dataFiltro` já definido para esse dia
  - Legenda de salas + legenda de estados na base do calendário

### ✅ Completado na Sessão 21 (2026-05-29) — Urgência Mobile: Manchester Completo
- ~~**Urgência mobile — protocolo Manchester completo**~~ — ✅ `UrgenciaScreen.tsx` reescrito
  - Corrigidos nomes de estados (eram `em_observacao`, `aguarda_resultado`, `alta` → alinhados com API: `sala_espera`, `em_atendimento`, `alta_urgencia`)
  - Botão "+" no header (roles: enfermeiro/médico/administrativo) → modal "Nova Entrada — Triagem Manchester"
  - Modal de entrada: queixa principal, nome temporário (opcional), notas (opcional), seleção de cor Manchester (5 botões com label + tempo máximo de espera; botão fica colorido ao seleccionar)
  - Botão "Registar Entrada" fica na cor da prioridade selecionada
  - Episódios ordenados por prioridade (vermelho → azul)
  - Tap num episódio activo → bottom sheet "Acções" com botões de transição de estado por fase:
    - `triagem` → `sala_espera`
    - `sala_espera` → `em_atendimento`, `transferido`
    - `em_atendimento` → `aguarda_resultado`, `alta_urgencia`, `internado`, `transferido`
    - `aguarda_resultado` → `em_atendimento`, `alta_urgencia`, `transferido`
  - Tempo de espera calculado desde `dataEntrada`
  - Ícone médico visível se atribuído; indicador "Acções" quando existem transições disponíveis

### ✅ Completado na Sessão 20 (2026-05-29) — Horários: Gestão de Folgas
- ~~**Horários — Gestão de folgas**~~ — ✅ Implementado
  - Backend: `folga` adicionado como tipo válido em `CriarAusenciaDto` (usa modelo `Ausencia` existente; reutiliza endpoints `/rh/ausencias/...`)
  - Web: `carregar()` carrega `GET /rh/ausencias/minhas` em paralelo; filtra as de tipo `folga` → `minhasFolgas`
  - Chefes: `GET /rh/ausencias/para-aprovar` carregado em `useEffect`; painel "Pedidos de Folga Pendentes" acima do calendário com nome, data, botões Aprovar/Rejeitar por row
  - Calendário: badge "Folga ✓" verde (aprovada) ou "Folga ⟳" âmbar (pendente) por dia
  - Painel lateral (dia): banner colorido se já existe folga/pendente + botão "Cancelar" se pendente; botão "Pedir folga neste dia" (não-chefes, dias futuros, sem folga já pedida)
  - `aprovandoFolga` state bloqueia botões duplicados durante requests

### ✅ Completado na Sessão 31 (2026-05-29) — Doentes: pesquisa server-side
- ~~**Pesquisa de doentes client-side**~~ — ✅ Migrada para server-side com debounce
  - **Problema resolvido**: pesquisa anterior filtrava só os 25 resultados da página actual; com >25 doentes, resultados ficavam incompletos
  - **Backend** (`doentes.service.ts`): parâmetro `search?` no `listar()`:
    - Filtra por `nome ILIKE %search%` + `numeroProcesso ILIKE %search%` + `diagnosticoPrincipal ILIKE %search%`
    - Comportamento especial para clínicos: sem search → apenas doentes do turno/atribuídos; com search → todos os internados (permite encontrar qualquer doente)
  - **Backend** (`doentes.controller.ts`): `@Query('search') search?` exposto no `GET /doentes`
  - **Frontend** (`doentes/page.tsx`):
    - `useEffect` com debounce 300ms: `pesquisa` → `pesquisaDebounced` + reset `pagina` para 1
    - `pesquisaDebounced` incluído no `queryKey` e no URL (`?search=…`)
    - Filtros client-side residuais apenas para `estado` e `serviço` (não têm parâmetros server-side)
    - Compatível com paginação: trocar de página mantém o termo de pesquisa

### ✅ Completado na Sessão 30 (2026-05-29) — Tarefas: SSE em tempo real
- ~~**SSE para Tarefas**~~ — ✅ Lista de tarefas actualiza automaticamente para todos os utilizadores
  - **Backend** (`tarefas.service.ts`): `Subject<{data,type}>` com `eventStream()` + `emit()` privado
    - `criar()` emite `tarefa_criada` com `{ id, prioridade, grupoResponsavel }`
    - `atualizarEstado()` emite `tarefa_atualizada` com `{ id, estado, doenteId }`
  - **Backend** (`tarefas.controller.ts`): `@Sse('eventos')` com `map()` → `{ type, data }`
  - **Frontend** (`tarefas/page.tsx`):
    - `useEffect` cria `EventSource('/tarefas/eventos', { withCredentials: true })`
    - `tarefa_criada`: re-fetch lista; se `prioridade === 'urgente'` → `toast.error('Nova tarefa urgente...')`
    - `tarefa_atualizada`: re-fetch lista (lista é user-specific, re-fetch é a estratégia correcta)
    - Badge "Em directo" verde com pulse animation no cabeçalho
    - Cleanup `es.close()` no unmount
  - Diferença de abordagem vs. Camas: tarefas usam re-fetch completo (lista é filtrada por utilizador); camas usavam actualização cirúrgica (lista é global)

### ✅ Completado na Sessão 29 (2026-05-29) — Mapa de Camas: SSE em tempo real
- ~~**SSE para Camas**~~ — ✅ Mapa de camas actualiza automaticamente para todos os utilizadores
  - **Backend** (`camas.service.ts`): `Subject<{data,type}>` com `eventStream()` + `emit()` privado; `emitirAtualizacaoCama()` público para uso por outros serviços
    - `atualizarEstado()` emite `cama_atualizada` após cada mudança de estado
    - `confirmarLimpeza()` emite `cama_atualizada` após limpeza confirmada
  - **Backend** (`camas.controller.ts`): `@Sse('eventos')` com `map()` → `{ type, data }` (autenticado via cookie JWT + `@UseGuards(JwtAuthGuard, RolesGuard)`)
  - **Frontend** (`camas/page.tsx`):
    - `useEffect` cria `EventSource('/camas/eventos', { withCredentials: true })` no mount
    - `addEventListener('cama_atualizada')` actualiza a cama específica em state com `setCamas(prev => prev.map(...))` — sem re-fetch completo
    - `sseConectado` state: `true` no `onopen`, `false` no `onerror`
    - Badge "Em directo" (verde, pulse animation) no cabeçalho quando SSE conectado
    - Cleanup `es.close()` no unmount

### ✅ Completado na Sessão 28 (2026-05-29) — Relatórios: Produtividade por Profissional
- ~~**Relatórios de produtividade**~~ — ✅ `GET /relatorios/produtividade`
  - **Backend** (`relatorios.service.ts`): método `produtividade()` com 5 queries `Promise.all`:
    - `Consulta.groupBy(['medicoId'])` where `estado='realizada'`, período filtrado
    - `NotaClinica.groupBy(['autorId'])` no período
    - `Tarefa.groupBy(['responsavelId'])` where `estado='concluida'`, período via `concluidaEm`
    - `CirurgiaProgramada.groupBy(['cirurgiaoId'])` where `estado='concluida'`, período
    - `Utilizador.findMany` para médicos, enfermeiros, auxiliares, técnicos, farmacêuticos activos
    - Join em memória com `Object.fromEntries` + retorna `{ periodo, totais, linhas }`
  - **Backend** (`relatorios.controller.ts`): `GET /relatorios/produtividade` com export CSV via `toCSV(data.linhas)`
  - **Frontend** (`relatorios/page.tsx`):
    - Adicionada entrada "Produtividade por Profissional" ao grid de selecção (ícone 📊)
    - Constante `ROLE_LABEL` para nomes PT de cada role
    - 4 KPI summary cards (Consultas / Notas Clínicas / Tarefas / Cirurgias) com cores distintas
    - Tabela detalhada: Profissional | Função | Serviço | Consultas | Notas | Tarefas | Cirurgias
    - Profissionais sem actividade no período: `opacity-40`; células com `0` mostram `—`
    - Export CSV funcional (dados de `data.linhas`)

### ✅ Completado na Sessão 27 (2026-05-29) — Notificações mobile: centro de notificações
- ~~**Leitura confirmada de notificações push**~~ — ✅ `NotificacoesScreen.tsx` criado de raiz
  - Lista todas as notificações in-app (`GET /notificacoes?limit=50`) com paginação
  - Indicador visual por notificação: dot indigo + fundo azul lavanda para não lidas; dot cinzento para lidas
  - Toque na notificação não lida → `PATCH /notificacoes/:id/ler` e actualização optimista do estado
  - Botão "Ler todas" no header → `PATCH /notificacoes/marcar-todas-lidas`; desaparece quando `naoLidas === 0`
  - Badge vermelho no header com contagem de não lidas
  - Pull-to-refresh + `useFocusEffect` para recarga automática ao entrar no ecrã
  - Formatação de data relativa (Agora mesmo / Há Xmin / Há Xh / Há X dias / data PT)
  - Ecrã vazio com ícone `notifications-off-outline` quando sem notificações
- **MaisScreen.tsx** actualizado:
  - Importa e roteia `NotificacoesScreen`
  - `useFocusEffect` carrega `GET /notificacoes/nao-lidas` ao entrar no separador
  - Item "Notificações" adicionado ao menu (visível a todos, acima de "Comunicação")
  - Badge vermelho no item do menu quando há não lidas (substitui a seta `›`)
  - Ao voltar do ecrã de notificações: badge do menu é zerado
- ~~**Interconsultas mobile ⚠️ Parcial**~~ — ✅ Correcção documental: `InterconsultasScreen` já estava completo e ligado em `MaisScreen`

### ✅ Completado na Sessão 26 (2026-05-29) — Dashboard Executivo: BI enriquecido
- ~~**Dashboard Executivo — novos KPIs e tendências**~~ — ✅ Backend + Frontend
  - **Backend** (`dashboard.service.ts`): `dashboardExecutivo()` expandido com 5 novas métricas calculadas em paralelo:
    - `tendenciaOcupacao`: array de 14 dias com `{ data, ocupadas, total, taxa }` (baseado em episódios activos por dia)
    - `tendenciaFaturacao`: array de 6 meses com `{ mes, total }` (soma `valorTotal` de facturas por mês)
    - `urgenciaHoje`: `{ total, emAtendimento, aguardaAlta, alta }` via `groupBy estado` nos episódios de urgência de hoje
    - `cirurgiasMes`: `{ total, concluidas, emCurso, canceladas }` via `groupBy estado` no mês corrente
    - `ausenciasAtivas`: contagem de ausências aprovadas activas (startDate ≤ hoje ≤ endDate)
  - **Frontend** (`dashboard-executivo/page.tsx`): Interface `DashExec` actualizada; novos charts com Recharts:
    - `AreaChart` "Tendência de Ocupação — 14 dias" com gradiente indigo e tooltip personalizado
    - `BarChart` "Faturação — 6 Meses" com barras verdes e formatação `fmtK` (compact notation para k€)
    - Nova secção "Urgência Hoje" (2×2 grid: total, em atendimento, aguarda alta, alta)
    - Nova secção "Bloco Operatório — Mês" (2×2 grid: total, concluídas, em curso, canceladas)
    - "Ausências Activas" adicionado ao painel Operacional (cor red quando > 0)
    - Tooltip custom para ambos os gráficos com formatação PT

### ✅ Completado na Sessão 19 (2026-05-29) — Comunicação: picker de destinatário
- ~~**Comunicação — "Enviar Mensagem" modal com UUID raw**~~ — ✅ Corrigido
  - Substituído campo de texto livre ("UUID do utilizador") por picker com pesquisa em tempo real
  - Ao abrir o modal: `GET /utilizadores?limit=200` carrega todos os utilizadores activos (lazy, só uma vez por sessão do modal)
  - Input de pesquisa filtra por nome e por role (PT); dropdown com até 8 resultados (avatar inicial, nome, role, serviço)
  - Após selecção: exibe pill azul com inicial + nome + botão X para limpar
  - `onClick` no overlay fecha o dropdown; `onMouseDown preventDefault` previne fechar ao clicar num item
  - Utilizador actual filtrado da lista (não pode enviar mensagem para si próprio)
  - Botão "Enviar" só activa se destinatário seleccionado + mensagem preenchida

### ✅ Completado na Sessão 32 (2026-05-30) — Sprint de Qualidade Arquitectural
- **Validação de negócio na admissão** — NIF e SNS únicos verificados com `findFirst` + `ConflictException 409`; cama disponível (`estado: 'livre' | 'reservada'`) verificada antes de criar episódio
- **Padronização de erros da API** — `ErrorCodes` enum em `common/error-codes.ts`; `AppException extends HttpException` com `{ statusCode, errorCode, message, details? }`; `GlobalExceptionFilter` unifica todas as respostas de erro
- **Comunicação — anexos em mensagens** — `POST /comunicacao/mensagens/:id/anexo` com `FileInterceptor` (multer + diskStorage); validação de tipo MIME (imagem, PDF, Word, Excel, TXT) + limite 10 MB; modelo `AnexoMensagem` com `nome`, `url`, `mimeType`, `tamanho`; `TIPOS_PERMITIDOS` e `MAX_SIZE_BYTES` como constantes no controller
- **`recepcao/page.tsx`** — todas as 9 chamadas `fetch()` directas substituídas por `api` axios com cookies httpOnly; removidos `const API` e `const token localStorage`; SSE mantido com `SSE_BASE`
- **Mobile — URL da API via variável de ambiente** — `const API_URL = 'http://localhost:3333'` → `process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:3333'` em `apps/mobile/src/lib/api.ts`
- **`$transaction()` adicional** — `dietas:prescrever()` (deactivate+create atómico), `exames:registarResultado()` (auto-faturação atómica), `bloco:registarNotasPos()` (auto-faturação atómica)
- **`client-layout.tsx` — extracção adicional de modais** — 2 novos ficheiros:
  - `modal-configuracoes.tsx` (80L) — modal tema claro/escuro; lê/escreve `localStorage('curasphere-theme')`; toggle `document.documentElement.classList.toggle('dark', ...)`
  - `modal-alterar-password.tsx` (91L) — `PATCH /auth/alterar-password`; estado de sucesso inline
  - `client-layout.tsx` reduzido de 1077L → ~130L
- **`doentes/[id]/page.tsx` — decomposição completa** — 7 novos painéis em `components/`:
  - `alergias-contactos-panel.tsx` (326L) — alergias + contactos de emergência; fetch próprio; `doenteId + utilizador` props
  - `notas-turno-panel.tsx` (293L) — notas de turno; recebe `notas[]`, `emTurno`, `onRefresh`
  - `medicacao-panel.tsx` (545L) — medicação activa + propostas enfermeiro; recebe `medicacoes[]`, busca propostas internamente
  - `tarefas-panel.tsx` (412L) — tarefas do doente; recebe `tarefas[]`, `emTurno`, `onRefresh`
  - `interconsultas-panel.tsx` (249L) — fetch próprio
  - `problemas-panel.tsx` (237L) — fetch próprio
  - `dispositivos-panel.tsx` (268L) — fetch próprio; usa `ConfirmModal` para remoção
  - Página reduzida de 3852L → 1121L; 12 painéis no total (incluindo os 5 da sessão 13)
- **`libs/shared` — activação adicional em 5 páginas web**:
  - `doentes/admitir/page.tsx` — `import type { Cama } from '@org/shared'`
  - `tarefas/page.tsx` — `interface Tarefa extends SharedTarefa { grupoResponsavel?, doente }`
  - `camas/page.tsx` — `interface Cama extends SharedCama { doente?: ... | null }`
  - `utilizadores/page.tsx` — `interface Utilizador extends SharedUtilizador { ordemExperiencia?, equipa? }`
  - `passagem-turno/page.tsx` — `import type { EstadoDoente, Turno as SharedTurno } from '@org/shared'`

### ✅ Completado na Sessão 33 (2026-05-30) — DTOs finais + Custom hooks integrados
- **0 `@Body() body: any` em toda a API** — últimos 2 controllers sem DTO tipado corrigidos:
  - `comunicacao/dto/enviar-broadcast.dto.ts` — `EnviarBroadcastDto` (`servicoAlvo?`, `roleAlvo?`, `assunto?`, `texto`)
  - `rh/dto/criar-troca-folga.dto.ts` — `CriarTrocaFolgaDto` (`destinatarioId`, `dataOrigem`, `dataDestino`, `motivo?`)
  - `comunicacao.controller.ts` + `rh.controller.ts` actualizados para usar os novos DTOs
- **`use-notificacoes.ts` — bugs corrigidos + hook de contagem adicionado**:
  - `useMarcarLida`: endpoint `/lida` → `/ler` (corrigido para corresponder ao controller)
  - `useMarcarTodasLidas`: endpoint `/todas/lidas` → `/marcar-todas-lidas` (corrigido)
  - `useNotificacoes(page)`: tipo de retorno corrigido de `Notificacao[]` → `NotificacoesPaginadas`; aceita `page` param
  - `useNaoLidasCount()` adicionado — query `/notificacoes/nao-lidas` com `staleTime: 30s`, `refetchInterval: 60s`
  - Ambas as mutações invalidam `['notificacoes']` + `['notificacoes-count']`
- **`notificacoes/page.tsx`** — migrada para hooks: remove `useQuery`/`useMutation`/`api` imports directos; usa `useNotificacoes(page)`, `useMarcarLida()`, `useMarcarTodasLidas()` de `@/lib/hooks`
- **`client-layout.tsx`** — remove `useQuery` + `api` imports; usa `useNaoLidasCount()` do `@/lib/hooks`; layout sem dependências directas de `@tanstack/react-query` ou `api`

### ✅ Completado na Sessão 34 (2026-05-30) — Mobile: Dietas + Eventos Adversos
- **`DietasScreen.tsx`** — prescrições dietéticas do dia no mobile
  - `GET /dietas/hoje` → lista todos os doentes internados com/sem dieta activa
  - Vista dividida: secção "Com dieta prescrita" (verde) + secção "Sem dieta prescrita" (âmbar) com contadores no topo
  - Cada cartão: nome + cama, badge colorido por tipo de dieta, chips de restrições (glúten, lactose, sal, etc.), observações, prescritor + data
  - FAB "+" para medico/enfermeiro → modal de prescrição: picker de doente (pesquisa), selector de 7 tipos, multi-select de 8 restrições, campo de observações
  - Visível a: todos os clínicos, auxiliar, administrativo
- **`EventosAdversosScreen.tsx`** — registo de incidentes, quedas, erros de medicação no mobile
  - `GET /eventos-adversos?tipo=&gravidade=&estado=` com 3 filtros em chip (ciclam pelos valores)
  - KPIs no topo: Total | Abertos (âmbar quando >0) | Graves (vermelho quando >0, conta dano_grave+óbito)
  - Cada cartão: badge gravidade (5 cores), badge estado, badge tipo, descrição (2 linhas), doente se associado, data, registadoPor
  - Tap no evento → modal detalhe: informação completa + (para qualidade/direcao/medico) input "Ação Corretiva" + selector de 3 estados com cores + "Guardar Alterações" (`PATCH /eventos-adversos/:id`)
  - FAB "+" para podeRegistar → modal de criação: selector tipo (6 botões), selector gravidade (5 botões coloridos), descrição (obrigatória), serviço (opcional), doente picker (sub-modal com pesquisa), data/hora ocorrência, ação corretiva opcional
  - Visível a: todos os clínicos + qualidade + direcao
- **`MaisScreen.tsx`** — 2 novos itens de menu adicionados (Dietas: ícone restaurant verde; Eventos Adversos: ícone warning vermelho)

### ✅ Completado na Sessão 35 (2026-05-30) — Mobile: EquipamentosScreen
- **`EquipamentosScreen.tsx`** — gestão de equipamentos médicos no mobile
  - Dois tabs: **Inventário** (lista com pesquisa + filtro por estado) e **Alertas** (equipamentos com manutenção próxima/vencida)
  - Cada cartão: ícone por tipo (cama, ventilador, monitor, cadeira de rodas, bomba, desfibrilhador), badge de estado colorido (operacional/avariado/em_manutencao/abatido), badge de alerta de manutenção se próxima ≤30 dias
  - Tap em equipamento → modal detalhe com grelha de info + histórico de manutenções carregado via `GET /equipamentos/:id/manutencoes`
  - **Reportar manutenção** (`POST /equipamentos/:id/manutencoes`): visível a operacional, ti, enfermeiro, medico, auxiliar — selectors de tipo (corretiva/preventiva/preditiva/emergencia), prioridade (urgente/alta/normal/baixa), descrição (obrigatória), observações
  - **Atualizar manutenção** (`PATCH /equipamentos/manutencoes/:id`): visível apenas a operacional e ti — bottom-sheet com selector de estado (pendente/em_curso/concluida/cancelada) e campo de observações
  - Alertas de manutenção carregados via `GET /equipamentos/alertas-manutencao` (roles: operacional, ti, medico, enfermeiro, direcao)
  - Visível a: todos os clínicos, operacional, ti, administrativo, direcao
- **`MaisScreen.tsx`** — 3º item adicionado (Equipamentos: ícone construct azul-ciano)

### ✅ Completado na Sessão 35 (cont.) — Mobile: ConsentimentosScreen
- **`ConsentimentosScreen.tsx`** — gestão de consentimentos informados no mobile
  - Pesquisa de doente por nome/processo com dropdown ao vivo (`GET /doentes?search=`)
  - Uma vez seleccionado o doente, lista os seus consentimentos via `GET /consentimentos/doente/:doenteId`
  - Cada cartão: tipo (cirurgia/procedimento_invasivo/anestesia/transfusão/outro), descrição, badge de estado (Pendente âmbar / Assinado verde / Recusado vermelho), metadata (criado por, data assinatura, testemunha, motivo de recusa)
  - **Criar** (`POST /consentimentos`): medico, enfermeiro — selectors de tipo em grade + textarea de descrição
  - **Assinar** (`POST /consentimentos/:id/assinar`): medico, enfermeiro, administrativo — bottom-sheet com toggle de confirmação obrigatório + registo de testemunha (utilizador actual)
  - **Recusar** (`POST /consentimentos/:id/recusar`): medico, enfermeiro, administrativo — bottom-sheet com campo obrigatório de motivo; acção irreversível com aviso legal
  - Visível a: medico, enfermeiro, administrativo
- **`MaisScreen.tsx`** — 4º item adicionado (Consentimentos: ícone document-text índigo)

### ✅ Completado na Sessão 36 (2026-05-30) — Mobile: RH + Faturação + Dashboard Executivo + Relatórios + Conformidade

#### `RHScreen.tsx` — Recursos Humanos (administrativo, direcao)
- 4 tabs: **Dashboard** (6 KPI cards em grelha 2 colunas: totalStaff, ausenciasPendentes, ausenciasAtivas, formacoesAExpirar, contratosAExpirar, avaliacoesPendentes), **Ausências** (segmented "Todas"/"Para Aprovar", cartões com tipo/período/estado + botões Aprovar verde / Rejeitar vermelho via `PATCH /rh/ausencias/:id/aprovar|rejeitar`), **Formações** (obrigatória badge vermelho, alerta expiração ≤30d), **Avaliações** (estado badge + nota/10)
- `useFocusEffect` recarga dados ao mudar de tab

#### `FaturacaoScreen.tsx` — Faturação (administrativo, direcao)
- 4 KPI cards: Total Faturado / Pago / Pendente / Anulado (via `GET /faturacao/resumo`)
- Filtro por estado (pills horizontais com contagem)
- Lista de episódios com doente, estado badge, valor, tipo cobertura (SNS/Seguro/Particular), datas e contagem de itens/pagamentos

#### `DashboardExecutivoScreen.tsx` — Dashboard Executivo (administrativo, direcao)
- `GET /dashboard/executivo` — sem tabs, ScrollView simples
- 6 secções: Doentes (internados/ambulatório/pendente cama/demora média), Camas (barra de progresso horizontal colorida + taxa ocupação), Faturação do Mês (totais + cobertura SNS/Seguro/Particular), Urgência Hoje, Bloco Cirúrgico do Mês, Pessoal por role
- `RefreshControl` para pull-to-refresh
- Valores monetários formatados em EUR pt-PT

#### `RelatoriosScreen.tsx` — Relatórios DGS/SNS (administrativo, direcao, ti)
- Range de datas estático: 1º dia do mês corrente → hoje (exibido no header)
- 6 tab pills horizontais com lazy loading por tab (só carrega quando visitado pela primeira vez)
- **Internamento**: Total Altas + Demora Média KPIs, tabela por serviço (internados/altas/demora)
- **Ocupação**: Taxa Média Ocupação KPI, tabela por serviço (total/ocupadas/livres/taxa%)
- **Diagnósticos**: Total KPI, top 20 rankeado com badge CID-10 azul + descrição + contagem
- **Medicamentos**: Total Administrações KPI, top 20 rankeado
- **Urgência**: Total episódios, distribuição por triagem com cores Manchester (vermelho/laranja/amarelo/verde/azul) + percentagem
- **Produtividade**: Total Ações KPI, lista por profissional com chips de notas/tarefas/exames

#### `ConformidadeScreen.tsx` — Conformidade (qualidade, direcao, ti)
- `GET /audit/conformidade` + `GET /audit/checklist`
- **Checklist**: 3 KPI chips (Conforme/A Verificar/Não Conforme), itens agrupados por categoria (RGPD/DGS/ACSS/SNS), toque no badge cicla estado optimisticamente + `PATCH /audit/checklist/:itemKey` com rollback em caso de erro
- **Acessos**: 2 KPIs (utilizadores únicos/total acessos 30d) + lista de `acessosDoentes`
- **Alto Risco**: lista com borda esquerda vermelha, vazio se sem entradas

#### `MaisScreen.tsx` — 6 novos itens integrados:
- Consentimentos (índigo), RH (violeta), Faturação (teal), Dashboard Executivo (índigo), Relatórios DGS/SNS (âmbar), Conformidade (teal)

### ✅ Completado na Sessão 37 (2026-05-30) — Testes Unitários para Serviços Críticos

#### Ficheiros criados:

**`apps/api/src/app/doentes/doentes.service.spec.ts`** — 15 testes
- `admitir()`: cama inexistente (NotFoundException), cama ocupada (BadRequestException), cama em limpeza (BadRequestException), cama reservada aceite, NIF duplicado (ConflictException), SNS duplicado (ConflictException), criação com sucesso + cama → ocupada, geração de `numeroProcesso` YYYY-00000001 para primeiro doente, incremento correcto de `numeroProcesso`, criação de `FicheiroPessoalDoente` quando dados opcionais fornecidos
- `darAlta()`: doente inexistente (NotFoundException), marcação ativo=false + cama → em_limpeza, sem cama → não actualiza cama
- `buscarPorId()`: doente inexistente (NotFoundException), doente encontrado devolvido

**`apps/api/src/app/medicacao/medicacao.service.spec.ts`** — 13 testes
- `prescrever()`: doente inexistente (NotFoundException), alergia detectada (ConflictException), `forcarApesarDeAlergia=true` bypassa alergia, sem alergias → sucesso com `avisoInteracoes: []`, detecção de interação grave warfarina+aspirina, `forcarApesarDeAlergia/justificativaOverride` removidos dos dados criados na DB
- `registarAdministracao()`: medicação inexistente (NotFoundException), medicação descontinuada (NotFoundException), criação de registo com `verificacao5Certas`
- `descontinuar()`: medicação inexistente (NotFoundException), `ativo=false` + `terminadoEm` preenchido
- `verificarInteracoes()`: sem medicações ativas → vazio, tramadol+sertralina → interação grave detectada

**`apps/api/src/app/faturacao/faturacao.service.spec.ts`** — 13 testes
- `resumo()`: agregação correcta de totalFaturado/totalPago/totalPendente/totalAnulado, countPorEstado, stats zeradas sem episódios
- `registarPagamento()`: episódio inexistente (NotFoundException), episódio anulado (BadRequestException), episódio já pago (BadRequestException), pagamento parcial sem mudar estado, pagamento total → estado muda para "paga"
- `criar()`: doente inexistente (NotFoundException), criação para doente existente
- `adicionarItem()`: episódio inexistente (NotFoundException), episódio pago (BadRequestException), `total = quantidade × precoUnitario`

**`apps/api/src/app/auth/auth.service.spec.ts`** — 12 testes
- `login()`: utilizador inexistente (UnauthorizedException), utilizador inativo (UnauthorizedException), password incorreta (UnauthorizedException), MFA ativo → `mfaPendente=true` + `mfaChallengeToken`, login sem MFA → `accessToken` + `refreshToken` (string hex), `passwordExpiradoAviso=true` quando expira em ≤10 dias
- `refresh()`: token inexistente (UnauthorizedException), token revogado (UnauthorizedException), token expirado (UnauthorizedException), token válido → revoga antigo + devolve novos tokens
- `alterarPassword()`: password actual incorreta (UnauthorizedException), hash actualizado + todos os refresh tokens revogados

#### Infraestrutura de testes:

**`apps/api/jest.config.js`** (novo) — Equivalente JS do `jest.config.cts`, necessário porque Jest 30.3.0 falha a parsear `.cts` com `moduleResolution:NodeNext`. Inclui `transformIgnorePatterns` para compilar as dependências ESM de `otplib` (`@scure/base`, `@noble/hashes`).

**`apps/api/jest.config.cts`** (actualizado) — Adicionado `transformIgnorePatterns` com a mesma lista para quando o runner Nx estiver operacional.

**Fix aplicado ao código fonte:**
- `medicacao.service.ts`: `import * as interacoesJson` → `import interacoesJson` (default import) — corrige comportamento com SWC/Jest onde namespace import de JSON resultava em `{ default: [...] }` em vez do array directo.

#### Execução dos testes:
```bash
# Na raiz do monorepo
node_modules/.bin/jest --config=apps/api/jest.config.js --no-coverage
# Resultado: 55 testes, 6 suites, todos a passar
```

### ✅ Completado na Sessão 39 (2026-05-30) — Expansão de testes unitários

**4 novos ficheiros de spec criados (40 novos testes):**

**`camas/camas.service.spec.ts`** — 10 testes
- `criar()`: ConflictException em número duplicado; criação com sucesso + `redis.del('camas:lista', 'camas:ocupacao')`
- `atualizarEstado()`: NotFoundException em cama inexistente; actualização com `{ data: { estado } }` + redis invalidation
- `confirmarLimpeza()`: NotFoundException em cama inexistente; ConflictException quando `estado !== 'em_limpeza'`; actualização para 'livre' quando em limpeza
- `ocupacao()`: cache hit não chama `prisma.cama.count`; cache miss → 5 chamadas `count` + `redis.set('camas:ocupacao', result, 30)`

**`alertas/alertas.service.spec.ts`** — 9 testes
- `listarNaoLidos()`, `marcarLido()`, `marcarTodosLidos()`, `acusar()`
- `acionarSOS()`: cria alerta com `urgencia=true`; emite SOS via WebSocket; notifica médicos atribuídos quando presentes; fallback para todos os médicos activos quando sem atribuição; inclui dados de sinais vitais, medicações e alergias em paralelo

**`sinais-vitais/sinais-vitais.service.spec.ts`** — 14 testes
- `criar()` — controlo de acesso: ForbiddenException para `administrativo`; NotFoundException para doente inexistente/inactivo
- `criar()` — scoring NEWS2: score=0 para parâmetros normais; score=9 crítico (FR=28+SpO2=89+PA=85) activa protocolo sepsis; score=5 alto gera 'news2_alto' sem protocolo; sem cálculo NEWS2 com <3 parâmetros; AVPU≠'A' adiciona +3
- Alertas individuais: SpO2<90 → 'sinal_vital_critico'; Pulso>120 → alerta; TA<80 → alerta
- `analisarTendencia()`: risco 'indeterminado' com 1 registo; risco 'alto' quando NEWS2≥7; risco 'baixo' com parâmetros estáveis; detecção de queda progressiva de SpO2

**`turnos/turnos.service.spec.ts`** — 7 testes
- `checkIn()`: BadRequestException sem turno ativo; BadRequestException com check-in duplicado; ForbiddenException quando não escalado; sucesso + `dentroGeofence: true`; IP externo → `dentroGeofence: false` + notifica chefe turno
- `atribuirDoentes()`: chama `$transaction([deleteMany, createMany])`
- `adicionarNota()`: cria nota com include de autor

**Total acumulado: 95 testes unitários, 10 suites**

**Fix adicional (continuação sessão 37):**
- `app.service.spec.ts`: string `'Hello API'` → `'CuraSphere API'` (teste antigo desactualizado)
- `app.controller.spec.ts`: adicionados 4 providers em falta (`HealthCheckService`, `PrismaHealthIndicator`, `RedisHealthIndicator`, `PrismaService`) — o `AppController` injecta todos eles mas o módulo de teste não os fornecia

### ✅ Completado na Sessão 38 (2026-05-30) — DTOs: cobertura total de todos os controllers

**Contexto:** 4 agentes paralelos em worktrees isolados criaram DTOs para 22 controllers durante a sessão 37. Esta sessão copiou o trabalho para o repositório principal e completou os controllers que ficaram por cobrir.

#### DTOs copiados de worktrees de agentes:

**Worktree a045** (atribuições, horários, trocas):
- `atribuicoes/dto/atribuir-doente.dto.ts` — `doenteId`, `utilizadorId`
- `horarios/dto/criar-escala.dto.ts` — `mes`, `ano`
- `horarios/dto/adicionar-turno.dto.ts` — `tipo`, `data`, `profissionaisIds[]`
- `horarios/dto/editar-turno.dto.ts` — tudo opcional
- `horarios/dto/gerar-automatico.dto.ts` — `mes`, `ano`, `servico?`
- `trocas/dto/criar-troca.dto.ts` — `turnoId`, `destinatarioId`
- `trocas/dto/responder-troca.dto.ts` — `aceitar: boolean`
- `trocas/dto/aprovar-troca.dto.ts` — `aprovar: boolean`

**Worktree abe21** (configurações, equipamentos):
- `configuracoes/dto/criar-role.dto.ts`, `criar-subrole.dto.ts`, `editar-role.dto.ts`, `editar-subrole.dto.ts`
- `equipamentos/dto/criar-equipamento.dto.ts`, `atualizar-equipamento.dto.ts`, `criar-manutencao.dto.ts`, `atualizar-manutencao.dto.ts`

**Worktree a6f05** (doentes, medicação, utilizadores):
- `doentes/dto/atualizar-estado.dto.ts`, `atualizar-ficha-pessoal.dto.ts`, `atualizar-isolamento.dto.ts`, `atualizar-problema.dto.ts`, `criar-problema.dto.ts`
- `medicacao/dto/totp-code.dto.ts` — `totpCode: string`
- `utilizadores/dto/editar-utilizador.dto.ts` — todos os campos opcionais

**Worktree ae5fe** (atos-clínicos, catálogo, fornecedores, notificações, tickets):
- `atos-clinicos/dto/criar-ato-clinico.dto.ts`, `atualizar-ato-clinico.dto.ts`
- `catalogo/dto/criar-catalogo-item.dto.ts`, `atualizar-catalogo-item.dto.ts`
- `fornecedores/dto/criar-fornecedor.dto.ts`, `atualizar-fornecedor.dto.ts`, `criar-encomenda.dto.ts`, `receber-encomenda.dto.ts`
- `notificacoes/dto/registar-token.dto.ts`
- `tickets/dto/chamar-ticket.dto.ts`, `criar-marcacao-quiosque.dto.ts`, `tirar-senha.dto.ts`

#### Novos DTOs criados nesta sessão (controllers sem cobertura):

- `break-glass/dto/ativar-break-glass.dto.ts` — `doenteId`, `motivo`
- `common/dto/atualizar-checklist.dto.ts` — `estado`
- `consentimentos/dto/criar-consentimento.dto.ts` — `doenteId`, `tipo`, `descricao`
- `consentimentos/dto/assinar-consentimento.dto.ts` — `testemunhaId?`
- `consentimentos/dto/recusar-consentimento.dto.ts` — `motivo`
- `dietas/dto/prescrever-dieta.dto.ts` — `doenteId`, `tipo`, `restricoes[]?`, `observacoes?`
- `farmacia/dto/atualizar-quantidade.dto.ts` — `quantidade`, `motivo`, `tipo` (entrada/saida/ajuste)
- `farmacia/dto/rejeitar-pedido.dto.ts` — `motivoRejeicao`
- `farmacia/dto/criar-transferencia.dto.ts` — `servicoDestino`, `quantidade`, `motivo?`
- `notas-clinicas/dto/totp-code.dto.ts` — `totpCode: string`
- `protocolos/dto/criar-protocolo.dto.ts` — `doenteId`, `tipo`
- `turnos/dto/atribuir-doentes-turno.dto.ts` — `atribuicoes[]` com `doenteId` + `enfermeiroId` (ValidateNested)

#### Controllers actualizados nesta sessão:

`doentes.controller.ts`, `equipamentos.controller.ts`, `medicacao.controller.ts`, `notas-clinicas.controller.ts`, `farmacia.controller.ts`, `break-glass.controller.ts`, `common/audit.controller.ts`, `consentimentos.controller.ts`, `dietas.controller.ts`, `protocolos.controller.ts`, `tickets/quiosque.controller.ts`, `tickets/tickets.controller.ts`, `turnos.controller.ts`

#### Estado final:
```bash
grep -rn "body: any|@Body() body: {" apps/api/src/app --include="*.controller.ts"
# Resultado: 0 correspondências
```
**100% dos controllers da API usam DTOs tipados com `class-validator` + `@nestjs/swagger`.**

### ✅ Completado na Sessão 40 (2026-05-30) — Decomposição mobile, componentes partilhados e circuit breaker

#### DoenteDetalheScreen.tsx — decomposição completa

O ficheiro monolítico de **1655 linhas** foi decomposto em **20 ficheiros focados**, reduzindo o ecrã principal para **335 linhas**.

**Estrutura criada em `apps/mobile/src/screens/doente-detalhe/`:**

```
styles.ts                         — StyleSheet partilhado (shared export)
modals/
  ModalAlterarEstado.tsx          — alteração de estado clínico do doente
  ModalCriarTarefa.tsx            — criação de tarefa com SelectPicker
  ModalPrescreverMedicacao.tsx    — prescrição com nome/dose/via/frequência
  ModalRegistarVitais.tsx         — 8 campos vitais em grelha 2 colunas
  ModalAltaEstruturada.tsx        — alta com motivo/destino/resumo/prescrição
  ModalRegistarAlergia.tsx        — alergénio/tipo/severidade/notas
  ModalContactoEmergencia.tsx     — contacto com checkbox "principal"
  ModalEditarDoente.tsx           — edição de diagnóstico e alta prevista
  ModalAvaliacaoEscala.tsx        — avaliação Braden e Morse com itens ponderados
  ModalHistoricoTarefas.tsx       — listagem de histórico de tarefas
  ModalHistoricoMedicacao.tsx     — listagem de histórico de medicação
tabs/
  TabInfo.tsx                     — dados clínicos, atribuições, alergias, contactos
  TabTarefas.tsx                  — lista de tarefas com dots de prioridade
  TabMedicacao.tsx                — medicações activas com Registar/Concluir
  TabNotas.tsx                    — input + listagem de notas de turno
  TabVitais.tsx                   — sinais vitais com cores por criticidade
  TabEscalas.tsx                  — escalas Braden e Morse com badges de risco
```

**Padrão aplicado:**
- Modais detêm o próprio estado de formulário — sem prop drilling
- Tabs recebem dados e callbacks do pai — sem estado próprio
- `shared` de `styles.ts` usado por todos os componentes — zero duplicação de estilos

#### Componentes partilhados mobile — novos em `apps/mobile/src/components/`

- **`EmptyState.tsx`** — componente genérico de estado vazio com texto centrado em cinzento
- **`SelectPicker.tsx`** — picker de opções em pills horizontais com genérico TypeScript `<T extends string | number>`

#### Circuit breaker — `NotificacoesService`

Adicionado `PushCircuitBreaker` ao `apps/api/src/app/notificacoes/notificacoes.service.ts`:
- **Threshold:** 3 falhas consecutivas abrem o breaker
- **Cooldown:** 60 segundos com reset half-open automático
- **Logging:** `Logger.warn` em cada falha e quando o breaker está aberto
- Substituiu o `.catch(() => {})` silencioso — push failures agora são observáveis

### ✅ Completado na Sessão 41 (2026-05-30) — $transaction, libs/shared, domain modules, libs/ui

#### Item 2 — `$transaction` em `atribuicoes.service.ts`

`atribuir` e `remover` envolvidos em `prisma.$transaction(async (tx) => {...})` com lógica de validação inline:
- Leitura do turno + role do utilizador dentro da transação via `tx.horarioTurno.findUnique` e `tx.utilizador.findUnique`
- `upsert` ou `deleteMany` dentro da mesma transação
- Elimina race condition TOCTOU (time-of-check-to-time-of-use) entre validação do chefe e escrita da atribuição

#### Item 5 — `libs/shared` completo

Adicionados 2 novos ficheiros de tipos:
- `libs/shared/src/lib/types/alerta.types.ts` — `AlertaClinico`
- `libs/shared/src/lib/types/notificacao.types.ts` — `Notificacao`, `NotificacoesPaginadas`

`libs/shared/src/index.ts` actualizado com re-export dos 2 novos módulos.

Hooks web actualizados para consumir a lib partilhada:
- `use-alertas.ts`: removeu declaração local `interface AlertaClinico`; importa de `@org/shared`
- `use-notificacoes.ts`: removeu declarações locais `Notificacao` e `NotificacoesPaginadas`; importa de `@org/shared`

Estado final: 5 hooks web + `apps/mobile/src/lib/auth.ts` importam tipos de `@org/shared` — **zero tipos duplicados** nos hooks.

#### Item 6 — Agrupamento do `AppModule` em domínios

Criados 3 módulos NestJS de domínio em `apps/api/src/app/`:

| Ficheiro | Módulos agrupados |
|---|---|
| `clinical.module.ts` | 26 módulos — Doente, Cama, Tarefas, Sinais Vitais, Alergias, Contactos, Alertas, Notas, Escalas, Dispositivos, Atos, BreakGlass, Consentimentos, Eventos, Medicação, Farmácia, Reconciliação, Exames, Protocolos, Dietas, Consultas, Interconsultas, Urgência, Bloco, Fisioterapia, IACS |
| `gestao.module.ts` | 8 módulos — Utilizadores, RH, Especialidades, Turnos, Horários, Atribuições, Trocas, Escalas |
| `operacional.module.ts` | 12 módulos — Tickets, Sala Espera, Faturação, Pedidos Internos, Comunicação, Incidentes TI, Pedidos TI, Equipamentos, Catálogo, Fornecedores, Dashboard, Relatórios |

`app.module.ts`: reduzido de 64 imports para **12 imports** (9 infra + 3 domínios). Cada domínio faz `imports` e `exports` de todos os sub-módulos para preservar injecção cross-domain.

#### Item 13 — `libs/ui` — componentes web partilhados

Criado pacote `@org/ui` em `libs/ui/` com estrutura idêntica a `@org/shared`:
- `package.json` com `"@org/source": "./src/index.ts"` nos exports
- `tsconfig.json` com suporte JSX
- `apps/web/next.config.js`: adicionado `'@org/ui'` a `transpilePackages`

**4 componentes criados em `libs/ui/src/components/`:**

| Componente | Descrição |
|---|---|
| `StatusBadge` | Badge colorido com `colorMap`, `labelMap` e dot opcional |
| `EmptyState` | Estado vazio com título, descrição e ícone opcional |
| `LoadingSpinner` | Spinner animado com tamanhos `sm / md / lg` |
| `PageShell` | Wrapper de página com título, subtítulo e slot de actions |

### ✅ Completado na Sessão 42 (2026-05-31) — Auditoria Arquitectural: Segurança, Robustez e Qualidade

Implementação dos 11 itens do plano de melhorias arquitecturais (avaliação estrutura + arquitectura).

#### 🔴 Alta Prioridade — Segurança e Integridade de Dados

**Item 1 — `onDelete` explícito no schema Prisma**
- 155 relações FK sem `onDelete` receberam estratégia explícita:
  - `Cascade` (113 relações): registos dependentes sem sentido sem o pai (ex: `SinalVital → Doente`, `RegistoMedicacao → Medicacao`, `NotificacaoInApp → Utilizador`)
  - `SetNull` (42 relações): registo pode existir sem o pai (ex: `Tarefa.responsavelId → Utilizador`, `AuditLog.utilizadorId → Utilizador`)
  - `Restrict` (2 relações): `Turno.chefeTurno → Utilizador`, `AuditLog.utilizador → Utilizador`
- Elimina erros runtime ao eliminar doentes/utilizadores com registos dependentes

**Item 2 — Tokens mobile para `expo-secure-store`**
- `apps/mobile/src/lib/auth.ts` reescrito: `AsyncStorage` → `expo-secure-store`
- `setItemAsync` / `deleteItemAsync` / `getItemAsync` em todos os pontos de leitura/escrita de `token` e `utilizador`
- Tokens JWT não legíveis em dispositivos rooteados ou backups sem encriptação

**Item 3 — Refresh token no mobile**
- `apps/mobile/src/lib/api.ts` reescrito com interceptor de response completo:
  - Flag `isRefreshing` + `refreshQueue: Array<(token: string) => void>` — previne chamadas concorrentes de refresh
  - 401 → tenta `POST /v1/auth/refresh` com cookie → emite novo token para toda a queue
  - Falha no refresh → limpa SecureStore + chama `onUnauthorized()` → logout automático
- Comportamento agora idêntico ao web (sem divergência no tratamento de sessão expirada)

#### 🟡 Média Prioridade — Robustez e Experiência

**Item 4 — `middleware.ts` Next.js para protecção de rotas**
- Criado `apps/web/src/middleware.ts`:
  - Lê cookie `access_token` server-side antes de renderizar qualquer página
  - Rotas públicas: `/login`, `/quiosque`, `/painel`
  - Sem token + rota protegida → redirect imediato para `/login` (sem flicker de conteúdo)
  - Com token + `/login` → redirect para `/dashboard`
  - Matcher exclui `api/`, `_next/static`, `_next/image`, assets estáticos

**Item 5 — React Query no mobile**
- Criado `apps/mobile/src/lib/query-client.ts` com `QueryClient({ staleTime: 30s, gcTime: 5min, retry: 1 })`
- `apps/mobile/src/app/App.tsx` envolvido com `<QueryClientProvider client={queryClient}>` a nível raiz (acima de `SafeAreaProvider`)
- Cache de 30s entre navegações — elimina re-fetch em cada visita ao ecrã

**Item 6 — Rate limiting por endpoint**
- Verificado: já implementado — `/auth/login` → 5/10min, `/auth/mfa/verificar` → 10/10min. Nenhuma alteração necessária.

**Item 7 — Versionamento da API**
- `apps/api/src/main.ts`: `app.enableVersioning({ type: VersioningType.URI, defaultVersion: '1' })` — todos os endpoints servidos em `/v1/`
- `apps/web/src/lib/api.ts`: `baseURL` → `${NEXT_PUBLIC_API_URL}/v1`; refresh URL → `/v1/auth/refresh`
- `apps/mobile/src/lib/api.ts`: `baseURL` → `${API_URL}/v1`; refresh URL → `${API_URL}/v1/auth/refresh`

#### 🟢 Baixa Prioridade — Qualidade e Manutenibilidade

**Item 8 — Validação automática "5 certas" no mobile e API**
- `apps/api/src/app/medicacao/medicacao.service.ts` — `registarAdministracao()` reescrito:
  - Função `parsearFrequenciaHoras()` — interpreta strings como `"8/8h"`, `"12/12h"`, `"SOS"` → horas de intervalo (null para SOS/contínuo)
  - **Doente certo**: se `doenteId` passado no request, verifica que corresponde à medicação
  - **Hora certa**: se frequência conhecida e há registo anterior, bloqueia administração prematura com tolerância ±1h
  - `verificacao5Certas: true` definido automaticamente (não mais confiado no checkbox do cliente)
- `dto/administrar-medicacao.dto.ts` — removido `verificacao5Certas`; adicionado `doenteId?: string` (IsUUID)
- `medicacao.controller.ts` — passa `doenteId` do DTO ao service

**Item 9 — Eliminar `any` no mobile** — adiado (74 ocorrências em 20 ficheiros; requer tipos adicionais em `@org/shared`)

**Item 10 — Extrair `ConsultasPanel` e `FaturacaoPanel`**
- Criado `components/consultas-panel.tsx` (90L): fetch próprio de `/consultas?doenteId=`, interface `Consulta` tipada, visível a `medico | enfermeiro | administrativo`
- Criado `components/faturacao-panel.tsx` (120L): fetch próprio de `/faturacao/doente/:id`, interfaces `EpisodioFaturacao / ItemFaturacao / Pagamento` tipadas, visível a `administrativo | direcao`
- `doentes/[id]/page.tsx`: 1122L → ~930L; removidos estados `consultas[]` e `faturacao[]`, removidas chamadas de fetch do `useEffect` principal; substituídas 190L de JSX inline por 2 componentes

**Item 11 — Dockerfile para a API**
- Já existia `apps/api/Dockerfile` com multi-stage build (deps → builder → runner), non-root user, Prisma binary para Alpine, healthcheck. Nenhuma alteração necessária.

### Prioridade Baixa — Backlog
12. Visualizador DICOM para imagiologia
13. Testes automatizados e2e (Playwright/Cypress)
14. Integrações externas (HL7, FHIR, SONHO/SClínico)

---

### ✅ Completado na Sessão 45 (2026-06-01) — Segunda Ronda de Hardening: IDOR Residual, Enforcement Frontend, Logging e Qualidade

Segunda auditoria white-box completa (3 agentes paralelos). 16 itens identificados e implementados em ordem de prioridade.

#### 🔴 Crítico — Vulnerabilidades Imediatas

**IDOR em 8 controllers clínicos restantes**
- `exames.controller.ts`, `consultas.controller.ts`, `consentimentos.controller.ts`, `dispositivos-invasivos.controller.ts`, `dietas.controller.ts`, `interconsultas.controller.ts`, `notas-clinicas.controller.ts` (GET), `medicacao.controller.ts` (GET doente + historico + interacoes)
- `DoenteService` injectado em todos + `assertAcessoDoente()` como primeira linha de cada endpoint afectado
- Módulos correspondentes: `DoenteModule` adicionado a `imports[]`

**Frontend enforcement de MFA obrigatório e password expirada**
- `login/page.tsx`: branches em `mfaSetupObrigatorio` (→ sessionStorage + `/login/mfa-setup`) e `passwordExpirada` (→ sessionStorage + `/login/alterar-password`)
- `/login/mfa-setup/page.tsx` (NOVA): lê `mfaSetupToken`; mostra QR code; chama `POST /auth/mfa/ativar`; redirige para login
- `/login/alterar-password/page.tsx` (NOVA): lê `passwordExpiredToken`; formulário nova password; chama `PATCH /auth/alterar-password`; redirige para login com mensagem
- `auth-context.tsx`: `LoginResult` estendido com campos `mfaSetupObrigatorio`, `mfaSetupToken`, `passwordExpirada`, `passwordExpiredToken`

**Logout mobile invalida sessão no servidor**
- `apps/mobile/src/lib/auth.ts`: `logout()` chama `POST /auth/logout` antes de limpar SecureStore — refresh token revogado no servidor

**React Query cache limpo no logout**
- `auth-context.tsx` (web): `queryClient.clear()` no `logout()` — dados de doentes da sessão anterior não persistem
- `apps/mobile/src/lib/auth.ts`: idem com `queryClient.clear()` antes de limpar SecureStore

#### 🟡 Alto — Robustez e Correctness

**Middleware Next.js valida expiração JWT**
- `apps/web/src/middleware.ts`: `async`; usa `jose jwtVerify()` com `algorithms: ['HS256']`, `issuer: 'curasphere-api'`, `audience: 'curasphere'`; token expirado → apaga cookies e redirige para `/login`

**Prisma error handling (P2002/P2025)**
- `exception.filter.ts`: `PrismaClientKnownRequestError` capturado; P2002 → 409 CONFLICT com nome do campo duplicado; P2025 → 404 NOT_FOUND; outros códigos Prisma → 500 DATABASE_ERROR

**Joi validação de variáveis de ambiente**
- `app.module.ts`: `ConfigModule.forRoot({ validationSchema })` com `DATABASE_URL`, `REDIS_URL`, `JWT_SECRET` (min 32), `ALLOWED_ORIGINS`, `PORT`, `NODE_ENV`; servidor recusa arrancar se faltar variável crítica

**Break-glass rate limit**
- `break-glass.controller.ts`: `@Throttle({ default: { ttl: 86400000, limit: 10 } })` — máximo 10 activações de emergência por utilizador por 24h

#### 🟢 Médio — Qualidade e Observabilidade

**Structured JSON logging (nestjs-pino)**
- `app.module.ts`: `LoggerModule.forRoot` com `pino-http`; correlation ID gerado por `genReqId` (lê `X-Correlation-ID` header ou gera UUID); `pino-pretty` em dev, JSON puro em prod; health check excluído do auto-logging; `Authorization` e `Cookie` headers redactados nos logs
- `main.ts`: `app.useLogger(PinoLogger)`; `bufferLogs: true`; CORS allowedHeaders inclui `X-Correlation-ID`

**Prisma connection pool**
- `.env.example`: `DATABASE_URL` agora inclui `?connection_limit=25&pool_timeout=10` — configuração explícita do pool para produção

**CSP header no Next.js frontend**
- `apps/web/next.config.js`: `Content-Security-Policy` adicionado com `default-src 'self'`, `frame-ancestors 'none'`, `object-src 'none'`, `base-uri 'self'`

**Audit log com payload redactado**
- `audit.interceptor.ts`: `req.body` serializado para `detalhes`; campos sensíveis (`password`, `passwordAtual`, `novaPassword`, `mfaSecret`, `secret`, `code`, `token`, `passwordExpiredToken`, `mfaSetupToken`) substituídos por `[REDACTED]`

#### Ficheiros Modificados

| Ficheiro | Alterações |
|---|---|
| `apps/api/src/app/exames/exames.controller.ts` + module | IDOR assertAcessoDoente |
| `apps/api/src/app/consultas/consultas.controller.ts` + module | IDOR assertAcessoDoente |
| `apps/api/src/app/consentimentos/consentimentos.controller.ts` + module | IDOR assertAcessoDoente |
| `apps/api/src/app/dispositivos-invasivos/dispositivos-invasivos.controller.ts` + module | IDOR assertAcessoDoente |
| `apps/api/src/app/dietas/dietas.controller.ts` + module | IDOR assertAcessoDoente |
| `apps/api/src/app/interconsultas/interconsultas.controller.ts` + module | IDOR assertAcessoDoente |
| `apps/api/src/app/notas-clinicas/notas-clinicas.controller.ts` + module | IDOR GET assertAcessoDoente |
| `apps/api/src/app/medicacao/medicacao.controller.ts` + module | IDOR GET assertAcessoDoente |
| `apps/api/src/app/common/exception.filter.ts` | Prisma P2002/P2025 → 409/404 |
| `apps/api/src/app/break-glass/break-glass.controller.ts` | @Throttle 10/24h |
| `apps/api/src/app/app.module.ts` | Joi env validation + LoggerModule pino |
| `apps/api/src/main.ts` | PinoLogger, bufferLogs, X-Correlation-ID CORS |
| `apps/api/src/app/common/audit.interceptor.ts` | req.body redactado em detalhes |
| `apps/api/.env.example` | connection_limit=25&pool_timeout=10 |
| `apps/web/src/lib/auth-context.tsx` | LoginResult flags, queryClient.clear() |
| `apps/web/src/app/(auth)/login/page.tsx` | branches mfaSetupObrigatorio/passwordExpirada |
| `apps/web/src/app/(auth)/login/mfa-setup/page.tsx` | NOVA página MFA setup forçado |
| `apps/web/src/app/(auth)/login/alterar-password/page.tsx` | NOVA página password expirada |
| `apps/web/src/middleware.ts` | jose jwtVerify async |
| `apps/web/next.config.js` | CSP header |
| `apps/mobile/src/lib/auth.ts` | logout invalida servidor + queryClient.clear() |

---

### ✅ Completado na Sessão 44 (2026-06-01) — Hardening Pós-Auditoria: 14 Correcções de Segurança e Qualidade

Implementação dos 14 itens identificados na avaliação white-box da Sessão 43.

#### 🔴 Crítico — Vulnerabilidades Imediatas

**IDOR em sub-recursos clínicos (sinais-vitais e alertas)**
- `sinais-vitais.controller.ts`: `DoenteService` injectado; `assertAcessoDoente()` chamado nos 3 endpoints GET antes de servir dados
- `alertas.controller.ts`: `assertAcessoDoente()` em `listar`, `marcarTodosLidos` e `marcarLido` (este último via `getDoenteIdByAlertaId()` para resolver o doenteId a partir do alertaId)
- `alertas.service.ts`: helper `getDoenteIdByAlertaId()` adicionado
- `sinais-vitais.module.ts` e `alertas.module.ts`: `DoenteModule` adicionado aos imports

**Rate limiting em MFA activação/desactivação**
- `auth.controller.ts`: `@SkipThrottle()` substituído por `@Throttle({ default: { ttl: 60000, limit: 5 } })` em `mfa/ativar` e `mfa/desativar` — impede brute-force dos 6 dígitos TOTP

**Author check em notas clínicas**
- `notas-clinicas.service.ts`: `atualizar()` e `apagar()` recebem `utilizadorId` e `role`; `ForbiddenException` se `nota.autorId !== utilizadorId` e role não for supervisão (`direcao`, `chefe_medicos`, `chefe_enfermeiros`)
- `notas-clinicas.controller.ts`: passa `req.user.sub, req.user.role` para ambos os métodos

#### 🟡 Alto — Robustez e Boas Práticas

**Account lockout após 5 falhas de login**
- `auth.service.ts`: Redis `login:fail:{id}` acumula falhas (TTL 900s); ao atingir 5, define `login:lock:{id}` por 15 min; login bem-sucedido limpa o contador
- Mantém DUMMY_BCRYPT_HASH para utilizadores inexistentes (timing-safe)

**6 índices compostos no schema Prisma**
- `Medicacao`: `@@index([doenteId, ativo, iniciadoEm])` — MAR e administração
- `AlertaClinico`: `@@index([doenteId, lido, criadoEm])` — badge e painel
- `AtribuicaoHorarioTurno`: `@@index([utilizadorId, horarioTurnoId])` — lista de doentes do enfermeiro
- `NotificacaoInApp`: `@@index([utilizadorId, lida, criadaEm])` — paginação de notificações
- `Turno`: `@@index([dataInicio, dataFim, tipo])` — escalas e gestão de RH

**Rate limiting em alterar-password**
- `auth.controller.ts`: `@Throttle({ default: { ttl: 3600000, limit: 3 } })` — 3 alterações/hora

**Prevenção de alertas duplicados + N+1 fix SOS**
- `alertas.service.ts`: `criarAlerta()` torna-se `async`; verifica alerta não lido do mesmo tipo em janela de 5 min — actualiza em vez de criar; notificação push apenas para alertas novos
- `notificacoes.service.ts`: `enviarParaUtilizadores(ids[], ...)` pré-carrega todos os device tokens numa query única; SOS usa este método em vez de loop individual

**Session idle timeout 15 min no web**
- `client-layout.tsx`: `useRef` + `setTimeout(15min)` com listeners `mousemove`, `keydown`, `click`, `touchstart`; expiração chama `POST /auth/logout` e redirige para `/login`

**Security headers em Next.js**
- `next.config.js`: `headers()` retorna `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`, `Permissions-Policy: camera=(), microphone=(), geolocation=(self)`, `HSTS: 2 anos`

#### 🟢 Médio — Qualidade e UX Clínica

**Error boundaries nos panels da ficha do doente**
- `doentes/[id]/page.tsx`: classe `PanelErrorBoundary` (React class component) envolve cada um dos 14 painéis; erro num painel não afecta os restantes — mostra mensagem de erro isolada

**MFA obrigatório para roles clínicos**
- `auth.service.ts`: após login com sucesso, roles `medico, enfermeiro, farmaceutico, tecnico_saude, auxiliar` sem MFA activo recebem `{ mfaSetupObrigatorio: true, mfaSetupToken }` em vez de access token

**Password expirada bloqueia login (não apenas aviso)**
- `auth.service.ts`: `passwordExpiresAt < now` emite `{ passwordExpirada: true, passwordExpiredToken }` com scope restrito — access token normal não é emitido

**Seed users com password a expirar imediatamente**
- `seed.ts`: todos os utilizadores de seed criados com `passwordExpiresAt: new Date()` — força alteração de password no primeiro login

#### Ficheiros Modificados

| Ficheiro | Alterações |
|---|---|
| `apps/api/src/app/sinais-vitais/sinais-vitais.controller.ts` | IDOR + DoenteService |
| `apps/api/src/app/sinais-vitais/sinais-vitais.module.ts` | DoenteModule em imports |
| `apps/api/src/app/alertas/alertas.controller.ts` | IDOR + DoenteService |
| `apps/api/src/app/alertas/alertas.module.ts` | DoenteModule em imports |
| `apps/api/src/app/alertas/alertas.service.ts` | getDoenteIdByAlertaId, criarAlerta dedup, batch SOS |
| `apps/api/src/app/notificacoes/notificacoes.service.ts` | enviarParaUtilizadores batch |
| `apps/api/src/app/notas-clinicas/notas-clinicas.service.ts` | author check em atualizar/apagar |
| `apps/api/src/app/notas-clinicas/notas-clinicas.controller.ts` | passa utilizadorId/role |
| `apps/api/src/app/auth/auth.controller.ts` | throttle MFA, throttle password |
| `apps/api/src/app/auth/auth.service.ts` | account lockout, MFA obrigat., pwd expirada |
| `apps/api/prisma/schema.prisma` | 5 índices compostos |
| `apps/api/src/seed.ts` | passwordExpiresAt: new Date() |
| `apps/web/src/app/(dashboard)/client-layout.tsx` | idle timeout 15 min |
| `apps/web/next.config.js` | security headers |
| `apps/web/src/app/(dashboard)/(clinico)/doentes/[id]/page.tsx` | PanelErrorBoundary |

---

### ✅ Completado na Sessão 43 (2026-05-31) — Auditoria de Segurança White-Box (OWASP Top 10 + 26 categorias)

Auditoria completa com leitura de código real, classificação por categoria e aplicação imediata de fixes. Metodologia OWASP Top 10 + 26 categorias adicionais.

#### Resultado Global

| Categoria | Estado | Acção |
|---|---|---|
| A01 Broken Access Control | VULNERÁVEL → CORRIGIDO | IDOR PHI cross-patient (CRÍTICO) |
| A02 Cryptographic Failures | SEGURO | JWT HS256, bcrypt cost 12, HTTPOnly cookies |
| A03 Injection | SEGURO | Prisma ORM (prepared statements), ValidationPipe whitelist |
| A04 Insecure Design | RISCO PARCIAL → CORRIGIDO | TOTP anti-replay, refresh reuse detection |
| A05 Security Misconfiguration | VULNERÁVEL → CORRIGIDO | Helmet CSP/HSTS, Swagger prod-disabled, WS CORS |
| A06 Vulnerable Components | SEGURO | Dependências actuais; sem CVEs conhecidos |
| A07 Identification Failures | VULNERÁVEL → CORRIGIDO | Timing attack user-enumeration, JWT alg pinning |
| A08 Software Integrity | SEGURO | `pnpm-lock.yaml` commitado, sem `--ignore-scripts` |
| A09 Security Logging | SEGURO | AuditInterceptor assíncrono, Logger em eventos críticos |
| A10 SSRF | SEGURO | Sem chamadas HTTP externas controladas pelo utilizador |
| Mass Assignment | VULNERÁVEL → CORRIGIDO | `EditarUtilizadorDto` com `@IsIn` para role/servico |
| Upload/XSS | VULNERÁVEL → CORRIGIDO | Servir uploads com `Content-Disposition: attachment` + sandbox CSP |
| WebSocket CORS | VULNERÁVEL → CORRIGIDO | Substituído `origin: '*'` por allowlist `ALLOWED_ORIGINS` |
| DoS por paginação | VULNERÁVEL → CORRIGIDO | Cap `limit ≤ 100` em todos os endpoints de listagem |
| Filename injection | RISCO PARCIAL → CORRIGIDO | Sanitização de extensão em uploads de mensagens |

#### Vulnerabilidades Críticas Corrigidas

**IDOR — PHI Cross-Patient Leak (A01)**
- Qualquer clínico autenticado podia ler registos de qualquer doente via `GET /doentes/:id`
- Fix: `assertAcessoDoente(utilizadorId, role, doenteId)` em `doentes.service.ts`; verificação de atribuição directa + turno; roles de supervisão isentos; log WARN em cada tentativa negada
- Aplicado em todos os 12 endpoints de leitura/escrita de `doentes.controller.ts`

**TOTP Anti-Replay — MFA + Assinatura Clínica (A04)**
- Código TOTP reutilizável dentro da janela de 30s; permitia replay de assinatura de prescrição
- Fix: `consumirTotpUmaVez(scope, secret, code)` em `auth.service.ts` — Redis `SET NX EX 90` com hash SHA-256 do `secret:code`; fail-closed quando Redis indisponível; aplicado em login, activação/desactivação MFA e assinatura de medicação

**Refresh Token Reuse Detection (A07)**
- Token revogado reapresentado não era detectado como roubo de sessão
- Fix: se refresh token já revogado → revogar TODAS as sessões do utilizador + `UnauthorizedException('Sessão comprometida')`

**JWT Algorithm Pinning (A07)**
- Sem `algorithms` fixo: vulnerável a `alg: none` e algorithm-confusion RS256→HS256
- Fix: `algorithms: ['HS256']` + `issuer: 'curasphere-api'` + `audience: 'curasphere'` em `jwt.strategy.ts` e `auth.module.ts`

**Timing Attack User Enumeration (A07)**
- Login falhado retornava imediatamente quando utilizador não existia; retardo diferente traía existência
- Fix: `DUMMY_BCRYPT_HASH` constante; `bcrypt.compare` corre sempre (cost 12) antes de rejeitar

#### Ficheiros Modificados

| Ficheiro | Tipo de fix |
|---|---|
| `apps/api/src/main.ts` | Helmet CSP/HSTS, uploads attachment, Swagger prod-off, `x-powered-by` off |
| `apps/api/src/app/auth/auth.service.ts` | TOTP anti-replay, refresh reuse detection, timing-safe login |
| `apps/api/src/app/auth/auth.module.ts` | JWT signOptions: issuer, audience, algorithm HS256 |
| `apps/api/src/app/auth/jwt.strategy.ts` | algorithms pin, issuer, audience validation |
| `apps/api/src/app/doentes/doentes.controller.ts` | IDOR fix (12 endpoints), `todos=true` bypass fix, limit cap |
| `apps/api/src/app/doentes/doentes.service.ts` | `assertAcessoDoente()` |
| `apps/api/src/app/medicacao/medicacao.service.ts` | TOTP anti-replay em `assinar()` |
| `apps/api/src/app/redis/redis.service.ts` | `setIfNotExists(key, value, ttl)` — Redis SET NX EX |
| `apps/api/src/app/gateway/events.gateway.ts` | WebSocket CORS: `origin: '*'` → `ALLOWED_ORIGINS` allowlist |
| `apps/api/src/app/utilizadores/dto/editar-utilizador.dto.ts` | Mass assignment: `@IsIn(ROLES_PERMITIDAS)`, `@IsIn(SERVICOS_PERMITIDOS)` |
| `apps/api/src/app/utilizadores/utilizadores.controller.ts` | limit ≤ 100 cap |
| `apps/api/src/app/faturacao/faturacao.controller.ts` | limit ≤ 100 cap |
| `apps/api/src/app/common/audit.controller.ts` | limit ≤ 100 cap |
| `apps/api/src/app/comunicacao/comunicacao.controller.ts` | Filename extension sanitization |

---

## 12. Modelos de Dados (Prisma)

### 12.1 Entidades Principais

| Modelo | Descrição | Relações Principais |
|--------|-----------|---------------------|
| `Utilizador` | Profissional de saúde | Tem role, subRole, servico, turno actual, notificações |
| `RefreshToken` | Token de renovação | → Utilizador |
| `RoleConfig` | Definição de role dinâmica | → SubRoleConfig[] |
| `SubRoleConfig` | Definição de sub-role | → RoleConfig |
| `Doente` | Paciente | → Cama, Medicações, Sinais Vitais, Notas, etc. |
| `Cama` | Cama hospitalar | → Doente (nullable), Serviço |
| `AuditLog` | Registo de auditoria | → Utilizador |
| `Anuncio` | Anúncio institucional | → Utilizador (autor) |
| `MensagemInterna` | Mensagem entre utilizadores | → Utilizador (de/para) |

### 12.2 Módulo Clínico

| Modelo | Descrição |
|--------|-----------|
| `Medicacao` | Prescrição de medicamento (dose, via, frequência, horários) |
| `RegistoMedicacao` | Registo de administração de medicamento (inclui `verificacao5Certas Boolean`) |
| `SinalVital` | Registo de sinais vitais (TA, FC, FR, SpO2, Temp, Peso, AVPU) + NEWS2 calculado automaticamente |
| `NotaClinica` | Nota SOAP (Subjectivo, Objectivo, Avaliação, Plano) |
| `EscalaClinica` | Avaliação com escala (14 tipos) |
| `DispositivoInvasivo` | Dispositivo invasivo activo/removido (10 tipos) |
| `Exame` | Exame solicitado com estado e resultado |
| `FicheiroExame` | Ficheiro anexado a um exame |
| `Interconsulta` | Pedido de interconsulta entre especialidades |
| `Alergia` | Alergia do doente |
| `AlertaClinico` | Alerta clínico (resolúvel) |
| `ContactoEmergencia` | Contacto familiar/emergência do doente |

### 12.3 Operacional

| Modelo | Descrição |
|--------|-----------|
| `Tarefa` | Tarefa com prioridade, estado, doente associado |
| `Turno` | Turno com data, tipo, serviço, membros, chefeTurnoId |
| `HorarioTurno` | Associação utilizador–turno |
| `PedidoTrocaTurno` | Pedido de troca com workflow de aprovação |
| `Atribuicao` | Doente atribuído a profissional |
| `PedidoInterno` | Pedido de material/serviço interno |

### 12.4 Serviços Especializados

| Modelo | Descrição |
|--------|-----------|
| `EpisodioUrgencia` | Episódio de urgência com triagem |
| `CheckinSalaEspera` | Check-in de utente na sala de espera |
| `CirurgiaProgramada` | Cirurgia agendada no bloco |
| `ChecklistCirurgia` | Checklist WHO para cirurgia |
| `Consulta` | Consulta externa agendada |
| `StockItem` | Item de stock da farmácia (+ `precoUnitario Float?`, `catalogoId String?`) |
| `PedidoFarmacia` | Pedido de medicação à farmácia |
| `CatalogoMedicamento` | Catálogo padronizado: DCI, formaFarmaceutica, classeTerap, unidade, concentracao?, codigoATC?, ativo |
| `AjusteStock` | Auditoria de movimentos de stock: stockItemId, delta Float, tipo, motivo, utilizadorId, criadoEm |
| `TransferenciaStock` | Transferência entre serviços: stockItemId, servicoOrigem, servicoDestino, quantidade, estado (pendente/confirmada/cancelada), solicitadoPorId, confirmadoPorId? |
| `Fornecedor` | Fornecedor externo: nome, nif?, email?, telefone?, morada?, ativo |
| `EncomendaFornecedor` | Encomenda a fornecedor: fornecedorId, stockItemId, quantidadeEncomendada, precoUnitario?, estado (pendente/recebida/parcial/cancelada), dataEntregaPrevista?, dataEntregaReal?, recebioPorId? |
| `PlanoReabilitacao` | Plano de fisioterapia/reabilitação |
| `SessaoFisioterapia` | Sessão individual de fisioterapia |

### 12.5 TI e Qualidade

| Modelo | Descrição |
|--------|-----------|
| `IncidenteTI` | Incidente tecnológico reportado |
| `PedidoTI` | Pedido de suporte/equipamento TI |
| `NotificacaoPush` | Token de notificação push por dispositivo |
| `CulturaMicrobiologica` | Cultura microbiológica com antibiograma JSON, resultado (`pendente/positivo/negativo/contaminado`), agente e serviço |
| `SurtoIACS` | Surto de IACS com agente, serviço, numCasos, medidas JSON, estado (`activo/controlado/encerrado`) |

### 12.6 Segurança Clínica e Utilitários (sessão 7)

| Artefacto | Tipo | Descrição |
|-----------|------|-----------|
| `interacoes.json` | Ficheiro | 50 pares de interacções medicamentosas para verificação em `prescrever()` |
| `pdf.service.ts` | Serviço | Geração de PDF com `pdfmake`; partilhado por doentes (alta) e turnos (relatório) |
| `reconciliacao/` | Módulo | Reconciliação MAR↔Farmácia; `setInterval` 30 min; endpoint `GET /reconciliacao` |
| `toast.tsx` | Componente web | `ToastProvider` + hook `useToast`; feedback visual universal de sucesso/erro em todas as páginas |

### 12.7 Componentes Partilhados Web (sessão 8)

| Componente | Caminho | Descrição |
|------------|---------|-----------|
| `confirm-modal.tsx` | `apps/web/src/components/` | Modal de confirmação acessível; substitui `confirm()` nativo; `role="dialog"`, focus trap, Escape, backdrop blur |
| `breadcrumb.tsx` | `apps/web/src/components/` | Breadcrumb semântico; `aria-label="Localização"`; `aria-current="page"` no último item |
| `page-header.tsx` | `apps/web/src/components/` | Header padronizado com `<h1>` e slot para acções; garante hierarquia de headings consistente |

### 12.8 Segurança Clínica Avançada e Relatórios (sessão 10)

#### Novos Modelos Prisma

| Modelo | Descrição |
|--------|-----------|
| `ConsentimentoInformado` | Consentimento para cirurgia/procedimento/anestesia/transfusão; estados: pendente, assinado, recusado; campo `motivoRecusa` |
| `BreakGlassAccess` | Acesso de emergência a doente fora do serviço do utilizador; TTL 4h; `expiradoEm`, `ativo` |
| `ProtocoloClinico` | Protocolo clínico ativo para um doente; tipos: `sepsis`, `avc`, `iamcst`; estados: ativo/concluido/cancelado |
| `ItemProtocolo` | Item individual de um protocolo clínico com prazo em minutos e timestamp de conclusão |
| `PrescricaoDieta` | Prescrição dietética com tipo e array de restrições alimentares; uma activa por doente |

#### Novos Módulos API

| Módulo | Endpoints principais | Roles |
|--------|---------------------|-------|
| `consentimentos/` | `POST /consentimentos`, `POST /:id/assinar`, `POST /:id/recusar`, `GET /doente/:id` | medico, enfermeiro, direcao |
| `break-glass/` | `POST /break-glass { doenteId, motivo }`, `GET /break-glass?doenteId=` | qualquer autenticado |
| `protocolos/` | `POST /protocolos`, `GET /doente/:id`, `PATCH /item/:itemId/concluir`, `PATCH /:id/concluir|cancelar` | medico, enfermeiro |
| `dietas/` | `POST /dietas`, `GET /doente/:id`, `GET /hoje` (vista cozinha) | medico, enfermeiro, cozinha, nutricao |
| `relatorios/` | `GET /internamento\|ocupacao\|diagnosticos\|medicamentos\|urgencia?inicio=&fim=` | direcao, administrativo, ti |

#### Novas Páginas Web

| Página | Caminho | Descrição |
|--------|---------|-----------|
| Relatórios DGS/SNS | `/relatorios` | 5 tipos de relatório com seletor de período; tabelas de resultados; download CSV |
| Dietética | `/dietas` | Vista cozinha (grid de dietas ativas) + tab prescrever (médico/enfermeiro) |
| Consentimentos do Doente | `/doentes/[id]/consentimentos` | Lista de consentimentos com modais assinar/recusar |

#### Integrações em Módulos Existentes

| Módulo | Alteração |
|--------|-----------|
| `sinais-vitais.service.ts` | NEWS2 ≥7 → `protocolosService.ativarSeNaoAtivo(doenteId, 'sepsis')` |
| `doentes.service.ts` | Alta → cama `em_limpeza` + `notificacoes.enviarParaRole('auxiliar', ...)` |
| `medicacao.service.ts` | `assinar(id, userId, totpCode)` — verificação TOTP + campos `assinadoEm/assinadoPorId` |
| `notas-clinicas.service.ts` | Mesmo padrão de assinatura digital |
| `camas.controller.ts` | `PATCH /:id/confirmar-limpeza` (auxiliar/enfermeiro) |
| `notificacoes.service.ts` | Novo método `enviarParaRole(role, titulo, corpo, data?)` |

---

*Documento mantido por Claude Code — actualizar após cada sprint ou alteração significativa.*
