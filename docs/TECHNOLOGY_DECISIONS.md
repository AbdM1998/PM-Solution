# Technology Decisions — ProjectFlow

This is a **personal** project/task management product (single user now, multi-user
capable later), not an enterprise system. The brief that seeded this project gave full
freedom to choose the stack as long as Web + Android + iOS all get a first-class
experience and reminders survive app/browser/server restarts. This document records
what was chosen and why, evaluated against the environment actually available on this
machine (checked during environment discovery, 2026-11-07):

- Node.js v24, npm 11 — present, modern.
- Git — present. GitHub CLI (`gh`) — **not installed**, no stored token. An SSH key
  (`~/.ssh/id_ed25519`) **is** already authorized with GitHub (user `AbdM1998`), so
  pushing to an *existing* repo works, but creating a brand-new repo needs either the
  user to create it once on github.com, or a PAT — this is the one external step this
  project cannot complete by itself.
- Docker Desktop — installed, daemon was not running; started during setup.
- PostgreSQL client (`psql`) — not installed locally; not needed, Postgres runs in Docker.
- Android SDK / `adb` — **not installed**. A real signed APK build is not possible on
  this machine without installing the Android SDK (multi-GB download). The mobile app
  is fully implemented and runnable via Expo (Metro bundler / Expo Go / web), which is
  the honest, verifiable alternative documented in the final delivery report.
- Xcode / macOS — not applicable (Windows machine). iOS project is prepared via Expo's
  managed workflow so a Mac can build it later; this is a hard platform constraint, not
  a shortcut.
- Java 1.8 — present but irrelevant to this stack (no Android Gradle build attempted).

## Chosen stack

| Layer | Technology | Why |
|---|---|---|
| Language | TypeScript everywhere | One language across backend, web, mobile, shared contracts — fastest path to a coherent product for a solo-maintained personal app. |
| Backend | Node.js + Express + Prisma | Simple, well-understood, no build-step surprises. Clean Architecture *principles* (domain/service/repository layering) without forcing .NET-style CQRS/MediatR ceremony the brief itself says is optional for a personal product. |
| Database | PostgreSQL (Docker) | Matches the brief exactly; relational integrity fits the Projects→Tasks→Checklists→Reminders graph well. |
| Reminder Engine | Separate Node worker process, DB-backed polling (not in-memory timers) | Satisfies "must survive browser/app/server restart" — occurrences live in Postgres (`ReminderOccurrence`), a worker polls `WHERE nextFireAt <= now() AND status = 'pending'` on an index, claims rows with an atomic `UPDATE ... RETURNING` (prevents two workers double-processing), and writes to a `NotificationOutbox` table dispatched independently. |
| Realtime | Socket.io | In-app "due now" notifications without needing a separate message broker. |
| Web | Next.js (App Router) + Tailwind CSS | Professional desktop dashboard/calendar/drag-and-drop experience; also serves a perfectly usable responsive mobile-browser fallback. |
| Mobile | Expo + React Native + Expo Router | One codebase for Android + iOS, real native navigation/notifications (not a WebView), buildable without native Android Studio/Xcode setup during development (`expo start`), EAS Build documented for a real APK/IPA. |
| Shared contracts | `packages/shared` (Zod schemas + TS types + typed fetch client) | Web and mobile both import the same request/response types and validation rules — the thing the brief calls "shared TypeScript packages." |
| Background jobs | `node-cron`-driven polling loop in a dedicated worker, not a GUI/browser timer | No in-memory scheduling of persistent reminders, as required. |
| Auth | JWT (access + refresh) + bcrypt password hashing | Simple, framework-agnostic, works identically for web and mobile clients. |
| Email import | `mailparser` (EML) + `@kenjiuno/msgreader` (MSG) for drag-and-drop import; Microsoft Graph / Gmail API **adapter interfaces** implemented, not wired to live OAuth (no app registration / client secret exists for this user yet — see final report). |
| WhatsApp | Adapter interface matching WhatsApp Business Cloud API's message shape, **not live** — requires a WhatsApp Business account, verified number and approved templates that don't exist yet. |
| Containerization | Docker Compose: `postgres`, `api`, `worker`, `web` | Matches the brief's deployment requirement; one command (`docker compose up`) runs the whole stack. |

## Explicitly rejected (per brief + YAGNI for a personal app)

- Microservices — modular monolith instead.
- Redis / Kubernetes — no measured need yet; the worker's polling query is indexed and
  batched, so a single Postgres instance is enough at this scale.
- A full in-app email client — only import/linking, not Outlook/Gmail reimplementation.
- Building/forcing identical UI components across web and mobile — shared *logic and
  types*, platform-appropriate UI on each.

## Honesty rule carried through this whole project

Nothing in this codebase claims an external integration (WhatsApp, Outlook OAuth, Gmail
OAuth, push-notification delivery to a real device, GitHub push) works unless it was
actually exercised against a real account/service during this session. Where that
wasn't possible without credentials this machine doesn't have, the adapter/interface is
implemented and the gap is called out in `docs/FINAL_DELIVERY_REPORT.md`, never papered
over.
