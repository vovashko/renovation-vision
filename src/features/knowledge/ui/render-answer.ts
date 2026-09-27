import type { useTranslation } from "react-i18next";
import type { Formatters } from "@/i18n";
import type { Status } from "@/domain/status";
import type { AiAnswer, AiLinkSection, AiSource } from "@/features/knowledge/domain/assistant";

type TFunc = ReturnType<typeof useTranslation<"knowledge">>["t"];

/** Everything `answerText`/`answerSources`/`linkLabel` need to turn an `AiAnswer` into language. */
export type AnswerCtx = { t: TFunc; format: Formatters; statusLabel: (status: Status) => string };

/**
 * Turns a structured `AiAnswer` into display text via the `knowledge` i18n namespace. A plain
 * function (not a hook) so it can run inside `AiChat`'s streaming callback: call the hooks once at
 * the top of the component and pass their results in as `ctx`.
 */
export function answerText(answer: AiAnswer, { t, format, statusLabel }: AnswerCtx): string {
  switch (answer.kind) {
    case "blocked": {
      const { roomNames, progress, note } = answer.params;
      const main = t("assistant.answer.blocked", { count: roomNames.length, names: roomNames.join(", "), progress });
      return main + (note ? ` ${note}` : ` ${t("assistant.answer.blockedNoNote")}`);
    }
    case "nothing_blocked":
      return t("assistant.answer.nothingBlocked");
    case "budget": {
      const { spent, budget, pct, remaining, overallProgress } = answer.params;
      return t("assistant.answer.budget", {
        spent: format.money(spent),
        budget: format.money(budget),
        pct,
        remaining: format.money(remaining),
        overallProgress,
      });
    }
    case "stage": {
      const { name, startDate, endDate, status, progress, nextTask, note } = answer.params;
      let text = t("assistant.answer.stage.main", {
        name,
        startDate: format.date(startDate, "short"),
        endDate: format.date(endDate, "short"),
        status: statusLabel(status),
        progress,
      });
      if (nextTask) text += t("assistant.answer.stage.nextTask", { task: nextTask });
      if (note) text += ` ${note}`;
      return text;
    }
    case "next": {
      const { current, openTasks, nextStage } = answer.params;
      if (current.length === 0 && !nextStage) return t("assistant.answer.next.empty");
      let text = current.length
        ? t("assistant.answer.next.current", {
            stages: current
              .map((s) =>
                t("assistant.answer.next.stageItem", { name: s.name, progress: s.progress, endDate: format.date(s.endDate, "short") }),
              )
              .join(t("assistant.answer.next.joiner")),
          })
        : t("assistant.answer.next.noneCurrent");
      if (openTasks.length) text += t("assistant.answer.next.openTasks", { tasks: openTasks.join(", ") });
      if (nextStage)
        text += t("assistant.answer.next.upcoming", { name: nextStage.name, startDate: format.date(nextStage.startDate, "short") });
      return text;
    }
    case "finish": {
      const { targetDate, lastStage, doneCount, totalCount } = answer.params;
      const main = lastStage
        ? t("assistant.answer.finish.withStage", {
            targetDate: format.date(targetDate, "long"),
            name: lastStage.name,
            startDate: format.date(lastStage.startDate, "short"),
            endDate: format.date(lastStage.endDate, "short"),
          })
        : t("assistant.answer.finish.plain", { targetDate: format.date(targetDate, "long") });
      return main + t("assistant.answer.finish.progress", { done: doneCount, total: totalCount });
    }
    case "photos": {
      const { photos } = answer.params;
      return photos.length
        ? t("assistant.answer.photos.list", { captions: photos.map((p) => `"${p.caption}"`).join(" · ") })
        : t("assistant.answer.photos.empty");
    }
    case "room": {
      const { name, status, progress, note } = answer.params;
      const main = t("assistant.answer.room", { name, status: statusLabel(status), progress });
      return note ? `${main} ${note}` : main;
    }
    case "fact":
      // Manager-written facts are shown as written, never translated.
      return answer.params.content;
    case "fallback": {
      const { overallProgress, managerName } = answer.params;
      return t("assistant.answer.fallback.main", {
        overallProgress,
        managerName: managerName ?? t("assistant.answer.fallback.defaultManager"),
      });
    }
  }
}

/** Turns `AiAnswer.sources` into display strings ("Based on: …"). */
export function answerSources(sources: AiSource[], { t, format }: Pick<AnswerCtx, "t" | "format">): string[] {
  const projectLabels: Record<"budget" | "progress" | "dates", string> = {
    budget: t("assistant.sources.project.budget"),
    progress: t("assistant.sources.project.progress"),
    dates: t("assistant.sources.project.dates"),
  };
  const sectionLabels: Record<"plan" | "stages" | "overview", string> = {
    plan: t("assistant.sources.section.plan"),
    stages: t("assistant.sources.section.stages"),
    overview: t("assistant.sources.section.overview"),
  };
  return sources.map((s) => {
    switch (s.kind) {
      case "room":
        return t("assistant.sources.room", { name: s.params.name });
      case "stage":
        return t("assistant.sources.stage", { index: s.params.index, name: s.params.name });
      case "project":
        return projectLabels[s.params.field];
      case "photo":
        return t("assistant.sources.photo", { date: format.date(s.params.date, "short") });
      case "fact":
        return t("assistant.sources.fact", { title: s.params.title });
      case "section":
        return sectionLabels[s.params.section];
    }
  });
}

/** Translated labels for an `AiLink`'s target section, arrow included. */
export function linkLabel(section: AiLinkSection, t: TFunc): string {
  const labels: Record<AiLinkSection, string> = {
    "": t("assistant.links.overview"),
    stages: t("assistant.links.stages"),
    plan: t("assistant.links.plan"),
    photos: t("assistant.links.photos"),
    design: t("assistant.links.design"),
  };
  return labels[section];
}
