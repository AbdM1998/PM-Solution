# Security — ProjectFlow

- **Passwords**: hashed with `bcrypt` (cost factor 12), never logged, never returned in
  any API response.
- **Auth tokens**: short-lived JWT access token (15 min) signed with `JWT_SECRET` from
  `.env`; refresh token in an httpOnly, `SameSite=Lax`, `Secure`-in-production cookie.
  `JWT_SECRET` must be a long random value generated per deployment — `.env.example`
  ships a placeholder, never a real secret.
- **Authorization**: every project-scoped route checks the caller is the project owner
  or a `ProjectMember` before reading/writing (prevents IDOR — one user cannot fetch
  another user's project by guessing a GUID). Enforced in the service layer with tests.
- **Input validation**: every request body validated with the Zod schemas in
  `packages/shared/src/schemas.ts` before it reaches a service — rejected requests never
  touch the database.
- **Rate limiting**: `express-rate-limit` on `/auth/*` (prevents credential stuffing)
  and a global, more generous limit on the rest of the API.
- **CORS**: explicit allow-list (`WEB_ORIGIN`, `MOBILE_ORIGIN` from `.env`), not `*`.
- **File uploads** (email import, attachments): MIME/extension allow-list (`.eml`,
  `.msg`, common image/document types for attachments), size cap, stored outside any
  web-servable path, filename never trusted for the on-disk path (random id used
  instead, original name kept only as metadata).
- **HTML sanitization**: imported email bodies are run through `sanitize-html` before
  being stored/rendered — raw HTML from an external email is never rendered as-is
  (stored-XSS risk otherwise).
- **OAuth tokens** (Outlook/Gmail, once configured): refresh tokens encrypted at rest
  (`accessTokenEncrypted`/`refreshTokenEncrypted` columns, AES-256-GCM with a key from
  `.env`, never the plaintext token); least-privilege scopes only (mail read + the
  specific folder/thread scopes needed, not full mailbox access).
- **Secrets hygiene**: `.env` is git-ignored; nothing under `docs/` or committed source
  contains a real credential; `.env.example` lists every variable name with a fake/blank
  value and a one-line comment on where to obtain the real one.
- **Error responses**: a global error handler returns a generic message + an internal
  error id for 5xx responses; stack traces only in server logs, never in the HTTP
  response body.
- **Audit log**: `ActivityLog` records who changed what on a project/task, for
  after-the-fact review.

This is a personal, single-user-first product, so there is intentionally no complex
permission/role system beyond `ProjectMember` (`OWNER`/`MEMBER`) — the data model
supports multi-user without inventing enterprise RBAC the brief explicitly said to
avoid.
