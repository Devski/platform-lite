# syntax=docker/dockerfile:1

# The production image. Built in CI and pulled by the instance — never built on
# the machine it deploys to (SPEC §3, #21): a Next.js build wants more CPU and
# memory than the dev instance has, while the running app is one Node process.
#
# Debian slim rather than Alpine on purpose: sharp ships native binaries, and
# glibc is the platform its prebuilds are best tested against. The size
# difference is paid once in the registry, a decoding bug would be paid daily.
ARG NODE_VERSION=24

FROM node:${NODE_VERSION}-slim AS base
ENV PNPM_HOME=/pnpm PATH=/pnpm:$PATH
RUN corepack enable
WORKDIR /app

# Dependencies resolve from the lockfile alone, so this layer is reused for
# every build that does not change package.json or the lockfile.
FROM base AS deps
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN --mount=type=cache,id=pnpm,target=/pnpm/store \
    pnpm install --frozen-lockfile

FROM base AS builder
ENV NEXT_TELEMETRY_DISABLED=1
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# No database, no bucket and no secrets are available here, and none are
# needed: every module that reads the environment does so lazily, so the build
# only compiles (src/db/client.ts and lib/storage.ts document that contract).
RUN pnpm build

FROM node:${NODE_VERSION}-slim AS runner
WORKDIR /app
# Explicit, not inherited: `next start` sets this itself, but a script run
# inside the container (pnpm db:seed) refuses to run without it (#17).
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000 \
    HOSTNAME=0.0.0.0

# The node image ships an unprivileged `node` user (uid 1000); nothing here
# needs root.
USER node

# standalone carries its own minimal server.js and only the traced files, so
# there is no node_modules install and no build toolchain in this layer.
# `public` and `.next/static` are NOT copied by standalone — the reference is
# explicit about it — and without them every asset 404s.
#
# Ownership is split rather than uniform. The standalone tree belongs to the
# runtime user because Next writes its prerender cache INSIDE it at runtime
# (`.next/server/app/<route>.segments`); a root-owned tree looks like sensible
# hardening and instead produces a stream of EACCES at runtime, with pages
# re-rendered on every request. Found in the deployed log on 05.09.2026.
# `static` and `public` are only ever read, so they stay root-owned.
COPY --from=builder --chown=node:node /app/.next/standalone ./
COPY --from=builder --chown=root:root /app/.next/static ./.next/static
COPY --from=builder --chown=root:root /app/public ./public

# #53: the migrations and the program that applies them travel WITH the code
# that needs them, so a deployment can bring the schema up before the new
# container serves anything. Read-only, hence root-owned. `drizzle-orm` is not
# traced into standalone by the app alone — the migrator is imported by
# nothing the pages reach — so next.config.ts includes it explicitly, the same
# way it does for sharp.
COPY --from=builder --chown=root:root /app/drizzle ./drizzle
COPY --from=builder --chown=root:root /app/deploy/migrate.mjs ./migrate.mjs

EXPOSE 3000

# No curl in a slim image, and none is worth adding: Node can ask for itself.
# Any answer that is not a server error means the process is serving.
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
    CMD node -e "fetch('http://127.0.0.1:'+process.env.PORT+'/').then(r=>process.exit(r.status<500?0:1)).catch(()=>process.exit(1))"

CMD ["node", "server.js"]
