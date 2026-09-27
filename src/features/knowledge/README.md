# Knowledge (`features/knowledge`)

Manager-curated facts the AI assistant may use when answering clients: `ai_knowledge`.

- **Routes:** `/knowledge`
- **UI:** `KnowledgeEntry`, `KnowledgeSheet`
- **i18n namespace:** `knowledge` (`useTranslation(["knowledge", "common"])`)

Layers (README → Architecture): `domain/` pure rules (optional, shared ones live in `src/domain`) · `data/`
the repository, the only code that imports supabase-js · `hooks/` TanStack Query hooks, keys and mutations ·
`ui/` small named components composing `src/components/ui` · `i18n/{en,pl}.json` the `knowledge` namespace.
