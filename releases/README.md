# ProjectFlow installer

`ProjectFlow-Setup-1.0.0.exe` — the Windows desktop installer (stored with Git LFS).

- Needs only Windows 10/11 64-bit and ~1GB of free disk space. The database and everything else are bundled.
- Windows may show a SmartScreen warning because the installer isn't code-signed: click **More info → Run anyway**.
- It installs for the current user and opens the app when it finishes. The first launch takes a little longer while the local database is set up.
- Each PC has its own local database. Register an account on first use; the first account registered becomes the admin.

To download it from a clone, Git LFS must be installed (`git lfs install`, then `git lfs pull`), or download it from the file's page on GitHub.

Built from `desktop/` with `npx electron-builder --win nsis` (see `desktop/README.md`).
