export type NavItem = {
  title: string;
  /** Path segment after /projects/$projectId ("" is the overview). */
  section: string;
  /** Material Symbols Outlined glyph name, rendered via `ui/icon`. */
  icon: string;
  managerOnly?: boolean;
};

export const projectNav: NavItem[] = [
  { title: "Overview", section: "", icon: "grid_view" },
  { title: "Stages", section: "stages", icon: "checklist" },
  { title: "Plan", section: "plan", icon: "floor" },
  { title: "Photos", section: "photos", icon: "photo_camera" },
  { title: "Design", section: "design", icon: "palette" },
  { title: "Budget", section: "budget", icon: "account_balance_wallet", managerOnly: true },
  { title: "Chat", section: "chat", icon: "chat_bubble" },
  { title: "Updates", section: "updates", icon: "notifications", managerOnly: true },
  { title: "AI knowledge", section: "knowledge", icon: "menu_book", managerOnly: true },
  { title: "Team", section: "team", icon: "group", managerOnly: true },
];

export const managerOnlySections = projectNav.filter((i) => i.managerOnly).map((i) => i.section);

export const projectPath = (projectId: string, section: string) =>
  section ? `/projects/${projectId}/${section}` : `/projects/${projectId}`;
