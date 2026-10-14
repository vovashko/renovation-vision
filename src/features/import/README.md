# Import (`features/import`)

Spreadsheet import (T45) for **stages + tasks** (Progress page) and **materials** (Budget page). Managers only.

- **Entry:** `ui/import-button.tsx` in the page-header actions of `routes/project/progress.tsx` (`kind="stages"`) and `routes/project/budget.tsx` (`kind="materials"`). It opens `ui/import-sheet.tsx`.
- **Flow:** pick a file (CSV or XLSX, up to 5 MB) → match columns (automatic, English and Polish header names) → preview with per-row errors → import. Nothing is saved unless every row passes.
- **Parsers:** `papaparse` (CSV, delimiter detected: comma, semicolon or tab) and `read-excel-file` (XLSX, first sheet). Both are `import()`ed on demand in `domain/parse.ts`, so they are separate chunks fetched only when a file of that type is picked. Cells are read as text; formulas are never evaluated.
- **Server:** `src/server/functions/import.ts` (`importRows`: `requireProjectRole(…, "manager")` + `rateLimit`) → `import.server.ts` calls `public.import_stages` / `public.import_materials` **as the user** (RLS and the RPC's own checks apply). The RPCs are all-or-nothing and report problems as SQLSTATE 22023 with DETAIL = a JSON array of `{ row, field, code|message }`; the server turns them into `ServerFnError` issues (`<0-based row>.<field>`) and `domain/rpc-errors.ts` maps them back to sheet rows using the sources recorded at validation time.
- **Stages file shape:** one line per task. A line with a stage name starts a stage (name, start and end dates required); a line with the same name as the stage above, or with no name, adds a task (`Task`, optional `Room`). Rooms are matched by name inside the project by the RPC.
- **Materials file shape:** `Material` (required), `Quantity`, `Unit`, `Unit price`, `Status`, `Stage`, `Room`, `Supplier`, `Notes`. Stage, room and supplier are matched by name by the RPC. Decimal commas (`12,50`) and day-first dates (`01.03.2026`) are accepted.
- **Templates:** `public/templates/{stages,materials}.{csv,xlsx}` (English headers) and `{stages,materials}.pl.{csv,xlsx}` (Polish headers, semicolon CSV with decimal commas).
- **Limits:** 500 stages, 2000 materials (the RPCs' own limits), 5 MB.
- **Not here yet:** **contacts import**. The `import_contacts` RPC was never built; it is deferred to T46 (contacts UI), which can reuse `domain/{parse,map}.ts` and add a `contacts` kind to `domain/fields.ts` and `domain/validate.ts`.
- **i18n namespace:** `import` (`useTranslation(["import", "common"])`)
- **No `data/` layer:** all writes go through the server function, so there is no repository.

Layers (README → Architecture): `domain/` pure rules · `hooks/` the wizard state machine and the mutation · `ui/` small named components composing `src/components/ui` · `i18n/{en,pl}.json` the `import` namespace.
