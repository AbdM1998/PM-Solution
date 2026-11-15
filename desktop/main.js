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
const http = require("http");

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

function runSync(cmd, args, opts = {}) {
  const { spawnSync } = require("child_process");
  return spawnSync(cmd, args, { windowsHide: true, ...opts });
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

function httpStatusOnce(url) {
  // Plain Node http, not fetch: Electron's fetch goes through Chromium's network
  // stack, which picks up the system/corporate proxy config — on a machine with a
  // VPN client (Ivanti, Cloudflare One, etc.) that can route all traffic through a
  // proxy that can't reach 127.0.0.1, so fetch() here just hangs forever even once
  // the server is actually healthy (confirmed: curl to the same URL worked instantly
  // while this was stuck). Node's http module never consults that proxy config.
  return new Promise((resolve, reject) => {
    const req = http.get(url, { timeout: 2000 }, (res) => {
      res.resume();
      resolve(res.statusCode);
    });
    req.on("timeout", () => req.destroy(new Error("timeout")));
    req.on("error", reject);
  });
}

async function waitForHttp(url, timeoutMs = 30000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const status = await httpStatusOnce(url);
      if (status < 500) return true;
    } catch {
      // not up yet
    }
    await new Promise((r) => setTimeout(r, 400));
  }
  return false;
}

async function startBackend(onStatus) {
  if (!fs.existsSync(path.join(PG_DATA, "PG_VERSION"))) {
    onStatus("Setting up your local database for the first time…");
    fs.mkdirSync(PG_DATA, { recursive: true });
    runSync(path.join(PG_BIN, "initdb.exe"), [
      "-D", PG_DATA, "--username=projectflow", "--auth=trust", "-E", "UTF8",
    ]);
  }

  onStatus("Starting database…");
  pgProcess = spawn(
    path.join(PG_BIN, "postgres.exe"),
    ["-D", PG_DATA, "-p", String(PG_PORT), "-h", "0.0.0.0"],
    { windowsHide: true, stdio: "ignore" }
  );

  // postgres needs a moment after the process starts before it accepts connections —
  // poll with pg_isready rather than a fixed sleep.
  for (let i = 0; i < 40; i++) {
    const ready = runSync(path.join(PG_BIN, "pg_isready.exe"), ["-h", "127.0.0.1", "-p", String(PG_PORT)]);
    if (ready.status === 0) break;
    await new Promise((r) => setTimeout(r, 300));
  }

  const secrets = loadOrCreateSecrets();
  const databaseUrl = `postgresql://projectflow@127.0.0.1:${PG_PORT}/projectflow`;

  const dbCheck = runSync(path.join(PG_BIN, "psql.exe"), [
    "-h", "127.0.0.1", "-p", String(PG_PORT), "-U", "projectflow", "-d", "postgres",
    "-tAc", "SELECT 1 FROM pg_database WHERE datname='projectflow'",
  ]);
  if (!dbCheck.stdout?.toString().includes("1")) {
    onStatus("Creating application database…");
    runSync(path.join(PG_BIN, "createdb.exe"), [
      "-h", "127.0.0.1", "-p", String(PG_PORT), "-U", "projectflow", "projectflow",
    ]);
  }

  onStatus("Applying database updates…");
  runSync(process.execPath, [
    path.join(API_DIR, "node_modules", "prisma", "build", "index.js"),
    "migrate", "deploy", "--schema", path.join("prisma", "schema.prisma"),
  ], { cwd: API_DIR, env: { ...process.env, ELECTRON_RUN_AS_NODE: "1", DATABASE_URL: databaseUrl } });

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
  await waitForHttp(`http://127.0.0.1:${WEB_PORT}`);
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
    win.loadURL(`http://127.0.0.1:${WEB_PORT}`);
  } catch (err) {
    win.webContents.executeJavaScript(
      `document.getElementById('status') && (document.getElementById('status').innerText = 'Something went wrong starting ProjectFlow.')`
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
