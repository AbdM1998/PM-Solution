# ProjectFlow Desktop (Electron)

A real desktop app version of the local/offline deployment — no console window, no
browser tab, a real app window. Closing the window keeps ProjectFlow running in the
background (tray icon); use the tray's "Quit ProjectFlow" to fully stop it.

Runs everything in-process using Electron's own embedded Node.js (via
`child_process.fork` + `ELECTRON_RUN_AS_NODE`) — no separate portable Node install is
needed here, unlike `local/` (which predates this and still uses a spawned
`node.exe`). Postgres is still a spawned native binary (can't run in-process).

## Building from source

```
cd desktop
npm install
```

Then bundle the resources (same build outputs as `local/`, see `../local/README.md`
for how `app/` and `pg-portable/` are produced):

```
mkdir resources
cp -r ../local/pg-portable resources/pg-portable
cp -r ../local/app resources/app
```

Generate the icon once (from the PWA icon already in the repo):

```
npm install --save-dev png-to-ico
node -e "require('png-to-ico').default('../apps/web/public/icon-512.png').then(b=>require('fs').writeFileSync('build/icon.ico',b))"
```

Run in dev mode to test:

```
npm start
```

Package a distributable:

```
npx electron-builder --win nsis
```

**Known issue on this machine**: the NSIS packaging step has intermittently hung with
no progress and no error (same antivirus/endpoint-security interference pattern hit
throughout this project with Docker and other builds) — when it hung, only
`dist-installer/win-unpacked/ProjectFlow.exe` got produced (a fully working,
console-free app on its own: login, dashboard, the reminder engine, all confirmed
working), not a one-click installer. On a later rebuild the exact same config
succeeded and produced a real `ProjectFlow Setup 1.0.0.exe` (confirmed working:
installs, runs, Admin/Reports pages all functional). So it's worth just trying
`npx electron-builder --win nsis` again if it hangs — if it still won't finish,
zip `win-unpacked/` and hand that over instead: unzip once, run `ProjectFlow.exe`
inside, done.
