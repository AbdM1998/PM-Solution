# ProjectFlow — Final Delivery Report

This report follows the original brief's "Definition of Done" rule: distinguish clearly
between **implemented and verified** (I ran it and watched it work), **implemented but
unverified** (code exists, builds, but I could not exercise it end-to-end), and
**stubbed by design** (no fake success — the adapter exists and clearly reports it is
not live).

## 0. Local, fully offline deployment (added after initial delivery)

A separate deployment mode exists for a single non-technical user with **no internet
connection and nothing new to install**: [local/start.bat](../local/start.bat). It
bundles:

- Portable PostgreSQL 16.15 (official EDB binaries ZIP, no installer, no admin rights,
  no Windows service registration)
- Portable Node.js 24 (official ZIP, no installer)
- The compiled API, worker, and Next.js web app (standalone output)

Double-clicking `start.bat` initializes the local database on first run only, applies
migrations, starts all three processes bound to `0.0.0.0`, and opens the browser —
genuinely zero Docker and zero internet access required at runtime. It also prints the
PC's real WiFi/Ethernet LAN IP so a phone on the same network can open the same app
and see the same data.

**Real bugs found and fixed while building this** (each confirmed by actually running
the thing and watching it fail first):
- The channels field on `Reminder` was a native Postgres array, which SQLite (briefly
  considered as an alternative engine, then abandoned — see below) can't represent;
  converted it to a JSON-encoded string column instead, with a migration that
  preserves existing data rather than dropping it.
- `Reminder.channels` being a Postgres array was never actually the blocker for this
  deployment mode (Postgres itself runs fine portably) — the real reason to keep the
  JSON-string conversion was to keep the schema change already made; the *actual*
  path taken for "local/offline" is portable **Postgres**, not SQLite (see below).
- Host port collisions with unrelated local apps/services (the same `localhost:3000`
  app encountered earlier) — the launcher uses 5433/4100/3100, chosen to avoid every
  port already in use on this machine.
- The Next.js standalone server's real entry point is nested at `apps/web/server.js`
  within the standalone output, not at the top level — the launcher pointed at the
  wrong path until corrected.
- **Next.js bakes `next.config.js`'s `rewrites()` destination into the build output at
  build time** — setting `API_INTERNAL_URL` at runtime (the approach that works for
  environment variables read inside request handlers) silently has no effect on the
  routing manifest. Had to rebuild with the correct value set as a build-time env var.
  `NEXT_PUBLIC_API_BASE_URL` has the same build-time-only behavior (it's inlined into
  the client bundle).
- `ipconfig`'s first non-loopback IPv4 address was a WSL virtual adapter
  (`172.31.48.1`), not the real WiFi adapter a phone could actually reach — the
  launcher now prefers a `192.168.x.x` address specifically.
- The batch script's `timeout` command resolved to a Unix-coreutils `timeout` earlier
  on PATH (from dev tooling) instead of Windows' own, which takes different flags —
  replaced with a `ping`-based wait, which has no such ambiguity.

**An earlier SQLite attempt was abandoned**: the installed Prisma version's SQLite
connector doesn't support the `Json` column type or native `enum`s at all, which would
have meant rewriting every enum field and every JSON field across the entire schema —
far more invasive than switching deployment *packaging* while keeping Postgres as the
database engine, which is what was actually shipped.

**Not yet done**: the web/mobile UI forms still don't expose the per-reminder custom
contact fields (`targetEmail`/`targetWhatsappNumber`) added earlier — only the API
supports them so far.

## 1. What actually happened overnight

The single biggest blocker was not the application code — it was **Docker Desktop
never starting**, for three separate, compounding reasons, discovered and fixed one at
a time by direct diagnosis (not guesswork):

1. **Stale AF_UNIX socket files.** Docker's Inference-manager and Secrets-Engine
   sockets (`%LOCALAPPDATA%\Docker\run\dockerInference`,
   `%LOCALAPPDATA%\docker-secrets-engine\engine.sock`) were left as broken NTFS
   reparse points from an earlier unclean shutdown. Every launch tried to remove them
   and failed with "The filename, directory name, or volume label syntax is
   incorrect." Fixed by renaming the parent directories aside (direct deletion of the
   reparse points themselves was refused by Windows).
2. **Docker's own "Docker AI" feature (`EnableDockerAI`).** Even after clearing stale
   files, a *freshly created* Inference-manager socket hit the same unlock error on
   every single launch — a reproducible bug with that specific feature on this
   machine, not staleness. Disabled it in
   `%APPDATA%\Docker\settings-store.json` (`EnableDockerAI: false`); unrelated to
   anything our stack needs.
