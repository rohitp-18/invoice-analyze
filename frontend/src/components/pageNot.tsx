import Link from "next/link";
import Navbar from "@/components/navbar";

export default function PageNot() {
  return (
    <main className="flex min-h-screen flex-col bg-slate-950 text-white">
      <Navbar />

      <section className="flex flex-1 items-center justify-center bg-[radial-gradient(circle_at_top,_rgba(56,189,248,0.2),_transparent_40%),radial-gradient(circle_at_80%_20%,_rgba(251,146,60,0.2),_transparent_35%)] px-6 py-24">
        <div className="mx-auto w-full max-w-2xl text-center">
          <p className="text-sm font-semibold uppercase tracking-[0.22em] text-cyan-300">
            Error 404
          </p>
          <h1 className="mt-4 text-4xl font-semibold tracking-tight md:text-6xl">
            Page not found
          </h1>
          <p className="mx-auto mt-5 max-w-xl text-base text-slate-300 md:text-lg">
            The page you are looking for does not exist or has been moved.
          </p>

          <div className="mt-10 flex flex-wrap items-center justify-center gap-3">
            <Link
              href="/"
              className="rounded-lg bg-cyan-400 px-5 py-2.5 text-sm font-semibold text-slate-950 transition hover:bg-cyan-300"
            >
              Back to Home
            </Link>
            <Link
              href="/login"
              className="rounded-lg border border-white/25 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-white/10"
            >
              Go to Login
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}
