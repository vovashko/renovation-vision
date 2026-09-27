import { describe, it, expect } from "vitest";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { I18nextProvider } from "react-i18next";
import { useState } from "react";
import { createI18n } from "@/i18n/instance";
import { ConfirmProvider } from "@/shared/ui/confirm-dialog";
import { useConfirm } from "@/shared/ui/use-confirm";

/** A button that asks, and prints the answer. */
function Asker() {
  const confirm = useConfirm();
  const [answer, setAnswer] = useState("none");
  return (
    <>
      <button
        onClick={async () => setAnswer(String(await confirm({ title: "Delete this photo?", confirmLabel: "Delete", destructive: true })))}
      >
        ask
      </button>
      <output>{answer}</output>
    </>
  );
}

function setup(locale: "en" | "pl" = "en") {
  render(
    <I18nextProvider i18n={createI18n(locale)}>
      <ConfirmProvider>
        <Asker />
      </ConfirmProvider>
    </I18nextProvider>,
  );
  fireEvent.click(screen.getByText("ask"));
}

describe("useConfirm", () => {
  it("opens an alert dialog with the given title", async () => {
    setup();
    const dialog = await screen.findByRole("alertdialog");
    expect(dialog).toHaveTextContent("Delete this photo?");
  });

  it("resolves true on confirm", async () => {
    setup();
    fireEvent.click(await screen.findByRole("button", { name: "Delete" }));
    await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent("true"));
  });

  it("resolves false on cancel", async () => {
    setup();
    fireEvent.click(await screen.findByRole("button", { name: "Cancel" }));
    await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent("false"));
  });

  it("resolves false on Escape", async () => {
    setup();
    const dialog = await screen.findByRole("alertdialog");
    act(() => {
      fireEvent.keyDown(dialog, { key: "Escape" });
    });
    await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent("false"));
    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
  });

  it("labels the default buttons in the current language", async () => {
    setup("pl");
    expect(await screen.findByRole("button", { name: "Anuluj" })).toBeInTheDocument();
  });

  it("throws a helpful error without a provider", () => {
    const Broken = () => {
      useConfirm();
      return null;
    };
    expect(() => render(<Broken />)).toThrow(/ConfirmProvider/);
  });
});
