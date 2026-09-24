import { useEffect, useRef } from "react";
import { Link, useRouterState } from "@tanstack/react-router";
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

const items = [
  { title: "Overview", url: "/", icon: "dashboard" },
  { title: "Stages", url: "/stages", icon: "checklist" },
  { title: "Photos", url: "/photos", icon: "photo_camera" },
  { title: "Plan", url: "/plan", icon: "map" },
  { title: "Design", url: "/design", icon: "palette" },
  { title: "Chat", url: "/chat", icon: "chat" },
];

export function AppSidebar() {
  const { state, setOpen } = useSidebar();

  // M3: the standard drawer is for expanded widths; between md and lg start as a rail.
  // Runs on mount and when crossing into that range, so a manual expand is kept.
  const setOpenRef = useRef(setOpen);
  setOpenRef.current = setOpen;
  useEffect(() => {
    const mq = window.matchMedia("(min-width: 768px) and (max-width: 1023px)");
    const apply = () => mq.matches && setOpenRef.current(false);
    apply();
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, []);
  const collapsed = state === "collapsed";
  const path = useRouterState({ select: (r) => r.location.pathname });

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="p-0">
        <Link
          to="/"
          aria-label="RenoTrack home"
          className="flex items-center gap-3 rounded-full px-4 pb-5 pt-4 focus-visible:outline-2 focus-visible:outline-primary group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:px-0"
        >
          <Icon name="construction" className="text-primary" />
          {!collapsed && <span className="text-title-sm text-on-surface-variant">RenoTrack</span>}
        </Link>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup className="p-0">
          <SidebarGroupLabel>Project</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {items.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild isActive={path === item.url}>
                    <Link to={item.url}>
                      <Icon name={item.icon} fill={path === item.url} />
                      {!collapsed && <span>{item.title}</span>}
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  );
}
