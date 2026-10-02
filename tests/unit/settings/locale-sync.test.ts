import { describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({ updateUser: vi.fn(async () => ({ error: null })) }));
vi.mock("@/lib/supabase", () => ({ supabase: { auth: { updateUser: h.updateUser } } }));

describe("updateUserLocale", () => {
  it("calls supabase.auth.updateUser({ data: { locale } })", async () => {
    const { updateUserLocale } = await import("@/features/auth/data/locale.repo");
    await updateUserLocale("en");
    expect(h.updateUser).toHaveBeenCalledWith({ data: { locale: "en" } });
  });

  it("throws when Supabase reports an error", async () => {
    h.updateUser.mockResolvedValueOnce({ error: new Error("nope") } as never);
    const { updateUserLocale } = await import("@/features/auth/data/locale.repo");
    await expect(updateUserLocale("pl")).rejects.toThrow("nope");
  });
});

describe("LanguageForm", () => {
  it("syncs user_metadata.locale when the language switch is applied", async () => {
    h.updateUser.mockClear();
    const React = await import("react");
    const { render, screen, fireEvent, waitFor } = await import("@testing-library/react");
    const { I18nextProvider } = await import("react-i18next");
    const { createI18n } = await import("@/i18n/instance");
    const { LanguageForm } = await import("@/features/settings/ui/language-form");

    const i18n = createI18n("pl");
    render(React.createElement(I18nextProvider, { i18n }, React.createElement(LanguageForm, {})));

    const select = screen.getByRole("combobox");
    fireEvent.change(select, { target: { value: "en" } });

    await waitFor(() => expect(h.updateUser).toHaveBeenCalledWith({ data: { locale: "en" } }));
  });
});
