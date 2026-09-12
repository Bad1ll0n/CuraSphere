# ─── Stage 1: Store do pnpm a partir do lockfile ─────────────────────────────
FROM node:22-alpine AS deps
WORKDIR /workspace

# OPS-14: `pnpm@latest` torna a imagem irreprodutível — a mesma etiqueta de imagem
# construída amanhã pode resolver dependências de forma diferente da de hoje, e uma
# regressão deixa de ser rastreável ao commit. Versão fixa, alinhada com o lockfile.
RUN corepack enable && corepack prepare pnpm@10.33.0 --activate

# OPS-02: ver a nota equivalente em apps/api/Dockerfile. Aqui era pior: o web depende de
# @org/shared (libs/shared), e nenhum package.json de libs/ chegava a ser copiado.
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm fetch --frozen-lockfile

# ─── Stage 2: Build ───────────────────────────────────────────────────────────
FROM deps AS builder

# O `prepare` da raiz corre o husky, que precisa de .git — excluído pelo .dockerignore.
ENV HUSKY=0

# Variáveis públicas substituídas no build pelo docker-compose
ARG NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
ARG NEXT_PUBLIC_SENTRY_DSN
ENV NEXT_PUBLIC_SENTRY_DSN=$NEXT_PUBLIC_SENTRY_DSN
# Servidor Jitsi da instituição. Sem isto, src/app/teleconsulta/[consultaId]/page.tsx
# cai em 'meet.jit.si' e as videochamadas clínicas saem por um servidor público.
ARG NEXT_PUBLIC_JITSI_SERVER
ENV NEXT_PUBLIC_JITSI_SERVER=$NEXT_PUBLIC_JITSI_SERVER

COPY . .
RUN pnpm install --frozen-lockfile --prefer-offline

# NODE_ENV=production só DEPOIS da instalação: com ele definido, o pnpm salta as
# devDependencies — e o build do Next precisa delas.
ENV NODE_ENV=production

# OPS-02: `--webpack` e obrigatorio. O Next 16 constroi com Turbopack por omissao, e o
# Turbopack ignora `output: 'standalone'` - a imagem compilava e depois falhava a copiar
# .next/standalone, que nunca chegava a existir. E a mesma flag que o alvo de build do
# projecto ja usa.
RUN cd apps/web && pnpm exec next build --webpack

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
