import { describe, expect, it } from "vitest";
import { createElement } from "react";
import { render, screen } from "@testing-library/react";
import { I18nextProvider } from "react-i18next";
import { createI18n } from "@/i18n/instance";
import { MessageList } from "@/features/comms/ui/message-list";
import type { Message } from "@/lib/database.types";

const ME = "a0000000-0000-4000-8000-000000000002";

const message = (id: string, sender_id: string | null, body: string): Message => ({
  id,
  project_id: "p1",
  sender_id,
  body,
  attachment_path: null,
  created_at: "2026-04-20T09:14:00Z",
});

function renderList(locale: "pl" | "en") {
  const items = [message("m1", null, "From a deleted account"), message("m2", "jonas", "Hi"), message("m3", ME, "Mine")];
  render(
    createElement(
      I18nextProvider,
      { i18n: createI18n(locale) },
      createElement(MessageList, { groups: [{ day: "Today", items }], currentUserId: ME, nameOf: () => "Jonas Weber" }),
    ),
  );
}

describe("MessageList: a deleted sender (sender_id null)", () => {
  it('shows "Former member" in English', () => {
    renderList("en");
    expect(screen.getByText("Former member")).toBeInTheDocument();
    expect(screen.getByText("From a deleted account")).toBeInTheDocument();
    expect(screen.getByText("Jonas Weber")).toBeInTheDocument();
  });

  it("shows it translated in Polish", () => {
    renderList("pl");
    expect(screen.getByText("Były członek zespołu")).toBeInTheDocument();
  });

  it("never treats a null sender as the signed-out viewer's own message", () => {
    render(
      createElement(MessageList, {
        groups: [{ day: "Today", items: [message("m1", null, "Orphan")] }],
        currentUserId: null,
        nameOf: () => "x",
      }),
    );
    expect(screen.getByText("Former member")).toBeInTheDocument();
  });
});
