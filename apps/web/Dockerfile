# ProjectFlow web (Next.js) image.
#
# IMPORTANT — build context is the REPO ROOT, not this directory:
#   docker build -f apps/web/Dockerfile -t projectflow-web:local .
# Same reasoning as apps/api/Dockerfile: npm workspaces + one root package-lock.json,
# and apps/web imports packages/shared (docs/ARCHITECTURE.md), which lives outside
# apps/web and must be inside the build context. docker-compose.yml is already wired
# for this (`context: .`, `dockerfile: apps/web/Dockerfile`).

ARG NODE_IMAGE=node:24.16.0-bookworm-slim

# ---------------------------------------------------------------------------------
# Stage 1: builder
# ---------------------------------------------------------------------------------
FROM ${NODE_IMAGE} AS builder
WORKDIR /repo

# ALL FOUR workspaces' manifests are copied here, not just apps/web +
# packages/shared, even though this image only needs those two — see the matching,
# more detailed comment in apps/api/Dockerfile. Verified empirically: `npm ci` with
# only a partial set of workspace manifests present hoists `@types/node` (which
# packages/shared's own build needs but doesn't declare itself) to a different
# location than a full install does, breaking packages/shared's `tsc` build.
COPY package.json package-lock.json ./
COPY apps/api/package.json apps/api/package.json
COPY apps/web/package.json apps/web/package.json
COPY apps/mobile/package.json apps/mobile/package.json
COPY packages/shared/package.json packages/shared/package.json

RUN npm ci
# `npm ci` here nests apps/web's own node_modules (confirmed locally: apps/web pins
# react@^18.3.1 for Next 14 while apps/mobile pins react@19.3.0 exactly for React
# Native — the two ranges conflict at the workspace root, so npm hoists React 19 to
# the repo root and nests apps/web's own React 18 + next copy inside
# apps/web/node_modules instead). The `COPY apps/web apps/web` below merges the real
# source into this already-existing apps/web/ directory rather than replacing it
# (how Docker's COPY behaves for an existing destination directory), so that nested
# node_modules survives into the final image, which is what `next start` needs.

COPY packages/shared packages/shared
COPY apps/web apps/web

# NEXT_PUBLIC_* variables are inlined into the client-side bundle at BUILD time, not
# read again at container start. docker-compose.yml passes this through as a
# `build.args` value sourced from .env (default below matches .env.example).
# NOTE for whoever is building the web app: if that ever changes, this image must be
# rebuilt, not just restarted, for the new value to take effect.
ARG NEXT_PUBLIC_API_BASE_URL=http://localhost:4000/api
ENV NEXT_PUBLIC_API_BASE_URL=${NEXT_PUBLIC_API_BASE_URL}

RUN npm run build --workspace packages/shared
RUN npm run build --workspace apps/web

# ---------------------------------------------------------------------------------
# Stage 2: runtime
# WORKDIR is /repo here too, matching the builder stage — see the matching comment
# in apps/api/Dockerfile. Verified empirically: on this Windows/npm combination,
# npm's workspace symlinks (node_modules/@projectflow/shared -> .../packages/shared)
# are written as ABSOLUTE paths tied to the cwd they were created in, so the
# runtime stage must reuse the same absolute path or those symlinks dangle after
# being copied.
# ---------------------------------------------------------------------------------
FROM ${NODE_IMAGE} AS runtime
ENV NODE_ENV=production
WORKDIR /repo

RUN groupadd --system --gid 1001 nodejs \
    && useradd --system --uid 1001 --gid nodejs --no-create-home --shell /usr/sbin/nologin webuser

# `next start` needs the full `next`/React runtime, so devDependencies are not
# pruned here either (consistent with apps/api/Dockerfile's reasoning) — `next` is
# conventionally a normal dependency anyway, but we don't assume that.
COPY --from=builder --chown=webuser:nodejs /repo/node_modules ./node_modules
COPY --from=builder --chown=webuser:nodejs /repo/package.json ./package.json
COPY --from=builder --chown=webuser:nodejs /repo/packages/shared ./packages/shared
COPY --from=builder --chown=webuser:nodejs /repo/apps/web ./apps/web

WORKDIR /repo/apps/web
USER webuser

ENV PORT=3000
EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD ["node", "-e", "fetch('http://127.0.0.1:3000/').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"]

CMD ["npm", "run", "start"]
