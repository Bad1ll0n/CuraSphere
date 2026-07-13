---
name: curasphere-i18n-audit
description: Use when adding UI text to apps/web, or when auditing the app for hardcoded/missing translations. CuraSphere is fully bilingual (pt/en) via next-intl; this skill covers key-parity checking and the namespace structure so new strings land consistently in both message files.
---

# CuraSphere — i18n Audit & Convention

Translations live in `apps/web/src/messages/pt.json` and `apps/web/src/messages/en.json`, loaded via `next-intl` (`apps/web/src/i18n/request.ts`). Portuguese is the primary/default locale.

## Namespace structure

Top-level keys (namespaces) as of last audit: `common`, `login`, `nav`, `dashboard`, `patients`, `medication`, `vitals`, `ai`, `errors`, `roles`, `subRoles`, `patientStatus`, `layout`, `tour`, `shortcuts`, `theme`. New feature areas either get their own namespace or extend an existing closely-related one (e.g. PRO forms extended `patients`/`common` rather than creating a one-off namespace) — check for a fitting existing namespace before adding a new top-level key.

In components: `const t = useTranslations('namespace')` then `t('key')`. `common` holds cross-cutting strings (`save`, `cancel`, `noRecords`, `comingSoon`, etc.) — always check `common` before adding a duplicate string to a feature namespace.

## Key parity check

`pt.json` and `en.json` must have identical key trees. Diff them structurally, not just by eyeballing:
```bash
node -e "
const pt = require('./apps/web/src/messages/pt.json');
const en = require('./apps/web/src/messages/en.json');
function keys(o, prefix='') { return Object.entries(o).flatMap(([k,v]) => typeof v === 'object' && v !== null ? keys(v, prefix+k+'.') : [prefix+k]); }
const ptKeys = new Set(keys(pt)), enKeys = new Set(keys(en));
console.log('Missing in en:', [...ptKeys].filter(k => !enKeys.has(k)));
console.log('Missing in pt:', [...enKeys].filter(k => !ptKeys.has(k)));
"
```
Run from `apps/web/` (or adjust the require paths). Zero missing keys in either direction is the bar — a key present in one language and not the other silently falls back to raw key text or throws depending on next-intl config, both bad.

## Finding hardcoded strings

Grep `.tsx` files under `apps/web/src/app` and `apps/web/src/components` for quoted Portuguese literals inside JSX (accented characters are a strong signal: `ã õ ç á é í ó ú â ê`) that aren't already passed through `t(...)`. Known past offenders were static strings inside modals/badges that were added without translation (e.g. `keyboard-shortcuts-modal.tsx`'s "Prima ? para reabrir" hint, and dashboard "Em breve" stat-card labels) — both are now translated via `shortcuts.hint` and `common.comingSoon`. Treat any new literal Portuguese string in a `.tsx` return block as a bug unless it's genuinely locale-invariant (an ID, a unit like "mmHg", a proper noun).

## Adding a new string

1. Add the key to **both** `pt.json` and `en.json`, same path, same nesting.
2. Use `useTranslations` in the component, never inline the literal.
3. Re-run the parity check above before considering the change done.
