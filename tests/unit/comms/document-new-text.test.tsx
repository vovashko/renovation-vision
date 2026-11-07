import { describe, expect, it } from "vitest";
import { createElement, type ReactNode } from "react";
import { renderHook } from "@testing-library/react";
import { I18nextProvider } from "react-i18next";
import { createI18n } from "@/i18n/instance";
import { useNotificationKindLabel, useNotificationText } from "@/features/comms/hooks/use-notification-text";

const wrapper = (locale: "pl" | "en") => {
  const i18n = createI18n(locale);
  return ({ children }: { children: ReactNode }) => createElement(I18nextProvider, { i18n }, children);
};
const legacy = { title: "LEGACY TITLE", body: "LEGACY BODY" };

describe("document_new notification (T62)", () => {
  const n = { kind: "document_new", params: { name: "Umowa.pdf", category: "contract" }, ...legacy };

  it("renders the file name in both languages", () => {
    const en = renderHook(() => useNotificationText(), { wrapper: wrapper("en") }).result.current(n);
    const pl = renderHook(() => useNotificationText(), { wrapper: wrapper("pl") }).result.current(n);
    expect(en.title).toBe("New document: Umowa.pdf");
    expect(pl.title).toBe("Nowy dokument: Umowa.pdf");
  });

  it("falls back to the legacy text when the name is missing", () => {
    const { result } = renderHook(() => useNotificationText(), { wrapper: wrapper("en") });
    expect(result.current({ kind: "document_new", params: {}, ...legacy })).toEqual({ title: "LEGACY TITLE", body: "LEGACY BODY" });
  });

  it("labels the kind", () => {
    const { result } = renderHook(() => useNotificationKindLabel(), { wrapper: wrapper("pl") });
    expect(result.current("document_new")).toBe("Dokument");
  });
});
