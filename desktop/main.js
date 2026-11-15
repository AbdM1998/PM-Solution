// ProjectFlow desktop app — Electron main process.
// Manages the local Postgres + API + reminder worker as hidden background processes
// (no console window ever appears — this is the whole point versus the start.bat /
// ProjectFlow.exe console launcher), and shows the app in a real app window instead
// of the user's own browser.
const { app, BrowserWindow, Tray, Menu } = require("electron");
const { spawn, fork } = require("child_process");
const fs = require("fs");
const path = require("path");
const os = require("os");
const crypto = require("crypto");
const net = require("net");

// Must run before app is ready / any session touches the network stack. Machines
// running a corporate VPN client (Ivanti, Cloudflare One, etc.) often configure a
// system proxy that intercepts ALL traffic including 127.0.0.1 — Chromium's renderer
// (unlike plain Node's http module, which ignores system proxy settings) honors that
// by default, so the app's own login/register fetch() calls, and even the window's own
// navigation to the app's page, can fail or hang indefinitely even though the local
// server is completely healthy. A --proxy-bypass-list alone wasn't reliable here, and
// this app never needs to reach the internet anyway (everything is local by design),
// so just disable proxying for the whole app outright.
app.commandLine.appendSwitch("no-proxy-server");

// app.isPackaged is false when running via `electron .` in dev, true inside the
// built installer — resourcesPath only exists/matters in the packaged app.
const RES = app.isPackaged ? process.resourcesPath : path.join(__dirname, "resources");
const USER_DATA = app.getPath("userData"); // e.g. %APPDATA%\ProjectFlow — writable, per-user, survives updates

const PG_BIN = path.join(RES, "pg-portable", "pgsql", "bin");
const PG_DATA = path.join(USER_DATA, "pg-data"); // lives outside the installed app's own (often read-only) folder
const API_DIR = path.join(RES, "app", "api");
const WEB_DIR = path.join(RES, "app", "web", "apps", "web");
const ENV_FILE = path.join(USER_DATA, "local.env");

const PG_PORT = 5433;
const API_PORT = 4100;
const WEB_PORT = 3100;

let mainWindow;
let tray;
let pgProcess;
let apiProcess;
let workerProcess;
let webProcess;

// Async, NOT spawnSync. spawnSync blocks the entire main process — including the
// window's message pump — until the child exits. If this machine's endpoint-security
// software (the same pattern behind the network-stack fixes above) delays or hangs
// any one of the child processes below, spawnSync would freeze the whole app with no
// recourse, which is exactly what "ProjectFlow (Not Responding)" looks like. An async
// spawn keeps the UI thread free the whole time, and a timeout means one stuck child
// process can no longer hang the app forever.
function runAsync(cmd, args, opts = {}) {
  return new Promise((resolve) => {
    const { spawn: spawnChild } = require("child_process");
    const timeoutMs = opts.timeout ?? 15000;
    const child = spawnChild(cmd, args, { windowsHide: true, ...opts });
    let stdout = "";
    child.stdout?.on("data", (d) => { stdout += d; });
    const timer = setTimeout(() => { try { child.kill(); } catch {} }, timeoutMs);
    child.on("close", (code) => { clearTimeout(timer); resolve({ status: code, stdout }); });
    child.on("error", () => { clearTimeout(timer); resolve({ status: null, stdout }); });
  });
}

function loadOrCreateSecrets() {
  if (!fs.existsSync(ENV_FILE)) {
    const secrets =
      `JWT_SECRET=${crypto.randomBytes(48).toString("base64url")}\n` +
      `ENCRYPTION_KEY=${crypto.randomBytes(32).toString("base64")}\n`;
    fs.mkdirSync(path.dirname(ENV_FILE), { recursive: true });
    fs.writeFileSync(ENV_FILE, secrets);
  }
  const vars = {};
  for (const line of fs.readFileSync(ENV_FILE, "utf-8").split("\n")) {
    const idx = line.indexOf("=");
    if (idx === -1) continue;
    vars[line.slice(0, idx).trim()] = line.slice(idx + 1).trim();
  }
  return vars;
}

