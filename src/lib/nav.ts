import { Bell, BookOpen, Camera, LayoutDashboard, ListChecks, Map, MessageCircle, Palette, Users, Wallet } from "lucide-react";

export type NavItem = {
  title: string;
  /** Path segment after /projects/$projectId ("" is the overview). */
  section: string;
  icon: typeof Map;
  managerOnly?: boolean;
};

export const projectNav: NavItem[] = [
  { title: "Overview", section: "", icon: LayoutDashboard },
  { title: "Stages", section: "stages", icon: ListChecks },
  { title: "Plan", section: "plan", icon: Map },
  { title: "Photos", section: "photos", icon: Camera },
  { title: "Design", section: "design", icon: Palette },
  { title: "Budget", section: "budget", icon: Wallet, managerOnly: true },
  { title: "Chat", section: "chat", icon: MessageCircle },
  { title: "Updates", section: "updates", icon: Bell, managerOnly: true },
  { title: "AI knowledge", section: "knowledge", icon: BookOpen, managerOnly: true },
  { title: "Team", section: "team", icon: Users, managerOnly: true },
];

export const managerOnlySections = projectNav.filter((i) => i.managerOnly).map((i) => i.section);

export const projectPath = (projectId: string, section: string) =>
  section ? `/projects/${projectId}/${section}` : `/projects/${projectId}`;
