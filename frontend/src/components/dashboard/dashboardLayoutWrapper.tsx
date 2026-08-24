"use client";

import React, { useEffect } from "react";
import { AppSidebar } from "@/components/dashboard/appSidebar";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { GalleryVerticalEnd, UploadCloud } from "lucide-react";
import Link from "next/link";
import { useSelector } from "react-redux";
import { RootState } from "@/store/store";
import { useRouter } from "next/navigation";

export function DashboardLayoutWrapper({ children }: { children: React.ReactNode }) {
  const { user, role, loading } = useSelector((state: RootState) => state.auth);
  const userRole = (role || user?.role || "EMPLOYEE").toUpperCase();

  const router = useRouter();

  useEffect(() => {
    if (!user && !loading) {
      router.push("/login");
    }
  }, [user, loading, router])

  if (!user) return null;

  return (
    <SidebarProvider className="bg-slate-950 text-slate-100 min-h-screen">
      <AppSidebar />
      <div className="flex-1 flex flex-col bg-slate-950 text-slate-100 min-h-screen min-w-0 overflow-x-hidden">
        {/* Mobile Top Header (Visible on screens < md) */}
        <header className="sticky top-0 z-30 flex md:hidden h-14 items-center justify-between border-b border-white/10 bg-slate-950/85 px-4 backdrop-blur-md">
          <div className="flex items-center gap-2.5">
            {/* Mobile Hamburger / Sidebar Menu Trigger */}
            <SidebarTrigger
              className="flex size-9 items-center justify-center rounded-lg border border-white/15 bg-slate-900 text-slate-200 hover:bg-slate-800 hover:text-white transition-colors"
              aria-label="Open Sidebar Menu"
            />
            <Link href="/dashboard" className="flex items-center gap-2">
              <div className="flex size-7 items-center justify-center rounded-md bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">
                <GalleryVerticalEnd className="size-3.5" />
              </div>
              <div className="flex flex-col leading-none">
                <span className="font-semibold text-xs text-white">Invoice Validate AI</span>
                <span className="text-[9px] text-cyan-400/90 font-medium tracking-wide">{userRole}</span>
              </div>
            </Link>
          </div>

          <div className="flex items-center gap-2">
            <Link
              href="/invoice/upload"
              className="flex items-center gap-1.5 rounded-lg bg-cyan-400 px-3 py-1.5 text-xs font-semibold text-slate-950 shadow-sm transition hover:bg-cyan-300 active:scale-95"
            >
              <UploadCloud className="size-3.5" />
              <span>Upload</span>
            </Link>
          </div>
        </header>

        {/* Main Content Area */}
        <div className="flex-1 bg-slate-950 text-slate-100 overflow-auto">
          {children}
        </div>
      </div>
    </SidebarProvider>
  );
}
