# ProjectFlow — Final Delivery Report

This report follows the original brief's "Definition of Done" rule: distinguish clearly
between **implemented and verified** (I ran it and watched it work), **implemented but
unverified** (code exists, builds, but I could not exercise it end-to-end), and
**stubbed by design** (no fake success — the adapter exists and clearly reports it is
not live).

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

- **Mobile app** (Expo/React Native): typechecks clean, `expo-doctor` 20/20, and
  `expo start --web` bundled every route with 0 errors — but I did not run it on an
  actual device or emulator, and did not click through its screens.
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
