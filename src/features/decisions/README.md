# Decisions (`features/decisions`)

Cases ("sprawy wymagające decyzji inwestora", #55) that the site manager submits and the investor (a signed-in `client` of
the project) decides. Only an **accepted** case moves the project's totals.

- **Routes:** `/projects/<id>/decisions` (`?case=<id>` opens one case). In the nav for managers and clients; clients get
  a count badge with the number of cases `pending` (`shared/ui/nav-counts.ts`).
- **Tables:** `decisions`, `decision_photos`, `decision_events` (append-only history), `decision_confirmations` (emailed
  codes; no API access). Migration `20261006000100_investor_decisions.sql`, tests `tests/db/investor_decisions.test.sql`.
- **UI:** `DecisionSummary`, `DecisionList`, `DecisionDetail` (`ImpactPreview`, `DecisionPhotos`, `DecisionHistory`,
  `InvestorActions` + `CodeDialog`, `ManagerActions`, `ReopenButton`), `DecisionFormSheet`, `TextDialog`.
- **i18n namespace:** `decisions` (`useTranslation(["decisions", "common"])`). Notification texts (`decision_*` kinds) and the
  two emails live in `comms`.
- **Server functions** (`src/server/functions/decisions.ts`): `createDecision` (manager; also emails the investors),
  `requestDecisionCode`, `acceptDecision` (investor). Reject / question / answer / reopen / edit are plain RPCs.

Layers as in README → Architecture: `domain/` (`impact.ts` the preview maths, `status.ts` the state machine as the UI sees
it, `schemas.ts` the forms) · `data/decisions.repo.ts` (the only supabase-js importer) · `hooks/` (queries, mutations,
`useDeltaText`, error texts) · `ui/` · `i18n/`.

## States

```
pending ──ask──▶ question ──answer (manager)──▶ pending
pending | question ──accept (code)──▶ accepted        final, locked
pending | question ──reject (reason)──▶ rejected ──reopen (either side)──▶ pending
```

Labels: `pending` "Oczekuje na decyzję", `accepted` "Zaakceptowano", `rejected` "Odrzucono", `question` "Pytanie do
wyjaśnienia". The manager edits (`update_decision`) only while the case is `pending` or `question`; after a decision it is locked
and a new case is the way forward. Every step appends a `decision_events` row (`submitted`, `question`, `answer`,
`accepted`, `rejected`, `reopened`, `edited`) with the actor, their project role, the text and the time.

`cost_delta` (numeric, may be negative: a saving) and `days_delta` (integer calendar days, may be negative: time gained)
default to 0. **Accepting** runs `budget = budget + cost_delta` and `target_date = target_date + days_delta` in the same
transaction as the status change (a project without an end date keeps it unset; the budget can't drop below zero, the
accept is refused then). Nothing else touches the totals: submitting, asking, rejecting and reopening change nothing. The
planned baseline (`planned_budget`, `planned_target_date`, #53/#54) stays put, so the existing plan-vs-current display
shows the difference by itself. `project_summary` and the other views are untouched.

The investor sees the effect **before** deciding (`ImpactPreview`, `domain/impact.ts`): "Budżet: z 84 500,00 zł do
85 380,00 zł", "Koniec: z 10 cze 2026 do 14 cze 2026", computed from the project's current values.

## Access

RLS lets the project's managers and clients **select** the four-table family (`decision_confirmations` has no policy, so
nobody reads it through the API). All privileges for writing are revoked: every change is a `SECURITY DEFINER` function
that checks the caller's project role and the state machine, takes a row lock on the case and writes the history event and
the notification in the same transaction. (This is stricter than "managers have full access": a manager can't skip the
lock or the history with a direct update.) Anonymous users have no access; the functions are granted to `authenticated` only.

