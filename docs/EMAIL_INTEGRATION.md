# Email Integration — ProjectFlow

Three ways to attach correspondence to a project, per the brief — we link existing
mail, we do not rebuild Outlook/Gmail.

1. **Drag-and-drop file import** (`POST /projects/:id/email-threads/import`) — accepts
   `.eml` (parsed with `mailparser`) and `.msg` (parsed with `@kenjiuno/msgreader`).
   Extracts subject, from/to/cc, date, body, attachments, message id; HTML body is
   sanitized (`sanitize-html`) before storage. **Implemented and testable today** — no
   external account needed.
2. **Manual thread linking** (`POST /projects/:id/email-threads`) — subject,
   conversation id, external URL (e.g. a direct Outlook Web/Gmail link), notes. Zero
   dependencies. **Implemented.**
3. **Connected account** (Microsoft Graph for Outlook/365, Gmail API for Google
   Workspace) — OAuth-based search/read/attach. The adapter interfaces
   (`modules/email/providers/outlook.ts`, `.../gmail.ts`) are implemented with the
   correct request/response shapes and least-privilege scopes
   (`Mail.Read`/`gmail.readonly` style), but **cannot go live in this session**: that
   requires registering an Azure AD app / Google Cloud OAuth client, which needs the
   user's own Microsoft 365 or Google Workspace admin access and a few minutes in that
   provider's console. Calling the connect endpoint today returns `501` with the exact
   environment variables needed (`MS_GRAPH_CLIENT_ID`, `MS_GRAPH_CLIENT_SECRET`,
   `MS_GRAPH_TENANT_ID` / `GOOGLE_OAUTH_CLIENT_ID`, `GOOGLE_OAUTH_CLIENT_SECRET`) so
   wiring it up later is a config change, not a code change.

Attachments from any of the three paths are stored on disk under a storage root (not in
the database) with only metadata (`storagePath`, `mimeType`, `sizeBytes`) persisted, per
the performance requirement to never load full email/attachment content when just
listing a project.
