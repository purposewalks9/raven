"use client";

import * as React from "react";
import { ChevronRight } from "lucide-react";

import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";
import { DocSchema } from "@/lib/types";
import Link from "next/link";
import { usePathname } from "next/navigation";

export function AppSidebar({
  docSchema,
  ...props
}: React.ComponentProps<typeof Sidebar> & {
  docSchema: DocSchema;
}) {
  const pathname = usePathname();
  const { toggleSidebar, isMobile } = useSidebar();
  const data = {
    navMain: docSchema,
  };

  // track collapsed state per group, default all open
  const [collapsed, setCollapsed] = React.useState<Record<string, boolean>>({});

  const toggleGroup = (title: string) => {
    setCollapsed((prev) => ({ ...prev, [title]: !prev[title] }));
  };

  return (
    <Sidebar
      className="mt-14 border-r border-border"
      style={{ "--sidebar-width": "14rem" } as React.CSSProperties}
      {...props}
    >
      {/* mt-14 > for header height */}
      <SidebarContent
        className="max-h-[calc(100vh-100px)] overflow-y-auto"
        style={{
          maskImage:
            "linear-gradient(to bottom, transparent 0, rgba(0,0,0,0.2) 1rem, black 2rem, black calc(100% - 2rem), rgba(0,0,0,0.2) calc(100% - 1rem), transparent 100%)",
        }}
      >
        <div className="h-4 shrink-0" />
        {data.navMain.map((group) => {
          const isCollapsed = collapsed[group.title];
          return (
            <SidebarGroup key={group.title} className="px-2 py-1">
              <button
                type="button"
                onClick={() => toggleGroup(group.title)}
                className="flex w-full items-center justify-between rounded-sm px-2 py-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground/70 hover:text-foreground"
              >
                <SidebarGroupLabel className="p-0 text-xs font-semibold uppercase tracking-wider text-muted-foreground/70">
                  {group.title}
                </SidebarGroupLabel>
                <ChevronRight
                  className={`h-3.5 w-3.5 shrink-0 transition-transform duration-200 ${
                    isCollapsed ? "rotate-0" : "rotate-90"
                  }`}
                />
              </button>

              {!isCollapsed && (
                <SidebarGroupContent className="mt-0.5">
                  <SidebarMenu className="gap-0.5">
                    {group.items.map((navItem) => (
                      <SidebarMenuItem key={navItem.title}>
                        <SidebarMenuButton
                          size="sm"
                          className="h-7 rounded-md border-transparent pl-3 text-[13px] text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground data-[active=true]:border-l-primary data-[active=true]:bg-accent/60 data-[active=true]:font-medium data-[active=true]:text-foreground"
                          asChild
                          isActive={pathname === `/docs/${navItem.id}`}
                          onClick={() => {
                            if (isMobile) {
                              toggleSidebar();
                            }
                          }}
                        >
                          <Link href={`/docs/${navItem.id}`}>
                            {navItem.title}
                          </Link>
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                    ))}
                  </SidebarMenu>
                </SidebarGroupContent>
              )}
            </SidebarGroup>
          );
        })}
        <div className="h-4 shrink-0" />
      </SidebarContent>
    </Sidebar>
  );
}