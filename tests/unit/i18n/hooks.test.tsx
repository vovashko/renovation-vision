import { describe, it, expect, afterEach } from "vitest";
import { act, render, screen } from "@testing-library/react";
import { I18nextProvider } from "react-i18next";
import { createI18n } from "@/i18n/instance";
import { useFormat, useLocale, useScheduleLabel, useSetLocale, useStatusLabel } from "@/i18n";
import type { Locale } from "@/i18n";

const plain = (s: string | null) => (s ?? "").replace(/[\u00a0\u202f]/g, " ");

let switchTo: (l: Locale) => Promise<void> = async () => {};

function Probe() {
  const format = useFormat();
  const status = useStatusLabel();
  const schedule = useScheduleLabel();
  const locale = useLocale();
  switchTo = useSetLocale();
  return (
    <dl>
      <dd data-testid="locale">{locale}</dd>
      <dd data-testid="money">{format.money(12345)}</dd>
      <dd data-testid="date">{format.date("2026-03-02", "long")}</dd>
      <dd data-testid="status">{status("progress")}</dd>
      <dd data-testid="schedule">{schedule("at_risk")}</dd>
    </dl>
  );
}

afterEach(() => {
  document.cookie = "locale=; Path=/; Max-Age=0";
});

describe("i18n hooks", () => {
  it("format and label in the provider's language", () => {
    render(
      <I18nextProvider i18n={createI18n("pl")}>
        <Probe />
      </I18nextProvider>,
    );
    expect(screen.getByTestId("locale")).toHaveTextContent("pl");
    expect(plain(screen.getByTestId("money").textContent)).toBe("12 345,00 zł");
    expect(plain(screen.getByTestId("date").textContent)).toBe("02 mar 2026");
    expect(screen.getByTestId("status")).toHaveTextContent("W toku");
    expect(screen.getByTestId("schedule")).toHaveTextContent("Zagrożony");
  });

  it("useSetLocale re-renders in the new language without a reload and remembers it in a cookie", async () => {
    render(
      <I18nextProvider i18n={createI18n("pl")}>
        <Probe />
      </I18nextProvider>,
    );
    await act(() => switchTo("en"));
    expect(screen.getByTestId("locale")).toHaveTextContent("en");
    expect(plain(screen.getByTestId("money").textContent)).toBe("PLN 12,345.00");
    expect(screen.getByTestId("date")).toHaveTextContent("Mar 02, 2026");
    expect(screen.getByTestId("status")).toHaveTextContent("In progress");
    expect(document.cookie).toContain("locale=en");
  });
});
