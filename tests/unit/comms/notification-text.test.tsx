import { describe, expect, it } from "vitest";
import { createElement, type ReactNode } from "react";
import { render, renderHook, screen } from "@testing-library/react";
import { I18nextProvider } from "react-i18next";
import { createI18n } from "@/i18n/instance";
import { useActivityText, useNotificationKindLabel, useNotificationText } from "@/features/comms/hooks/use-notification-text";
import { ActivityLog } from "@/features/comms/ui/activity-log";
import { InboxNotificationItem, SentNotificationItem } from "@/features/comms/ui/notification-item";
import type { ActivityEntry, Notification } from "@/lib/database.types";

type Locale = "pl" | "en";

function wrapper(locale: Locale) {
  const i18n = createI18n(locale);
  return ({ children }: { children: ReactNode }) => createElement(I18nextProvider, { i18n }, children);
}

function textIn(locale: Locale, n: Pick<Notification, "kind" | "params" | "title" | "body">) {
  const { result } = renderHook(() => useNotificationText(), { wrapper: wrapper(locale) });
  return result.current(n);
}

const legacy = { title: "LEGACY TITLE", body: "LEGACY BODY" };

describe("useNotificationText: kind + params → translated text", () => {
  it("stage_status", () => {
    const n = { kind: "stage_status", params: { stage: "Demolition", status: "done" }, ...legacy };
    expect(textIn("en", n)).toEqual({ title: "Stage update: Demolition", body: "Demolition is now completed." });
    expect(textIn("pl", n)).toEqual({ title: "Aktualizacja etapu: Demolition", body: "Etap Demolition ma teraz status: ukończone." });
  });

  it("room_status (the note is shown as written)", () => {
    const n = { kind: "room_status", params: { room: "Bedroom 2", status: "blocked", note: "Waiting on the inspector." }, ...legacy };
    expect(textIn("en", n)).toEqual({ title: "Bedroom 2 is now blocked", body: "Waiting on the inspector." });
    expect(textIn("pl", n)).toEqual({ title: "Bedroom 2 — status: wstrzymane", body: "Waiting on the inspector." });
  });

  it("photo_published and render_published", () => {
    expect(textIn("pl", { kind: "photo_published", params: { caption: "Drywall done." }, ...legacy })).toEqual({
      title: "Nowe zdjęcie z budowy",
      body: "Drywall done.",
    });
    expect(textIn("en", { kind: "render_published", params: { title: "Kitchen", description: "Oak shelves." }, ...legacy })).toEqual({
      title: "New design render: Kitchen",
      body: "Oak shelves.",
    });
    expect(textIn("pl", { kind: "render_published", params: { title: "", description: "" }, ...legacy }).title).toBe("Nowa wizualizacja");
  });

  it("schedule_status", () => {
    const n = { kind: "schedule_status", params: { status: "at_risk", note: "Bedroom 2 is blocked." }, ...legacy };
    expect(textIn("en", n)).toEqual({ title: "Schedule: At risk", body: "Bedroom 2 is blocked." });
    expect(textIn("pl", n)).toEqual({ title: "Harmonogram: Zagrożony", body: "Bedroom 2 is blocked." });
  });

  it("message: sender, no sender, attachment only", () => {
    const n = { kind: "message", params: { sender: "Jonas Weber", preview: "Hi!", attachment: false }, ...legacy };
    expect(textIn("en", n)).toEqual({ title: "New message from Jonas Weber", body: "Hi!" });
    expect(textIn("pl", n)).toEqual({ title: "Nowa wiadomość od: Jonas Weber", body: "Hi!" });
    expect(textIn("pl", { kind: "message", params: { sender: null, preview: "", attachment: true }, ...legacy })).toEqual({
      title: "Nowa wiadomość",
      body: "Wysłano załącznik",
    });
  });

  it("manual: the announcement as written", () => {
    expect(textIn("pl", { kind: "manual", params: { title: "Water off", body: "Thursday" }, ...legacy })).toEqual({
      title: "Water off",
      body: "Thursday",
    });
  });

  it("falls back to the stored title/body for an unknown kind or missing params", () => {
    expect(textIn("pl", { kind: "stage", params: {}, ...legacy })).toEqual(legacy); // a pre-T33 row
    expect(textIn("en", { kind: "something_new", params: { x: 1 }, ...legacy })).toEqual(legacy);
    expect(textIn("pl", { kind: "stage_status", params: { stage: "Demolition", status: "nonsense" }, ...legacy })).toEqual(legacy);
    expect(textIn("pl", { kind: "schedule_status", params: {}, ...legacy })).toEqual(legacy);
  });

  it("labels the kind, showing an unknown one as stored", () => {
    const { result } = renderHook(() => useNotificationKindLabel(), { wrapper: wrapper("pl") });
    expect(result.current("manual")).toBe("Ogłoszenie");
    expect(result.current("stage")).toBe("stage");
  });
});

