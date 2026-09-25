import { Link, useParams, useRouterState } from "@tanstack/react-router";
import { Icon } from "@/components/ui/icon";
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
  { title: "Overview", to: "/projects/$projectId", icon: "grid_view" },
  { title: "Stages", to: "/projects/$projectId/stages", icon: "checklist" },
  { title: "Plan", to: "/projects/$projectId/plan", icon: "floor" },
  { title: "Photos", to: "/projects/$projectId/photos", icon: "photo_camera" },
  { title: "Design", to: "/projects/$projectId/design", icon: "palette" },
  { title: "Budget", to: "/projects/$projectId/budget", icon: "account_balance_wallet" },
  { title: "Chat", to: "/projects/$projectId/chat", icon: "chat_bubble" },
  { title: "Updates", to: "/projects/$projectId/updates", icon: "notifications" },
  { title: "AI knowledge", to: "/projects/$projectId/knowledge", icon: "menu_book" },
  { title: "Team", to: "/projects/$projectId/team", icon: "group" },
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
            <Icon name="construction" size={22} />
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
                    <Icon name="folder_open" size={20} />
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
                          <Icon name={item.icon} size={20} />
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
