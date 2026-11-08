# Infrastructure — local Docker stack

Owner: devops-engineer role. Covers `docker-compose.yml`, `docker-compose.override.yml`,
`apps/api/Dockerfile`, `apps/web/Dockerfile`, and `.github/workflows/ci.yml`.

## Quick start

```bash
cp .env.example .env
# edit .env with real local values (DB password, JWT secret, encryption key, ...)
docker compose up --build
```

- `api` → http://localhost:4000 (health: `GET /health`)
- `web` → http://localhost:3000
- `postgres` → `localhost:5432` (see trade-off note below)

`docker-compose.override.yml` is picked up automatically alongside `docker-compose.yml`
and currently only loosens the restart policy for a friendlier foreground dev session.
Run `docker compose -f docker-compose.yml up --build` to skip it and get the
"prod-like" stack (`restart: unless-stopped` everywhere).

## `.env` is never committed

Every variable name the stack reads is already declared in `.env.example` at the repo
root. `docker-compose.yml` only ever reads `.env` (via Compose's automatic
root-`.env` substitution and each service's `env_file: .env`) — it never invents new
variable names. `.env` itself is gitignored (see root `.gitignore`); only
`.env.example` (with placeholder/blank values) is committed. If you add a new
variable, add it to `.env.example` first, with a comment, so the contract stays
documented and the repo never depends on an undocumented local file.

## Why `api`/`worker`'s `DATABASE_URL` differs from `.env.example`

`.env.example`'s `DATABASE_URL` uses `localhost`, which is correct for a process
running directly on the host (e.g. `npm run dev`) connecting to the Dockerized
Postgres through the published `5432` port. Inside the Compose network, containers
must reach Postgres by its service name instead. `docker-compose.yml` overrides just
this one variable for the `api` and `worker` services
(`postgresql://...@postgres:5432/...`), using the same `POSTGRES_USER` /
`POSTGRES_PASSWORD` / `POSTGRES_DB` names already in `.env.example` — nothing new is
invented, it's the same values re-pointed at the in-network hostname. Everything else
(`WEB_ORIGIN`, `NEXT_PUBLIC_API_BASE_URL`, etc.) is correct as-is in `.env.example`
because the *browser*, not a container, is the consumer of those values.

## `NEXT_PUBLIC_*` vars are a build-time concern

Next.js inlines `NEXT_PUBLIC_*` variables into the client bundle at build time, not at
container start. `docker-compose.yml` passes `NEXT_PUBLIC_API_BASE_URL` into the
`web` image as a `build.args` value sourced from `.env`. If you change it, rebuild
the image (`docker compose build web`) — restarting the container alone will not pick
up the new value.

## Why `postgres:5432` is published to the host

Convenience for local `psql`/GUI-client access during development. Trade-off: this
opens the DB port on the host's network interfaces to anything that can reach this
machine, not just the other containers (which already reach Postgres over the
internal `projectflow-net` network without this). Fine for a single-developer local
machine; remove the `ports:` block on the `postgres` service before reusing this
compose file on a shared or internet-facing host.

## One image, two processes (`api` + `worker`)

`apps/api/Dockerfile` builds a single image used by both the `api` and `worker`
Compose services (same codebase, two entrypoints — see
`docs/ARCHITECTURE.md`). Its default `CMD` runs the API (`node dist/server.js`);
the `worker` service overrides `command:` to run `node dist/worker-entry.js` from
that same image instead, so only one image is ever built for both processes. The
image's baked-in `HEALTHCHECK` targets the API's `GET /health` endpoint, so it's
explicitly disabled (`healthcheck: disable: true`) on the `worker` service, which
has no HTTP port to probe.

## devDependencies are kept in the runtime images (not pruned)

Both `apps/api/Dockerfile` and `apps/web/Dockerfile` skip `npm prune --omit=dev` in
their runtime stage. For `api`, this is required: the `api` service's startup
command runs `prisma migrate deploy`, which needs the `prisma` CLI (conventionally a
devDependency). For `web`, it's a belt-and-suspenders consistency choice since
`next start` needs the full Next.js/React runtime either way in the common case.
Trade-off: bigger images than a fully-pruned production build. Acceptable for a
personal project's local stack; revisit if image size ever becomes a real constraint
(e.g. by explicitly listing `prisma` as a production dependency and pruning dev deps,
or using Next's `output: "standalone"`).

## Why both Dockerfiles copy ALL FOUR workspace manifests before `npm ci`

`apps/api/Dockerfile` and `apps/web/Dockerfile` each copy `apps/api/package.json`,
`apps/web/package.json`, `apps/mobile/package.json`, and
`packages/shared/package.json` before running `npm ci` — even though, say, the `api`
image only ever uses the `apps/api` and `packages/shared` source trees. This was not
a guess: a partial copy (only the manifests an image actually needs) was tested
directly (`npm ci` + `npm run build` against a scratch copy with only a subset of
workspace `package.json` files present) and it broke `packages/shared`'s own build
with `Cannot find name 'fetch'/'RequestInit'/'URLSearchParams'`. Root cause:
`packages/shared/package.json` has no direct `@types/node` devDependency of its own;
it relies on `@types/node` being hoisted to the root `node_modules` from
`apps/api`'s/`apps/web`'s devDependencies. `npm ci` is lockfile-driven and replays the
exact hoisting shape recorded in `package-lock.json` — which was computed against all
four workspaces — so a partial manifest copy makes it hoist differently and lands
`@types/node` somewhere `tsc` can't see for `packages/shared`. Copying every
workspace's manifest (cheap: they're just `package.json` files) makes `npm ci`
resolve identically to the one at the repo root, every time. (If `packages/shared`
ever adds its own `@types/node` devDependency, this stops mattering, but copying all
four manifests costs nothing either way.)

## App-level issue found while verifying this, apparently since resolved upstream

While verifying the above by actually running the build steps locally (mirroring the
Dockerfiles, since Docker itself wasn't reachable this pass — see below),
`apps/web`'s `next build` type-check reproducibly failed with errors like
`'CheckCircle2' cannot be used as a JSX component` / a `ReactNode` type mismatch, and
a separate `eslint-config-next` / `next/dist/compiled/babel/eslint-parser`
module-resolution error. Root cause at the time: `apps/mobile`'s `package.json`
pinned `react@19.3.0` exactly (needed by `react-native@0.88.1`), while `apps/web`'s
pinned `react@^18.3.1` (needed by `next@^14.2.18`) — two conflicting ranges at the
workspace root, so npm hoisted React 19 to the repo root and nested a separate React
18 copy inside `apps/web/node_modules`; `lucide-react` (hoisted at the root, not
workspace-local) then type-checked against the wrong React version for apps/web's
own source. Verified reproducible twice: once against the full repo, once against an
isolated scratch copy mirroring exactly what `apps/web/Dockerfile` copies.

**Update: confirmed fixed.** `apps/web/package.json` now pins `next@^16.4.5` +
`react@^19.0.0` / `react-dom@^19.0.0` (bumped from 14/18), matching `apps/mobile`'s
React 19, and a full `npm run build --workspace apps/web` now completes cleanly
(Turbopack build, typecheck, static generation for all routes) — re-run and
confirmed in a later pass of this same task, after both the backend and frontend
engineers finished their in-progress work. No infra change was needed for this; it
was purely an application-dependency fix on the other side.

## Status as of this pass

See the devops-engineer task report (`D:\AI-Org\state\runs\PM-DOCKER-CI-001.md`) for
the full, command-by-command account, including a second verification pass done
after the backend/web engineers finished: `packages/shared`, `apps/api`, and
`apps/web` all now build cleanly (`npm run build --workspace <each>`), `apps/api`'s
`dist/server.js`/`dist/worker-entry.js` entrypoints exist exactly as this Dockerfile
and `docker-compose.yml` expect, and `apps/mobile` typechecks cleanly
(`npx tsc --noEmit -p apps/mobile/tsconfig.json`). `docker compose config` was run
successfully (it doesn't need the daemon) and fully validates the compose file,
including the override merge, the `api`/`worker` shared-image setup, the
`DATABASE_URL` override, and the disabled `worker` healthcheck. Docker Desktop's
daemon itself was unreachable for most of this task; by the end, Docker Desktop's
own processes were observed starting up (CPU-active), but `docker compose build`/
`up` were not confirmed successful before this report was filed — that's the one
remaining step for a follow-up pass once the engine finishes initializing.
