"use client";

import * as React from "react";
import { useSelector } from "react-redux";
import { RootState } from "@/store/store";
import {
  GalleryVerticalEnd,
  LayoutDashboard,
  FileText,
  UploadCloud,
  FileSpreadsheet,
  Scale,
  PlusCircle,
  Users,
  User,
  CreditCard,
  ShieldAlert,
} from "lucide-react";

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

interface NavItem {
  title: string;
  url: string;
  isActive?: boolean;
  allowedRoles?: string[];
  allowedDepartments?: string[];
}

interface NavSection {
  title: string;
  url: string;
  allowedRoles?: string[];
  allowedDepartments?: string[];
  items?: NavItem[];
}

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  const { user, role } = useSelector((state: RootState) => state.auth);

  const userRole = (role || user?.role || "EMPLOYEE").toUpperCase();
  const userDept = (user?.department || "").toUpperCase();

  // Role Checker Helper
  const hasAccess = (
    allowedRoles?: string[],
    allowedDepartments?: string[]
  ): boolean => {
    // If no restrictions specified, everyone has access
    if (!allowedRoles && !allowedDepartments) return true;

    // Superadmin & Admin have universal access
    if (userRole === "ADMIN") return true;

    const roleMatched = allowedRoles
      ? allowedRoles.some((r) => r.toUpperCase() === userRole.toUpperCase())
      : false;

    const deptMatched = allowedDepartments
      ? allowedDepartments.some((d) => d.toUpperCase() === userDept.toUpperCase())
      : false;

    return roleMatched || deptMatched;
  };

  // Dynamic Navigation Matrix with RBAC Rules
  const navMain: NavSection[] = [
    {
      title: "Dashboard Home",
      url: "/dashboard",
    },
    {
      title: "Spend Analysis",
      url: "/dashboard/analysis"
    },
    {
      title: "Invoices",
      url: "/dashboard/invoices",
      items: [
        {
          title: "All Invoices",
          url: "/dashboard/invoices",
          allowedRoles: ["MANAGER", "AUDITOR", "COMPLIANCE", "FINANCE", "ADMIN"],
          allowedDepartments: ["FINANCE", "COMPLIANCE", "ADMIN", "AUDIT"],
        },
        {
          title: "Upload Invoice",
          url: "/invoice/upload",
        },
        {
          title: "My Invoices",
          url: "/dashboard/invoices/my",
        },
        {
          title: "Export Data (CSV)",
          url: "/dashboard/export",
          allowedRoles: ["MANAGER", "AUDITOR", "COMPLIANCE", "FINANCE", "ADMIN"],
          allowedDepartments: ["FINANCE", "COMPLIANCE", "ADMIN", "AUDIT"],
        },
      ],
    },
    {
      title: "Operations & Compliance",
      url: "/dashboard/compliance",
      // Accessible ONLY to Compliance, Admin, and Auditor
      allowedRoles: ["COMPLIANCE", "ADMIN", "AUDITOR"],
      allowedDepartments: ["COMPLIANCE", "ADMIN", "AUDIT"],
      items: [
        {
          title: "Compliance Policies",
          url: "/dashboard/compliance",
          allowedRoles: ["COMPLIANCE", "ADMIN", "AUDITOR"],
          allowedDepartments: ["COMPLIANCE", "ADMIN", "AUDIT"],
        },
        {
          title: "New Policy Rule",
          url: "/dashboard/compliance/new",
          allowedRoles: ["COMPLIANCE", "ADMIN"],
          allowedDepartments: ["COMPLIANCE", "ADMIN"],
        },
      ],
    },
    {
      title: "Organizations & Departments",
      url: "/dashboard/actions/teams",
      // Accessible to Managers, Admin, and Compliance
      allowedRoles: ["ADMIN", "MANAGER", "COMPLIANCE"],
      allowedDepartments: ["ADMIN", "COMPLIANCE", "FINANCE"],
      items: [
        {
          title: "Departments & Members",
          url: "/dashboard/actions/teams",
          allowedRoles: ["ADMIN", "MANAGER", "COMPLIANCE"],
          allowedDepartments: ["ADMIN", "COMPLIANCE", "FINANCE"],
        },
      ],
    },
    {
      title: "My Details",
      url: "/dashboard/profile",
      items: [
        {
          title: "Profile",
          url: "/dashboard/profile",
        },
        {
          title: "My Invoices",
          url: "/dashboard/invoices/my",
        },
        {
          title: "Logout",
          url: "/dashboard/logout",
        },
      ],
    }
  ];

  // Filter sections and nested items based on user authorization
  const filteredNavMain = navMain
    .filter((section) => hasAccess(section.allowedRoles, section.allowedDepartments))
    .filter((section) => (section.items && section.items.length > 0) || !section.items);

  return (
    <Sidebar className="border-r border-white/10 bg-slate-950 text-slate-100" {...props}>
      <SidebarHeader className="border-b border-white/10 bg-slate-950 p-3">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" render={<Link href="/dashboard" />} className="hover:bg-slate-900 data-[active=true]:bg-cyan-500/10">
              <div className="flex aspect-square size-8 items-center justify-center rounded-lg bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">
                <GalleryVerticalEnd className="size-4" />
              </div>
              <div className="flex flex-col gap-0.5 leading-none">
                <span className="font-semibold text-sm text-white">Invoice Validate AI</span>
                <span className="text-[10px] text-slate-400">
                  {userDept ? `${userDept} • ` : ""}{userRole}
                </span>
              </div>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      <SidebarContent className="bg-slate-950 text-slate-100">
        <SidebarGroup className="bg-slate-950">
          <SidebarMenu className="space-y-1">
            {filteredNavMain.map((section) => (
              <SidebarMenuItem key={section.title}>
                <SidebarMenuButton render={<Link href={section.url} />} className="text-slate-300 hover:text-white hover:bg-slate-900/80">
                  <span className="font-medium text-xs tracking-wide">{section.title}</span>
                </SidebarMenuButton>
                {section.items?.length ? (
                  <SidebarMenuSub className="border-white/10">
                    {section.items.map((item) => (
                      <SidebarMenuSubItem key={item.title}>
                        <SidebarMenuSubButton
                          href={item.url}
                          isActive={item.isActive}
                          className="text-slate-400 hover:text-slate-200 hover:bg-slate-900/60 data-[active=true]:text-cyan-300 data-[active=true]:bg-cyan-500/10"
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
