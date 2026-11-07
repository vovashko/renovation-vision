// Settings → Notifications (T41): the repository reads each group's effective email frequency through
// notification_pref (saved, else the role's default) and saves one row per kind; the list shows the default with a
// "Default" badge until a choice is saved, and change requests as always emailed.
import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { I18nextProvider } from "react-i18next";
import { createI18n } from "@/i18n/instance";

const h = vi.hoisted(() => ({
  saved: [] as { kind: string; frequency: string }[],
  rpc: vi.fn(),
  upsert: vi.fn(async (_rows: unknown, _opts: unknown) => ({ data: null, error: null })),
  filters: [] as [string, unknown][],
}));

vi.mock("@/lib/supabase", () => ({
  supabase: {
    from: (table: string) => {
      const q = {
        select: () => q,
        eq: (column: string, value: unknown) => {
          h.filters.push([column, value]);
          return q;
        },
        upsert: (rows: unknown, opts: unknown) => h.upsert(rows, opts),
        then: (resolve: (v: unknown) => unknown) => resolve({ data: table === "notification_preferences" ? h.saved : [], error: null }),
      };
      return q;
    },
    rpc: (fn: string, args: { p_user: string; p_kind: string; p_channel: string }) => {
      h.rpc(fn, args);
      // notification_pref: the saved row, else the client default (daily).
      return Promise.resolve({ data: h.saved.find((r) => r.kind === args.p_kind)?.frequency ?? "daily", error: null });
    },
  },
}));

const { commsRepo } = await import("@/features/comms/data/comms.repo");
const { EmailPreferencesList } = await import("@/features/comms/ui/notification-preferences");

beforeEach(() => {
  h.saved = [];
  h.filters = [];
  h.rpc.mockClear();
  h.upsert.mockClear();
});

describe("commsRepo email preferences", () => {
  it("nothing saved: every group shows the default notification_pref returns", async () => {
    const prefs = await commsRepo.emailPreferences("u2");
    expect(prefs).toEqual({
      progress: { frequency: "daily", saved: false },
      media: { frequency: "daily", saved: false },
      documents: { frequency: "daily", saved: false },
      announcements: { frequency: "daily", saved: false },
    });
    expect(h.rpc).toHaveBeenCalledWith("notification_pref", { p_user: "u2", p_kind: "stage_status", p_channel: "email" });
    expect(h.filters).toEqual(
      expect.arrayContaining([
        ["user_id", "u2"],
        ["channel", "email"],
      ]),
    );
  });

  it("saved rows win and are marked saved", async () => {
    h.saved = [
      { kind: "photo_published", frequency: "instant" },
      { kind: "render_published", frequency: "instant" },
      { kind: "manual", frequency: "off" },
    ];
    const prefs = await commsRepo.emailPreferences("u2");
    expect(prefs.media).toEqual({ frequency: "instant", saved: true });
    expect(prefs.announcements).toEqual({ frequency: "off", saved: true });
    expect(prefs.progress).toEqual({ frequency: "daily", saved: false });
  });

  it("saving a group writes one email row per kind in it", async () => {
    await commsRepo.saveEmailPreference("u2", "media", "instant");
    expect(h.upsert).toHaveBeenCalledWith(
      [
        { user_id: "u2", kind: "photo_published", channel: "email", frequency: "instant" },
        { user_id: "u2", kind: "render_published", channel: "email", frequency: "instant" },
      ],
      { onConflict: "user_id,kind,channel" },
    );
  });
});

describe("EmailPreferencesList", () => {
  const preferences = {
    progress: { frequency: "daily" as const, saved: false },
    media: { frequency: "instant" as const, saved: true },
    documents: { frequency: "off" as const, saved: true },
    announcements: { frequency: "daily" as const, saved: false },
  };

  it("shows each group's frequency, a Default badge where nothing is saved, and change requests as always emailed", () => {
    render(<EmailPreferencesList preferences={preferences} onChange={() => {}} />);
    expect(screen.getByRole("combobox", { name: "Email for Progress" })).toHaveValue("daily");
    expect(screen.getByRole("combobox", { name: "Email for Photos and designs" })).toHaveValue("instant");
    expect(screen.getByRole("combobox", { name: "Email for Documents" })).toHaveValue("off");
    expect(screen.getAllByText("Default")).toHaveLength(2);
    expect(screen.getByText("Always emailed right away")).toBeInTheDocument();
    expect(screen.getAllByText("In the app: always")).toHaveLength(5);
  });

  it("picking a frequency reports the group and the choice", () => {
    const onChange = vi.fn();
    render(<EmailPreferencesList preferences={preferences} onChange={onChange} />);
    fireEvent.change(screen.getByRole("combobox", { name: "Email for Announcements" }), { target: { value: "instant" } });
    expect(onChange).toHaveBeenCalledWith("announcements", "instant");
  });

  it("in Polish", () => {
    render(
      <I18nextProvider i18n={createI18n("pl")}>
        <EmailPreferencesList preferences={preferences} onChange={() => {}} />
      </I18nextProvider>,
    );
    const select = screen.getByRole("combobox", { name: "E-mail: Postęp prac" });
    expect(within(select).getByRole("option", { name: "Codzienne podsumowanie o 7:00" })).toBeInTheDocument();
    expect(screen.getByText("Zawsze wysyłane od razu")).toBeInTheDocument();
  });
});
