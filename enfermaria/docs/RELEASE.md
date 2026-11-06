# Release e deploy

Uma release é uma **tag `vX.Y.Z` num commit da `main`**. Não há outro caminho para produção.

```
PR → main (CI obrigatório) → tag vX.Y.Z → release.yml → GHCR (assinado) → deploy.sh vX.Y.Z
```

## 1. Criar a release

```bash
git switch main && git pull
git tag -a v1.4.0 -m "v1.4.0"
git push origin v1.4.0
```

O workflow [`release.yml`](../../.github/workflows/release.yml):

1. recusa uma tag que aponte para um commit fora da `main`;
2. constrói as imagens `api`, `migrate` e `web`;
3. analisa cada imagem com **Trivy**. Um CRITICAL ou HIGH com correcção disponível **reprova a release**;
4. publica no GHCR como `ghcr.io/<dono>/curasphere-<app>:vX.Y.Z` (e `:sha-<commit>`), com **SBOM** (SPDX) e **proveniência SLSA** anexadas. Nunca publica `latest`;
5. assina cada imagem com **cosign** (keyless; o certificado identifica este workflow e esta tag);
6. cria a GitHub Release com as notas geradas a partir dos PRs desde a tag anterior. Esse é o changelog.

**Configuração única no GitHub** (Settings → Environments → `producao`):

| Variável | Para quê |
|---|---|
| `NEXT_PUBLIC_API_URL` | Fica no bundle do web (WebSocket e CSP) |
| `NEXT_PUBLIC_JITSI_SERVER` | Servidor de teleconsulta do hospital (SEC-16) |
| `NEXT_PUBLIC_SENTRY_DSN` | Opcional |

Para exigir aprovação manual antes de publicar, acrescente *required reviewers* ao environment.

## 2. Instalar no servidor

Uma vez, no `.env.prod`:

```
CURASPHERE_IMAGE_PREFIX=ghcr.io/<dono>/curasphere
CURASPHERE_GITHUB_REPO=<dono>/CuraSphere
```

Uma vez, também: autenticar no GHCR (`docker login ghcr.io` com um token só de leitura de pacotes) e instalar o [cosign](https://docs.sigstore.dev/cosign/system_config/installation/).

Para cada versão:

```bash
./scripts/deploy.sh v1.4.0
```

O script faz isto:

1. descarrega as imagens da versão, e a versão em serviço continua a correr;
2. verifica as assinaturas com cosign. Uma imagem que não tenha sido assinada pelo `release.yml` deste repositório é recusada;
3. faz uma cópia de segurança antes de tocar no schema;
4. aplica as migrações (`prisma migrate deploy`) e os triggers de auditoria;
5. troca a API e o web e espera que a API fique *healthy*;
6. se não ficar, volta à versão anterior (`.versao-em-servico`).

O histórico fica em `deploys.log`.

**Rollback manual:** `./scripts/deploy.sh <versão anterior>`. O rollback troca as imagens mas não desfaz migrações, por isso as migrações têm de ser aditivas (ver `apps/api/prisma/MIGRACOES.md`).

**Sem registry** (instalação isolada): `./scripts/deploy.sh local` constrói no próprio servidor, sem verificação de assinatura. O rollback volta à imagem `local-anterior`.

## 3. Cadeia de fornecimento

- Imagens base (`node`, `postgres`, `redis`, `nginx`) fixadas por **digest**. O Dependabot actualiza-as todos os meses (ecossistemas `docker` e `docker-compose`).
- Actions do GitHub fixadas por SHA.
- `security.yml` analisa o repositório (Trivy fs, gitleaks, Semgrep, `pnpm audit`). O `release.yml` analisa a imagem final.
