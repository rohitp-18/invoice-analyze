"use client";

import React from "react";
import { useSelector, useDispatch } from "react-redux";
import { AppDispatch, RootState } from "@/store/store";
import { logout } from "@/store/authSlice";
import AuthProvider from "@/components/authProvider";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  User as UserIcon,
  Mail,
  Building,
  Shield,
  ShieldCheck,
  KeyRound,
  LogOut,
  FileText,
  UploadCloud,
  Check,
  Sparkles,
  Lock,
  Edit,
  ExternalLink,
  CheckCircle2,
  Calendar,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export default function ProfilePage() {
  const router = useRouter();
  const dispatch = useDispatch<AppDispatch>();
  const { user, role } = useSelector((state: RootState) => state.auth);

  const userRole = (role || user?.role || "EMPLOYEE").toUpperCase();
  const userDept = (user?.department || "General").toUpperCase();

  // Role permissions breakdown
  const permissions = [
    {
      action: "Upload & OCR Extract Invoices",
      allowed: true,
      desc: "Upload PDF / Image receipts for automated AI extraction",
    },
    {
      action: "Human-in-the-Loop Approval & Decisions",
      allowed: ["ADMIN", "AUDITOR", "FINANCE", "COMPLIANCE", "MANAGER", "SUPERADMIN"].includes(userRole),
      desc: "Approve, reject, or flag invoice submissions",
    },
    {
      action: "Author & Edit Compliance Policies",
      allowed: ["COMPLIANCE", "ADMIN", "SUPERADMIN"].includes(userRole),
      desc: "Manage corporate spend policies & vector store rules",
    },
    {
      action: "Export Full Ledger to CSV",
      allowed: ["ADMIN", "AUDITOR", "FINANCE", "COMPLIANCE", "MANAGER", "SUPERADMIN"].includes(userRole),
      desc: "Generate customized CSV/Excel exports with column selection",
    },
    {
      action: "Team & Organization Management",
      allowed: ["ADMIN", "MANAGER", "SUPERADMIN"].includes(userRole),
      desc: "Manage departmental teams and assign user roles",
    },
  ];

  // Role badge color helper
  const getRoleBadgeStyle = (r: string) => {
    switch (r) {
      case "ADMIN":
      case "SUPERADMIN":
        return "bg-emerald-500/20 text-emerald-300 border-emerald-500/40";
      case "COMPLIANCE":
        return "bg-purple-500/20 text-purple-300 border-purple-500/40";
      case "FINANCE":
        return "bg-cyan-500/20 text-cyan-300 border-cyan-500/40";
      case "AUDITOR":
        return "bg-amber-500/20 text-amber-300 border-amber-500/40";
      case "MANAGER":
        return "bg-indigo-500/20 text-indigo-300 border-indigo-500/40";
      default:
        return "bg-slate-500/20 text-slate-300 border-slate-500/40";
    }
  };

  // User initials
  const getInitials = (userName?: string, userEmail?: string) => {
    if (userName && userName.trim()) {
      const parts = userName.trim().split(" ");
      if (parts.length >= 2) return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
      return userName.slice(0, 2).toUpperCase();
    }
    if (userEmail) return userEmail.slice(0, 2).toUpperCase();
    return "US";
  };

  const handleLogout = () => {
    dispatch(logout());
    router.push("/login");
  };

  return (
    <AuthProvider>
      <div className="flex-1 space-y-6 p-6 md:p-8 pt-6 min-h-screen bg-slate-950 text-slate-100">
        {/* Page Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-white/10 pb-5">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <div className="flex size-7 items-center justify-center rounded-lg bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">
                <UserIcon className="size-4" />
              </div>
              <h1 className="text-2xl font-bold tracking-tight text-white">
                Account & User Profile
              </h1>
            </div>
            <p className="text-xs text-slate-400">
              Overview of your corporate identity, security settings, and authorized RBAC roles.
            </p>
          </div>

          <div className="flex items-center gap-2.5">
            <Link href="/dashboard/profile/update/profile">
              <Button
                variant="outline"
                size="sm"
                className="border-white/10 bg-slate-900 text-slate-300 hover:bg-slate-800 text-xs h-9"
              >
                <Edit className="size-3.5 mr-1.5" />
                Edit Profile
              </Button>
            </Link>
            <Link href="/dashboard/profile/update/password">
              <Button
                variant="outline"
                size="sm"
                className="border-cyan-500/30 bg-cyan-950/30 text-cyan-300 hover:bg-cyan-900/40 text-xs h-9"
              >
                <KeyRound className="size-3.5 mr-1.5" />
                Change Password
              </Button>
            </Link>
            <Button
              variant="outline"
              size="sm"
              onClick={handleLogout}
              className="border-rose-500/30 bg-rose-500/10 text-rose-300 hover:bg-rose-500/20 text-xs h-9"
            >
              <LogOut className="size-3.5 mr-1.5" />
              Sign Out
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* ========================================================================= */}
          {/* LEFT COLUMN: IDENTITY & ACCOUNT OVERVIEW (7 COLS) */}
          {/* ========================================================================= */}
          <div className="lg:col-span-7 space-y-6">
            {/* Identity Banner Card */}
            <Card className="border-white/10 bg-slate-900/60 backdrop-blur shadow-xl overflow-hidden">
              <div className="bg-gradient-to-r from-cyan-500/20 via-indigo-500/20 to-purple-500/20 p-6 border-b border-white/10">
                <div className="flex flex-col sm:flex-row items-center sm:items-start gap-4">
                  {/* Large Avatar */}
                  <div className="relative flex size-20 shrink-0 items-center justify-center rounded-2xl bg-slate-950 border-2 border-cyan-500/40 text-cyan-300 font-bold text-2xl shadow-xl shadow-cyan-950/50">
                    {getInitials(user?.name, user?.email)}
                    <span className="absolute -bottom-1 -right-1 flex size-5 items-center justify-center rounded-full bg-emerald-500 text-slate-950">
                      <Check className="size-3 stroke-[3]" />
                    </span>
                  </div>

                  {/* Details */}
                  <div className="text-center sm:text-left flex-1 min-w-0">
                    <h2 className="text-xl font-bold text-white truncate">
                      {user?.name || "Corporate User"}
                    </h2>
                    <p className="text-xs text-slate-400 flex items-center justify-center sm:justify-start gap-1.5 mt-0.5">
                      <Mail className="size-3.5" />
                      {user?.email || "user@enterprise.internal"}
                    </p>

                    <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2 mt-3">
                      <span
                        className={`inline-flex items-center gap-1 rounded-md border px-2.5 py-0.5 text-xs font-bold ${getRoleBadgeStyle(
                          userRole
                        )}`}
                      >
                        <Shield className="size-3" />
                        {userRole}
                      </span>

                      <span className="inline-flex items-center gap-1 rounded-md border border-white/10 bg-slate-950/60 px-2.5 py-0.5 text-xs font-medium text-slate-300">
                        <Building className="size-3 text-cyan-400" />
                        {userDept}
                      </span>

                      <span className="inline-flex items-center gap-1 rounded-md border border-emerald-500/20 bg-emerald-500/10 px-2 py-0.5 text-[11px] font-semibold text-emerald-400">
                        <CheckCircle2 className="size-3" /> Active JWT Session
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Profile Details Summary */}
              <div className="p-6 space-y-4 text-xs">
                <div className="flex items-center justify-between border-b border-white/10 pb-2">
                  <div>
                    <h3 className="font-semibold text-sm text-white">Profile Details</h3>
                    <p className="text-slate-400 text-[11px]">Overview of account attributes.</p>
                  </div>
                  <Link href="/dashboard/profile/update/profile">
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-cyan-300 hover:bg-cyan-500/10 text-xs h-7 px-2"
                    >
                      <Edit className="size-3 mr-1" /> Edit Info
                    </Button>
                  </Link>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="rounded-lg bg-slate-950/60 border border-white/10 p-3">
                    <span className="text-slate-400 text-[11px] block">Full Name</span>
                    <span className="font-semibold text-white text-sm mt-0.5 block">
                      {user?.name || "N/A"}
                    </span>
                  </div>

                  <div className="rounded-lg bg-slate-950/60 border border-white/10 p-3">
                    <span className="text-slate-400 text-[11px] block">Email Address</span>
                    <span className="font-semibold text-white text-sm mt-0.5 block truncate">
                      {user?.email || "N/A"}
                    </span>
                  </div>

                  <div className="rounded-lg bg-slate-950/60 border border-white/10 p-3">
                    <span className="text-slate-400 text-[11px] block">Department</span>
                    <span className="font-semibold text-cyan-300 text-sm mt-0.5 block">
                      {userDept}
                    </span>
                  </div>

                  <div className="rounded-lg bg-slate-950/60 border border-white/10 p-3">
                    <span className="text-slate-400 text-[11px] block">Assigned Role</span>
                    <span className="font-semibold text-emerald-400 text-sm mt-0.5 block">
                      {userRole}
                    </span>
                  </div>
                </div>
              </div>
            </Card>

            {/* Security Actions Card */}
            <Card className="border-white/10 bg-slate-900/60 backdrop-blur shadow-xl">
              <CardHeader className="pb-3 border-b border-white/10 flex flex-row items-center justify-between">
                <div>
                  <CardTitle className="text-sm font-semibold text-white flex items-center gap-2">
                    <KeyRound className="size-4 text-cyan-400" /> Account Security & Credentials
                  </CardTitle>
                  <CardDescription className="text-xs text-slate-400 mt-0.5">
                    Manage authentication credentials and active login session.
                  </CardDescription>
                </div>
              </CardHeader>
              <CardContent className="p-4 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
                <div>
                  <span className="text-white font-medium block">Password Management</span>
                  <span className="text-slate-400 text-[11px]">
                    Ensure your account is protected with a secure password.
                  </span>
                </div>
                <Link href="/dashboard/profile/update/password">
                  <Button
                    size="sm"
                    className="bg-cyan-400 hover:bg-cyan-300 text-slate-950 font-semibold text-xs h-8 shadow-md shadow-cyan-950/40"
                  >
                    <KeyRound className="size-3.5 mr-1.5" />
                    Change Password
                  </Button>
                </Link>
              </CardContent>
            </Card>
          </div>

          {/* ========================================================================= */}
          {/* RIGHT COLUMN: RBAC PERMISSIONS MATRIX & SHORTCUTS (5 COLS) */}
          {/* ========================================================================= */}
          <div className="lg:col-span-5 space-y-6">
            {/* Permissions Matrix */}
            <Card className="border-white/10 bg-slate-900/60 backdrop-blur shadow-xl">
              <CardHeader className="pb-3 border-b border-white/10">
                <CardTitle className="text-sm font-semibold text-white flex items-center gap-2">
                  <ShieldCheck className="size-4 text-emerald-400" /> RBAC Permissions Matrix
                </CardTitle>
                <CardDescription className="text-xs text-slate-400">
                  Authorized capabilities for role: <span className="text-cyan-300 font-bold">{userRole}</span>
                </CardDescription>
              </CardHeader>

              <CardContent className="p-4 space-y-3">
                {permissions.map((perm, idx) => (
                  <div
                    key={idx}
                    className={`flex items-start gap-3 p-2.5 rounded-lg border text-xs ${
                      perm.allowed
                        ? "bg-emerald-500/5 border-emerald-500/20 text-slate-200"
                        : "bg-slate-950/40 border-white/5 text-slate-500 opacity-60"
                    }`}
                  >
                    <div
                      className={`flex size-5 shrink-0 items-center justify-center rounded-full mt-0.5 ${
                        perm.allowed
                          ? "bg-emerald-500/20 text-emerald-400"
                          : "bg-slate-800 text-slate-500"
                      }`}
                    >
                      {perm.allowed ? <Check className="size-3 stroke-[3]" /> : <Lock className="size-3" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <span className={`font-semibold block ${perm.allowed ? "text-white" : "text-slate-400"}`}>
                        {perm.action}
                      </span>
                      <p className="text-[11px] text-slate-400 mt-0.5">{perm.desc}</p>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>

            {/* Quick Workspace Navigation */}
            <Card className="border-white/10 bg-slate-900/60 backdrop-blur shadow-xl">
              <CardHeader className="pb-3 border-b border-white/10">
                <CardTitle className="text-sm font-semibold text-white flex items-center gap-2">
                  <Sparkles className="size-4 text-cyan-400" /> Workspace Shortcuts
                </CardTitle>
              </CardHeader>

              <CardContent className="p-4 space-y-2 text-xs">
                <Link href="/invoice/upload" className="block">
                  <Button
                    variant="outline"
                    className="w-full justify-between border-white/10 bg-slate-950/60 hover:bg-slate-800 text-slate-200 text-xs h-9"
                  >
                    <span className="flex items-center gap-2">
                      <UploadCloud className="size-3.5 text-cyan-400" />
                      Upload New Invoice
                    </span>
                    <ExternalLink className="size-3 text-slate-500" />
                  </Button>
                </Link>

                <Link href="/invoice/details" className="block">
                  <Button
                    variant="outline"
                    className="w-full justify-between border-white/10 bg-slate-950/60 hover:bg-slate-800 text-slate-200 text-xs h-9"
                  >
                    <span className="flex items-center gap-2">
                      <FileText className="size-3.5 text-amber-400" />
                      View My Submissions
                    </span>
                    <ExternalLink className="size-3 text-slate-500" />
                  </Button>
                </Link>

                {["COMPLIANCE", "ADMIN", "SUPERADMIN"].includes(userRole) && (
                  <Link href="/dashboard/compliance" className="block">
                    <Button
                      variant="outline"
                      className="w-full justify-between border-white/10 bg-slate-950/60 hover:bg-slate-800 text-slate-200 text-xs h-9"
                    >
                      <span className="flex items-center gap-2">
                        <Shield className="size-3.5 text-purple-400" />
                        Compliance Policy Manager
                      </span>
                      <ExternalLink className="size-3 text-slate-500" />
                    </Button>
                  </Link>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </AuthProvider>
  );
}
