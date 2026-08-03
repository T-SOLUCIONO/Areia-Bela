# The guest site and the panel.
#
# Built as a Next standalone bundle: Next traces the files the server actually
# reaches and copies them, so the final image carries a runtime rather than a
# `node_modules`. In a pnpm workspace that is 78 MB against well over a
# gigabyte.

FROM node:22-slim AS base
ENV PNPM_HOME=/pnpm PATH=/pnpm:$PATH
RUN corepack enable && corepack prepare pnpm@9.15.9 --activate
WORKDIR /repo

# ---------------------------------------------------------------------------
FROM base AS deps

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml turbo.json ./
COPY apps/web/package.json apps/web/
COPY packages/shared/package.json packages/shared/
COPY packages/types/package.json packages/types/
COPY packages/utils/package.json packages/utils/
COPY packages/ui/package.json packages/ui/
COPY packages/config/package.json packages/config/

# Sin `--mount=type=cache`: esa sintaxis es de BuildKit y el constructor
# clásico de Cloud Build la rechaza de plano. Lo que ahorraba era volver a
# descargar paquetes entre builds; el caché de capas de Docker ya cubre el caso
# habitual —los manifiestos no cambian, la capa se reutiliza— y una imagen que
# no se puede construir no ahorra nada.
RUN pnpm install --frozen-lockfile --filter @areia-bela/web...

# ---------------------------------------------------------------------------
FROM deps AS build

COPY packages/ packages/
COPY apps/web/ apps/web/

# Baked in, not read at runtime.
#
# Anything a browser reads is compiled into the bundle at build time, so the
# API's address is fixed when the image is built. Pointing an image at a
# different API means building another image — surprising, and the reason it is
# written down here rather than discovered in production.
ARG NEXT_PUBLIC_API_URL
ARG NEXT_PUBLIC_SITE_URL
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_SITE_URL=$NEXT_PUBLIC_SITE_URL
ENV NEXT_TELEMETRY_DISABLED=1

RUN pnpm --filter @areia-bela/web build

# ---------------------------------------------------------------------------
FROM base AS runtime

ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME=0.0.0.0
ENV NEXT_TELEMETRY_DISABLED=1

RUN useradd --system --uid 1001 --create-home areia
WORKDIR /app

# Three pieces, and only three: the traced server, the hashed assets, and what
# is served verbatim.
COPY --from=build --chown=areia:areia /repo/apps/web/.next/standalone ./
COPY --from=build --chown=areia:areia /repo/apps/web/.next/static ./apps/web/.next/static
COPY --from=build --chown=areia:areia /repo/apps/web/public ./apps/web/public

USER areia
EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||3000)+'/es').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

# The path standalone writes for a workspace app, mirroring the repo layout.
CMD ["node", "apps/web/server.js"]