function findLanIp() {
  const nets = os.networkInterfaces();
  const candidates = [];
  for (const addrs of Object.values(nets)) {
    for (const addr of addrs || []) {
      if (addr.family === "IPv4" && !addr.internal) candidates.push(addr.address);
    }
  }
  return candidates.find((ip) => ip.startsWith("192.168.")) ?? candidates[0] ?? null;
}

function tcpPortOpen(port, host = "127.0.0.1", timeoutMs = 1500) {
  // Plain TCP connect via Node's net module — NOT http/fetch. In Electron's main
  // process (unlike a standalone `ELECTRON_RUN_AS_NODE=1` script, which uses pure
  // Node), even `require("http")` requests get routed through Chromium's own network
  // service for consistency with the renderer — so they inherit the exact same
  // system/corporate-proxy interference (VPN clients like Ivanti, Cloudflare One) that
  // breaks renderer fetches, and can hang indefinitely even once the server is
  // actually healthy (confirmed with curl, and with a standalone ELECTRON_RUN_AS_NODE
  // script, both instant). A raw socket connect has no HTTP semantics for a proxy to
  // intercept, so it reliably answers "is something listening on this port yet".
  return new Promise((resolve) => {
    const socket = net.createConnection({ port, host, timeout: timeoutMs });
    socket.once("connect", () => { socket.destroy(); resolve(true); });
    socket.once("timeout", () => { socket.destroy(); resolve(false); });
    socket.once("error", () => resolve(false));
  });
}

async function waitForPort(port, timeoutMs = 30000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    if (await tcpPortOpen(port)) return true;
    await new Promise((r) => setTimeout(r, 400));
  }
  return false;
}

// Marks which bundled migrations have already been applied to this machine's
// database, so a normal launch can skip the slow one-time setup steps entirely
// instead of redoing them every single time the app starts.
const DB_INIT_MARKER = path.join(USER_DATA, "db-init.json");

function bundledMigrationNames() {
  const dir = path.join(API_DIR, "prisma", "migrations");
  try {
    return fs.readdirSync(dir, { withFileTypes: true })
      .filter((e) => e.isDirectory())
      .map((e) => e.name)
      .sort();
  } catch {
    return [];
  }
}

function readDbInitMarker() {
  try {
    return JSON.parse(fs.readFileSync(DB_INIT_MARKER, "utf-8"));
  } catch {
    return null;
  }
}

function writeDbInitMarker(migrations) {
  try {
    fs.writeFileSync(DB_INIT_MARKER, JSON.stringify({ migrations }));
  } catch {
    // non-fatal — worst case, the next launch just redoes the setup steps once
  }
}

