# ─── Stage 1: Instalar dependências ──────────────────────────────────────────
FROM node:22-alpine AS deps
WORKDIR /workspace

RUN corepack enable && corepack prepare pnpm@latest --activate

# Copiar ficheiros de workspace primeiro (melhor cache)
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/api/package.json ./apps/api/
COPY apps/web/package.json ./apps/web/

# Instalar todas as dependências do workspace
RUN pnpm install --frozen-lockfile

# ─── Stage 2: Build ───────────────────────────────────────────────────────────
FROM node:22-alpine AS builder
WORKDIR /workspace

RUN corepack enable && corepack prepare pnpm@latest --activate

COPY --from=deps /workspace/node_modules ./node_modules
COPY . .

# Gerar cliente Prisma com binário linux-musl — usar pnpm exec (não npx) para
# resolver o `prisma` já instalado no workspace em vez de o npx tentar buscar
# uma versão nova do registry, que não reconhece o prisma.config.ts do projecto
RUN cd apps/api && pnpm exec prisma generate --schema prisma/schema.prisma

# Build da API via Nx.
# --skip-nx-cache: sem isto, o Nx pode restaurar um artefacto de build em cache (local ou
# Nx Cloud) em vez de recompilar, servindo um main.js stale que não reflecte o código atual.
RUN pnpm exec nx build api --skip-nx-cache

# ─── Stage 3: Produção ────────────────────────────────────────────────────────
FROM node:22-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production

# Utilizador sem privilégios
RUN addgroup --system --gid 1001 nodejs \
 && adduser  --system --uid 1001 nestjs

# Binário Prisma para linux-musl (necessário em Alpine)
COPY --from=builder /workspace/apps/api/src/generated/prisma/libquery_engine-linux-musl-openssl-3.0.x.so.node* ./generated/prisma/
COPY --from=builder /workspace/apps/api/src/generated/prisma/schema.prisma ./generated/prisma/

# Código compilado — webpack.config.js define output relativo a apps/api/dist,
# não ao dist/apps/api de raiz que o Nx usa por convenção noutros projectos
COPY --from=builder /workspace/apps/api/dist/ ./

# node_modules (sem devDependencies)
COPY --from=deps    /workspace/node_modules ./node_modules

# Directório de uploads (comunicacao.controller.ts guarda anexos em disco) —
# tem de existir e pertencer ao utilizador sem privilégios antes do runtime
RUN mkdir -p uploads/mensagens && chown -R nestjs:nodejs uploads

USER nestjs
EXPOSE 3333

HEALTHCHECK --interval=30s --timeout=10s --start-period=20s --retries=3 \
  CMD wget -qO- http://localhost:3333/v1/health || exit 1

CMD ["node", "main.js"]
