/**
 * @deprecated moved to `@/features/knowledge/domain/assistant`. `getAiAnswer` now returns a
 * structured, language-free `AiAnswer` (rendered via i18n in `ai-answer.tsx`) instead of English
 * text. This re-export stays for any code that hasn't moved yet.
 */
export {
  getAiAnswer,
  suggestedQuestionKeys,
  type AiAnswer,
  type AiAnswerKind,
  type AiLink,
  type AiLinkSection,
  type AiSource,
  type ProjectData,
} from "@/features/knowledge/domain/assistant";
