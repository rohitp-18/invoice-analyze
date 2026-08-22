import { AppSidebar } from "@/components/dashboard/appSidebar";
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  Clock3,
  DollarSign,
  FileText,
  UploadCloud,
} from "lucide-react";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbList,
  BreadcrumbPage,
} from "@/components/ui/breadcrumb";
import { Separator } from "@/components/ui/separator";
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar";

export default function Page() {
  const stats = [
    {
      title: "Total Invoices",
      value: "1,284",
      detail: "+34 this week",
      icon: FileText,
    },
    {
      title: "Processed",
      value: "1,192",
      detail: "92.8% success rate",
      icon: CheckCircle2,
    },
    {
      title: "In Queue",
      value: "37",
      detail: "Average wait: 1m 40s",
      icon: Clock3,
    },
    {
      title: "Detected Spend",
      value: "$246,910",
      detail: "Current month",
      icon: DollarSign,
    },
  ];

  const recentUploads = [
    {
      file: "august-office-supplies.pdf",
      vendor: "Apex Supplies",
      amount: "$1,280.55",
      status: "Processed",
      statusClass: "text-emerald-300",
    },
    {
      file: "travel-receipt-17.jpg",
      vendor: "Skyline Air",
      amount: "$286.14",
      status: "Review",
      statusClass: "text-amber-300",
    },
    {
      file: "hosting-bill-july.png",
      vendor: "Cloudnova",
      amount: "$419.00",
      status: "Queued",
      statusClass: "text-cyan-300",
    },
    {
      file: "vendor-invoice-9942.pdf",
      vendor: "Northwind Parts",
      amount: "$3,904.10",
      status: "Processed",
      statusClass: "text-emerald-300",
    },
  ];

  return (
    <SidebarInset>
      <header className="sticky top-0 z-10 flex h-16 shrink-0 items-center gap-2 border-b bg-background/95 px-4 backdrop-blur">
        <SidebarTrigger className="-ml-1" />
        <Separator orientation="vertical" className="mr-2 h-4" />
        <Breadcrumb>
          <BreadcrumbList>
            <BreadcrumbItem>
              <BreadcrumbPage>Invoice Operations Dashboard</BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>
      </header>

      <div className="flex flex-1 flex-col gap-4 p-4 md:p-6">
        <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {stats.map((item) => {
            const Icon = item.icon;

            return (
              <article
                key={item.title}
                className="rounded-xl border border-border/60 bg-card/70 p-4 shadow-sm"
              >
                <div className="flex items-center justify-between">
                  <p className="text-sm text-muted-foreground">{item.title}</p>
                  <Icon className="size-4 text-cyan-400" />
                </div>
                <p className="mt-2 text-2xl font-semibold tracking-tight">
                  {item.value}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {item.detail}
                </p>
              </article>
            );
          })}
        </section>

        <section className="grid gap-4 lg:grid-cols-[1.6fr_1fr]">
          <article className="rounded-xl border border-border/60 bg-card/70 p-4 shadow-sm">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-base font-semibold">Recent Uploads</h2>
              <a
                href="/invoice/upload"
                className="inline-flex items-center gap-1 rounded-md border border-border px-3 py-1.5 text-xs font-medium text-muted-foreground transition hover:text-foreground"
              >
                <UploadCloud className="size-3.5" />
                Upload New
              </a>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full min-w-[560px] text-sm">
                <thead>
                  <tr className="border-b border-border/60 text-left text-xs uppercase tracking-wide text-muted-foreground">
                    <th className="pb-2 font-medium">File</th>
                    <th className="pb-2 font-medium">Vendor</th>
                    <th className="pb-2 font-medium">Amount</th>
                    <th className="pb-2 font-medium">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {recentUploads.map((row) => (
                    <tr
                      key={row.file}
                      className="border-b border-border/40 last:border-0"
                    >
                      <td className="py-3 pr-4 text-foreground">{row.file}</td>
                      <td className="py-3 pr-4 text-muted-foreground">
                        {row.vendor}
                      </td>
                      <td className="py-3 pr-4 text-foreground">
                        {row.amount}
                      </td>
                      <td className="py-3">
                        <span className={`font-medium ${row.statusClass}`}>
                          {row.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </article>

          <article className="rounded-xl border border-border/60 bg-card/70 p-4 shadow-sm">
            <h2 className="mb-4 text-base font-semibold">Pipeline Health</h2>

            <div className="space-y-3">
              <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-3">
                <div className="flex items-center gap-2 text-sm font-medium text-emerald-300">
                  <CheckCircle2 className="size-4" />
                  OCR and extraction services healthy
                </div>
              </div>

              <div className="rounded-lg border border-cyan-500/30 bg-cyan-500/10 p-3">
                <div className="flex items-center gap-2 text-sm font-medium text-cyan-300">
                  <Activity className="size-4" />
                  37 documents currently in queue
                </div>
              </div>

              <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-3">
                <div className="flex items-center gap-2 text-sm font-medium text-amber-300">
                  <AlertTriangle className="size-4" />4 invoices flagged for
                  manual review
                </div>
              </div>
            </div>
          </article>
        </section>
      </div>
    </SidebarInset>
  );
}