3. **The C: drive was completely full (0 GB free)**, which made Docker's WSL2 VM disk
   go read-only mid-build. Found via `Get-PSDrive`. With your explicit go-ahead, I
   freed 24.65 GB by deleting only `~/.lmstudio/models` (left your conversations,
   credentials, and projects untouched), then restarted the WSL distro cleanly.

Once Docker was actually reachable, four more **real, reproducible bugs** surfaced —
all fixed, not worked around:

| # | Bug | Fix |
|---|-----|-----|
| 1 | `apps/api/Dockerfile` ran `tsc` **before** `prisma generate`, so the backend compiled against an empty/stub Prisma Client inside Docker (worked locally only because a generated client already existed on disk from earlier dev runs). | Reordered: `prisma generate` now runs before `npm run build --workspace apps/api`. |
| 2 | No Prisma migration had ever been created — `apps/api/prisma/migrations/` didn't exist at all (blocked all night by Docker being down, so no one had ever run `prisma migrate dev` against a reachable Postgres). | Generated the real initial migration (`20261108053834_init`) against the live database; it applied cleanly. |
| 3 | `schema.prisma`'s `generator client` block had no `binaryTargets`; the Docker builder stage has no `openssl` binary to let Prisma auto-detect the right engine, so it silently defaulted to `debian-openssl-1.1.x` while the runtime needs `debian-openssl-3.0.x` → crash on container start. | Added `binaryTargets = ["native", "debian-openssl-3.0.x"]`. |
| 4 | A **second, stale `.env`** existed at `apps/api/.env` (left over from an agent's local-dev testing) with the old placeholder DB password — Prisma reads this one preferentially over the repo-root `.env`, so my generated real password was being silently shadowed. | Updated both `.env` files to match. |

And three **environment/networking bugs**, found only by actually clicking through the
running app in a browser (none of these were visible from code review or a clean
build):

| # | Bug | Fix |
|---|-----|-----|
| 5 | This machine resolves `localhost` via IPv6 first, and that path hangs/fails for Docker-published ports (Postgres, then the browser's own API calls). | Switched `DATABASE_URL` and `NEXT_PUBLIC_API_BASE_URL` to `127.0.0.1`. |
| 6 | The `web` service's container loaded the **shared root `.env`**, which includes `PORT=4000` (the API's port) — Next.js inherited it and bound to 4000 instead of 3000 inside its own container, so nothing was listening on the published port at all (the container reported `unhealthy`). | Added an explicit `PORT: 3000` override in `docker-compose.yml`'s `web` service. |
| 7 | Host port **3000 is already used by an unrelated app of yours** ("Digital Demands hub") — my first browser check actually loaded *that* app, not ProjectFlow. | Remapped ProjectFlow's web service to host port **3001** (`3001:3000`); your other app on 3000 was never touched. |
| 8 | `WEB_ORIGIN` in `.env` was still `http://localhost:3000`; the browser's real origin is `http://127.0.0.1:3001`, so the API's CORS check rejected every request with no `Access-Control-Allow-Origin` header. | Updated `WEB_ORIGIN` to `http://127.0.0.1:3001`. |

Also replaced the placeholder secrets that had been copied verbatim from
`.env.example` (`JWT_SECRET`, `ENCRYPTION_KEY`, `POSTGRES_PASSWORD`) with real random
values. `.env` and `apps/api/.env` are both confirmed gitignored — nothing was
committed.

## 2. Implemented and verified (I ran it and watched it work)

- **Full Docker stack actually running together**: `docker compose up` brings up
  `postgres` (healthy), `api` (healthy), `worker`, `web` (healthy) — confirmed via
  `docker compose ps`.
- **Backend test suite: 59/59 tests passing, for real, against the live
  containerized Postgres** (not mocked) — `npm test --workspace apps/api`, 7 test
  files: scheduler locking/idempotency, dispatcher retry/backoff, reminder-engine
  invariants, IDOR protection (service- and HTTP-layer), email parsing, projects
  service, timezone handling, auth flow.
- **A genuine end-to-end user journey**, exercised via real HTTP calls to the running
  API and then confirmed in the actual web UI:
  1. Registered a user, got a real JWT.
  2. Created a project → task → nested checklist item.
  3. Created a `ONE_TIME` reminder ~20s out. **The real worker container claimed it on
     its own schedule and marked it `SENT`** — not simulated, the actual
     scheduler/dispatcher tick in the running container did this.
  4. Confirmed a real in-app notification was generated: *"Final QA pass" in E2E
     Launch Plan is due now.*
  5. **Snooze invariant verified**: snoozing an occurrence changed `nextFireAt` and
     left the task's `dueDate` completely untouched.
  6. **Completion-cancellation invariant verified**: completing the checklist item
     cancelled its still-pending future reminder occurrence (`PENDING` → `CANCELLED`).
  7. Logged into the web app as the seeded dev user (`dev@projectflow.local` /
     `DevPassword123!`) and confirmed the Dashboard and a Project detail page render
     real data from the real database, including server-computed fields (duration,
     days elapsed/remaining, completion %).
- **Backend**: builds clean (`tsc --noEmit`, `prisma validate`), Auth, Projects,
  Tasks, nested Checklists, Reminder Engine (scheduler + dispatcher as two processes
  from one image), Email import, Tags, Notifications, Dashboard/My Day — all code
  paths above are the ones actually exercised by the test suite and/or the manual
  walkthrough.
- **Web app** (Next.js 16 / React 19): builds, lints clean, and is now confirmed
  working live in a browser — Dashboard, Project detail with Tasks tab, login/auth
  redirect flow.
- **Docker/CI infra**: `docker-compose.yml`, both Dockerfiles, and
  `.github/workflows/ci.yml` exist and the local compose stack is now confirmed to
  actually build and run end-to-end (this was the one thing the devops agent could
  not verify overnight, because Docker itself was never reachable).

## 3. Implemented but not verified by me

- **Mobile app** (Expo/React Native) — update: actually run and clicked through in a
  browser (`expo start --web`) after this report was first written. Two more real bugs
  surfaced only by doing that, both fixed:
  - The `(auth)` route group had no `index.tsx`, so landing on it directly (the normal
    signed-out redirect target) showed "Unmatched Route" instead of the login screen.
    Added `src/app/(auth)/index.tsx` redirecting to `/(auth)/login`.
  - `useNotificationRouter` called `Notifications.getLastNotificationResponseAsync()`
    unconditionally on mount; that API throws "not supported on web" on the web
    platform, crashing the entire app behind an error overlay before anything could
    render. Guarded it with `Platform.OS === 'web'` (same convention already used in
    `src/lib/notifications.ts`).
  
  After both fixes: logged in as the seeded dev user and confirmed the "Today" (My
  Day) screen renders real live data from the same backend (active project count,
  due-today task). Still not run on an actual iOS/Android device or emulator — only
  the web preview.
- **Web UI beyond the two pages above**: My Day, Calendar, Reminders UI, checklist
  drag-and-drop, template application, tag picker, email-thread linking UI — these
  exist in code and passed `npm run build`/`lint`, but I did not click through them
  this session (time was spent getting the stack to run at all, then proving the
  core reminder-engine promise end-to-end).
- **CI workflow**: the GitHub Actions file exists and was validated by the devops
  agent against a Postgres service container in its own run, but has never executed
  on GitHub itself (no repo pushed yet — see below).
- **`docker compose build` for the full multi-stage pipeline under load**: verified
  working now, but only after several real fixes above; if you add new dependencies
  later, rebuild and watch for the same class of issue (Prisma generation ordering,
  binary targets) rather than assuming it will "just work" again.

## 4. Stubbed by design (no fake success)

Per the brief's explicit instruction: these report their own gap rather than
pretending to work.

- **Outlook (Microsoft Graph) and Gmail OAuth**: endpoints exist, return `501` with
  the exact environment variable names needed to go live.
- **WhatsApp Business Cloud API, Web Push (VAPID), FCM**: adapters exist; with no
  credentials configured, they log "not configured — no-op" and mark the delivery
  `simulated: true` — confirmed directly in this session's test output, e.g.
  `"WhatsApp not configured — no-op (would have sent)"`. They never claim a message
  was actually sent.
- **SMTP email channel**: same pattern — logs the email instead of sending when
  `SMTP_HOST` is unset.

## 5. Still blocked on you

- **GitHub push.** `gh` is installed but not authenticated (`gh auth login` needs an
  interactive browser flow I can't complete for you), and there's no existing GitHub
  remote. Give me either:
  - an empty repo URL you've created on github.com, or
  - a personal access token,

  and I'll push everything (current branch has one commit, `a7fe3f4`; everything
  built this session is still uncommitted locally, ready to be reviewed and
  committed).
- **A local machine setting changed**: `EnableDockerAI` was set to `false` in Docker
  Desktop's own settings (not part of this repo) to work around the crash loop
  described above. If you use Docker's AI/model-runner feature for other projects,
  you'll want to know it's now off — the real fix (whatever Docker ships to resolve
  that socket bug) would let you turn it back on.
- **~26 GB of LM Studio model weights were deleted** (`~/.lmstudio/models`) with your
  explicit go-ahead, to unblock the completely-full C: drive. Your conversations,
  credentials, and project settings under `.lmstudio` were left alone.

## 6. Everything not committed yet

Nothing from this session has been committed — `git status` still shows the same
uncommitted tree as when this started (plus the fixes above). Recommend reviewing the
diff, then committing in a few logical chunks (backend / web / mobile / infra) rather
than one giant commit, before pushing.
