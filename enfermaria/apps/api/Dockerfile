# ─── Stage 1: Store do pnpm a partir do lockfile ─────────────────────────────
# OPS-15: imagem base fixada por digest (o Dependabot actualiza-o); uma tag flutuante
# mudava o que se construía sem nenhuma alteração no repositório.
FROM node:26-alpine@sha256:8996bb5821d62a8fd9bb27c1cb07462f3fdce6e47d640c6a881ead0b064ce216 AS deps
WORKDIR /workspace

# OPS-14: `pnpm@latest` torna a imagem irreprodutível — a mesma etiqueta de imagem
# construída amanhã pode resolver dependências de forma diferente da de hoje, e uma
# regressão deixa de ser rastreável ao commit. Versão fixa, alinhada com o lockfile.
# Via npm e não corepack: o Node 25+ deixou de trazer o corepack incluído.
RUN npm install -g pnpm@10.33.0

# OPS-02: esta fase copiava três package.json de um workspace com vários projectos
# (apps/*, libs/*, packages/*). Com `--frozen-lockfile`, o pnpm não instala um workspace
# a que faltam projectos que o lockfile declara — a imagem não construía.
# `pnpm fetch` só precisa do lockfile: descarrega a store para esta camada, que fica em
# cache enquanto o lockfile não mudar, e a instalação faz-se depois sobre o código completo.
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm fetch --frozen-lockfile

# ─── Stage 2: Build ───────────────────────────────────────────────────────────
# É também o estágio do serviço `migrate` do docker-compose.prod.yml (schema e triggers
# de auditoria): tem o workspace, o CLI do Prisma e os scripts.
FROM deps AS builder

# O `prepare` da raiz corre o husky, que precisa de .git — excluído pelo .dockerignore.
ENV HUSKY=0

COPY . .
RUN pnpm install --frozen-lockfile --prefer-offline

# Gerar cliente Prisma com binário linux-musl — usar pnpm exec (não npx) para
# resolver o `prisma` já instalado no workspace em vez de o npx tentar buscar
# uma versão nova do registry, que não reconhece o prisma.config.ts do projecto
RUN cd apps/api && pnpm exec prisma generate --schema prisma/schema.prisma

# Build e poda (alvo `prune` da API): o bundle em apps/api/dist, com o cliente Prisma
# gerado, e um package.json + pnpm-lock.yaml só com as dependências de runtime da API.
# --skip-nx-cache: sem isto, o Nx pode restaurar um artefacto de build em cache (local ou
# Nx Cloud) em vez de recompilar, servindo um main.js stale que não reflecte o código atual.
RUN pnpm exec nx run @org/api:prune --skip-nx-cache

# O prune copia a secção `overrides:` do lockfile da raiz para o lockfile podado, mas não
# a configuração que a declara (`overrides:` no pnpm-workspace.yaml) — e o
# `pnpm install --frozen-lockfile` abaixo recusa a diferença
# (ERR_PNPM_LOCKFILE_CONFIG_MISMATCH). Leva-se o bloco para junto do lockfile podado.
RUN tr -d '\r' < pnpm-workspace.yaml | awk '/^overrides:/{f=1} f&&/^$/{exit} f' > apps/api/dist/pnpm-workspace.yaml

# ─── Stage 3: Produção ────────────────────────────────────────────────────────
FROM node:26-alpine@sha256:8996bb5821d62a8fd9bb27c1cb07462f3fdce6e47d640c6a881ead0b064ce216 AS runner
WORKDIR /app

RUN npm install -g pnpm@10.33.0

# Utilizador sem privilégios
RUN addgroup --system --gid 1001 nodejs \
 && adduser  --system --uid 1001 nestjs

# Bundle, cliente Prisma gerado (dist/generated/prisma, copiado pelos assets do webpack —
# inclui o binário linux-musl) e o package.json/lockfile podados pelo Nx.
COPY --from=builder /workspace/apps/api/dist/ ./

