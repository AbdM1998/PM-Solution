# ProjectFlow — local, offline deployment

For a single non-technical user on one PC, no internet connection, nothing to install
beyond what's described here. Everything — database, backend, reminder engine, and
website — runs locally and never touches the internet at runtime.

**To use it (once set up):** double-click `ProjectFlow.exe` (a real compiled program —
`start.bat` also still works, doing the exact same thing, if you'd rather run that).
It opens your browser automatically. The first run takes a little longer (it
initializes the local database); every run after that is fast. To let your phone see
the same data, make sure it's on the same WiFi as this PC, then open the "On your
PHONE" address
`start.bat` prints.

**Windows may show a SmartScreen warning** the first time `ProjectFlow.exe` runs,
since it isn't digitally signed (that costs money and isn't needed for personal use).
Click "More info" → "Run anyway" — this is normal for any unsigned program, not a
sign that anything is wrong.

## What's NOT committed to git, and why

`pg-portable/`, `node-portable/`, `app/`, and `pg-data/` are gitignored — they're
~1.5GB of downloaded binaries and build output, not source. `local.env` (generated
secrets) is also gitignored since it's per-machine. This folder works right now on
the machine it was built on; the steps below regenerate it on a fresh machine.

## Regenerating this package from source

1. **Portable PostgreSQL** (no installer): download the Windows x64 binaries ZIP from
   the official PostgreSQL downloads page (EnterpriseDB), extract it so you have
   `pg-portable/pgsql/bin/postgres.exe` etc.
2. **Portable Node.js** (no installer): download the Windows x64 ZIP matching the
   version in the repo root's `package.json` engines field from nodejs.org/dist/,
   extract it to `node-portable/`.
3. **Build the app** from the repo root:
   ```
   npm ci
   npm run build
   ```
4. **Assemble `app/`** — a clean, production-only copy of the built API/worker plus
   a self-contained Next.js server (see `apps/web/next.config.js`'s
   `output: "standalone"`):
   - `app/api/`: copy `apps/api/dist/`, `apps/api/prisma/`, and a production-only
     `node_modules` (built with `npm ci --omit=dev` against a temp copy of just the
     workspace manifests — see git history for the exact steps that produced this).
     Then run `npx prisma generate --schema prisma/schema.prisma` inside it.
   - `app/web/`: copy `apps/web/.next/standalone/*` into `app/web/` (this is the
     top-level `node_modules` + `apps/web/{package.json,server.js,.next}` +
     `packages/shared`). **Use a copy method that includes dotfiles/dotdirs** — a
     plain shell glob (`cp -r .../standalone/* dest/`) silently skips `.next` since
     it starts with a dot, which was a real bug here: the resulting build then fails
     at startup with "Could not find a production build in the './.next' directory"
     because `.next` (containing `BUILD_ID`, the routes manifest, etc.) never
     actually got copied. Copy `.next` explicitly as its own step if your tool has
     the same glob behavior.
   - Then also copy `apps/web/.next/static` and `apps/web/public` into
     `app/web/apps/web/.next/static` and `app/web/apps/web/public` respectively
     (Next's standalone output doesn't include these by default).
   - `app/packages/shared/`: copy `packages/shared/dist/`.
   - **Before building the web app**, set `NEXT_PUBLIC_API_BASE_URL=/api` and
     `API_INTERNAL_URL=http://127.0.0.1:4100` as environment variables — Next.js bakes
     both into the build output at build time, not at runtime. Getting this wrong
     produces a build that silently tries to reach the wrong API address.
   - **If you build from Git Bash**, prefix the command with `MSYS_NO_PATHCONV=1`.
     Otherwise MSYS rewrites `/api` into `C:/Program Files/Git/api` before Next.js
     sees it, and every request from the app fails with "Could not reach the server"
     even though the server is healthy (this exact bug shipped once). Check with
     `grep -rl "Program Files/Git" apps/web/.next/static` — it must find nothing.
5. **Compile `ProjectFlow.exe`** from `launcher.js` (a plain Node script — the same
   startup logic as `start.bat`, just in JS so it can be compiled):
   ```
   npm install -g pkg
   npx pkg launcher.js --targets node18-win-x64 --output ProjectFlow.exe
   ```
   `start.bat` is kept too, as a fallback that needs no compile step.
6. Run `ProjectFlow.exe` (or `start.bat`). First run initializes the database; after
   that, it just starts.

## Known limits

- Tested only on this one Windows machine. The LAN-IP detection specifically prefers
  a `192.168.x.x` address (this machine's real WiFi range) over WSL/Hyper-V virtual
  adapters — on a different network layout this heuristic may need adjusting.
- `5433` / `4100` / `3100` (Postgres / API / web ports) were chosen to avoid
  conflicting with other things already running on this machine. Change
  `PG_PORT`/`API_PORT`/`WEB_PORT` at the top of `start.bat` if any of these collide
  with something on yours.
