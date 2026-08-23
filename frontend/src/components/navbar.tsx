"use client";

import { RootState } from "@/store/store";
import Link from "next/link";
import { useSelector } from "react-redux";

export default function Navbar() {
  const { user } = useSelector((state: RootState) => state.auth);

  return (
    <header className="sticky top-0 z-20 border-b border-white/10 bg-slate-950/80 backdrop-blur">
      <div className="mx-auto flex w-full max-w-6xl items-center justify-between px-6 py-4">
        <Link
          href="/"
          className="text-sm font-semibold uppercase tracking-[0.16em] text-cyan-300"
        >
          Invoice Validate AI
        </Link>

        <nav className="hidden items-center gap-8 text-sm text-slate-300 md:flex">
          <Link href="/" className="transition hover:text-white">
            Home
          </Link>
          <Link href="/invoice/upload" className="transition hover:text-white">
            Upload Invoice
          </Link>
          <Link href="/dashboard" className="transition hover:text-white">
            Dashboard
          </Link>
        </nav>

        {user ? (
          <div className="flex items-center gap-2">
            <Link
              href="/dashboard/account"
              className="rounded-lg border border-white/20 px-4 py-2 text-sm font-medium text-white transition hover:bg-white/10"
            >
              Account
            </Link>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <Link
              href="/login"
              className="rounded-lg border border-white/20 px-4 py-2 text-sm font-medium text-white transition hover:bg-white/10"
            >
              Login
            </Link>
            <Link
              href="/register"
              className="rounded-lg bg-cyan-400 px-4 py-2 text-sm font-semibold text-slate-950 transition hover:bg-cyan-300"
            >
              Get Started
            </Link>
          </div>
        )}
      </div>
    </header>
  );
}
