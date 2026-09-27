import type en from "@/i18n/common/en.json";
import type work from "@/features/work/i18n/en.json";
import type { ProjectRole } from "@/lib/database.types";

/**
 * A label under `common:nav.*`, or, when a section's owning feature has no shared `common` key for
 * it (see README → Internationalization: "you can't edit common"), a `<feature>:nav.*` key from
 * that feature's own namespace.
 */
export type NavLabelKey = `common:nav.${keyof typeof en.nav}` | `work:nav.${keyof typeof work.nav}`;

export type NavItem = {
  /** Stable id for React keys and tests. */
  key: string;
  /** Path segment after /projects/$projectId ("" is the overview). */
  section: string;
  /** Material Symbols Outlined glyph name, rendered via `ui/icon`. */
  icon: string;
  /** i18n key: render with `t(item.labelKey)`. */
  labelKey: NavLabelKey;
  /** Project roles that see this section (in the rail, the phone bar and the route guard). */
  roles: ProjectRole[];
  /** Phone bottom bar: a tab of its own, or a row in the "More" sheet. The desktop rail shows both. */
  placement: "tab" | "more";
};

const everyone: ProjectRole[] = ["manager", "client"];
const managers: ProjectRole[] = ["manager"];

/** Project sections, in rail order. */
export const projectNav: NavItem[] = [
  { key: "overview", section: "", icon: "grid_view", labelKey: "common:nav.overview", roles: everyone, placement: "tab" },
  // Stages + the floor plan merged into one Progress page with a timeline/plan tab (T13). No
  // `common:nav.progress` key exists (features can't edit `common`), hence the `work:` namespace key.
  { key: "progress", section: "progress", icon: "checklist", labelKey: "work:nav.progress", roles: everyone, placement: "tab" },
  { key: "photos", section: "photos", icon: "photo_camera", labelKey: "common:nav.photos", roles: everyone, placement: "tab" },
  { key: "design", section: "design", icon: "palette", labelKey: "common:nav.design", roles: everyone, placement: "more" },
  {
    key: "budget",
    section: "budget",
    icon: "account_balance_wallet",
    labelKey: "common:nav.budget",
    roles: managers,
    placement: "more",
  },
  { key: "chat", section: "chat", icon: "chat_bubble", labelKey: "common:nav.chat", roles: everyone, placement: "tab" },
  { key: "updates", section: "updates", icon: "notifications", labelKey: "common:nav.updates", roles: managers, placement: "more" },
  { key: "knowledge", section: "knowledge", icon: "menu_book", labelKey: "common:nav.knowledge", roles: managers, placement: "more" },
  { key: "team", section: "team", icon: "group", labelKey: "common:nav.team", roles: managers, placement: "more" },
];

/** The sections a role sees, in rail order. */
export function navItemsFor(role: ProjectRole, placement?: NavItem["placement"]): NavItem[] {
  return projectNav.filter((i) => i.roles.includes(role) && (!placement || i.placement === placement));
}

/** Sections a client may not open (the project layout redirects them). */
export const managerOnlySections: string[] = projectNav.filter((i) => !i.roles.includes("client")).map((i) => i.section);

/** The URL of a project section: `/projects/<id>` or `/projects/<id>/<section>`. */
export const projectPath = (projectId: string, section: string) =>
  section ? `/projects/${projectId}/${section}` : `/projects/${projectId}`;

/** The router `to` of a project section (pass `params={{ projectId }}` alongside). */
export const projectRoute = (section: string) =>
  (section ? `/projects/$projectId/${section}` : "/projects/$projectId") as "/projects/$projectId";
