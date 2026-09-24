import { Link, useParams, useRouterState } from "@tanstack/react-router";
import {
  BookOpen,
  Camera,
  FolderKanban,
  Hammer,
  LayoutDashboard,
  ListChecks,
  Map,
  MessageCircle,
  Palette,
  Bell,
  Users,
  Wallet,
} from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";
import { useProject } from "@/lib/queries";

const projectItems = [
  { title: "Overview", to: "/projects/$projectId", icon: LayoutDashboard },
  { title: "Stages", to: "/projects/$projectId/stages", icon: ListChecks },
  { title: "Plan", to: "/projects/$projectId/plan", icon: Map },
  { title: "Photos", to: "/projects/$projectId/photos", icon: Camera },
  { title: "Design", to: "/projects/$projectId/design", icon: Palette },
  { title: "Budget", to: "/projects/$projectId/budget", icon: Wallet },
  { title: "Chat", to: "/projects/$projectId/chat", icon: MessageCircle },
  { title: "Updates", to: "/projects/$projectId/updates", icon: Bell },
  { title: "AI knowledge", to: "/projects/$projectId/knowledge", icon: BookOpen },
  { title: "Team", to: "/projects/$projectId/team", icon: Users },
] as const;

export function AppSidebar() {
  const { state, isMobile, setOpenMobile } = useSidebar();
  const collapsed = state === "collapsed" && !isMobile;
  const path = useRouterState({ select: (r) => r.location.pathname });
  const { projectId } = useParams({ strict: false }) as { projectId?: string };
  const { data: project } = useProject(projectId);
  const close = () => isMobile && setOpenMobile(false);

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader>
        <Link to="/" onClick={close} className="flex items-center gap-2 px-2 py-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[image:var(--gradient-primary)] text-primary-foreground shadow-[var(--shadow-soft)]">
            <Hammer className="h-5 w-5" />
          </div>
          {!collapsed && (
            <div className="flex flex-col leading-tight">
              <span className="flex items-center gap-1.5 text-sm font-semibold">
                RenoTrack
                <span className="rounded-md bg-foreground px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-background">Manager</span>
              </span>
              <span className="text-xs text-muted-foreground">Site admin portal</span>
            </div>
          )}
        </Link>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton asChild isActive={path === "/"} tooltip="All projects">
                  <Link to="/" onClick={close} className="flex items-center gap-2">
                    <FolderKanban className="h-4 w-4" />
                    {!collapsed && <span>All projects</span>}
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
        {projectId && (
          <SidebarGroup>
            <SidebarGroupLabel className="truncate">{project?.name ?? "Project"}</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {projectItems.map((item) => {
                  const href = item.to.replace("$projectId", projectId);
                  return (
                    <SidebarMenuItem key={item.title}>
                      <SidebarMenuButton asChild isActive={path === href} tooltip={item.title}>
                        <Link to={item.to} params={{ projectId }} onClick={close} className="flex items-center gap-2">
                          <item.icon className="h-4 w-4" />
                          {!collapsed && <span>{item.title}</span>}
                        </Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  );
                })}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}
      </SidebarContent>
    </Sidebar>
  );
}
