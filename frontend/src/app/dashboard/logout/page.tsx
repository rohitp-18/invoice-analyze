"use client";

import { useEffect } from "react";
import { useDispatch } from "react-redux";
import { logout } from "@/store/authSlice";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { AppDispatch } from "@/store/store";

export default function LogoutPage() {
  const dispatch = useDispatch<AppDispatch>();
  const router = useRouter();

  useEffect(() => {
    dispatch(logout());
    localStorage.removeItem("token")
    router.push("/login");
  }, [dispatch, router]);

  return (
    <div className="flex h-screen w-full items-center justify-center bg-slate-950 text-slate-100">
      <div className="flex flex-col items-center gap-3">
        <Loader2 className="size-8 animate-spin text-cyan-400" />
        <p className="text-xs text-slate-400">Signing out and clearing session...</p>
      </div>
    </div>
  );
}
