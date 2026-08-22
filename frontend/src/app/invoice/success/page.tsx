import Link from "next/link";
import {
  CheckCircle2,
  FileUp,
  LayoutDashboard,
  Building2,
  Receipt,
  DollarSign,
  AlertTriangle,
  FileText,
  ShieldCheck,
} from "lucide-react";
import Navbar from "@/components/navbar";

type SuccessPageProps = {
  searchParams?: Promise<{
    file?: string;
    invoice_id?: string;
    invoice_number?: string;
    vendor?: string;
    amount?: string;
    currency?: string;
    status?: string;
    anomalies?: string;
  }>;
};

export default async function InvoiceUploadSuccessPage({
  searchParams,
}: SuccessPageProps) {
  const params = searchParams ? await searchParams : undefined;
  const fileName = params?.file || "Uploaded document";
  const invoiceNumber = params?.invoice_number || "INV-EXTRACTED";
  const vendorName = params?.vendor || "Detected Vendor";
  const amount = params?.amount ? parseFloat(params.amount) : null;
  const currency = params?.currency || "USD";
  const status = params?.status || "APPROVED";
  const anomaliesCount = params?.anomalies ? parseInt(params.anomalies, 10) : 0;

  const isFlagged = status === "FLAGGED" || anomaliesCount > 0;

  return (
    <main className="flex min-h-screen flex-col bg-slate-950 text-white">
      <Navbar />

      <section className="flex flex-1 items-center justify-center bg-[radial-gradient(circle_at_top,_rgba(56,189,248,0.22),_transparent_42%),radial-gradient(circle_at_80%_20%,_rgba(34,197,94,0.18),_transparent_35%)] px-4 py-12 md:py-16">
        <div className="w-full max-w-2xl rounded-2xl border border-emerald-300/20 bg-slate-900/80 p-6 md:p-8 text-center shadow-2xl backdrop-blur">
          {/* Status Icon */}
          <div
            className={`mx-auto mb-4 flex size-16 items-center justify-center rounded-full border ${
              isFlagged
                ? "border-amber-400/30 bg-amber-400/10 text-amber-300"
                : "border-emerald-400/30 bg-emerald-400/10 text-emerald-300"
            }`}
          >
            {isFlagged ? (
              <AlertTriangle className="size-8" />
            ) : (
              <CheckCircle2 className="size-8" />
            )}
          </div>

          <p
            className={`text-xs font-semibold uppercase tracking-[0.2em] ${
              isFlagged ? "text-amber-300" : "text-emerald-300"
            }`}
          >
            {isFlagged ? "Review Required" : "Extraction & Audit Complete"}
          </p>

          <h1 className="mt-2 text-2xl md:text-3xl font-bold text-white">
            {isFlagged
              ? "Invoice Processed with Alerts"
              : "Invoice Extracted & Verified"}
          </h1>
          <p className="mt-2 text-sm text-slate-300 max-w-md mx-auto">
            {isFlagged
              ? "Our AI detected policy or statistical anomalies that have been flagged for manager review."
              : "LangGraph pipeline completed OCR extraction, mathematical sum checks, and duplicate validation."}
          </p>

          {/* Extraction Summary Card */}
          <div className="mt-6 rounded-xl border border-white/10 bg-slate-950/70 p-5 text-left text-sm text-slate-300 shadow-inner">
            <div className="flex items-center justify-between border-b border-white/10 pb-3 mb-3">
              <div className="flex items-center gap-2">
                <FileText className="size-4 text-cyan-400" />
                <span className="font-semibold text-white">{fileName}</span>
              </div>
              <span
                className={`rounded-md px-2 py-0.5 text-xs font-semibold uppercase ${
                  status === "FLAGGED"
                    ? "bg-amber-500/20 text-amber-300 border border-amber-500/30"
                    : status === "PENDING_REVIEW"
                    ? "bg-cyan-500/20 text-cyan-300 border border-cyan-500/30"
                    : "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30"
                }`}
              >
                {status}
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <span className="text-xs text-slate-500 flex items-center gap-1">
                  <Receipt className="size-3" /> Invoice Number
                </span>
                <p className="font-medium text-slate-100 mt-0.5">
                  {invoiceNumber}
                </p>
              </div>

              <div>
                <span className="text-xs text-slate-500 flex items-center gap-1">
                  <Building2 className="size-3" /> Vendor
                </span>
                <p className="font-medium text-slate-100 mt-0.5">
                  {vendorName}
                </p>
              </div>

              <div>
                <span className="text-xs text-slate-500 flex items-center gap-1">
                  <DollarSign className="size-3" /> Total Amount
                </span>
                <p className="font-medium text-white text-base mt-0.5">
                  {amount !== null
                    ? `${currency} $${amount.toLocaleString("en-US", {
                        minimumFractionDigits: 2,
                      })}`
                    : "N/A"}
                </p>
              </div>

              <div>
                <span className="text-xs text-slate-500 flex items-center gap-1">
                  <ShieldCheck className="size-3" /> Anomaly Flags
                </span>
                <p
                  className={`font-medium mt-0.5 ${
                    anomaliesCount > 0 ? "text-amber-300" : "text-emerald-400"
                  }`}
                >
                  {anomaliesCount === 0
                    ? "0 Anomalies (Clean)"
                    : `${anomaliesCount} ${
                        anomaliesCount === 1 ? "flag detected" : "flags detected"
                      }`}
                </p>
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <Link
              href="/invoice/upload"
              className="inline-flex items-center gap-2 rounded-lg border border-white/20 bg-slate-900/60 px-5 py-2.5 text-sm font-semibold text-slate-200 transition hover:bg-slate-800 hover:text-white"
            >
              <FileUp className="size-4" />
              Upload Another
            </Link>
            <Link
              href="/dashboard"
              className="inline-flex items-center gap-2 rounded-lg bg-cyan-400 px-5 py-2.5 text-sm font-semibold text-slate-950 transition hover:bg-cyan-300 shadow-md shadow-cyan-950/50"
            >
              <LayoutDashboard className="size-4" />
              Go to Dashboard
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}
