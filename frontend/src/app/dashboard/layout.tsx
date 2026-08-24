import type { Metadata } from "next";
import { DashboardLayoutWrapper } from "@/components/dashboard/dashboardLayoutWrapper";

export const metadata: Metadata = {
  title: "Invoice Validate AI - Dashboard",
  description: "AI-powered invoice and expense extraction with automated compliance auditing.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <DashboardLayoutWrapper>{children}</DashboardLayoutWrapper>;
}
