import Link from "next/link";
import Navbar from "@/components/navbar";

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col bg-slate-950 text-white">
      <Navbar />
      <section className="flex flex-1 items-center justify-center bg-[radial-gradient(circle_at_top,_rgba(56,189,248,0.22),_transparent_42%),radial-gradient(circle_at_80%_20%,_rgba(251,146,60,0.22),_transparent_36%)] px-6 py-24">
        <div className="mx-auto w-full max-w-3xl text-center">
          <p className="mb-4 text-sm font-medium uppercase tracking-[0.22em] text-cyan-300">
            Invoice Validate AI
          </p>
          <h1 className="text-4xl font-semibold tracking-tight text-white md:text-6xl">
            Extract invoice and expense data with AI
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-base text-slate-300 md:text-lg">
            Convert receipts and invoices into clean, structured records in
            seconds.
          </p>
          <div className="mt-10 flex flex-wrap items-center justify-center gap-3">
            <Link
              href="/register"
              className="rounded-lg bg-cyan-400 px-5 py-2.5 text-sm font-semibold text-slate-950 transition hover:bg-cyan-300"
            >
              Get Started
            </Link>
            <Link
              href="/login"
              className="rounded-lg border border-white/25 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-white/10"
            >
              Login
            </Link>
          </div>
        </div>
      </section>

      <footer className="border-t border-white/10 bg-slate-950 px-6 py-6">
        <div className="mx-auto flex w-full max-w-6xl flex-col items-center justify-between gap-2 text-sm text-slate-400 md:flex-row">
          <p>© 2026 Invoice Validate AI</p>
          <p>Secure AI extraction for invoices and expenses</p>
        </div>
      </footer>
    </main>
  );
}
