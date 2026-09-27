import { useTranslation } from "react-i18next";

/** "Thinking…" indicator shown while the assistant streams an answer. */
export function AiThinking() {
  const { t } = useTranslation("knowledge");
  return (
    <div className="flex items-center gap-1.5 text-body-sm text-on-surface-variant" aria-label={t("assistant.thinkingAria")}>
      <span className="size-2 animate-bounce rounded-full bg-primary [animation-delay:-0.3s]" />
      <span className="size-2 animate-bounce rounded-full bg-primary [animation-delay:-0.15s]" />
      <span className="size-2 animate-bounce rounded-full bg-primary" />
      <span className="ml-1">{t("assistant.thinking")}</span>
    </div>
  );
}
