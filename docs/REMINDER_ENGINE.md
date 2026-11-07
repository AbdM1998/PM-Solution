# Reminder Engine Design — ProjectFlow

This is the highest-priority module in the whole product. It must keep working when
the browser is closed, the mobile app is killed, or the API/worker process restarts.

## The four concepts, kept strictly separate

1. **Reminder** (`Reminder` table) — the *rule*: "remind me about checklist item X,
   one time at 2026-11-10 09:00" or "remind me about task Y every Monday" or "remind me
   60 minutes before project Z's target end date." Lives as long as the user wants it.
2. **ReminderOccurrence** (`ReminderOccurrence`) — one *concrete instant* this rule must
   fire. A one-time reminder has exactly one occurrence, ever. A recurring reminder gets
   its *next* occurrence created only after the current one resolves (sent/cancelled) —
   we never pre-materialize years of future rows.
3. **NotificationOutbox** (`NotificationOutbox`) — one row per *(occurrence, channel)*
   that needs to be sent (e.g. one occurrence firing on both EMAIL and IN_APP creates
   two outbox rows). Has a unique `idempotencyKey` = `${occurrenceId}:${channel}:${attemptGeneration}`
   so retrying never double-sends.
4. **NotificationDelivery** — the log of what actually happened for each outbox row
   (success, provider error, retry count).

## Core invariants (each has a backend test)

- **Snoozing never touches the source entity's `dueDate`.** Snooze only moves
  `ReminderOccurrence.nextFireAt` and appends a `SnoozeHistory` row. The Task/Checklist
  item's own due date is a completely separate field and is never written by the
  reminder engine.
- **Completing a checklist item/task cancels its pending occurrences.** The
  `completeChecklistItem` service call, inside the same DB transaction, sets every
  `ReminderOccurrence` with `status IN (PENDING, SNOOZED)` for reminders pointing at
  that entity to `CANCELLED`.
- **Editing a due date reschedules, it doesn't duplicate.** If a reminder's
  `offsetBeforeDueMinutes` is set (relative reminder), changing the entity's `dueDate`
  recomputes the *pending* occurrence's `nextFireAt` in place rather than creating a
  second one.
- **No double send.** The worker claims rows with a single atomic statement:
  ```sql
  UPDATE "ReminderOccurrence"
  SET status = 'PROCESSING', "lockedBy" = $1, "lockedAt" = now()
  WHERE id IN (
    SELECT id FROM "ReminderOccurrence"
    WHERE status = 'PENDING' AND "nextFireAt" <= now()
    ORDER BY "nextFireAt"
    LIMIT $2
    FOR UPDATE SKIP LOCKED
  )
  RETURNING *;
  ```
  `FOR UPDATE SKIP LOCKED` means two worker instances (or two ticks overlapping because
  one run took too long) can never claim the same occurrence. This is the mechanism
  that makes horizontal scaling and restarts safe.
- **Missed-reminder recovery policy (the "closed for a day" test).** On each tick the
  worker only ever processes occurrences with `nextFireAt <= now()`, oldest first, in
  batches of `BATCH_SIZE` (default 50). If the system was down for a day, the next tick
  does **not** blast 200 old reminders — each overdue occurrence is sent **once**,
  marked `SENT` (or `CANCELLED` by the policy below), and the dashboard's "Overdue"
  section is what surfaces the backlog visually instead of a notification storm. Any
  occurrence more than `STALE_AFTER_HOURS` (default 24h) in the past when the worker
  finally sees it is marked `SENT` with a `wasStale: true` flag in the outbox payload
  and delivered as a single "while you were away" digest-style notification rather than
  a normal one — this is the explicit policy, not silent dropping.
- **Recurring reminders compute their next occurrence correctly across DST.** All
  scheduling math happens in UTC against `nextFireAt`; the user's IANA `timezone` on
  `User` is applied only when *computing* what "9:00 AM" or "every Monday" means in UTC,
  using a timezone-aware date library (`luxon`), never manual offset arithmetic — this
  is what keeps DST transitions correct.

## How the worker runs (no in-memory timers, no per-second table scan)

```
Reminder created/edited
        |
        v
Occurrence computed + inserted (status=PENDING, indexed on (status, nextFireAt))
        |
        v
Worker tick (node-cron, every 30s)
   SELECT ... WHERE status='PENDING' AND nextFireAt <= now()
   ORDER BY nextFireAt LIMIT 50 FOR UPDATE SKIP LOCKED
        |
        v
For each claimed occurrence:
   - write one NotificationOutbox row per channel on the Reminder
   - if recurring: compute + insert the NEXT occurrence now
   - mark this occurrence SENT
        |
        v
Outbox dispatcher (separate tick, every 10s)
   SELECT ... WHERE status='PENDING' LIMIT 100
   -> channel adapter (InApp / Email / WhatsApp / Push)
   -> NotificationDelivery row with result
   -> retry with exponential backoff (max 5 attempts) on failure,
      one channel's failure never blocks another channel's row
```

The index `@@index([status, nextFireAt])` on `ReminderOccurrence` is exactly what keeps
this query fast regardless of table size — it never scans tasks/checklists, only the
small set of occurrences actually due.

## Snooze options (fixed set the UI offers, plus custom)

`5m, 10m, 30m, 1h, later_today (today 18:00 local), tomorrow (tomorrow same time local),
next_week (+7 days same time), custom(date,time)`. Each maps to a new `nextFireAt`
computed in the user's timezone, then stored as UTC.

## What's implemented vs. what needs external setup

- Implemented and tested: occurrence scheduling, claiming, snooze, recurrence,
  cancellation-on-complete, reschedule-on-due-date-change, idempotent outbox, retry.
- Channel adapters implemented: **In-App** (Socket.io, fully working), **Email** (SMTP
  via `nodemailer` — works the moment real SMTP credentials are put in `.env`; without
  them it logs to `NotificationDelivery` instead of silently pretending to send).
- Channel adapters scaffolded but **not live** (no credentials exist for this user):
  **WhatsApp Business Cloud API**, **Web Push**, **Mobile Push (FCM/APNs)** — the
  interface, request shape and retry/error handling are implemented; actually sending
  requires the accounts/keys documented in `docs/FINAL_DELIVERY_REPORT.md`.
