# Documents (`features/documents`)

Project documentation (#58): six categories of files in the private `project-documents` bucket, listed in `documents`.

- **Route:** `/documents` (nav "Dokumentacja", managers and clients)
- **Categories** (Postgres enum `document_category`): `contract` Umowa · `estimate` Kosztorys · `invoices` Faktury ·
  `installation_photos` Zdjęcia instalacji przed zakryciem · `warranties` Gwarancje · `manuals` Instrukcje urządzeń
- **UI:** `DocumentsPanel` (tabs per category), `DocumentItem`, `VersionedDocuments`, `InstallationGallery`,
  `DocumentUploadSheet`, `DocumentEditSheet`
- **i18n namespace:** `documents` (`useTranslation(["documents", "common"])`)

Layers (README → Architecture): `domain/` pure rules (`documents.ts`: categories, `isNewDocument`, upload rules, safe
file names, version/room grouping; `schemas.ts`: zod forms) · `data/documents.repo.ts` the only supabase-js import ·
`hooks/` TanStack Query hooks · `ui/` · `i18n/{en,pl}.json`.

## Rules

- **Who:** only the project's site manager uploads, edits and archives; every other member (the investor, a signed-in
  `client`) reads and downloads. There is no anonymous access. Downloads use one-minute signed URLs.
- **New (nowe):** a document added within the last 7 days (`isNewDocument(createdAt, now)`).
- **Versioning (contract, estimate):** rows of one document share a `version_group`; `is_current` marks the current
  one. A new version is an insert into the same group: a `security definer` trigger numbers it, makes it the only
  current one and keeps the old rows as history (partial unique index `documents_one_current_idx`). The investor sees the
  current version and, below it, the older ones. Archiving the current version promotes the newest older one.
- **Installation photos:** `room_id` is required, `task_id` (a work) optional; both must belong to the project (guard
  trigger). Shown as a gallery grouped by room. jpeg/png/webp photos are re-encoded in the browser like site photos
  (EXIF/GPS dropped); HEIC is uploaded as is.
- **Invoices:** a plain file list. No payment status, amount or link to expenses. **Warranties / manuals:** list with a
  description.
- **Archive, never delete:** `archived_at`. Archived documents are hidden from the investor (RLS) and from the
  manager's default list (a toggle shows them). There is no DELETE privilege or policy on `documents`, and storage
  objects a row points at cannot be deleted by the API (only orphans left by a failed row insert).
- **Upload hardening:** mime allow-list pdf, jpeg, png, webp, heic, docx, xlsx; max 25 MB; the extension must match the
  mime type; the stored object name is `<project_id>/<category>/<uuid>.<ext>` and `file_name` is a sanitized name
  (`safeFileName`). The same limits are enforced by the table's check constraints and the bucket.
- Documents from investor decisions (#55) are **not** added automatically.

Tests: `tests/db/documents.test.sql` (versioning, RLS, storage, guards), `tests/unit/documents/*`.