async function startBackend(onStatus) {
  const firstTimeInit = !fs.existsSync(path.join(PG_DATA, "PG_VERSION"));
  if (firstTimeInit) {
    onStatus("Setting up your local database for the first time…");
    fs.mkdirSync(PG_DATA, { recursive: true });
    await runAsync(path.join(PG_BIN, "initdb.exe"), [
      "-D", PG_DATA, "--username=projectflow", "--auth=trust", "-E", "UTF8",
    ], { timeout: 30000 });
  }

  onStatus("Starting database…");
  pgProcess = spawn(
    path.join(PG_BIN, "postgres.exe"),
    ["-D", PG_DATA, "-p", String(PG_PORT), "-h", "0.0.0.0"],
    { windowsHide: true, stdio: "ignore" }
  );

  // postgres needs a moment after the process starts before it accepts connections —
  // poll with a raw TCP connect (see tcpPortOpen's comment — anything that spawns a
  // process or hits Chromium's network stack here is unreliable on this machine) and
  // a short interval, instead of spawning pg_isready.exe in a loop.
  for (let i = 0; i < 100; i++) {
    if (await tcpPortOpen(PG_PORT, "127.0.0.1", 300)) break;
    await new Promise((r) => setTimeout(r, 150));
  }

  const secrets = loadOrCreateSecrets();
  const databaseUrl = `postgresql://projectflow@127.0.0.1:${PG_PORT}/projectflow`;

  // The slow part of every launch used to be here unconditionally: spawning psql to
  // check the database exists, then spawning the Prisma CLI (which itself is a slow
  // cold start, easily 2-5s, worse under this machine's endpoint-security scanning of
  // every new process) to run `migrate deploy` — every single time, even though both
  // are no-ops after the very first successful run or after an unchanged update. Skip
  // both entirely once a marker confirms this machine is already on the bundled
  // migration set; only re-run them when that set actually changed (a real update) or
  // on a genuinely fresh install.
  const currentMigrations = bundledMigrationNames();
  const marker = readDbInitMarker();
  const upToDate = marker && JSON.stringify(marker.migrations) === JSON.stringify(currentMigrations);

  if (!upToDate) {
    const dbCheck = await runAsync(path.join(PG_BIN, "psql.exe"), [
      "-h", "127.0.0.1", "-p", String(PG_PORT), "-U", "projectflow", "-d", "postgres",
      "-tAc", "SELECT 1 FROM pg_database WHERE datname='projectflow'",
    ], { timeout: 10000 });
    if (!dbCheck.stdout?.toString().includes("1")) {
      onStatus("Creating application database…");
      await runAsync(path.join(PG_BIN, "createdb.exe"), [
        "-h", "127.0.0.1", "-p", String(PG_PORT), "-U", "projectflow", "projectflow",
      ], { timeout: 10000 });
    }

    onStatus("Applying database updates…");
    await runAsync(process.execPath, [
      path.join(API_DIR, "node_modules", "prisma", "build", "index.js"),
      "migrate", "deploy", "--schema", path.join("prisma", "schema.prisma"),
    ], { cwd: API_DIR, env: { ...process.env, ELECTRON_RUN_AS_NODE: "1", DATABASE_URL: databaseUrl }, timeout: 30000 });

    writeDbInitMarker(currentMigrations);
  }

  const lanIp = findLanIp();

  onStatus("Starting the app…");
  // fork (not spawn) + ELECTRON_RUN_AS_NODE: runs these as plain Node scripts using
  // Electron's own embedded Node runtime, so no separate portable Node install and no
  // console window is needed at all (Electron's own process has no console).
  apiProcess = fork(path.join(API_DIR, "dist", "server.js"), [], {
    cwd: API_DIR,
    silent: true,
    env: {
      ...process.env,
      ELECTRON_RUN_AS_NODE: "1",
      DATABASE_URL: databaseUrl,
      JWT_SECRET: secrets.JWT_SECRET,
      ENCRYPTION_KEY: secrets.ENCRYPTION_KEY,
      PORT: String(API_PORT),
      WEB_ORIGIN: `http://127.0.0.1:${WEB_PORT}`,
      MOBILE_ORIGIN: lanIp ? `http://${lanIp}:${WEB_PORT}` : "",
      SMTP_FROM: "ProjectFlow <abdalruhman.mustafa@gmail.com>",
    },
  });

  workerProcess = fork(path.join(API_DIR, "dist", "worker-entry.js"), [], {
    cwd: API_DIR,
    silent: true,
    env: { ...process.env, ELECTRON_RUN_AS_NODE: "1", DATABASE_URL: databaseUrl },
  });

  webProcess = fork(path.join(WEB_DIR, "server.js"), [], {
    cwd: WEB_DIR,
    silent: true,
    env: {
      ...process.env,
      ELECTRON_RUN_AS_NODE: "1",
      PORT: String(WEB_PORT),
      HOSTNAME: "127.0.0.1",
      API_INTERNAL_URL: `http://127.0.0.1:${API_PORT}`,
    },
  });

  onStatus("Waiting for the app to come online…");
  await waitForPort(WEB_PORT);
}

function stopBackend() {
  for (const p of [apiProcess, workerProcess, webProcess]) {
    try { p?.kill(); } catch {}
  }
  if (pgProcess) {
    // Graceful Postgres shutdown (SIGINT ~= "fast shutdown") so the data directory
    // is never left in a torn state between app launches.
    try { pgProcess.kill("SIGINT"); } catch {}
  }
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 860,
    minWidth: 900,
    minHeight: 600,
    title: "ProjectFlow",
    autoHideMenuBar: true,
    show: false,
    webPreferences: { contextIsolation: true },
  });

  mainWindow.once("ready-to-show", () => mainWindow.show());
  mainWindow.on("close", (e) => {
    // Hide to tray instead of quitting outright, so the backend (and the reminder
    // engine especially) keeps running in the background like a real installed app —
    // closing the window is not the same as "quit ProjectFlow".
    if (!app.isQuitting) {
      e.preventDefault();
      mainWindow.hide();
    }
  });

  return mainWindow;
}

