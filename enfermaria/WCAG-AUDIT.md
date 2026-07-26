# Auditoria de Acessibilidade (WCAG 2.1 AA) — CuraSphere (web)

Auditoria da app web (`apps/web`, Next.js) contra a WCAG 2.1 nível AA. Combina varrimento
automatizado por padrões (nomes acessíveis, `alt`, labels, semântica de modais) com revisão
manual das páginas de maior tráfego e dos painéis clínicos.

**Estado**: 1ª ronda — corrigido o defeito mais transversal (nomes acessíveis em botões de
ícone); restantes itens priorizados como backlog acionável abaixo.

---

## 1. O que já está bom (verificado)

- **Modo de alto contraste** — `html.high-contrast` em [`global.css`](apps/web/src/app/global.css)
  (rotulado WCAG AAA): fundo preto, texto branco, override das superfícies. Escape hatch de
  contraste já disponível ao utilizador.
- **Internacionalização** — pt/en completos via `next-intl` (guardrail de paridade de chaves).
- **Imagens** — 3/3 `<img>` têm `alt`.
- **Dark mode** por tokens CSS.
- **Alguns modais** já têm `role="dialog"`/`aria-modal`/tratamento de `Escape` (~31 ocorrências).

---

## 2. Corrigido nesta ronda

### 2.1 — WCAG 4.1.2 (Name, Role, Value) · Botões de ícone sem nome acessível — **RESOLVIDO**
**Problema**: 75 botões de fechar de modais eram apenas o glifo `✕`, sem texto nem `aria-label`.
Um leitor de ecrã anunciava "✕" (ou nada útil), deixando o utilizador sem saber a ação.

**Correção**: `aria-label="Fechar"` acrescentado a **75 botões** em **34 ficheiros**
(65 numa linha + 6 multi-linha + 4 que já estavam corretos, deduplicados). Verificado:
`tsc` limpo, diff = 70 linhas, todas exclusivamente a adicionar o `aria-label`.

---

## 3. Backlog priorizado (não corrigido nesta ronda)

| # | Critério WCAG | Achado | Severidade | Ação recomendada |
|---|---|---|---|---|
| 1 | **1.3.1 / 4.1.2** Info & Relationships | ~192 `<input>` sem `aria-label`/`id`+`<label htmlFor>` associados programaticamente (heurística; muitos têm label visível mas não ligado). | Alta | Associar `<label htmlFor>` ou `aria-label` a cada campo. Priorizar formulários clínicos (medicação, sinais vitais, prescrição). |
| 2 | **2.1.2 / 2.4.3 / 4.1.2** Modais | Nem todos os modais têm `role="dialog"`+`aria-modal`, armadilha de foco, `Esc` para fechar e retorno de foco ao gatilho. | Alta | Extrair um primitivo `Modal` acessível (o shell já existe no Storybook, Sessão 72) e migrar os modais para ele. |
| 3 | **1.4.3** Contraste | Tema por defeito pode ter texto cinza-claro (`text-slate-400`) abaixo de 4.5:1 sobre branco. Alto-contraste mitiga, mas o tema base deve cumprir AA sozinho. | Média | Auditar os tokens de cor com uma ferramenta de rácio; subir os cinzas de texto que falhem. |
| 4 | **2.4.1** Bypass Blocks | Sem link "saltar para o conteúdo". | Média | Adicionar skip-link no layout do dashboard, visível ao focar. |
| 5 | **2.3.3** Animação | Sem bloco `@media (prefers-reduced-motion)` no `global.css`; transições/spinners sempre animam. | Baixa | Envolver transições/animações num guard `prefers-reduced-motion: reduce`. |
| 6 | **1.3.1** Cabeçalhos | Verificar hierarquia de `<h1>`→`<h6>` por rota (sem saltos de nível). | Baixa | Revisão manual por rota; usar heading único por página. |
| 7 | **1.4.1** Cor como único meio | Alguns estados (ex.: severidade) dependem de cor. Muitos já têm rótulo textual (ex.: "CRÍTICO"), confirmar cobertura total. | Baixa | Garantir ícone/texto além da cor em todos os indicadores de estado. |

---

## 4. Método (reproduzir a auditoria)

```sh
# nomes acessíveis em botões de ícone
grep -rnE ">[✕✓×]</button>" apps/web/src --include=*.tsx | grep -v aria-label
# imagens sem alt
grep -rnE "<img " apps/web/src --include=*.tsx | grep -v "alt="
# inputs potencialmente sem label
grep -rnE "<input " apps/web/src --include=*.tsx | grep -viE "aria-label|id=|type=\"(hidden|checkbox|radio)\""
# semântica de modais
grep -rnE "role=\"dialog\"|aria-modal|'Escape'" apps/web/src --include=*.tsx
```
Complementar com: axe DevTools / Lighthouse a11y por rota, e teste manual só-teclado
(Tab/Shift-Tab/Enter/Esc) + leitor de ecrã (NVDA/VoiceOver) nos fluxos clínicos críticos
(login, detalhe do doente, MAR, prescrição).

---

## 5. Recomendação de sequência
1. **#2 (modais)** e **#1 (labels)** primeiro — maior impacto para utilizadores de leitor de ecrã e
   afetam formulários clínicos críticos.
2. **#3 (contraste)** e **#4 (skip-link)** de seguida.
3. **#5–#7** como polimento.
Fazer da regra "botão de ícone exige `aria-label`" e "campo exige label associado" um item de
checklist de PR / regra ESLint (`jsx-a11y`) para não regredir.

---

*Auditoria por Claude Code — reexecutar após migração para o primitivo `Modal` e após a ronda de labels.*
