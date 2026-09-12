# ─── Stage 1: Store do pnpm a partir do lockfile ─────────────────────────────
FROM node:22-alpine AS deps
WORKDIR /workspace

# OPS-14: `pnpm@latest` torna a imagem irreprodutível — a mesma etiqueta de imagem
# construída amanhã pode resolver dependências de forma diferente da de hoje, e uma
# regressão deixa de ser rastreável ao commit. Versão fixa, alinhada com o lockfile.
RUN corepack enable && corepack prepare pnpm@10.33.0 --activate

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

# ─── Stage 3: Produção ────────────────────────────────────────────────────────
FROM node:22-alpine AS runner
WORKDIR /app

RUN corepack enable && corepack prepare pnpm@10.33.0 --activate

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
RUN pnpm install --prod --frozen-lockfile \
 && pnpm store prune

# Directório de uploads (comunicacao.controller.ts guarda anexos em disco) —
# tem de existir e pertencer ao utilizador sem privilégios antes do runtime
RUN mkdir -p uploads/mensagens && chown -R nestjs:nodejs uploads

USER nestjs
EXPOSE 3333

HEALTHCHECK --interval=30s --timeout=10s --start-period=20s --retries=3 \
  CMD wget -qO- http://localhost:3333/v1/health || exit 1

CMD ["node", "main.js"]
