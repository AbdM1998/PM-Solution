# ProjectFlow — Project Overview

A personal (single-user now, multi-user-ready) project & task management platform that
replaces Excel/email-based tracking. The checklist and reminder system is the core of
the product, not a secondary feature — opening the app must immediately answer: what
projects am I running, how long have they been going, what's left, what's overdue, what
needs attention today, what emails are linked to what, and what reminders are coming up
or were snoozed.

Full requirements, architecture, database design, reminder engine design, API design and
technology decisions live in the other files in this `docs/` folder. This project was
seeded from a detailed Arabic-language product brief (summarized and translated into
the documents here); nothing in that brief was skipped silently — anything not
implemented is called out explicitly in `docs/FINAL_DELIVERY_REPORT.md`.

## The six pillars

1. **Projects** — status, dates (auto-computed duration/elapsed/remaining), priority,
   tags, notes, members, activity history.
2. **Tasks & Checklists** — unlimited nested tasks/checklist items per project,
   templates, drag-and-drop ordering, bulk completion, progress computed from real
   state (never manually entered).
3. **Smart Reminders** — see `docs/REMINDER_ENGINE.md`. Survives restarts, supports
   snooze/recurrence/multi-channel, never double-sends.
4. **Email & Threads** — link existing correspondence to a project by drag-and-drop
   (.eml/.msg), manual reference, or a connected account (Outlook/Gmail adapters).
5. **Dashboard & My Day** — a single screen that aggregates everything due today across
   every project, so the user never has to open each project to check.
6. **Calendar & Timeline** — visual due dates for tasks, checklist items and reminders.

## Explicitly out of scope for v1 (see `docs/TECHNOLOGY_DECISIONS.md`)

AI-assisted task extraction from emails, microservices, a full in-app email client, an
internal chat system, HR-style permission management, Redis/Kubernetes before a proven
need, and live WhatsApp/Outlook/Gmail sending without real credentials for those
services.
