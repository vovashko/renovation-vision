# Knowledge (`features/knowledge`)

Manager-curated facts the AI assistant may use when answering clients: `ai_knowledge`. Also owns the
client-facing AI assistant itself (the "Ask AI" tab in chat), moved here from `features/comms` since
the assistant reads knowledge entries as one of its data sources.

- **Routes:** `/knowledge`
- **UI:** `KnowledgeEntry`, `KnowledgeSheet`, `AiChat`, `AiAnswerMessage`, `AiAskInput`, `AiSuggestions`, `AiThinking`
- **i18n namespace:** `knowledge` (`useTranslation(["knowledge", "common"])`)

`/chat` (in `features/comms`) imports `AiChat` directly from here for its "Ask AI" tab.

## The assistant

`domain/assistant.ts` is a rule-based `getAiAnswer(question, data)`: it matches English and Polish
keywords (diacritics-insensitive) and returns a structured, language-free `AiAnswer`
(`{ kind, params, sources, links }` — numbers and dates stay raw). `ui/ai-answer.tsx` is the only
place that turns a `kind` into text, via the `knowledge:assistant.answer.*` i18n keys and
`useFormat()`/`useStatusLabel()`. A manager-written fact (`ai_knowledge.content`) is shown as
written, never translated. This keeps a single entry point so a future server-side LLM can replace
`getAiAnswer`'s body without touching the UI.

Layers (README → Architecture): `domain/` pure rules (the assistant's matching/answer logic, the
entry form schema) · `data/` the repository, the only code that imports supabase-js · `hooks/`
TanStack Query hooks, keys and mutations · `ui/` small named components composing
`src/components/ui` · `i18n/{en,pl}.json` the `knowledge` namespace.
