"use client";

import React, { useEffect, useState, use } from "react";
import { useRouter } from "next/navigation";
import AuthProvider from "@/components/authProvider";
import axios from "@/store/axios";
import { isAxiosError } from "axios";
import {
  Scale,
  ArrowLeft,
  Save,
  Loader2,
  Sparkles,
  AlertCircle,
  CheckCircle2,
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
import Link from "next/link";

export default function EditPolicyPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const router = useRouter();
  const resolvedParams = use(params);
  const policyId = resolvedParams.id;

  const [formData, setFormData] = useState({
    title: "",
    policy_code: "",
    category: "THRESHOLD",
    rule_type: "MAX_AMOUNT",
    max_amount: "",
    currency: "USD",
    severity: "HIGH",
    department: "All",
    description: "",
    is_active: true,
  });

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  useEffect(() => {
    async function fetchPolicy() {
      try {
        setLoading(true);
        const res = await axios.get(`/policies/${policyId}`);
        const p = res.data;
        setFormData({
          title: p.title || "",
          policy_code: p.policy_code || "",
          category: p.category || "THRESHOLD",
          rule_type: p.rule_type || "MAX_AMOUNT",
          max_amount: p.max_amount !== null ? String(p.max_amount) : "",
          currency: p.currency || "USD",
          severity: p.severity || "HIGH",
          department: p.department || "All",
          description: p.description || "",
          is_active: p.is_active ?? true,
        });
      } catch (err: unknown) {
        console.error("Error loading policy:", err);
        if (isAxiosError(err)) {
          setErrorMessage(
            err.response?.data?.detail || "Failed to load policy details."
          );
        } else {
          setErrorMessage("Failed to load policy details.");
        }
      } finally {
        setLoading(false);
      }
    }

    if (policyId) {
      fetchPolicy();
    }
  }, [policyId]);

  const handleChange = (
    e: React.ChangeEvent<
      HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement
    >
  ) => {
    const { name, value, type } = e.target;
    if (type === "checkbox") {
      const checked = (e.target as HTMLInputElement).checked;
      setFormData((prev) => ({ ...prev, [name]: checked }));
    } else {
      setFormData((prev) => ({ ...prev, [name]: value }));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage("");
    setSuccessMessage("");

    if (!formData.title.trim() || !formData.description.trim()) {
      setErrorMessage("Please fill in both Title and Rule Description.");
      return;
    }

    try {
      setSubmitting(true);
      const payload = {
        title: formData.title.trim(),
        category: formData.category,
        rule_type: formData.rule_type,
        max_amount: formData.max_amount ? Number(formData.max_amount) : null,
        currency: formData.currency,
        severity: formData.severity,
        department: formData.department.trim() || "All",
        description: formData.description.trim(),
        is_active: formData.is_active,
      };

      const res = await axios.put(`/policies/${policyId}`, payload);
      setSuccessMessage(
        `Policy ${res.data.policy_code} updated and re-indexed in Vector Store successfully!`
      );
      setTimeout(() => {
        router.push("/dashboard/compliance");
      }, 1200);
    } catch (err: unknown) {
      console.error("Policy update error:", err);
      if (isAxiosError(err)) {
        setErrorMessage(
          err.response?.data?.detail || "Failed to update compliance policy."
        );
      } else {
        setErrorMessage("An unexpected error occurred while updating policy.");
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AuthProvider
      allowedRoles={["COMPLIANCE", "ADMIN", "SUPERADMIN"]}
      allowedDepartments={["COMPLIANCE", "ADMIN", "LEGAL"]}
    >
      <div className="flex-1 space-y-6 p-6 md:p-8 pt-6 min-h-screen bg-slate-950 text-slate-100">
        {/* Header Navigation */}
        <div className="flex items-center justify-between border-b border-white/10 pb-4">
          <div className="flex items-center gap-3">
            <Link
              href="/dashboard/compliance"
              className="flex size-8 items-center justify-center rounded-lg border border-white/10 bg-slate-900 text-slate-300 hover:bg-slate-800 hover:text-white transition-colors"
            >
              <ArrowLeft className="size-4" />
            </Link>
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2">
                <Scale className="size-6 text-cyan-400" /> Edit Policy:{" "}
                <span className="font-mono text-cyan-300">
                  {formData.policy_code || policyId.slice(0, 8)}
                </span>
              </h1>
              <p className="text-xs text-slate-400">
                Modify corporate governance rules and vector embedding criteria.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              onClick={() => router.push("/dashboard/compliance")}
              className="border-white/10 bg-slate-900 text-slate-300 hover:bg-slate-800 text-xs h-9"
            >
              Cancel
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={submitting || loading}
              className="bg-cyan-400 hover:bg-cyan-300 text-slate-950 font-semibold text-xs h-9 shadow-md shadow-cyan-950/40"
            >
              {submitting ? (
                <>
                  <Loader2 className="size-3.5 animate-spin mr-1.5" />
                  Updating Vector Index...
                </>
              ) : (
                <>
                  <Save className="size-3.5 mr-1.5" />
                  Save Changes
                </>
              )}
            </Button>
          </div>
        </div>

        {/* Feedback Alerts */}
        {errorMessage && (
          <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-xs text-red-200 flex items-center gap-2.5">
            <AlertCircle className="size-4 text-red-400 shrink-0" />
            <span>{errorMessage}</span>
          </div>
        )}

        {successMessage && (
          <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-4 text-xs text-emerald-200 flex items-center gap-2.5">
            <CheckCircle2 className="size-4 text-emerald-400 shrink-0" />
            <span>{successMessage}</span>
          </div>
        )}

        {loading ? (
          <div className="flex flex-col items-center justify-center h-64 gap-2">
            <Loader2 className="size-8 animate-spin text-cyan-400" />
            <p className="text-xs text-slate-400">Loading policy details...</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Main Form (2 Cols) */}
            <form onSubmit={handleSubmit} className="lg:col-span-2 space-y-6">
              <Card className="border-white/10 bg-slate-900/60 backdrop-blur shadow-xl">
                <CardHeader className="pb-4">
                  <CardTitle className="text-base font-semibold text-white">
                    Policy Identification & Classification
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <label className="text-slate-200 text-xs font-semibold block mb-1.5">
                      Policy Title <span className="text-cyan-400">*</span>
                    </label>
                    <Input
                      name="title"
                      value={formData.title}
                      onChange={handleChange}
                      required
                      className="bg-slate-950/60 border-white/10 text-slate-100 text-sm h-10"
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="text-slate-200 text-xs font-semibold block mb-1.5">
                        Policy Code
                      </label>
                      <Input
                        name="policy_code"
                        value={formData.policy_code}
                        disabled
                        className="bg-slate-950/40 border-white/10 text-slate-400 text-sm h-10 font-mono cursor-not-allowed"
                      />
                    </div>

                    <div>
                      <label className="text-slate-200 text-xs font-semibold block mb-1.5">
                        Category Domain
                      </label>
                      <select
                        name="category"
                        value={formData.category}
                        onChange={handleChange}
                        className="w-full h-10 rounded-md border border-white/10 bg-slate-950/60 px-3 text-sm text-slate-200 focus:outline-none focus:ring-2 focus:ring-cyan-500"
                      >
                        <option value="THRESHOLD">THRESHOLD</option>
                        <option value="TRAVEL">TRAVEL</option>
                        <option value="PROCUREMENT">PROCUREMENT</option>
                        <option value="TAX">TAX</option>
                        <option value="GENERAL">GENERAL</option>
                      </select>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="border-white/10 bg-slate-900/60 backdrop-blur shadow-xl">
                <CardHeader className="pb-4">
                  <CardTitle className="text-base font-semibold text-white">
                    Enforcement Rules & Threshold Limits
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div>
                      <label className="text-slate-200 text-xs font-semibold block mb-1.5">
                        Rule Type
                      </label>
                      <select
                        name="rule_type"
                        value={formData.rule_type}
                        onChange={handleChange}
                        className="w-full h-10 rounded-md border border-white/10 bg-slate-950/60 px-3 text-sm text-slate-200 focus:outline-none focus:ring-2 focus:ring-cyan-500"
                      >
                        <option value="MAX_AMOUNT">Maximum Amount</option>
                        <option value="CATEGORY_RESTRICTION">Category Restriction</option>
                        <option value="VENDOR_RESTRICTION">Vendor Restriction</option>
                        <option value="MANDATORY_DOCUMENT">Mandatory Tax ID</option>
                      </select>
                    </div>

                    <div>
                      <label className="text-slate-200 text-xs font-semibold block mb-1.5">
                        Max Threshold Amount ($)
                      </label>
                      <Input
                        name="max_amount"
                        type="number"
                        step="0.01"
                        value={formData.max_amount}
                        onChange={handleChange}
                        className="bg-slate-950/60 border-white/10 text-slate-100 text-sm h-10"
                      />
                    </div>

                    <div>
                      <label className="text-slate-200 text-xs font-semibold block mb-1.5">
                        Severity
                      </label>
                      <select
                        name="severity"
                        value={formData.severity}
                        onChange={handleChange}
                        className="w-full h-10 rounded-md border border-white/10 bg-slate-950/60 px-3 text-sm text-slate-200 focus:outline-none focus:ring-2 focus:ring-cyan-500"
                      >
                        <option value="CRITICAL">CRITICAL</option>
                        <option value="HIGH">HIGH</option>
                        <option value="MEDIUM">MEDIUM</option>
                        <option value="LOW">LOW</option>
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="text-slate-200 text-xs font-semibold block mb-1.5">
                        Target Department
                      </label>
                      <Input
                        name="department"
                        value={formData.department}
                        onChange={handleChange}
                        className="bg-slate-950/60 border-white/10 text-slate-100 text-sm h-10"
                      />
                    </div>

                    <div>
                      <label className="text-slate-200 text-xs font-semibold block mb-1.5">
                        Currency
                      </label>
                      <Input
                        name="currency"
                        value={formData.currency}
                        onChange={handleChange}
                        className="bg-slate-950/60 border-white/10 text-slate-100 text-sm h-10 uppercase"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="text-slate-200 text-xs font-semibold block mb-1.5">
                      Policy Standard & Criteria Description <span className="text-cyan-400">*</span>
                    </label>
                    <textarea
                      name="description"
                      rows={4}
                      value={formData.description}
                      onChange={handleChange}
                      required
                      className="w-full rounded-md border border-white/10 bg-slate-950/60 p-3 text-sm text-slate-100 focus:outline-none focus:ring-2 focus:ring-cyan-500 leading-relaxed"
                    />
                  </div>

                  <div className="flex items-center gap-2.5 pt-2">
                    <input
                      type="checkbox"
                      id="is_active"
                      name="is_active"
                      checked={formData.is_active}
                      onChange={handleChange}
                      className="size-4 rounded border-white/10 bg-slate-950 text-cyan-500 focus:ring-cyan-400"
                    />
                    <label htmlFor="is_active" className="text-xs font-medium text-slate-300 cursor-pointer">
                      Enable active policy enforcement in AI pipeline
                    </label>
                  </div>
                </CardContent>
              </Card>
            </form>

            {/* Right Column Preview */}
            <div className="space-y-6">
              <Card className="border-cyan-500/30 bg-cyan-950/20 backdrop-blur shadow-xl">
                <CardHeader className="pb-3">
                  <div className="flex items-center gap-1.5 text-cyan-300 text-xs font-semibold">
                    <Sparkles className="size-4" /> Vector Embedding Snapshot
                  </div>
                  <CardTitle className="text-base font-bold text-white mt-1">
                    {formData.title}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3 text-xs">
                  <div className="rounded-lg border border-white/10 bg-slate-950/70 p-3 font-mono text-[11px] text-slate-300 space-y-1">
                    <div>
                      <span className="text-cyan-400">Code:</span> {formData.policy_code}
                    </div>
                    <div>
                      <span className="text-cyan-400">Category:</span> {formData.category}
                    </div>
                    <div>
                      <span className="text-cyan-400">Threshold:</span>{" "}
                      {formData.max_amount ? `$${formData.max_amount} ${formData.currency}` : "N/A"}
                    </div>
                    <div>
                      <span className="text-cyan-400">Severity:</span> {formData.severity}
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        )}
      </div>
    </AuthProvider>
  );
}
