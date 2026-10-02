import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { I18nextProvider } from "react-i18next";
import type { ReactNode } from "react";
import { createI18n } from "@/i18n/instance";
import { AiAnswerMessage } from "@/features/knowledge/ui/ai-answer";
import type { AiAnswer } from "@/features/knowledge/domain/assistant";

// AiAnswerMessage renders a router `<Link>` for each answer link; stub it to a plain anchor so this
// stays a unit test of the i18n rendering, not a routing test.
vi.mock("@tanstack/react-router", () => ({
  Link: ({ children, to, ...props }: { children: ReactNode; to: string; [key: string]: unknown }) => (
    <a href={to} {...props}>
      {children}
    </a>
  ),
}));

const budgetAnswer: AiAnswer = {
  kind: "budget",
  params: { spent: 40000, budget: 100000, pct: 40, remaining: 60000, overallProgress: 45, currency: "PLN" },
  sources: [
    { kind: "project", params: { field: "budget" } },
    { kind: "project", params: { field: "progress" } },
  ],
  links: [{ section: "" }],
};

function renderAnswer(locale: "en" | "pl") {
  render(
    <I18nextProvider i18n={createI18n(locale)}>
      <AiAnswerMessage
        text="the streamed answer text"
        answer={budgetAnswer}
        question="How much of the budget is spent?"
        projectId="p1"
        managerName="Jonas"
        onAskManager={() => {}}
      />
    </I18nextProvider>,
  );
}

describe("AiAnswerMessage", () => {
  it("renders the streamed text, translated sources and link in English", () => {
    renderAnswer("en");
    expect(screen.getByText("the streamed answer text")).toBeInTheDocument();
    expect(screen.getByText("Based on: Project budget · Overall progress")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Overview →" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Ask Jonas about this/ })).toBeInTheDocument();
  });

  it("renders the same structured answer translated in Polish", () => {
    renderAnswer("pl");
    expect(screen.getByText("the streamed answer text")).toBeInTheDocument();
    expect(screen.getByText("Na podstawie: Budżet projektu · Postęp ogólny")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Przegląd →" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Zapytaj o to Jonas/ })).toBeInTheDocument();
  });
});
