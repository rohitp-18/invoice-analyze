"use client";

import React, { useState } from "react";
import AuthProvider from "@/components/authProvider";
import axios from "@/store/axios";
import { isAxiosError } from "axios";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  KeyRound,
  ArrowLeft,
  Save,
  Loader2,
  CheckCircle2,
  AlertCircle,
  Eye,
  EyeOff,
  Lock,
  ShieldCheck,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export default function ChangePasswordPage() {
  const router = useRouter();

  const [currentPassword, setCurrentPassword] = useState<string>("");
  const [newPassword, setNewPassword] = useState<string>("");
  const [confirmPassword, setConfirmPassword] = useState<string>("");

  const [showCurrent, setShowCurrent] = useState<boolean>(false);
  const [showNew, setShowNew] = useState<boolean>(false);
  const [showConfirm, setShowConfirm] = useState<boolean>(false);

  const [submitting, setSubmitting] = useState<boolean>(false);
  const [successMsg, setSuccessMsg] = useState<string>("");
  const [errorMsg, setErrorMsg] = useState<string>("");

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setSuccessMsg("");
    setErrorMsg("");

    if (!currentPassword) {
      setErrorMsg("Please enter your current password.");
      return;
    }

    if (!newPassword || newPassword.length < 6) {
      setErrorMsg("New password must be at least 6 characters long.");
      return;
    }

    if (newPassword !== confirmPassword) {
      setErrorMsg("New password and confirm password do not match.");
      return;
    }

    try {
      setSubmitting(true);
      const res = await axios.post("/auth/change-password", {
        current_password: currentPassword,
        new_password: newPassword,
      });

      setSuccessMsg(res.data?.message || "Password updated successfully!");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");

      setTimeout(() => {
        router.push("/dashboard/profile");
      }, 1500);
    } catch (err: unknown) {
      console.error("Password update error:", err);
      if (isAxiosError(err)) {
        setErrorMsg(
          err.response?.data?.detail || "Failed to update password. Please check your credentials."
        );
      } else {
        setErrorMsg("An unexpected error occurred.");
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AuthProvider>
      <div className="flex-1 space-y-6 p-6 md:p-8 pt-6 min-h-screen bg-slate-950 text-slate-100">
        {/* Top Header */}
        <div className="flex items-center justify-between border-b border-white/10 pb-4">
          <div className="flex items-center gap-3">
            <Link
              href="/dashboard/profile"
              className="flex size-8 items-center justify-center rounded-lg border border-white/10 bg-slate-900 text-slate-300 hover:bg-slate-800 hover:text-white transition-colors"
            >
              <ArrowLeft className="size-4" />
            </Link>
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2">
                <KeyRound className="size-6 text-cyan-400" /> Change Security Password
              </h1>
              <p className="text-xs text-slate-400">
                Update your account password to maintain enterprise security standards.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              onClick={() => router.push("/dashboard/profile")}
              className="border-white/10 bg-slate-900 text-slate-300 hover:bg-slate-800 text-xs h-9"
            >
              Cancel
            </Button>
            <Button
              onClick={handleChangePassword}
              disabled={submitting}
              className="bg-cyan-400 hover:bg-cyan-300 text-slate-950 font-semibold text-xs h-9 shadow-md shadow-cyan-950/40"
            >
              {submitting ? (
                <>
                  <Loader2 className="size-3.5 animate-spin mr-1.5" />
                  Updating...
                </>
              ) : (
                <>
                  <Save className="size-3.5 mr-1.5" />
                  Update Password
                </>
              )}
            </Button>
          </div>
        </div>

        {/* Feedback Alerts */}
        {errorMsg && (
          <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-xs text-red-200 flex items-center gap-2.5 max-w-2xl">
            <AlertCircle className="size-4 text-red-400 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        {successMsg && (
          <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-4 text-xs text-emerald-200 flex items-center gap-2.5 max-w-2xl">
            <CheckCircle2 className="size-4 text-emerald-400 shrink-0" />
            <span>{successMsg}</span>
          </div>
        )}

        {/* Password Form Card */}
        <div className="max-w-2xl">
          <Card className="border-white/10 bg-slate-900/60 backdrop-blur shadow-xl">
            <CardHeader className="pb-4 border-b border-white/10">
              <CardTitle className="text-base font-semibold text-white flex items-center gap-2">
                <Lock className="size-4 text-cyan-400" /> Password Credentials
              </CardTitle>
              <CardDescription className="text-xs text-slate-400">
                Enter your existing password followed by your desired new password.
              </CardDescription>
            </CardHeader>

            <CardContent className="p-6">
              <form onSubmit={handleChangePassword} className="space-y-4 text-xs">
                {/* Current Password */}
                <div>
                  <label className="text-slate-200 font-semibold block mb-1.5">
                    Current Password <span className="text-cyan-400">*</span>
                  </label>
                  <div className="relative">
                    <Input
                      type={showCurrent ? "text" : "password"}
                      value={currentPassword}
                      onChange={(e) => setCurrentPassword(e.target.value)}
                      placeholder="Enter existing password"
                      required
                      className="bg-slate-950/60 border-white/10 text-slate-100 text-sm h-10 pr-10"
                    />
                    <button
                      type="button"
                      onClick={() => setShowCurrent(!showCurrent)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white transition-colors"
                    >
                      {showCurrent ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                    </button>
                  </div>
                </div>

                {/* New Password */}
                <div>
                  <label className="text-slate-200 font-semibold block mb-1.5">
                    New Password <span className="text-cyan-400">*</span>
                  </label>
                  <div className="relative">
                    <Input
                      type={showNew ? "text" : "password"}
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      placeholder="At least 6 characters"
                      required
                      className="bg-slate-950/60 border-white/10 text-slate-100 text-sm h-10 pr-10"
                    />
                    <button
                      type="button"
                      onClick={() => setShowNew(!showNew)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white transition-colors"
                    >
                      {showNew ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                    </button>
                  </div>
                  <p className="text-[10px] text-slate-500 mt-1">
                    Must be at least 6 characters in length.
                  </p>
                </div>

                {/* Confirm New Password */}
                <div>
                  <label className="text-slate-200 font-semibold block mb-1.5">
                    Confirm New Password <span className="text-cyan-400">*</span>
                  </label>
                  <div className="relative">
                    <Input
                      type={showConfirm ? "text" : "password"}
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="Re-enter new password"
                      required
                      className="bg-slate-950/60 border-white/10 text-slate-100 text-sm h-10 pr-10"
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirm(!showConfirm)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white transition-colors"
                    >
                      {showConfirm ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                    </button>
                  </div>
                </div>

                <div className="flex items-center justify-end pt-4 gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => router.push("/dashboard/profile")}
                    className="border-white/10 bg-slate-950/60 text-slate-300 text-xs h-9"
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    disabled={submitting}
                    className="bg-cyan-400 hover:bg-cyan-300 text-slate-950 font-semibold text-xs h-9 shadow-md shadow-cyan-950/40"
                  >
                    {submitting ? (
                      <>
                        <Loader2 className="size-3.5 animate-spin mr-1.5" />
                        Updating Password...
                      </>
                    ) : (
                      <>
                        <KeyRound className="size-3.5 mr-1.5" />
                        Update Password
                      </>
                    )}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>
      </div>
    </AuthProvider>
  );
}
