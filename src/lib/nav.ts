/** @deprecated moved to @/shared/ui/nav-config (i18n `labelKey`, `roles`, `placement`). This shim goes away in T17. */
import en from "@/i18n/common/en.json";
import { projectNav as navConfig } from "@/shared/ui/nav-config";

export { managerOnlySections, projectPath } from "@/shared/ui/nav-config";

/** @deprecated Use `NavItem` from @/shared/ui/nav-config. */
export type NavItem = {
  /** English label. */
  title: string;
  /** Path segment after /projects/$projectId ("" is the overview). */
  section: string;
  /** Material Symbols Outlined glyph name, rendered via `ui/icon`. */
  icon: string;
  managerOnly?: boolean;
};

/** @deprecated English labels. Use `projectNav` / `navItemsFor` from @/shared/ui/nav-config with `t(item.labelKey)`. */
export const projectNav: NavItem[] = navConfig.map((i) => ({
  title: en.nav[i.key as keyof typeof en.nav],
  section: i.section,
  icon: i.icon,
  ...(i.roles.includes("client") ? {} : { managerOnly: true }),
}));
