# Budget (`features/budget`)

Manager-only money: the budget, expenses (category: the `cost_category` enum) and receipts (`project-internal` bucket),
internal notes: `expenses`, `project_internal`. The schema for stage planned costs and materials (`stage_budgets`,
`materials`, `stage_costs`, `import_materials`) is in place (T31; README → Costs & materials); their screens come later (T42).

- **Routes:** `/budget`
- **UI:** `BudgetStats`, `ExpenseTable`, `InternalNotes`
- **i18n namespace:** `budget` (`useTranslation(["budget", "common"])`)

Layers (README → Architecture): `domain/` pure rules (optional, shared ones live in `src/domain`) · `data/`
the repository, the only code that imports supabase-js · `hooks/` TanStack Query hooks, keys and mutations ·
`ui/` small named components composing `src/components/ui` · `i18n/{en,pl}.json` the `budget` namespace.