# OPS-02: a imagem copiava o node_modules da RAIZ do workspace. Com o linker isolado do
# pnpm, as dependências da API vivem no node_modules da própria app, e na raiz só estão as
# da raiz: a API arrancaria sem @nestjs/config, @nestjs/jwt, pg ou socket.io. Instala-se
# aqui exactamente o que o bundle externaliza, a partir do lockfile podado.
ENV NODE_ENV=production
# OPS-16: o pnpm instala automaticamente os "peers" das dependências de produção, e alguns são
# ferramentas de BUILD que nunca correm aqui: o CLI do Prisma (com o Prisma Studio, o pglite e o
# effect — o @prisma/client declara-o como peer), o webpack/terser/swc (peers do plugin de
# bundling do @sentry/node), o esbuild/lightningcss e o TypeScript. ~230 MB que só aumentavam o
# tempo de deploy e a superfície de ataque. O @swc/helpers fica (é runtime do pdfmake).
# A verificação a seguir carrega TODAS as dependências de produção e o cliente Prisma gerado:
# se alguma deixar de carregar, o build falha aqui e não em produção.
# Instalar, podar e verificar no MESMO `RUN`: num RUN à parte, o que se apaga continua na camada
# da instalação e a imagem não diminui.
COPY apps/api/scripts/verificar-dependencias.cjs /tmp/verificar-dependencias.cjs
RUN pnpm install --prod --frozen-lockfile \
 && pnpm store prune \
 && for p in prisma@ @prisma+dev@ @prisma+studio-core@ @prisma+config@ @electric-sql+ effect@ \
             webpack@ webpack-cli@ @webpack-cli+ terser-webpack-plugin@ minimizer-webpack-plugin@ \
             @swc+core esbuild@ @esbuild+ lightningcss@ lightningcss- typescript@ \
             @sentry+bundler-plugins@ @sentry+webpack-plugin@ @sentry+babel-plugin; do \
      rm -rf node_modules/.pnpm/${p}*; \
    done \
 && node /tmp/verificar-dependencias.cjs && rm /tmp/verificar-dependencias.cjs \
 # Nada de gestores de pacotes em runtime: o pnpm só servia a instalação acima, e o npm/yarn
 # da imagem base não fazem nada numa imagem imutável (só superfície de ataque).
 && npm uninstall -g pnpm >/dev/null 2>&1 \
 && rm -rf /usr/local/lib/node_modules/npm /usr/local/lib/node_modules/corepack \
           /usr/local/bin/npm /usr/local/bin/npx /usr/local/bin/corepack /opt/yarn* /usr/local/bin/yarn /usr/local/bin/yarnpkg \
           /root/.npm /root/.cache /root/.local/share/pnpm

# Directório de uploads (comunicacao.controller.ts guarda anexos em disco) —
# tem de existir e pertencer ao utilizador sem privilégios antes do runtime
RUN mkdir -p uploads/mensagens && chown -R nestjs:nodejs uploads

# OPS-08: a versão do release (tag ou SHA) — vai para o Sentry, para o tracing e para o /health/live.
ARG VERSAO=desconhecida
ENV APP_VERSION=$VERSAO
# PERF-20: o threadpool do libuv tem 4 threads por omissão e é partilhado pelo bcrypt (@node-rs),
# pela cifragem assíncrona, pelo zlib da compressão, pelo DNS e pelo fs. Com logins e PDFs em
# simultâneo, 4 faziam fila. 16 é o valor recomendado para uma réplica com 2–4 vCPU; pode
# sobrepor-se no compose (UV_THREADPOOL_SIZE).
ENV UV_THREADPOOL_SIZE=16

USER nestjs
EXPOSE 3333

HEALTHCHECK --interval=30s --timeout=10s --start-period=20s --retries=3 \
  CMD wget -qO- http://localhost:3333/v1/health/live || exit 1

CMD ["node", "main.js"]
