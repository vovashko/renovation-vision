# Change requests (`features/change-requests`)

The manager asks the client to approve a significant change: extra cost beyond the budget, a schedule change, often
to unblock a stage (owner decision 4, T61). The client approves or rejects it. Only an **approved** request moves the
project's totals. This replaced the bug-bash "decisions" (#55): the tables keep their names (`decisions`,
`decision_events`); the app calls them change requests.

- **Where they are listed:** one `ChangeRequestList`, filtered by place (`domain/status.ts` → `inPlace`):
  - **Budget** (`/projects/<id>/budget`, both roles) lists the requests with a cost change;
  - **Progress** lists the requests with a day change; a request with both is in both;
  - the client overview's **"Awaiting your approval"** card (`ApprovalsCard`) shows the pending count and the newest
    three, each linking to its page; the manager overview's "Needs attention" lists "N change requests waiting for the
    client".
  - `?request=<id>` on Budget or Progress opens one request in a sheet (links from notifications, emails and the card).
    Old `/decisions?case=<id>` links redirect to Budget.
  - The client's phone tab bar has Budget as its fourth tab, with the pending-count badge (`shared/ui/nav-counts.ts`).
- **Tables:** `decisions` (+ `stage_id`, `pending_since`, `reminded_at`), `decision_events` (append-only history).
  Migrations `20261006000100_investor_decisions.sql` and `20261025000200_change_requests.sql`, tests
  `tests/db/change_requests.test.sql`.
- **UI:** `ChangeRequestSection` (list, sheet and form for one place), `ChangeRequestList`, `ChangeRequestSheet`
  (`ImpactPreview`, `ClientActions` + `RejectDialog` + `ManagerContactLink`, `ManagerActions`, `ReopenButton`,
  `ChangeRequestHistory`), `ChangeRequestFormSheet`, `ApprovalsCard`.
- **i18n namespace:** `change-requests`. Notification texts (`decision_*` kinds) and the three emails live in `comms`.
- **Server functions** (`src/server/functions/decisions.ts`): `createChangeRequest` (manager; also emails the clients)
  and `acceptChangeRequest` (client; also emails the managers). Reject / reopen / edit are plain RPCs.
- **Hooks for other features:** `usePendingRequestsByStage(projectId)` (stage id → pending count) for T60's
  "Waiting for client approval" badge on the stage rows; `usePendingChangeRequestCount` for the badges.

## States

```
pending ──approve (client)──▶ accepted          final, locked
pending ──reject (client, reason)──▶ rejected ──reopen (either side)──▶ pending
```

The manager edits (`update_decision`) only while the request is pending. The `question` status from the bug-bash model
is unused: the migration moved those rows back to `pending` (the enum value stays; the UI treats it like pending).

A request has a title, a description, a cost change and a day change (either may be negative or zero, not both zero)
and an optional stage of the same project (`on delete set null`). Approving doesn't change the stage: the manager
unblocks it. No photos: a supporting estimate goes to Documents.

**Approving** runs `budget = budget + cost_delta` and `target_date = target_date + days_delta` in the same transaction
as the status change, under a row lock: a double click or two clients at once approve once, and the second gets
`already_accepted`. A project without an end date keeps it unset; the budget can't drop below zero. The client sees the
impact before deciding, in the sheet and in the confirm dialog: "Budget changes from 120,000 to 128,800 PLN. The end
date changes from Mar 3 to Mar 5. This can't be undone." There is no emailed code any more.

Questions go to WhatsApp: "Questions? Message your manager" opens the point of contact's `wa.me` link (or a call),
from `contactLinks` (`features/people/domain/contact-links.ts`).

## Access

RLS lets the project's managers and clients **select**. Nobody writes the tables directly: every change is a
`SECURITY DEFINER` function that checks the caller's project role and the state, and writes the history event and the
notification in the same transaction.

| Function                                                           | Who                     | Notes                                                            |
| ------------------------------------------------------------------ | ----------------------- | ---------------------------------------------------------------- |
| `create_decision(project, title, description, cost, days, stage?)` | manager, 2FA            | not both zero; stage of the same project                         |
| `update_decision(id, title, description, cost, days, stage?)`      | manager, 2FA            | pending only                                                     |
| `reject_decision(id, reason)`                                      | client                  | reason required                                                  |
| `reopen_decision(id)`                                              | manager (2FA) or client | rejected → pending; resets `pending_since`, clears `reminded_at` |
| `accept_decision(id)`                                              | client                  | `ok` / `already_accepted` / `not_open`; 23514 below zero         |
| `remind_decision(id)`                                              | service role only       | the cron's claim, see below                                      |

## Notifications, email and the 24-hour reminder

In-app (`notifications.kind` + `params { title, text }`): `decision_new` and `decision_reopened` (by the manager) and
`decision_reminder` to the clients; `decision_accepted`, `decision_rejected` and `decision_reopened` (by the client) to
the managers. Email (best effort, in each recipient's language, `notification` template): a new request to the clients,
an approval to the managers, and the reminder.

**The reminder.** `pending_since` is set when a request is submitted or reopened; `reminded_at` when its one reminder
goes out (cleared on reopen). An hourly Cron Trigger (`wrangler.jsonc` → `triggers.crons`, `src/server.ts` →
`scheduled`) runs `src/server/jobs/change-request-reminders.server.ts` with the admin client: it lists pending requests
waiting over 24 hours with no reminder, re-checks them with `isReminderDue` (`domain/reminder.ts`), claims each with
`remind_decision` (row lock; it re-checks and writes the in-app reminder) and only then emails the clients. One reminder
per wait. The email links need `APP_ORIGIN` (wrangler vars): preview and production refuse to run without it; in
development the reminder is in-app only. T41 adds preferences and the digest to the same handler.
