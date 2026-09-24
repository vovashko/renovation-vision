import { useEffect, useRef } from "react";
import { Link, useRouterState } from "@tanstack/react-router";
import { Icon } from "@/components/ui/icon";
import logoUrl from "@/assets/renovision-logo.svg";
import markUrl from "@/assets/renovision-mark.svg";
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
  { title: "Overview", url: "/", icon: "grid_view" },
  { title: "Stages", url: "/stages", icon: "checklist" },
  { title: "Photos", url: "/photos", icon: "photo_camera" },
  { title: "Plan", url: "/plan", icon: "floor" },
  { title: "Design", url: "/design", icon: "palette" },
  { title: "Chat", url: "/chat", icon: "chat_bubble" },
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
          aria-label="Home"
          className="mb-4 flex h-10 items-center rounded-md px-4 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:px-0"
        >
          {collapsed ? (
            <img src={markUrl} alt="Renovision" width={40} height={40} className="size-10" />
          ) : (
            <>
              {/* The lockup's wordmark is dark and only works on light surfaces; dark mode uses the mark. */}
              <img
                src={logoUrl}
                alt="Renovision"
                width={150}
                height={40}
                className="h-10 w-auto dark:hidden"
              />
              <img
                src={markUrl}
                alt="Renovision"
                width={40}
                height={40}
                className="hidden size-10 dark:block"
              />
            </>
          )}
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