| Function                                                             | Who               | Notes                                                              |
| -------------------------------------------------------------------- | ----------------- | ------------------------------------------------------------------ |
| `create_decision(project, title, description, cost, days, photos[])` | manager           | 1-10 photos that exist in storage under `<project>/decisions/`     |
| `update_decision(id, …, add_photos[], remove_photos[])`              | manager           | only `pending`/`question`; voids open codes; returns removed paths |
| `answer_decision_question(id, text)`                                 | manager           | `question` → `pending`; notifies the investors                     |
| `ask_decision_question(id, text)`                                    | client            | `pending` → `question`; notifies the managers                      |
| `reject_decision(id, reason)`                                        | client            | reason required; notifies the managers                             |
| `reopen_decision(id)`                                                | manager or client | only `rejected` → `pending`; logged as `reopened`                  |
| `accept_decision(id, code)`                                          | client            | see below; returns a status text, raises only for 42501/23514      |

Photos: `project-media` bucket, `<project_id>/decisions/<uuid>.<ext>`; the table checks the folder, and a storage policy lets
the project's clients read exactly the objects a `decision_photos` row points at. Uploads go through the media feature's
hardening (`reencodeImage`: EXIF/GPS stripped, longest edge capped, `validateFile` mime/size) before they leave the browser.

## Accepting a case: the confirmation code

Accepting needs a "Czy na pewno?" dialog **and** a 6-digit code emailed to the investor. The design, and why:

1. **Request.** The `requestDecisionCode` server function (`requireProjectRole("client")`, `rateLimit("email")`, 5/min per
   user) reads the case as the user (RLS), generates a uniformly random 6-digit code with `crypto.getRandomValues`, and
   stores **only** `sha256(salt ":" code)` with a per-row random salt, a 10-minute expiry and an attempts counter, using the
   **admin client**. The browser can't write `decision_confirmations`, so it can't plant a code whose value it knows. The code
   goes by email (Brevo, `confirmationCode` template) to the signed-in user's own address, in their language. The email is
   marked `sensitive`: not even the development log provider prints it. Codes are never logged anywhere.
2. **Verify and apply in one place: the database.** `accept_decision(decision, code)` runs as the user (no secret key), locks
   the case row, and only when the code is the latest open one for **that user and that case**, unexpired, under 5 attempts
   and matching the hash does it flip the status and apply the totals, in the same transaction. A wrong code increments the
   attempts and **returns** `invalid_code` (a raise would roll the increment back); the fifth wrong attempt burns the code;
   success (or an edit, a rejection, a newer code) consumes it, so it is single use.
3. **Why DB-side rather than "server checks, then calls an RPC".** If the RPC only needed a server-side check beforehand it
   would have to be callable without proof, and the browser holds the user's JWT and can call any granted RPC directly. With
   the check inside the RPC there is no code path that accepts without the emailed code, whichever way it is called. The
   server function for accepting is a thin, rate-limited wrapper (`acceptDecision`: the 6-digit shape is validated by zod,
   then the RPC is called as the user). A caller who bypasses the wrapper is still bounded by the 5 attempts per code and by
   the cap on issuing codes: at most 5 per case and user per hour (a trigger on the table, so it holds for any caller).
4. **Idempotence and races.** The row lock serializes a double click and two investors accepting at once; whoever comes
   second sees `already_accepted` and nothing is applied twice. Rejected cases answer `not_open` (reopen first).

Results of `accept_decision`: `ok`, `already_accepted`, `not_open`, `no_code`, `expired`, `invalid_code`,
`too_many_attempts`. The dialog turns each into a message (`decisions:accept.result.*`).

## Notifications and email

In-app (comms schema v2, `notifications.kind` + `params { title, text }`): `decision_new` and `decision_answer` and
`decision_reopened` (by the manager) to the investors; `decision_question`, `decision_rejected` and `decision_reopened`
(by the investor) to the managers. Rendered by `useNotificationText` (`comms:notifications.decision_*`). Email: the code
(above) and a "new case" notice to every investor of the project when a case is submitted (`createDecision`, best effort: a
failed email is logged and never undoes the case).
