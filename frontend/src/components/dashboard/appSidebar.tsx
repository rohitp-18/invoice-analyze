"use client";

import * as React from "react";
import { GalleryVerticalEnd } from "lucide-react";

import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  SidebarRail,
} from "@/components/ui/sidebar";
import Link from "next/link";

const data = {
  navMain: [
    {
      title: "Overview",
      url: "/dashboard",
      items: [
        {
          title: "Dashboard Home",
          url: "/dashboard",
          isActive: true,
        },
        {
          title: "Upload Invoice",
          url: "/invoice/upload",
        },
      ],
    },
    {
      title: "Invoices",
      url: "/invoice/upload",
      items: [
        {
          title: "New Upload",
          url: "/invoice/upload",
        },
        {
          title: "Upload Success",
          url: "/invoice/success",
        },
        {
          title: "Processing Queue",
          url: "#",
        },
        {
          title: "Extraction History",
          url: "#",
        },
      ],
    },
    {
      title: "Operations",
      url: "#",
      items: [
        {
          title: "Validation Rules",
          url: "#",
        },
        {
          title: "Review Exceptions",
          url: "#",
        },
        {
          title: "Export Data",
          url: "#",
        },
      ],
    },
    {
      title: "Account",
      url: "#",
      items: [
        {
          title: "Profile",
          url: "#",
        },
        {
          title: "Billing",
          url: "#",
        },
        {
          title: "Teams & Members",
          url: "/dashboard/actions/teams",
        },
      ],
    },
  ],
};

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  return (
    <Sidebar {...props}>
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" render={<Link href="/dashboard" />}>
              <div className="flex aspect-square size-8 items-center justify-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground">
                <GalleryVerticalEnd className="size-4" />
              </div>
              <span className="font-medium">Invoice Validate AI</span>
              <div className="flex flex-col gap-0.5 leading-none"></div>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarMenu>
            {data.navMain.map((item) => (
              <SidebarMenuItem key={item.title}>
                <SidebarMenuButton render={<Link href={item.url} />}>
                  <span className="font-medium">{item.title}</span>
                </SidebarMenuButton>
                {item.items?.length ? (
                  <SidebarMenuSub>
                    {item.items.map((item) => (
                      <SidebarMenuSubItem key={item.title}>
                        <SidebarMenuSubButton
                          href={item.url}
                          isActive={item.isActive}
                        >
                          {item.title}
                        </SidebarMenuSubButton>
                      </SidebarMenuSubItem>
                    ))}
                  </SidebarMenuSub>
                ) : null}
              </SidebarMenuItem>
            ))}
          </SidebarMenu>
        </SidebarGroup>
      </SidebarContent>
      <SidebarRail />
    </Sidebar>
  );
}
