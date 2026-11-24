# ProjectFlow API / Worker image.
#
# This single image is used by BOTH the `api` and `worker` services in the root
# docker-compose.yml — only the runtime command differs (see compose file) — so we
# only ever build one image for the two processes described in docs/ARCHITECTURE.md
# ("Why one repo, two runtime processes for the backend").
#
# IMPORTANT — build context is the REPO ROOT, not this directory:
#   docker build -f apps/api/Dockerfile -t projectflow-api:local .
# This repo is an npm workspaces monorepo with a single root package-lock.json
# (lockfile discipline: `npm ci` needs that one lockfile, not a per-app one), so the
# Dockerfile has to be able to see apps/api + packages/shared + the root manifests
# together. docker-compose.yml is already wired for this (`context: .`,
# `dockerfile: apps/api/Dockerfile`).

ARG NODE_IMAGE=node:24.16.0-bookworm-slim

# ---------------------------------------------------------------------------------
# Stage 1: builder
# Installs the full workspace (including devDependencies — needed for `tsc` and the
# `prisma` CLI) and produces apps/api/dist.
# ---------------------------------------------------------------------------------
FROM ${NODE_IMAGE} AS builder
WORKDIR /repo

# Manifests only, first, for better layer caching. ALL FOUR workspaces' manifests
# are copied here, not just apps/api + packages/shared, even though this image only
# needs those two — verified empirically (by actually running `npm ci` against a
# deliberately partial copy of this repo): `npm ci` is lockfile-driven, and with only
# a subset of workspace package.json files present, it replays the *same* dependency
# tree shape as the full install but some hoisting lands differently (e.g. the
# root-hoisted `@types/node` that packages/shared's own build relies on — it has no
# direct devDependency on `@types/node` itself — was missing from node_modules with a
# partial copy, breaking `tsc`). Copying every workspace manifest makes this `npm ci`
# resolve identically to the one at the repo root.
COPY package.json package-lock.json ./
COPY apps/api/package.json apps/api/package.json
COPY apps/web/package.json apps/web/package.json
COPY apps/mobile/package.json apps/mobile/package.json
COPY packages/shared/package.json packages/shared/package.json

RUN npm ci
# `npm ci` here may nest a per-workspace node_modules (e.g. apps/api/node_modules,
# observed locally holding its own @types/typescript copies) when a workspace's own
# dependency range can't be satisfied by what's hoisted to the root — normal npm
# workspaces behavior. The `COPY apps/api apps/api` below merges the real source into
# this already-existing apps/api/ directory rather than replacing it (that's how
# Docker's COPY behaves for an existing destination directory), so any such nested
# node_modules survives into the final image alongside the source/build output.

# `prisma generate` validates the schema, which references env("DATABASE_URL"); it
# does not open a DB connection. This placeholder is only ever used at build time.
ENV DATABASE_URL="postgresql://build:build@localhost:5432/build"

COPY packages/shared packages/shared
COPY apps/api apps/api

# Build order matches the root package.json `build` script: shared contracts first.
RUN npm run build --workspace packages/shared
# Must run BEFORE `tsc` below: apps/api's own `build` script is just `tsc` (verified
# in apps/api/package.json — no prebuild/postinstall hook calls `prisma generate`),
# and apps/api's source imports types (ReminderChannel, NotificationOutbox, Prisma.sql,
# etc.) off the generated @prisma/client. Without this running first, tsc compiles
# against the unexpanded client stub and fails with "has no exported member X" for
# every Prisma model/enum. Found by actually running this build, not assumed.
RUN npx prisma generate --schema apps/api/prisma/schema.prisma
RUN npm run build --workspace apps/api

# ---------------------------------------------------------------------------------
# Stage 2: runtime
# Same base image/libc as the builder on purpose — avoids the classic Prisma engine
# mismatch you get from building on one OS/libc (e.g. Alpine/musl) and running on
# another (e.g. Debian/glibc).
#
# devDependencies are intentionally KEPT here (not pruned): docker-compose.yml runs
# `prisma migrate deploy` as part of the `api` service's startup command, and that
# needs the `prisma` CLI, which is conventionally a devDependency. Pruning it would
# silently break migrations on container start. Trade-off documented in
# infrastructure/README.md: bigger image, correct startup.
#
# WORKDIR is /repo here too, matching the builder stage — verified empirically (by
# actually running `npm ci` against this repo), npm's workspace symlinks
# (node_modules/@projectflow/shared -> .../packages/shared, etc.) on this
# Windows/npm combination are written as ABSOLUTE paths tied to the cwd they were
# created in, not relative ones. If this stage used a different WORKDIR (e.g.
# /app), those symlinks would survive the COPY but point at a path
# (/repo/packages/shared) that doesn't exist in this stage, i.e. silently dangle.
# Keeping the same absolute path in both stages sidesteps that entirely.
# ---------------------------------------------------------------------------------
FROM ${NODE_IMAGE} AS runtime
ENV NODE_ENV=production
WORKDIR /repo

# Prisma's query engine binary needs OpenSSL; the "-slim" base trims it out.
RUN apt-get update \
    && apt-get install -y --no-install-recommends openssl \
    && rm -rf /var/lib/apt/lists/*

RUN groupadd --system --gid 1001 nodejs \
    && useradd --system --uid 1001 --gid nodejs --no-create-home --shell /usr/sbin/nologin apiuser

# Hoisted workspace node_modules (contains the symlink to packages/shared) + the
# built apps/api tree (dist/, prisma/schema + migrations, package.json) + the shared
# package's own build output. (docs/ARCHITECTURE.md describes packages/shared as a
# web/mobile-only dependency, but apps/api's own package.json and source actually do
# import @projectflow/shared in several modules — confirmed by reading the real
# code, not just the doc — so this copy is required, not just defensive.)
COPY --from=builder --chown=apiuser:nodejs /repo/node_modules ./node_modules
COPY --from=builder --chown=apiuser:nodejs /repo/package.json ./package.json
COPY --from=builder --chown=apiuser:nodejs /repo/packages/shared ./packages/shared
COPY --from=builder --chown=apiuser:nodejs /repo/apps/api ./apps/api

# Uploaded files live here (STORAGE_ROOT defaults to ./storage). It must exist in the
# image owned by apiuser: a named volume mounted on it copies this ownership on first
# use — without it Docker creates the mount point as root and every upload fails with
# EACCES, since the process runs as the unprivileged apiuser.
RUN mkdir -p /repo/apps/api/storage && chown apiuser:nodejs /repo/apps/api/storage

WORKDIR /repo/apps/api
USER apiuser

EXPOSE 4000

HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD ["node", "-e", "fetch('http://127.0.0.1:4000/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"]

# Default command = start.sh: applies migrations, then the API — or, by PF_ROLE, the
# reminder engine alone ("worker") or both in one container ("all"). Hosts like
# Railway that just run the image's CMD get the right behavior from one variable.
# docker-compose files override `command:` explicitly, so they're unaffected.
CMD ["sh", "start.sh"]
