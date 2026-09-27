/** @deprecated moved to @/shared/ui/nav-config (i18n `labelKey`, `roles`, `placement`). This shim goes away in T17. */
import en from "@/i18n/common/en.json";
import work from "@/features/work/i18n/en.json";
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

/** English title for a `labelKey` from either `common:nav.*` or `work:nav.*` (the only feature namespace used in nav-config so far). */
function titleFor(labelKey: string): string {
  if (labelKey.startsWith("work:nav.")) return work.nav[labelKey.replace("work:nav.", "") as keyof typeof work.nav];
  return en.nav[labelKey.replace("common:nav.", "") as keyof typeof en.nav];
}

/** @deprecated English labels. Use `projectNav` / `navItemsFor` from @/shared/ui/nav-config with `t(item.labelKey)`. */
export const projectNav: NavItem[] = navConfig.map((i) => ({
  title: titleFor(i.labelKey),
  section: i.section,
  icon: i.icon,
  ...(i.roles.includes("client") ? {} : { managerOnly: true }),
}));
