# Architecture — ProjectFlow

Modular monolith, not microservices (see `docs/TECHNOLOGY_DECISIONS.md` for why).

```
                 +-------------------+        +--------------------+
                 |  apps/web         |        |  apps/mobile       |
                 |  Next.js (App     |        |  Expo React Native |
                 |  Router), Tailwind|        |  Expo Router       |
                 +---------+---------+        +----------+---------+
                           |  REST + WebSocket             |
                           v                                v
                        +----------------------------------------+
                        |          apps/api (Express)            |
                        |  routes -> controllers -> services     |
                        |          -> Prisma repositories         |
                        |  Socket.io (in-app notifications)       |
                        +--------------------+--------------------+
                                             |
                           +-----------------+------------------+
                           |                                    |
                           v                                    v
                 +-------------------+              +------------------------+
                 |   PostgreSQL      |<-------------->  apps/api/worker       |
                 |   (Docker volume) |   same schema  |  reminder scheduler + |
                 +-------------------+   via Prisma   |  notification outbox  |
                                                       |  dispatcher           |
                                                       +------------------------+
                                                                 |
                                               +------------------+------------------+
                                               |                  |                  |
                                               v                  v                  v
                                          Email (SMTP)       WhatsApp (stub)     Web/Mobile Push (stub)
```

`packages/shared` holds Zod request/response schemas, derived TypeScript types, and a
typed `fetch`-based API client. `apps/web` and `apps/mobile` both depend on it so a
field renamed in one place is a compile error everywhere else — this is the "shared
TypeScript packages" requirement from the brief, applied to logic/contracts rather than
to UI (web and mobile UIs are deliberately platform-specific, see
`docs/TECHNOLOGY_DECISIONS.md`).

## Backend internal layering (`apps/api/src`)

```
src/
  modules/
    auth/            routes, service, jwt + bcrypt
    projects/        routes, service (computes progress/duration), repository
    tasks/
    checklists/      items, templates
    reminders/       reminder CRUD + occurrence CRUD (snooze/complete)
    notifications/   in-app list, Socket.io gateway
    email/           thread linking, EML/MSG import, OAuth adapter interfaces
    dashboard/       summary + my-day aggregation queries
  worker/
    scheduler.ts     claims due occurrences (FOR UPDATE SKIP LOCKED), creates next
                     recurrence, writes outbox rows
    dispatcher.ts    processes NotificationOutbox, calls channel adapters, retries
    channels/
      inApp.ts  email.ts  whatsapp.ts  push.ts  browserPush.ts
  lib/
    prisma.ts  logger.ts  auth-middleware.ts  error-handler.ts  timezone.ts
  app.ts          Express app wiring (no listen)
  server.ts       entrypoint for the API process (listen)
  worker-entry.ts entrypoint for the worker process
```

Business logic lives in `modules/*/service.ts`, never in route handlers, so it is
unit-testable without an HTTP server and reusable from the worker where needed (e.g.
"complete checklist item cancels reminders" is one service function called from both
the REST route and, in principle, a future bulk-import path).

## Why one repo, two runtime processes for the backend

`apps/api` builds to two entrypoints from the same codebase and `node_modules`:
`server.js` (HTTP API) and `worker-entry.js` (scheduler + dispatcher). They share the
Prisma client and the `modules/*/service.ts` business logic but run as separate Docker
containers/processes so a slow notification provider or a worker crash never takes the
API down, and vice versa.
