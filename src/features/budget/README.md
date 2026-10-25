# Budget (`features/budget`)

The project's money. Managers: the budget, expenses (category: the `cost_category` enum) and receipts
(`project-internal` bucket), internal notes: `expenses`, `project_internal`. Clients (T61, decision 10): the planned,
projected and spent totals with the deviation, never the expenses, vendors, receipts or notes. Both roles see the change
requests with a cost change (`features/change-requests`). The schema for stage planned costs and materials
(`stage_budgets`, `materials`, `stage_costs`, `import_materials`) is in place (T31; README → Costs & materials); their
screens, and the client's per-stage and per-category breakdown, come later (T42).

- **Routes:** `/budget` (both roles; `?request=<id>` opens a change request)
- **UI:** managers `BudgetStats`, `ExpenseTable`, `InternalNotes`; clients `ClientBudgetView` (`ClientBudgetStats`)
- **i18n namespace:** `budget` (`useTranslation(["budget", "common"])`)

Layers (README → Architecture): `domain/` pure rules (optional, shared ones live in `src/domain`) · `data/`
the repository, the only code that imports supabase-js · `hooks/` TanStack Query hooks, keys and mutations ·
`ui/` small named components composing `src/components/ui` · `i18n/{en,pl}.json` the `budget` namespace.
