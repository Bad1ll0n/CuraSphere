# ─── Stage 1: Instalar dependências ──────────────────────────────────────────
FROM node:20-alpine AS deps
WORKDIR /workspace

RUN corepack enable && corepack prepare pnpm@latest --activate

# Copiar ficheiros de workspace primeiro (melhor cache)
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/api/package.json ./apps/api/
COPY apps/web/package.json ./apps/web/

# Instalar todas as dependências do workspace
RUN pnpm install --frozen-lockfile

# ─── Stage 2: Build ───────────────────────────────────────────────────────────
FROM node:20-alpine AS builder
WORKDIR /workspace

RUN corepack enable && corepack prepare pnpm@latest --activate

COPY --from=deps /workspace/node_modules ./node_modules
COPY . .

# Gerar cliente Prisma com binário linux-musl
RUN cd apps/api && npx prisma generate --schema prisma/schema.prisma

# Build da API via Nx
RUN pnpm exec nx build api

# ─── Stage 3: Produção ────────────────────────────────────────────────────────
FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production

# Utilizador sem privilégios
RUN addgroup --system --gid 1001 nodejs \
 && adduser  --system --uid 1001 nestjs

# Binário Prisma para linux-musl (necessário em Alpine)
COPY --from=builder /workspace/apps/api/src/generated/prisma/libquery_engine-linux-musl-openssl-3.0.x.so.node* ./generated/prisma/
COPY --from=builder /workspace/apps/api/src/generated/prisma/schema.prisma ./generated/prisma/

# Código compilado
COPY --from=builder /workspace/dist/apps/api/ ./

# node_modules (sem devDependencies)
COPY --from=deps    /workspace/node_modules ./node_modules

USER nestjs
EXPOSE 3333

HEALTHCHECK --interval=30s --timeout=10s --start-period=20s --retries=3 \
  CMD wget -qO- http://localhost:3333/health || exit 1

CMD ["node", "main.js"]
