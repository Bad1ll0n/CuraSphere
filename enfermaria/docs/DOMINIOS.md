# Domínios da API (ARQ-19)

## `common/` por tema

O `common/` tinha 95 ficheiros soltos, que misturavam cálculo clínico, segurança, auditoria, IA e infraestrutura. Agora estão organizados assim:

| Subpasta | Conteúdo |
|---|---|
| `common/clinico/` | Regras e cálculos clínicos: NEWS2, PEWS, escalas (`escalas-motor`, `escala-acoes`), doses, diálise, obstetrícia, oncologia, antropometria, dia clínico, turno em curso, vigilância, consentimento de tratamento, remoção lógica |
| `common/seguranca/` | CSRF, CSP, SSRF, *throttling*, palavras-passe, TOTP, guarda do quiosque, *redaction* de logs, origens permitidas, papéis |
| `common/auditoria/` | Trilho de auditoria, *checkpoints*, acessos de leitura |
| `common/ia/` | Modelos, funções de IA ativas (PROD-19), deteção de anomalias |
| `common/infra/` | PDF, Excel, CSV, armazenamento, filtro de exceções, idempotência, transações, falhas, correlação, dinheiro, validação PT, enums |
| `common/dto/` | DTOs partilhados |

Na raiz de `common/` ficam só as guardas do repositório (`estrutura.spec.ts`, `schema-modelacao.spec.ts`). Um teste falha se aparecer um ficheiro solto ou uma subpasta nova.

## Domínios que se sobrepunham

| Antes | Agora |
|---|---|
| `escalas/` (Braden, Morse) e `escalas-clinicas/` (NRS-2002, Barthel, RASS…), em dois módulos | Um só domínio, `escalas/`, com um módulo. Partilham o motor e as regras escala → ação. As rotas `/escalas` e `/escalas-clinicas` mantêm-se. |
| `EscalasModule` registado no `GestaoModule` (confundido com a escala de serviço, o modelo `Escala`) | No `ClinicalModule`. A escala de serviço continua em `horarios/`. |
| `reconciliacao/` (pendências operacionais), confundível com `reconciliacao-medicacao/` (reconciliação medicamentosa) | `pendencias/` (`PendenciasService`). A rota `/reconciliacao` mantém o nome para não partir a web. |

Por fundir, mas são decisões de produto (ver `AMBITO-PRODUTO.md`):
- as duas vias de alta (`plano-alta`, PROD-12);
- `exames` e `exames-lab`.
