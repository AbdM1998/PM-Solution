// ProjectFlow — local, offline launcher. Compiled into ProjectFlow.exe.
// Everything (database, backend, website) runs only on this PC. Nothing here ever
// needs the internet, and nothing new needs to be installed — Postgres and Node.js
// are both bundled, portable copies that live next to this file.
const { spawn, spawnSync } = require("child_process");
const { randomBytes } = require("crypto");
const fs = require("fs");
const os = require("os");
const path = require("path");

// `process.pkg` is set when running inside a pkg-compiled executable; __dirname then
// points inside the embedded snapshot, not next to the real .exe on disk — use the
// .exe's own directory instead so pg-portable/node-portable/app resolve correctly.
const ROOT = process.pkg ? path.dirname(process.execPath) : __dirname;

const PG_BIN = path.join(ROOT, "pg-portable", "pgsql", "bin");
const PG_DATA = path.join(ROOT, "pg-data");
const NODE_EXE = path.join(ROOT, "node-portable", "node-v24.16.0-win-x64", "node.exe");
const API_DIR = path.join(ROOT, "app", "api");
const WEB_DIR = path.join(ROOT, "app", "web", "apps", "web");
const ENV_FILE = path.join(ROOT, "local.env");

const PG_PORT = 5433;
const API_PORT = 4100;
const WEB_PORT = 3100;

function log(msg) {
  console.log(msg);
}

function run(cmd, args, opts = {}) {
  const result = spawnSync(cmd, args, { stdio: "inherit", ...opts });
  return result.status ?? 0;
}

function loadOrCreateSecrets() {
  if (!fs.existsSync(ENV_FILE)) {
    log("First run - generating local secrets...");
    const secrets =
      `JWT_SECRET=${randomBytes(48).toString("base64url")}\n` +
      `ENCRYPTION_KEY=${randomBytes(32).toString("base64")}\n`;
    fs.writeFileSync(ENV_FILE, secrets);
  }
  const content = fs.readFileSync(ENV_FILE, "utf-8");
  const vars = {};
  for (const line of content.split("\n")) {
    const idx = line.indexOf("=");
    if (idx === -1) continue;
    vars[line.slice(0, idx).trim()] = line.slice(idx + 1).trim();
  }
  return vars;
}

// Real network-interface lookup instead of parsing `ipconfig` text — more reliable
// than the batch-script version, and correctly skips virtual adapters (WSL, VPN,
// Hyper-V) by checking the interface's own internal/family flags, not just its IP
// range. Still prefers a 192.168.x.x address first since that's what this project's
// own home/office networks hand out to the real WiFi/Ethernet adapter.
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

function main() {
  log("============================================");
  log("  ProjectFlow - starting locally, offline");
  log("============================================\n");

  const secrets = loadOrCreateSecrets();

  if (!fs.existsSync(path.join(PG_DATA, "PG_VERSION"))) {
    log("First run - initializing the local database...");
    run(path.join(PG_BIN, "initdb.exe"), [
      "-D", PG_DATA, "--username=projectflow", "--auth=trust", "-E", "UTF8",
    ]);
  }

  log("Starting local database...");
  run(path.join(PG_BIN, "pg_ctl.exe"), [
    "-D", PG_DATA, "-o", `-p ${PG_PORT} -h 0.0.0.0`,
    "-l", path.join(PG_DATA, "logfile.txt"), "-w", "start",
  ]);

  const databaseUrl = `postgresql://projectflow@127.0.0.1:${PG_PORT}/projectflow`;

  const dbCheck = spawnSync(path.join(PG_BIN, "psql.exe"), [
    "-h", "127.0.0.1", "-p", String(PG_PORT), "-U", "projectflow", "-d", "postgres",
    "-tAc", "SELECT 1 FROM pg_database WHERE datname='projectflow'",
  ]);
  if (!dbCheck.stdout?.toString().includes("1")) {
    log("Creating application database...");
    run(path.join(PG_BIN, "createdb.exe"), [
      "-h", "127.0.0.1", "-p", String(PG_PORT), "-U", "projectflow", "projectflow",
    ]);
  }

  log("Applying database updates...");
  run(NODE_EXE, [
    path.join(API_DIR, "node_modules", "prisma", "build", "index.js"),
    "migrate", "deploy", "--schema", path.join("prisma", "schema.prisma"),
  ], { cwd: API_DIR });

  const lanIp = findLanIp();

  log("Starting the app server...");
  spawn(NODE_EXE, [path.join(API_DIR, "dist", "server.js")], {
    cwd: API_DIR,
    detached: true,
    stdio: "ignore",
    env: {
      ...process.env,
      DATABASE_URL: databaseUrl,
      JWT_SECRET: secrets.JWT_SECRET,
      ENCRYPTION_KEY: secrets.ENCRYPTION_KEY,
      PORT: String(API_PORT),
      WEB_ORIGIN: `http://127.0.0.1:${WEB_PORT}`,
      MOBILE_ORIGIN: lanIp ? `http://${lanIp}:${WEB_PORT}` : "",
      SMTP_FROM: "ProjectFlow <abdalruhman.mustafa@gmail.com>",
    },
  }).unref();

  log("Starting the reminder engine...");
  spawn(NODE_EXE, [path.join(API_DIR, "dist", "worker-entry.js")], {
    cwd: API_DIR,
    detached: true,
    stdio: "ignore",
    env: { ...process.env, DATABASE_URL: databaseUrl },
  }).unref();

  log("Starting the website...");
  spawn(NODE_EXE, [path.join(WEB_DIR, "server.js")], {
    cwd: WEB_DIR,
    detached: true,
    stdio: "ignore",
    env: {
      ...process.env,
      PORT: String(WEB_PORT),
      HOSTNAME: "0.0.0.0",
      API_INTERNAL_URL: `http://127.0.0.1:${API_PORT}`,
    },
  }).unref();

  setTimeout(() => {
    log("\n============================================");
    log("  ProjectFlow is running.\n");
    log(`  On THIS computer:   http://localhost:${WEB_PORT}`);
    if (lanIp) log(`  On your PHONE (same WiFi): http://${lanIp}:${WEB_PORT}`);
    log("\n  Leave this window open. Closing it (or shutting down this PC) stops ProjectFlow.");
    log("============================================\n");

    spawn("cmd", ["/c", "start", "", `http://localhost:${WEB_PORT}`], { detached: true }).unref();

    log("Press Ctrl+C to close this window (ProjectFlow keeps running until you do).");
  }, 4000);
}

main();
