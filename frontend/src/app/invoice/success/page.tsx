import Link from "next/link";
import { CheckCircle2, FileUp, LayoutDashboard } from "lucide-react";
import Navbar from "@/components/navbar";

type SuccessPageProps = {
  searchParams?: Promise<{ file?: string }>;
};

export default async function InvoiceUploadSuccessPage({
  searchParams,
}: SuccessPageProps) {
  const params = searchParams ? await searchParams : undefined;
  const fileName = params?.file;

  return (
    <main className="flex min-h-screen flex-col bg-slate-950 text-white">
      <Navbar />

      <section className="flex flex-1 items-center justify-center bg-[radial-gradient(circle_at_top,_rgba(56,189,248,0.22),_transparent_42%),radial-gradient(circle_at_80%_20%,_rgba(34,197,94,0.18),_transparent_35%)] px-6 py-16">
        <div className="w-full max-w-2xl rounded-2xl border border-emerald-300/20 bg-slate-900/70 p-8 text-center shadow-xl backdrop-blur">
          <div className="mx-auto mb-5 flex size-14 items-center justify-center rounded-full border border-emerald-300/30 bg-emerald-400/10">
            <CheckCircle2 className="size-8 text-emerald-300" />
          </div>

          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-emerald-300">
            Upload Complete
          </p>
          <h1 className="mt-3 text-3xl font-semibold text-white md:text-4xl">
            Invoice uploaded successfully
          </h1>
          <p className="mt-4 text-slate-300">
            Your document is now queued for AI extraction and validation.
          </p>

          <div className="mt-6 rounded-xl border border-white/10 bg-slate-950/60 px-4 py-3 text-left text-sm text-slate-300">
            <p className="font-medium text-slate-100">Uploaded file</p>
            <p className="mt-1 break-all">{fileName || "Invoice document"}</p>
          </div>

          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <Link
              href="/invoice/upload"
              className="inline-flex items-center gap-2 rounded-lg border border-white/25 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-white/10"
            >
              <FileUp className="size-4" />
              Upload Another
            </Link>
            <Link
              href="/dashboard"
              className="inline-flex items-center gap-2 rounded-lg bg-cyan-400 px-5 py-2.5 text-sm font-semibold text-slate-950 transition hover:bg-cyan-300"
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
