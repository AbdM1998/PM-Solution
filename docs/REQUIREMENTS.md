# Requirements (SRS summary) — ProjectFlow

## Functional

- FR1 Users can register/login (single-user today, schema supports multiple).
- FR2 CRUD for Projects with status/priority/tags/notes; duration/elapsed/remaining/
  overdue/completion are **computed**, never manually entered (see `Project` computed
  fields in `packages/shared/src/types.ts`).
- FR3 CRUD for Tasks under a project; drag-and-drop ordering; bulk completion;
  duplication; filtering/sorting/searching.
- FR4 Checklist items under a task, arbitrarily nested via `parentId`; templates that
  create a full set of items in one call; drag-and-drop reordering; bulk completion.
- FR5 Reminders attach to a Project, Task, or Checklist Item; one-time or recurring
  (daily/weekly/monthly/custom); multiple reminders per entity; "remind N minutes
  before due date"; snooze with fixed presets + custom date/time; full history kept.
- FR6 Completing a checklist item/task cancels its pending reminder occurrences.
- FR7 Users can attach correspondence to a project via drag-and-drop `.eml`/`.msg`,
  manual thread reference, or a connected Outlook/Gmail account.
- FR8 Dashboard shows portfolio totals; "My Day" aggregates everything due today across
  every project in one list.
- FR9 Calendar/timeline view of due dates across tasks/checklists/reminders.
- FR10 Notifications are delivered in-app (real-time) and by email at minimum; the
  channel abstraction allows WhatsApp/push to be enabled later without changing the
  reminder engine.

## Non-functional

- NFR1 No N+1 queries; list endpoints paginated; dashboard queries are purpose-built,
  not N calls to per-project endpoints.
- NFR2 Indexes on `dueDate`, `status`, `projectId`, and `(status, nextFireAt)` for the
  reminder occurrence table (see `docs/DATABASE_DESIGN.md`).
- NFR3 All timestamps stored UTC; timezone conversion only at the edges.
- NFR4 Reminders survive browser close, mobile app kill, and backend/worker restart.
- NFR5 No duplicate notification sends (enforced by a unique idempotency key, not just
  application logic).
- NFR6 A day of downtime must not cause a flood of stale notifications on restart (see
  the missed-reminder recovery policy in `docs/REMINDER_ENGINE.md`).
- NFR7 Secrets never committed; `.env` is git-ignored, `.env.example` documents the
  shape without real values.

## Acceptance criteria (the real test, not "build succeeded")

See the end-to-end scenario at the bottom of `docs/IMPLEMENTATION_PLAN.md` and the
pass/fail record in `docs/FINAL_DELIVERY_REPORT.md`.
