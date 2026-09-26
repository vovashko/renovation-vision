import { Link, useParams, useRouterState } from "@tanstack/react-router";
import { FolderKanban, Hammer } from "lucide-react";
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
import { useAuth } from "@/lib/auth";
import { projectNav, projectPath } from "@/lib/nav";
import { useProject } from "@/lib/queries";

export function AppSidebar() {
  const { state, isMobile, setOpenMobile } = useSidebar();
  const collapsed = state === "collapsed" && !isMobile;
  const path = useRouterState({ select: (r) => r.location.pathname });
  const { projectId } = useParams({ strict: false }) as { projectId?: string };
  const { data: project } = useProject(projectId);
  const isManager = useAuth().profile?.account_type === "manager";
  const items = projectNav.filter((i) => isManager || !i.managerOnly);
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
                {isManager && <span className="rounded-md bg-foreground px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-background">Manager</span>}
              </span>
              <span className="text-xs text-muted-foreground">{isManager ? "Site admin portal" : "Live progress"}</span>
            </div>
          )}
        </Link>
      </SidebarHeader>
      <SidebarContent>
        {isManager && <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton asChild isActive={path === "/projects"} tooltip="All projects">
                  <Link to="/projects" onClick={close} className="flex items-center gap-2">
                    <FolderKanban className="h-4 w-4" />
                    {!collapsed && <span>All projects</span>}
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>}
        {projectId && (
          <SidebarGroup>
            <SidebarGroupLabel className="truncate">{project?.name ?? "Project"}</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {items.map((item) => {
                  const href = projectPath(projectId, item.section);
                  const to = (item.section ? `/projects/$projectId/${item.section}` : "/projects/$projectId") as "/projects/$projectId";
                  return (
                    <SidebarMenuItem key={item.title}>
                      <SidebarMenuButton asChild isActive={path === href} tooltip={item.title}>
                        <Link to={to} params={{ projectId }} onClick={close} className="flex items-center gap-2">
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
