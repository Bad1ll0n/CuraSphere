# CuraSphere

Sistema de informação hospitalar centrado no internamento e nos cuidados de enfermagem: processo do doente, medicação segura (prescrição, validação farmacêutica, administração com os 5 certos), sinais vitais e NEWS2, turnos e passagem ISBAR, camas e altas, portal do doente e app móvel para a cabeceira.

> Contém dados de saúde (RGPD, art. 9.º). Nunca use uma cópia da base de produção fora da produção, nem anonimizada à mão. Ver [docs/AMBIENTES.md](docs/AMBIENTES.md).

## Estrutura

Monorepo [Nx](https://nx.dev) com pnpm:

| Projeto | O que é | Tecnologia |
|---|---|---|
| `apps/api` | API (`/v1`), autenticação, regras clínicas, auditoria, integrações (HL7, FHIR, SPMS) | NestJS 12, Prisma 7, PostgreSQL 16, Redis |
| `apps/web` | Aplicação web do pessoal, portal do doente, quiosque e painéis | Next.js 16, React, TanStack Query, next-intl |
| `apps/mobile` | App de cabeceira (enfermagem), com modo offline | Expo / React Native |
| `apps/web-e2e` | Testes de ponta a ponta | Playwright |
| `libs/shared` | O que a API, a web e o mobile partilham: tipos, contratos, a matriz de permissões por rota e regras clínicas (coerência dos sinais vitais) | TypeScript |

## Arrancar em desenvolvimento

Requisitos: Node ≥ 24.9 (o CI e as imagens usam o 26), pnpm ≥ 10 e Docker.

1. Instalar dependências:

   ```sh
   pnpm install
   ```

2. Configuração: copie `apps/api/.env.example` para `apps/api/.env` e preencha os segredos. Para gerar um valor: `openssl rand -hex 32`. Em produção, a configuração é validada no arranque e um valor de exemplo impede a API de arrancar; ver [docs/SEGREDOS.md](docs/SEGREDOS.md).

3. Base de dados (PostgreSQL 16):

   ```sh
   docker compose up -d
   ```

   O Redis é opcional em desenvolvimento. Sem ele, a API funciona em modo degradado: o SSO e as passkeys ficam indisponíveis e as caches passam a locais. Ver [docs/ALTA-DISPONIBILIDADE.md](docs/ALTA-DISPONIBILIDADE.md) §2.1.

4. Migrações, trilho de auditoria e utilizadores de teste:

   ```sh
   cd apps/api
   pnpm exec prisma migrate deploy
   node scripts/apply-audit-triggers.mjs
   npx ts-node --transpile-only src/prisma/seed-test-users.ts
   cd ../..
   ```

   O trilho de auditoria é imutável: os triggers recusam `UPDATE`, `DELETE` e `TRUNCATE`.

5. Arrancar:

   ```sh
   pnpm exec nx serve @org/api      # http://localhost:3333 (documentação em /api/docs)
   pnpm exec nx dev @org/web        # http://localhost:3000
   pnpm exec nx start @org/mobile   # Expo
   ```

### Utilizadores de teste

O `seed-test-users.ts` cria uma persona por papel. O número de funcionário vai de `00001` a `00017`, e o script imprime a lista completa e a password. Alguns exemplos:

- `00001` direção;
- `00002` médico;
- `00003` enfermeiro;
- `00006` farmacêutico;
- `00007` administrativo (receção);
- `00009` TI.

As personas clínicas têm MFA ativo, com um segredo TOTP fixo de teste que o script também imprime.

## Testes e verificações

```sh
pnpm exec nx run-many -t typecheck lint test     # tipos, lint e unitários (api, web, mobile, shared)
pnpm exec nx run @org/api:test-integracao        # API real contra uma BD descartável (DATABASE_URL_INTEGRACAO)
pnpm exec playwright test --config=apps/web-e2e/playwright.config.ts   # E2E, com a API e a web a correr
```

Os testes de integração apagam e recriam a base indicada em `DATABASE_URL_INTEGRACAO`. Nunca a aponte para dados reais.

Há testes que transformam regras de arquitetura e de segurança em verificações (`apps/api/src/app/common/estrutura.spec.ts` e `apps/web/src/arquitetura.spec.ts`). Alguns exemplos:
- acesso ao doente verificado em todas as rotas;
- nenhuma falha engolida em silêncio;
- ficheiros que não crescem;
- o número de `any` só desce.

Quando uma dívida desce, a base dessas verificações atualiza-se com:

```sh
ATUALIZAR_BASELINE=1 pnpm exec nx run @org/web:test
```

### CI

O CI está em `.github/workflows/`, na raiz do repositório:

- **`ci.yml`:**
  - o job `verify` bloqueia o merge: tipos, migrações contra o schema, lint, unitários, integração, build e orçamento de JS;
  - nos PRs, os passos rápidos correm só nos projetos afetados;
  - o E2E corre todas as noites, ou num PR com a etiqueta `run-e2e`.
- **`release.yml`:** imagens assinadas, com SBOM e análise da imagem, a partir de uma tag `vX.Y.Z`.
- **`staging.yml`, `ambiente-efemero.yml`, `ensaio-dr.yml`, `load.yml` e `security.yml`:** ver a documentação de operação abaixo.

## Operação

| Tema | Documento |
|---|---|
| Ambientes (desenvolvimento, efémero, staging, produção) e promoção | [docs/AMBIENTES.md](docs/AMBIENTES.md) |
| Release e deploy (`scripts/deploy.sh vX.Y.Z`, rollback) | [docs/RELEASE.md](docs/RELEASE.md) |
| Recuperação de desastre, backups e PITR | [DR-RUNBOOK.md](DR-RUNBOOK.md) |
| Alta disponibilidade e o que pára sem Redis | [docs/ALTA-DISPONIBILIDADE.md](docs/ALTA-DISPONIBILIDADE.md) |
| Monitorização, alertas, logs e tracing | [docs/MONITORIZACAO.md](docs/MONITORIZACAO.md) |
| Segredos e rotação da chave de cifragem | [docs/SEGREDOS.md](docs/SEGREDOS.md) |
| TLS, rede interna e portal público | [docs/TLS-E-REDE.md](docs/TLS-E-REDE.md) |
| Desempenho da base de dados | [docs/DESEMPENHO-BD.md](docs/DESEMPENHO-BD.md) |
| Interoperabilidade (HL7, FHIR, RNU, PEM) | [docs/INTEROPERABILIDADE.md](docs/INTEROPERABILIDADE.md) |
| Catálogo de medicamentos e interações | [docs/CATALOGO-MEDICAMENTOS.md](docs/CATALOGO-MEDICAMENTOS.md) |
| RGPD: direitos do titular e retenção; subcontratantes; registo da IA | [docs/RGPD-DIREITOS-E-RETENCAO.md](docs/RGPD-DIREITOS-E-RETENCAO.md), [docs/SUBPROCESSADORES.md](docs/SUBPROCESSADORES.md), [docs/REGISTO-IA.md](docs/REGISTO-IA.md) |
| Acessibilidade | [WCAG-AUDIT.md](WCAG-AUDIT.md) |

### Regras clínicas configuráveis por hospital

As regras mais sensíveis estão em `apps/api/.env.example`. Três exemplos:
- `VALIDACAO_ANTES_DE_ADMINISTRAR`: `bloquear`, `primeira_dose` ou `avisar`; uma prescrição rejeitada pela farmácia nunca se administra.
- `BCMA_OBRIGATORIO`: exige a leitura da pulseira e da embalagem.
- `ALTA_REQUISITOS`: os passos obrigatórios da alta.

Os valores são validados no arranque.

## Contribuir

- Cada mudança entra por PR, com o CI verde.
- Uma rota ou funcionalidade nova entra na matriz de permissões (`libs/shared/src/lib/permissoes.ts`), e o `@Roles` da API tem de bater certo com ela.
- Os textos da web passam pelo `next-intl`, em `apps/web/src/messages`: português e inglês.
