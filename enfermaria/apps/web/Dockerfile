# ─── Stage 1: Instalar dependências ──────────────────────────────────────────
FROM node:22-alpine AS deps
WORKDIR /workspace

RUN corepack enable && corepack prepare pnpm@latest --activate

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/api/package.json ./apps/api/
COPY apps/web/package.json ./apps/web/

RUN pnpm install --frozen-lockfile

# ─── Stage 2: Build ───────────────────────────────────────────────────────────
FROM node:22-alpine AS builder
WORKDIR /workspace

RUN corepack enable && corepack prepare pnpm@latest --activate

# Variáveis públicas substituídas no build pelo docker-compose
ARG NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
ARG NEXT_PUBLIC_SENTRY_DSN
ENV NEXT_PUBLIC_SENTRY_DSN=$NEXT_PUBLIC_SENTRY_DSN
ENV NODE_ENV=production

COPY --from=deps /workspace/node_modules ./node_modules
COPY . .

# Build do Next.js (cwd: apps/web) — pnpm exec, não npx, para usar o next já
# instalado no workspace em vez de o npx tentar buscar uma versão do registry
RUN cd apps/web && pnpm exec next build

# ─── Stage 3: Produção ────────────────────────────────────────────────────────
FROM node:22-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000

RUN addgroup --system --gid 1001 nodejs \
 && adduser  --system --uid 1001 nextjs

# Standalone output do Next.js
COPY --from=builder /workspace/apps/web/.next/standalone ./
COPY --from=builder /workspace/apps/web/.next/static     ./apps/web/.next/static
COPY --from=builder /workspace/apps/web/public           ./apps/web/public

USER nextjs
EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=10s --start-period=20s --retries=3 \
  CMD wget -qO- http://localhost:3000 || exit 1

CMD ["node", "apps/web/server.js"]