describe("useActivityText: params → translated line", () => {
  const entry = (params: Record<string, unknown>) => ({ params, summary: "ENGLISH SUMMARY" });
  const lineIn = (locale: Locale, a: ReturnType<typeof entry>) =>
    renderHook(() => useActivityText(), { wrapper: wrapper(locale) }).result.current(a);

  it("renders entity, action and label in both languages", () => {
    const a = entry({ entity: "stage", action: "update", label: "Flooring" });
    expect(lineIn("en", a)).toBe('Updated stage "Flooring"');
    expect(lineIn("pl", a)).toBe("Zaktualizowano etap „Flooring”");
    expect(lineIn("pl", entry({ entity: "render", action: "insert", label: "Kitchen" }))).toBe("Dodano wizualizację „Kitchen”");
    expect(lineIn("en", entry({ entity: "crew_member", action: "delete", label: "" }))).toBe("Removed crew member");
  });

  it("falls back to the English summary for unknown entities or missing params", () => {
    expect(lineIn("pl", entry({}))).toBe("ENGLISH SUMMARY");
    expect(lineIn("pl", entry({ entity: "contacts", action: "insert", label: "Ann" }))).toBe("ENGLISH SUMMARY");
    expect(lineIn("pl", entry({ entity: "stage", action: "upsert" }))).toBe("ENGLISH SUMMARY");
  });
});

describe("the updates page's items render translated text", () => {
  const notification: Notification = {
    id: "n1",
    project_id: "p1",
    recipient_id: "u2",
    kind: "stage_status",
    params: { stage: "Flooring", status: "progress" },
    title: "Stage update: Flooring",
    body: "Flooring is now in progress.",
    link: "/stages",
    created_at: "2026-04-18T08:00:00Z",
    read_at: null,
  };

  it("SentNotificationItem in Polish, with the kind badge", () => {
    render(createElement(wrapper("pl"), null, createElement(SentNotificationItem, { notification, total: 2, read: 1 })));
    expect(screen.getByText("Aktualizacja etapu: Flooring")).toBeInTheDocument();
    expect(screen.getByText("Etap Flooring ma teraz status: w toku.")).toBeInTheDocument();
    expect(screen.getByText("Etap")).toBeInTheDocument();
  });

  it("InboxNotificationItem in English", () => {
    const message = { ...notification, kind: "message", params: { sender: "Sarah Bennett", preview: "Thanks!", attachment: false } };
    render(createElement(wrapper("en"), null, createElement(InboxNotificationItem, { notification: message })));
    expect(screen.getByText("New message from Sarah Bennett")).toBeInTheDocument();
    expect(screen.getByText("Thanks!")).toBeInTheDocument();
  });

  it("ActivityLog in Polish", () => {
    const activity: ActivityEntry[] = [
      {
        id: 1,
        project_id: "p1",
        actor_id: null,
        action: "update",
        entity_type: "stages",
        entity_id: null,
        summary: 'Updated stage "Flooring"',
        changes: {},
        params: { entity: "stage", action: "update", label: "Flooring" },
        created_at: "2026-04-18T08:00:00Z",
      },
    ];
    render(createElement(wrapper("pl"), null, createElement(ActivityLog, { activity, nameOf: () => "System" })));
    expect(screen.getByText("Zaktualizowano etap „Flooring”")).toBeInTheDocument();
  });
});

describe("useNotificationText: investor decisions (#55)", () => {
  const params = { title: "Extra socket", text: "Is the price final?" };

  it("renders every decision kind in both languages, with the question / answer / reason as written", () => {
    const cases = [
      ["decision_new", "Decision needed: Extra socket", "Potrzebna decyzja: Extra socket"],
      ["decision_answer", "Answer on: Extra socket", "Odpowiedź do sprawy: Extra socket"],
      ["decision_question", "Question on: Extra socket", "Pytanie do sprawy: Extra socket"],
      ["decision_rejected", "Rejected: Extra socket", "Odrzucono: Extra socket"],
      ["decision_reopened", "Reopened: Extra socket", "Wznowiono: Extra socket"],
    ] as const;
    for (const [kind, en, pl] of cases) {
      expect(textIn("en", { kind, params, ...legacy })).toEqual({ title: en, body: "Is the price final?" });
      expect(textIn("pl", { kind, params, ...legacy })).toEqual({ title: pl, body: "Is the price final?" });
    }
  });

  it("falls back to the legacy text when the title is missing", () => {
    expect(textIn("pl", { kind: "decision_new", params: {}, ...legacy })).toEqual({ title: "LEGACY TITLE", body: "LEGACY BODY" });
  });

  it("labels the kinds", () => {
    const { result } = renderHook(() => useNotificationKindLabel(), { wrapper: wrapper("pl") });
    expect(result.current("decision_question")).toBe("Pytanie");
    expect(result.current("decision_new")).toBe("Decyzja");
  });
});
