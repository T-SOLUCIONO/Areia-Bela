# The API.
#
# Runs compiled, on plain Node. It used to need ts-node because the workspace
# packages shipped TypeScript source with no build step, so `node dist/main.js`
# died on `Cannot find module .../packages/shared/src/constants`. Those packages
# now compile, and their `exports` map hands `dist` to Node and `src` to a dev
# server — so the image carries no TypeScript toolchain at all.

FROM node:22-slim AS base
ENV PNPM_HOME=/pnpm PATH=/pnpm:$PATH
# OpenSSL: Prisma's query engine links against it and the slim image has none.
RUN apt-get update \
  && apt-get install -y --no-install-recommends openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/*
RUN corepack enable && corepack prepare pnpm@9.15.9 --activate
WORKDIR /repo

# ---------------------------------------------------------------------------
FROM base AS deps

# Manifests before sources, so a change to a component does not re-download
# every dependency.
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml turbo.json ./
COPY apps/api/package.json apps/api/
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
RUN pnpm install --frozen-lockfile --filter @areia-bela/api...

# ---------------------------------------------------------------------------
FROM deps AS build

COPY packages/ packages/
COPY apps/api/ apps/api/

# The Prisma client is a build artefact, generated from the schema rather than
# committed. The engine it downloads is why this stage and the runtime share a
# base image.
RUN pnpm --filter @areia-bela/api exec prisma generate

# The shared packages first — `node dist/main.js` requires them as JavaScript —
# then the API itself. Turbo orders this through `dependsOn: ["^build"]`.
RUN pnpm --filter @areia-bela/api... build

# ---------------------------------------------------------------------------
FROM base AS runtime

ENV NODE_ENV=production
# Nest reads it; 3001 matches what CORS_ORIGINS and the web app expect.
ENV PORT=3001

COPY --from=build /repo /repo

# Not root. A container that only ever answers HTTP has no reason to be able to
# write to its own runtime.
RUN useradd --system --uid 1001 --create-home areia \
  && chown -R areia:areia /repo
USER areia

EXPOSE 3001

# Answers before the app is ready to take a booking, which is the point: an
# orchestrator that routes traffic to a container still opening its database
# pool sends the first guest an error.
HEALTHCHECK --interval=30s --timeout=5s --start-period=40s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||3001)+'/properties/areia-bela').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

WORKDIR /repo/apps/api

# Migrations are deliberately NOT run here. Two containers starting at once
# would race, and a migration that fails at boot leaves a crash loop instead of
# a clear error. `docs/deployment.md` runs them as their own step.
#
# Plain node, no package manager in the process tree: one less thing between a
# signal and the app that has to handle it.
CMD ["node", "dist/main.js"]
