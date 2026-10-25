# Documents (`features/documents`)

A simple shelf of final, signed files (#58, simplified in T62): private `project-documents` bucket, listed in `documents`.
The deal is made outside the portal; the manager uploads, the client views and downloads.

- **Route:** `/documents` (nav "Dokumentacja", managers and clients)
- **Categories** (Postgres enum `document_category`, UI list `DOCUMENT_CATEGORIES`): `contract` Contract and amendments ·
  `estimate` · `invoices` · `warranties` · `manuals` Device manuals. `installation_photos` stays in the enum but is unused.
- **UI:** `DocumentsPanel` (tabs per category), `DocumentItem`, `DocumentUploadSheet`, `DocumentEditSheet`
- **i18n namespace:** `documents` (`useTranslation(["documents", "common"])`)

Layers (README → Architecture): `domain/` pure rules (`documents.ts`: categories, `isNewDocument`, upload rules, safe
file names; `schemas.ts`: zod forms) · `data/documents.repo.ts` the only supabase-js import · `hooks/` TanStack Query
hooks · `ui/` · `i18n/{en,pl}.json`. Deleting is the `deleteDocument` server function
(`src/server/functions/documents*.ts`).

## Rules

- **Who:** only the project's site manager uploads, edits the description and deletes; the project's clients read and
  download. No anonymous access. Downloads use one-minute signed URLs.
- **The file name is the title** (as uploaded, made storage-safe). The description is optional.
- **No versions, no archive.** An amendment is just another file in "Contract and amendments". Delete is final: the
  server function removes the row, then the storage object (a storage failure is logged as an orphan; the call still
  succeeds).
- **Staff writes need 2FA:** restrictive `aal2` policies on insert and delete (table and bucket), like expenses.
- **New (nowe):** added within the last 7 days (`isNewDocument`). Clients also get an in-app `document_new` notification
  (params `{ name, category }`) when a document is added.
- **Installation photos are normal photos** (Photos, linked to a room, stage or task). The T62 migration moved the old
  ones into `photos`; `scripts/move-installation-photos.ts` moves their objects (see the script header).
- **Upload hardening:** mime allow-list pdf, jpeg, png, webp, docx, xlsx (a HEIC pick is converted to JPEG before upload);
  max 25 MB; the extension must match the mime type; object name `<project_id>/<category>/<uuid>.<ext>`.

Tests: `tests/db/documents.test.sql`, `tests/db/documents-v2-migration.check.sql` (data move, manual),
`tests/unit/documents/*`, `tests/unit/server/documents-delete.test.ts`.