function loadSplash(win) {
  win.loadURL(
    "data:text/html;charset=utf-8," +
      encodeURIComponent(`<!doctype html><html><head><meta charset="utf-8">
      <style>
        html,body{height:100%;margin:0;background:#4F46E5;display:flex;align-items:center;justify-content:center;
          font-family:system-ui,-apple-system,Segoe UI,sans-serif;color:#fff}
        .box{text-align:center}
        .spinner{width:36px;height:36px;border:4px solid rgba(255,255,255,.3);border-top-color:#fff;
          border-radius:50%;margin:0 auto 16px;animation:spin 1s linear infinite}
        @keyframes spin{to{transform:rotate(360deg)}}
      </style></head>
      <body><div class="box"><div class="spinner"></div><div id="status">Starting ProjectFlow…</div></div></body></html>`)
  );
}

app.whenReady().then(async () => {
  const win = createWindow();
  loadSplash(win);
  win.show();

  try {
    await startBackend((status) => {
      win.webContents.executeJavaScript(
        `document.getElementById('status') && (document.getElementById('status').innerText = ${JSON.stringify(status)})`
      ).catch(() => {});
    });
    // Chromium's own network process (used by loadURL, unlike the plain-socket
    // readiness check above) appears to be intermittently intercepted/delayed by
    // endpoint-security software on this machine — the exact same local server that
    // TCP-connects instantly sometimes takes loadURL several seconds, or one attempt,
    // to get through, and sometimes the call just hangs rather than rejecting (plain
    // retry-on-catch alone would then never get a second attempt). Race each attempt
    // against its own timeout, stop() the hung navigation, and try again.
    let loaded = false;
    let lastErr;
    for (let attempt = 1; attempt <= 8 && !loaded; attempt++) {
      try {
        await Promise.race([
          win.loadURL(`http://127.0.0.1:${WEB_PORT}`),
          new Promise((_, reject) => setTimeout(() => reject(new Error("loadURL timed out")), 5000)),
        ]);
        loaded = true;
      } catch (loadErr) {
        lastErr = loadErr;
        try { win.webContents.stop(); } catch {}
        await new Promise((r) => setTimeout(r, 1000));
      }
    }
    if (!loaded) {
      win.webContents.executeJavaScript(
        `document.getElementById('status') && (document.getElementById('status').innerText = ${JSON.stringify(
          "Could not load the app: " + (lastErr?.message || String(lastErr))
        )})`
      ).catch(() => {});
    }
  } catch (err) {
    win.webContents.executeJavaScript(
      `document.getElementById('status') && (document.getElementById('status').innerText = ${JSON.stringify(
        "Something went wrong starting ProjectFlow: " + (err?.message || String(err))
      )})`
    ).catch(() => {});
  }

  // Tray icon so a user who closed the window can reopen it or truly quit. This must
  // never throw — if it does, the app.on("activate") handler below never gets
  // registered, and a closed/hidden window becomes permanently unreachable (the exact
  // bug that made "I can't get back into it" happen: this used to pass a path to a
  // build/icon.png that didn't exist, which made `new Tray()` throw and silently skip
  // everything after it).
  try {
    tray = new Tray(path.join(__dirname, "build", "icon.png"));
    tray.setToolTip("ProjectFlow");
    tray.setContextMenu(
      Menu.buildFromTemplate([
        { label: "Open ProjectFlow", click: () => { mainWindow.show(); } },
        { type: "separator" },
        { label: "Quit ProjectFlow", click: () => { app.isQuitting = true; app.quit(); } },
      ])
    );
    tray.on("click", () => mainWindow.show());
  } catch (err) {
    console.error("Failed to create tray icon:", err);
  }

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
    else mainWindow.show();
  });
});

app.on("window-all-closed", () => {
  // Don't quit on window close (see the close handler above) — only an explicit
  // tray "Quit" sets app.isQuitting and actually exits.
});

app.on("before-quit", () => {
  app.isQuitting = true;
  stopBackend();
});
