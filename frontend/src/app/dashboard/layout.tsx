import { AppSidebar } from "@/components/dashboard/appSidebar";
import { SidebarProvider } from "@/components/ui/sidebar";
import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";

export const metadata: Metadata = {
  title: "Invoice Validate AI",
  description:
    "AI-powered invoice and expense extraction with structured output.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <SidebarProvider className="bg-slate-950 text-slate-100 min-h-screen">
      <AppSidebar />
      <div className="flex-1 bg-slate-950 text-slate-100 min-h-screen overflow-auto">
        {children}
      </div>
    </SidebarProvider>
  );
}
