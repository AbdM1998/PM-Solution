# ProjectFlow

Personal project/task/checklist management app (web + mobile + API), reminders that
survive restarts, optional email import and WhatsApp/push notification channels. See
`docs/` for the full design (`docs/ARCHITECTURE.md`, `docs/PROJECT_OVERVIEW.md`,
`docs/TECHNOLOGY_DECISIONS.md`, etc.).

## Running it locally (Docker)

```bash
cp .env.example .env
# edit .env with real local values
docker compose up --build
```

See `infrastructure/README.md` for what each piece of the Docker setup does and why.

---
This is a minimal stub — created by the devops-engineer role because no root README
existed yet. Expand freely (a docs/release engineer may do so later); this file isn't
meant to be the last word on the project.
