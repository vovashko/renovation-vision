import { beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({
  calls: [] as string[],
  updateUser: vi.fn(async (_args: unknown) => ({ error: null as Error | null })),
  profileUpdate: vi.fn(async (_values: unknown, _id: string) => ({ error: null as Error | null })),
  toastError: vi.fn(),
  userId: "a0000000-0000-4000-8000-000000000002" as string | null,
}));

vi.mock("@/lib/supabase", () => ({
  supabase: {
    auth: {
      updateUser: async (args: unknown) => {
        h.calls.push("user_metadata");
        return h.updateUser(args);
      },
    },
    from: (table: string) => ({
      update: (values: unknown) => ({
        eq: async (_column: string, id: string) => {
          h.calls.push(`${table}.update`);
          return h.profileUpdate(values, id);
        },
      }),
    }),
  },
}));
// LanguageForm reads the signed-in user from the router context; stub just that.
vi.mock("@/lib/auth", () => ({ useAuth: () => ({ userId: h.userId }), useSessionRefresh: () => async () => {} }));
vi.mock("sonner", () => ({ toast: { error: h.toastError, success: vi.fn() } }));

beforeEach(() => {
  h.calls = [];
  h.updateUser.mockClear();
  h.profileUpdate.mockClear();
  h.toastError.mockClear();
  h.userId = "a0000000-0000-4000-8000-000000000002";
  document.cookie = "locale=; Max-Age=0; Path=/";
});

describe("updateUserLocale", () => {
  it("calls supabase.auth.updateUser({ data: { locale } })", async () => {
    const { updateUserLocale } = await import("@/features/auth/data/locale.repo");
    await updateUserLocale("en");
    expect(h.updateUser).toHaveBeenCalledWith({ data: { locale: "en" } });
  });

  it("throws when Supabase reports an error", async () => {
    h.updateUser.mockResolvedValueOnce({ error: new Error("nope") });
    const { updateUserLocale } = await import("@/features/auth/data/locale.repo");
    await expect(updateUserLocale("pl")).rejects.toThrow("nope");
  });
});

async function renderLanguageForm(start: "pl" | "en" = "pl") {
  const React = await import("react");
  const { render, screen } = await import("@testing-library/react");
  const { I18nextProvider } = await import("react-i18next");
  const { createI18n } = await import("@/i18n/instance");
  const { LanguageForm } = await import("@/features/settings/ui/language-form");
  const i18n = createI18n(start);
  render(React.createElement(I18nextProvider, { i18n }, React.createElement(LanguageForm, {})));
  return { i18n, select: screen.getByRole("combobox") };
}

describe("LanguageForm", () => {
  it("saves profiles.locale, then syncs user_metadata.locale, and switches the language and cookie", async () => {
    const { fireEvent, waitFor } = await import("@testing-library/react");
    const { i18n, select } = await renderLanguageForm("pl");

    fireEvent.change(select, { target: { value: "en" } });

    await waitFor(() => expect(h.updateUser).toHaveBeenCalledWith({ data: { locale: "en" } }));
    expect(h.profileUpdate).toHaveBeenCalledWith({ locale: "en" }, "a0000000-0000-4000-8000-000000000002");
    // The profile first: user_metadata's USER_UPDATED re-reads the session, which must see the new locale.
    expect(h.calls).toEqual(["profiles.update", "user_metadata"]);
    expect(i18n.language).toBe("en");
    expect(document.cookie).toContain("locale=en");
    expect(h.toastError).not.toHaveBeenCalled();
  });

  it("still switches (cookie + metadata) and says so when the profile can't be saved", async () => {
    h.profileUpdate.mockResolvedValueOnce({ error: new Error("offline") });
    const { fireEvent, waitFor } = await import("@testing-library/react");
    const { i18n, select } = await renderLanguageForm("en");

    fireEvent.change(select, { target: { value: "pl" } });

    await waitFor(() => expect(h.updateUser).toHaveBeenCalledWith({ data: { locale: "pl" } }));
    expect(h.toastError).toHaveBeenCalledTimes(1);
    expect(i18n.language).toBe("pl");
  });
});
