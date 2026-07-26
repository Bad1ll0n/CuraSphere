# Auditoria de Acessibilidade (WCAG 2.1 AA) — CuraSphere (web)

Auditoria da app web (`apps/web`, Next.js) contra a WCAG 2.1 nível AA. Combina varrimento
automatizado por padrões (nomes acessíveis, `alt`, labels, semântica de modais) com revisão
manual das páginas de maior tráfego e dos painéis clínicos.

**Estado**: 1ª ronda — corrigido o defeito mais transversal (nomes acessíveis em botões de
ícone); restantes itens priorizados como backlog acionável abaixo.

---

## 1. O que já está bom (verificado)

- **Modo de alto contraste** — `html.high-contrast` em [`global.css`](apps/web/src/app/global.css)
  (rotulado WCAG AAA): fundo preto, texto branco, override das superfícies.
- **`prefers-reduced-motion`** (WCAG 2.3.3) — bloco já presente em `global.css` (l.284): reduz
  animações/transições a ~0. **(Já feito; corrige a impressão inicial desta auditoria.)**
- **Skip-to-content** (WCAG 2.4.1) — `<a href="#main-content" class="skip-to-content">` no
  `client-layout.tsx` (i18n `skipToContent`), com alvo `<main id="main-content" tabIndex={-1}>`. **(Já feito.)**
- **Internacionalização** — pt/en completos via `next-intl` (guardrail de paridade de chaves).
- **Imagens** — 3/3 `<img>` têm `alt`.
- **Dark mode** por tokens CSS.
- **Modais acessíveis** — o `confirm-modal.tsx` já tinha `role="dialog"`+`aria-modal`+Escape+focus-trap;
  agora existe um **primitivo genérico** [`components/ui/modal.tsx`](apps/web/src/components/ui/modal.tsx)
  para conteúdo arbitrário (ver §2.2).

---

## 2. Corrigido nesta ronda

### 2.1 — WCAG 4.1.2 (Name, Role, Value) · Botões de ícone sem nome acessível — **RESOLVIDO**
**Problema**: 75 botões de fechar de modais eram apenas o glifo `✕`, sem texto nem `aria-label`.
Um leitor de ecrã anunciava "✕" (ou nada útil), deixando o utilizador sem saber a ação.

**Correção**: `aria-label="Fechar"` acrescentado a **75 botões** em **34 ficheiros**
(65 numa linha + 6 multi-linha + 4 que já estavam corretos, deduplicados). Verificado:
`tsc` limpo, diff = 70 linhas, todas exclusivamente a adicionar o `aria-label`.

### 2.2 — WCAG 2.1.2 / 2.4.3 (Foco) · Primitivo de modal acessível — **CRIADO + demonstrado**
**Contexto**: existiam ~52 ficheiros com modais ad-hoc (`fixed inset-0`) sem `role="dialog"`,
armadilha de foco, `Esc` nem devolução de foco — ao contrário do `confirm-modal` (usado só em 6 sítios).

**Ação**: criado o primitivo genérico [`ui/modal.tsx`](apps/web/src/components/ui/modal.tsx)
(`role="dialog"`+`aria-modal`, `aria-labelledby`, Escape, armadilha de foco sobre **todos** os
focáveis, foco inicial e devolução ao gatilho, fecho por backdrop) + story. Os 2 modais da
**worklist de imagiologia** (resultado + laudo) foram migrados para ele como demonstração.
A migração dos restantes ~50 modais para este primitivo é o item #2 do backlog.

---

## 3. Backlog priorizado (não corrigido nesta ronda)

| # | Critério WCAG | Achado | Severidade | Ação recomendada |
|---|---|---|---|---|
| 1 | **1.3.1** Info & Relationships | **386 `<label>` sem controlo associado** — já sinalizado como **erro** pela regra `jsx-a11y/label-has-associated-control` (ativa no `nx lint web`). Espalhado por ~40 ficheiros (top: urgencia 19, farmacia 17, equipamentos 16). **É a causa principal do lint web estar vermelho** (548 erros no total). | Alta | Associar cada label (wrap do controlo no `<label>`, ou `htmlFor`+`id`, ou `aria-label`). Fazer form-a-form; cada ficheiro corrigido baixa a contagem de erros do gate. `FormField` já foi corrigido (associação implícita). |
| 2 | **2.1.2 / 2.4.3** Modais | ~50 modais ad-hoc ainda não usam o primitivo acessível (o `ui/modal.tsx` já existe; worklist já migrada — ver §2.2). | Alta | Migrar os restantes modais para `<Modal>`, ficheiro a ficheiro, verificando o layout. |
| 3 | **1.4.3** Contraste | Tema por defeito pode ter texto cinza-claro (`text-slate-400`) abaixo de 4.5:1 sobre branco. Alto-contraste mitiga, mas o tema base deve cumprir AA sozinho. | Média | Auditar os tokens de cor com uma ferramenta de rácio; subir os cinzas de texto que falhem. |
| 4 | **1.3.1** Cabeçalhos | Verificar hierarquia de `<h1>`→`<h6>` por rota (sem saltos de nível). | Baixa | Revisão manual por rota; usar heading único por página. |
| 5 | **1.4.1** Cor como único meio | Alguns estados (ex.: severidade) dependem de cor. Muitos já têm rótulo textual (ex.: "CRÍTICO"), confirmar cobertura total. | Baixa | Garantir ícone/texto além da cor em todos os indicadores de estado. |

> **Já resolvidos** (verificados no código, corrigindo a 1ª impressão desta auditoria): skip-to-content
> (2.4.1) e `prefers-reduced-motion` (2.3.3) — ver §1.

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
