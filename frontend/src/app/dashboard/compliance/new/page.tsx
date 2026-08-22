"use client";

import React, { useState } from "react";
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
  ShieldAlert,
  Building,
  DollarSign,
  AlertCircle,
  CheckCircle2,
  FileCheck2,
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

export default function CreatePolicyPage() {
  const router = useRouter();

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

  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

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
        policy_code: formData.policy_code.trim() || undefined,
        category: formData.category,
        rule_type: formData.rule_type,
        max_amount: formData.max_amount ? Number(formData.max_amount) : null,
        currency: formData.currency,
        severity: formData.severity,
        department: formData.department.trim() || "All",
        description: formData.description.trim(),
        is_active: formData.is_active,
      };

      const res = await axios.post("/policies", payload);
      setSuccessMessage(
        `Policy ${res.data.policy_code} created and indexed into Vector AI successfully!`
      );
      setTimeout(() => {
        router.push("/dashboard/compliance");
      }, 1200);
    } catch (err: unknown) {
      console.error("Policy creation error:", err);
      if (isAxiosError(err)) {
        setErrorMessage(
          err.response?.data?.detail || "Failed to create compliance policy."
        );
      } else {
        setErrorMessage("An unexpected error occurred while saving policy.");
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
                <Scale className="size-6 text-cyan-400" /> New Compliance Policy
              </h1>
              <p className="text-xs text-slate-400">
                Author a new corporate governance rule for LangGraph automated audit and vector indexing.
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
              disabled={submitting}
              className="bg-cyan-400 hover:bg-cyan-300 text-slate-950 font-semibold text-xs h-9 shadow-md shadow-cyan-950/40"
            >
              {submitting ? (
                <>
                  <Loader2 className="size-3.5 animate-spin mr-1.5" />
                  Indexing Vector AI...
                </>
              ) : (
                <>
                  <Save className="size-3.5 mr-1.5" />
                  Save & Index Policy
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

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Form (2 Cols) */}
          <form onSubmit={handleSubmit} className="lg:col-span-2 space-y-6">
            <Card className="border-white/10 bg-slate-900/60 backdrop-blur shadow-xl">
              <CardHeader className="pb-4">
                <CardTitle className="text-base font-semibold text-white">
                  Policy Identification & Classification
                </CardTitle>
                <CardDescription className="text-xs text-slate-400">
                  Assign title, unique reference code, and corporate category.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Title */}
                <div>
                  <label className="text-slate-200 text-xs font-semibold block mb-1.5">
                    Policy Title <span className="text-cyan-400">*</span>
                  </label>
                  <Input
                    name="title"
                    value={formData.title}
                    onChange={handleChange}
                    placeholder="e.g. Executive Hotel & Travel Nightly Cap"
                    required
                    className="bg-slate-950/60 border-white/10 text-slate-100 placeholder:text-slate-500 text-sm h-10"
                  />
                </div>

                {/* Code & Category */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="text-slate-200 text-xs font-semibold block mb-1.5">
                      Policy Code (Optional)
                    </label>
                    <Input
                      name="policy_code"
                      value={formData.policy_code}
                      onChange={handleChange}
                      placeholder="e.g. POL-HOTEL-001"
                      className="bg-slate-950/60 border-white/10 text-slate-100 placeholder:text-slate-500 text-sm h-10 font-mono"
                    />
                    <p className="text-[10px] text-slate-500 mt-1">
                      Leave empty to auto-generate unique reference code.
                    </p>
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
                      <option value="THRESHOLD">THRESHOLD (Spend Limits)</option>
                      <option value="TRAVEL">TRAVEL (Travel & Meals)</option>
                      <option value="PROCUREMENT">PROCUREMENT (Vendor/PO)</option>
                      <option value="TAX">TAX (Tax ID & Compliance)</option>
                      <option value="GENERAL">GENERAL (Operational Rules)</option>
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
                <CardDescription className="text-xs text-slate-400">
                  Configure numerical bounds and violation severity.
                </CardDescription>
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
                      placeholder="e.g. 5000.00"
                      className="bg-slate-950/60 border-white/10 text-slate-100 text-sm h-10"
                    />
                  </div>

                  <div>
                    <label className="text-slate-200 text-xs font-semibold block mb-1.5">
                      Severity on Violation
                    </label>
                    <select
                      name="severity"
                      value={formData.severity}
                      onChange={handleChange}
                      className="w-full h-10 rounded-md border border-white/10 bg-slate-950/60 px-3 text-sm text-slate-200 focus:outline-none focus:ring-2 focus:ring-cyan-500"
                    >
                      <option value="CRITICAL">CRITICAL (Direct Red Flag)</option>
                      <option value="HIGH">HIGH (Escalate Review)</option>
                      <option value="MEDIUM">MEDIUM (Manager Sign-Off)</option>
                      <option value="LOW">LOW (Informational Notice)</option>
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
                      placeholder="e.g. All, Finance, Engineering, Procurement"
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

                {/* Description */}
                <div>
                  <label className="text-slate-200 text-xs font-semibold block mb-1.5">
                    Policy Standard & Criteria Description <span className="text-cyan-400">*</span>
                  </label>
                  <textarea
                    name="description"
                    rows={4}
                    value={formData.description}
                    onChange={handleChange}
                    placeholder="Provide exact rules, thresholds, and conditions to be embedded into the vector database and evaluated by the LangGraph forensic auditor..."
                    required
                    className="w-full rounded-md border border-white/10 bg-slate-950/60 p-3 text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-500 leading-relaxed"
                  />
                </div>

                {/* Active Checkbox */}
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
                    Enable policy enforcement immediately upon saving
                  </label>
                </div>
              </CardContent>
            </Card>
          </form>

          {/* Right Column: Live AI Simulation Card */}
          <div className="space-y-6">
            <Card className="border-cyan-500/30 bg-cyan-950/20 backdrop-blur shadow-xl">
              <CardHeader className="pb-3">
                <div className="flex items-center gap-1.5 text-cyan-300 text-xs font-semibold">
                  <Sparkles className="size-4" /> Vector AI Embedding Preview
                </div>
                <CardTitle className="text-base font-bold text-white mt-1">
                  {formData.title || "Policy Title Preview"}
                </CardTitle>
                <CardDescription className="text-xs text-slate-400">
                  How the LangGraph Forensic Auditor will index this policy in FAISS / Pinecone.
                </CardDescription>
              </CardHeader>

              <CardContent className="space-y-3 text-xs">
                <div className="rounded-lg border border-white/10 bg-slate-950/70 p-3 font-mono text-[11px] text-slate-300 space-y-1">
                  <div>
                    <span className="text-cyan-400">Code:</span> {formData.policy_code || "POL-AUTO-GEN"}
                  </div>
                  <div>
                    <span className="text-cyan-400">Category:</span> {formData.category}
                  </div>
                  <div>
                    <span className="text-cyan-400">Threshold:</span>{" "}
                    {formData.max_amount ? `$${formData.max_amount} ${formData.currency}` : "Rule-Based"}
                  </div>
                  <div>
                    <span className="text-cyan-400">Severity:</span>{" "}
                    <span className="text-amber-400 font-bold">{formData.severity}</span>
                  </div>
                  <div>
                    <span className="text-cyan-400">Department:</span> {formData.department || "All"}
                  </div>
                </div>

                <div className="rounded-lg bg-slate-900/80 p-3 border border-white/10">
                  <span className="text-[11px] font-semibold text-slate-300 block mb-1">
                    Semantic Text:
                  </span>
                  <p className="text-xs text-slate-400 italic">
                    "{formData.description || "Enter description to preview embedding..."}"
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </AuthProvider>
  );
}
