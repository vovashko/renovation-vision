import { Link, useParams, useRouterState } from "@tanstack/react-router";
import { FolderKanban } from "lucide-react";
import logo from "@/assets/renovision-logo.svg";
import logoMark from "@/assets/renovision-mark.svg";
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
        <Link to="/" onClick={close} aria-label="RenoVision home" className="flex items-center gap-2 px-2 py-3">
          {collapsed ? (
            <img src={logoMark} alt="RenoVision" className="h-9 w-9 shrink-0" />
          ) : (
            <img src={logo} alt="RenoVision" className="h-9 w-auto max-w-[9.5rem]" />
          )}
          {!collapsed && isManager && (
            <span className="rounded-md bg-foreground px-1.5 py-0.5 text-[10px] font-semibold tracking-wide text-background uppercase">
              Manager
            </span>
          )}
        </Link>
      </SidebarHeader>
      <SidebarContent>
        {isManager && (
          <SidebarGroup>
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
          </SidebarGroup>
        )}
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
