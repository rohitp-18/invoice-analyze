"use client";

import React, { useEffect, useState, use } from "react";
import { useSelector } from "react-redux";
import { RootState } from "@/store/store";
import AuthProvider from "@/components/authProvider";
import axios from "@/store/axios";
import { isAxiosError } from "axios";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  FileText,
  ArrowLeft,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Clock,
  ExternalLink,
  DollarSign,
  Building,
  User as UserIcon,
  ShieldAlert,
  ShieldCheck,
  Check,
  X,
  Layers,
  Calculator,
  Loader2,
  Sparkles,
  Download,
  AlertCircle,
  FileCheck2,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  Zap,
  Compass,
  Shield,
  Lock,
  Undo2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { getCurrencySymbol, formatCurrency } from "@/lib/utils";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

interface LineItem {
  id?: string;
  description: string;
  quantity: number;
  unit_price: number;
  total_amount: number;
  category?: string;
}

interface Anomaly {
  id?: string;
  anomaly_flag?: string;
  anomaly_type: string;
  severity: "CRITICAL" | "HIGH" | "MEDIUM" | "LOW";
  reason?: string;
  explanation: string;
  evidence?: string;
}

interface InvoiceDetail {
  id: string;
  invoice_number: string;
  vendor_name: string;
  invoice_date: string;
  subtotal?: number;
  tax_amount?: number;
  total_amount: number;
  currency: string;
  status: "PROCESSING" | "PENDING_REVIEW" | "APPROVED" | "FLAGGED" | "REJECTED";
  ai_status?: string;
  human_status?: string;
  decision_notes?: string;
  decision_by_name?: string;
  decision_by_role?: string;
  decision_at?: string;
  document_url: string;
  overall_confidence?: number;
  overall_confidance?: number;
  risk_level?: "CRITICAL" | "HIGH" | "MEDIUM" | "LOW" | string;
  risk_score?: number;
  recommended_action?: string;
  submitter_id?: string;
  submitter_name?: string;
  submitter_email?: string;
  submitter_department?: string;
  approver_id?: string;
  approver_name?: string;
  created_at: string;
  line_items?: LineItem[];
  anomalies?: Anomaly[];
}

const getDocumentUrl = (path: string | undefined | null): string => {
  if (!path) return "";
  if (path.startsWith("http://") || path.startsWith("https://")) {
    return path;
  }
  const backendBase = process.env.NEXT_PUBLIC_API_URL
    ? process.env.NEXT_PUBLIC_API_URL.replace(/\/api\/v1\/?$/, "")
    : "http://localhost:8000";
  const cleanPath = path.startsWith("/") ? path : `/${path}`;
  return `${backendBase}${cleanPath}`;
};

export default function InvoiceInspectionPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const router = useRouter();
  const resolvedParams = use(params);
  const invoiceId = resolvedParams.id;

  const { user, role } = useSelector((state: RootState) => state.auth);

  const [invoice, setInvoice] = useState<InvoiceDetail | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [errorMsg, setErrorMsg] = useState<string>("");
  const [decisionNotes, setDecisionNotes] = useState<string>("");
  const [submittingAction, setSubmittingAction] = useState<boolean>(false);
  const [actionSuccessMsg, setActionSuccessMsg] = useState<string>("");
  const [zoomLevel, setZoomLevel] = useState<number>(1);

  // RBAC permissions: Only Finance, Auditor, and Admin can approve/reject invoices
  const userRole = (role || user?.role || "EMPLOYEE").toUpperCase();
  const userDept = (user?.department || "").toUpperCase();

  const isAdmin = ["ADMIN", "SUPERADMIN"].includes(userRole);
  const isDecided = invoice?.human_status === "APPROVED" || invoice?.human_status === "REJECTED";
  const canRoleDecide =
    ["ADMIN", "AUDITOR", "FINANCE", "SUPERADMIN"].includes(userRole) ||
    ["FINANCE", "AUDIT", "ADMIN"].includes(userDept);

  // Once decided by a human, regular reviewers cannot approve/reject. Only ADMIN can undo/modify.
  const canMakeDecision = canRoleDecide && (!isDecided || isAdmin);

  // Fetch invoice details
  const fetchInvoice = async () => {
    try {
      setLoading(true);
      setErrorMsg("");
      const res = await axios.get(`/invoice/${invoiceId}`);
      setInvoice(res.data);
    } catch (err: unknown) {
      console.error("Error loading invoice:", err);
      if (isAxiosError(err)) {
        setErrorMsg(
          err.response?.data?.detail || "Failed to load invoice details."
        );
      } else {
        setErrorMsg("Failed to load invoice details from server.");
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (invoiceId) {
      fetchInvoice();
    }
  }, [invoiceId]);

  // Handle Human Decision / Admin Undo
  const handleDecision = async (
    targetStatus: "APPROVED" | "REJECTED" | "FLAGGED" | "PENDING_REVIEW" | "RESET"
  ) => {
    try {
      setSubmittingAction(true);
      setActionSuccessMsg("");
      const res = await axios.post(`/invoice/${invoiceId}/decision`, {
        status: targetStatus,
        notes: decisionNotes.trim() || undefined,
      });

      setActionSuccessMsg(
        res.data?.message || `Invoice updated successfully.`
      );
      if (res.data) {
        setInvoice((prev) =>
          prev
            ? {
                ...prev,
                status: (res.data.status || (targetStatus === "RESET" ? "PENDING_REVIEW" : targetStatus)) as InvoiceDetail["status"],
                human_status: res.data.human_status || (targetStatus === "RESET" ? "PENDING" : targetStatus),
                decision_notes: res.data.decision_notes,
                decision_by_name: res.data.decision_by_name || user?.name,
                decision_by_role: res.data.decision_by_role || userRole,
                decision_at: res.data.decision_at || new Date().toISOString(),
                approver_name: user?.name || "Me",
              }
            : null
        );
      }
      fetchInvoice();
      setDecisionNotes("");
    } catch (err: unknown) {
      console.error("Decision update failed:", err);
      if (isAxiosError(err)) {
        alert(err.response?.data?.detail || "Failed to update invoice status.");
      } else {
        alert("Failed to update status.");
      }
    } finally {
      setSubmittingAction(false);
    }
  };

  const getStatusBadge = (status?: string) => {
    switch (status) {
      case "APPROVED":
        return (
          <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-xs font-semibold text-emerald-300">
            <CheckCircle2 className="size-3.5 text-emerald-400" /> Approved
          </span>
        );
      case "FLAGGED":
        return (
          <span className="inline-flex items-center gap-1.5 rounded-full border border-rose-500/30 bg-rose-500/10 px-3 py-1 text-xs font-semibold text-rose-300">
            <AlertTriangle className="size-3.5 text-rose-400" /> Flagged (Risk)
          </span>
        );
      case "PROCESSING":
        return (
          <span className="inline-flex items-center gap-1.5 rounded-full border border-cyan-500/30 bg-cyan-500/10 px-3 py-1 text-xs font-semibold text-cyan-300">
            <Loader2 className="size-3.5 animate-spin text-cyan-400" /> Processing AI
          </span>
        );
      case "REJECTED":
        return (
          <span className="inline-flex items-center gap-1.5 rounded-full border border-red-500/30 bg-red-500/10 px-3 py-1 text-xs font-semibold text-red-300">
            <XCircle className="size-3.5 text-red-400" /> Rejected
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-500/30 bg-amber-500/10 px-3 py-1 text-xs font-semibold text-amber-300">
            <Clock className="size-3.5 text-amber-400" /> Pending Review
          </span>
        );
    }
  };

  const getSeverityBadge = (sev: string) => {
    switch (sev) {
      case "CRITICAL":
        return "bg-rose-500/20 text-rose-300 border-rose-500/30";
      case "HIGH":
        return "bg-amber-500/20 text-amber-300 border-amber-500/30";
      case "MEDIUM":
        return "bg-cyan-500/20 text-cyan-300 border-cyan-500/30";
      default:
        return "bg-slate-500/20 text-slate-300 border-slate-500/30";
    }
  };

  // Math sum calculation
  const calculatedItemsSum =
    invoice?.line_items?.reduce(
      (sum, item) => sum + Number(item.total_amount || 0),
      0
    ) || 0;
  const isMathAccurate =
    invoice && Math.abs(calculatedItemsSum - Number(invoice.total_amount)) < 0.05;

  const isPdf =
    invoice?.document_url?.toLowerCase().endsWith(".pdf") ||
    invoice?.document_url?.toLowerCase().includes("pdf");

  const fullDocUrl = getDocumentUrl(invoice?.document_url);

  return (
    <AuthProvider>
      <div className="flex-1 space-y-5 p-4 md:p-6 min-h-screen bg-slate-950 text-slate-100">
        {/* Top Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-white/10 pb-4">
          <div className="flex items-center gap-3">
            <Link
              href="/dashboard/invoices"
              className="flex size-8 items-center justify-center rounded-lg border border-white/10 bg-slate-900 text-slate-300 hover:bg-slate-800 hover:text-white transition-colors"
            >
              <ArrowLeft className="size-4" />
            </Link>
            <div>
              <div className="flex items-center gap-3 flex-wrap">
                <h1 className="text-xl font-bold tracking-tight text-white flex items-center gap-2">
                  <FileText className="size-5 text-cyan-400" />
                  Invoice: {invoice?.invoice_number || invoiceId.slice(0, 8)}
                </h1>
                {invoice && (
                  <div className="flex items-center gap-2 flex-wrap">
                    <div className="flex items-center gap-1.5 bg-slate-900 border border-white/10 rounded-md px-2 py-0.5 text-xs">
                      <span className="text-[10px] text-slate-400 font-mono">AI:</span>
                      {getStatusBadge(invoice.ai_status || invoice.status)}
                    </div>
                    <div className="flex items-center gap-1.5 bg-slate-900 border border-white/10 rounded-md px-2 py-0.5 text-xs">
                      <span className="text-[10px] text-slate-400 font-mono">Human:</span>
                      {getStatusBadge(invoice.human_status || (invoice.status === "APPROVED" ? "APPROVED" : (invoice.status === "REJECTED" ? "REJECTED" : "PENDING_REVIEW")))}
                    </div>
                  </div>
                )}
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Submitted on{" "}
                {invoice?.created_at
                  ? new Date(invoice.created_at).toLocaleString()
                  : "N/A"}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {fullDocUrl && (
              <a
                href={fullDocUrl}
                target="_blank"
                rel="noopener noreferrer"
                download
                className="inline-flex items-center gap-1.5 rounded-md border border-white/10 bg-slate-900 px-3 py-1.5 text-xs text-slate-300 hover:bg-slate-800 hover:text-white transition-colors"
              >
                <Download className="size-3.5" /> Download File
              </a>
            )}
            <Button
              variant="outline"
              size="sm"
              onClick={fetchInvoice}
              disabled={loading}
              className="border-white/10 bg-slate-900 text-slate-300 hover:bg-slate-800 text-xs h-8"
            >
              <Loader2 className={`size-3.5 mr-1 ${loading ? "animate-spin" : ""}`} />
              Refresh
            </Button>
          </div>
        </div>

        {/* Action Success Alert */}
        {actionSuccessMsg && (
          <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3.5 text-xs text-emerald-200 flex items-center gap-2.5">
            <CheckCircle2 className="size-4 text-emerald-400 shrink-0" />
            <span>{actionSuccessMsg}</span>
          </div>
        )}

        {/* Error Alert */}
        {errorMsg && (
          <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-3.5 text-xs text-red-200 flex items-center gap-2.5">
            <AlertTriangle className="size-4 text-red-400 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* Loading Skeleton */}
        {loading && !invoice ? (
          <div className="flex flex-col items-center justify-center h-80 gap-3">
            <Loader2 className="size-8 animate-spin text-cyan-400" />
            <p className="text-xs text-slate-400">Loading invoice and forensic audit data...</p>
          </div>
        ) : !invoice ? (
          <div className="text-center py-12 text-slate-400 text-sm">
            Invoice not found.
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
            {/* ========================================================================= */}
            {/* LEFT COLUMN: DOCUMENT VIEWER (5 COLS) */}
            {/* ========================================================================= */}
            <div className="lg:col-span-5 space-y-4">
              <Card className="border-white/10 bg-slate-900/60 backdrop-blur overflow-hidden">
                <CardHeader className="pb-3 border-b border-white/10 flex flex-row items-center justify-between gap-2">
                  <CardTitle className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                    <FileText className="size-4 text-cyan-400" /> Original Document
                  </CardTitle>

                  <div className="flex items-center gap-2">
                    {!isPdf && (
                      <div className="flex items-center gap-1 bg-slate-950/80 border border-white/10 rounded-md p-0.5">
                        <button
                          type="button"
                          onClick={() => setZoomLevel((z) => Math.max(0.6, z - 0.2))}
                          className="size-6 flex items-center justify-center text-slate-400 hover:text-white rounded hover:bg-slate-800 text-xs"
                          title="Zoom Out"
                        >
                          <ZoomOut className="size-3" />
                        </button>
                        <span className="text-[10px] text-slate-400 px-1 font-mono">
                          {Math.round(zoomLevel * 100)}%
                        </span>
                        <button
                          type="button"
                          onClick={() => setZoomLevel((z) => Math.min(2.5, z + 0.2))}
                          className="size-6 flex items-center justify-center text-slate-400 hover:text-white rounded hover:bg-slate-800 text-xs"
                          title="Zoom In"
                        >
                          <ZoomIn className="size-3" />
                        </button>
                        {zoomLevel !== 1 && (
                          <button
                            type="button"
                            onClick={() => setZoomLevel(1)}
                            className="size-6 flex items-center justify-center text-slate-400 hover:text-white rounded hover:bg-slate-800 text-xs"
                            title="Reset Zoom"
                          >
                            <RotateCcw className="size-3" />
                          </button>
                        )}
                      </div>
                    )}
                    {fullDocUrl && (
                      <a
                        href={fullDocUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-[11px] text-cyan-400 hover:underline flex items-center gap-1 shrink-0"
                      >
                        <ExternalLink className="size-3" /> Full Screen
                      </a>
                    )}
                  </div>
                </CardHeader>
                <CardContent className="p-0 bg-slate-950 min-h-[540px] flex items-center justify-center relative overflow-hidden">
                  {!fullDocUrl ? (
                    <div className="p-8 text-center text-slate-500 text-xs">
                      No document file attached to this invoice.
                    </div>
                  ) : isPdf ? (
                    <div className="w-full h-[620px] bg-slate-950 flex flex-col">
                      <iframe
                        src={`${fullDocUrl}#toolbar=1&navpanes=0`}
                        title="Invoice PDF"
                        className="w-full h-full border-none rounded-b-xl"
                      />
                    </div>
                  ) : (
                    <div className="p-4 w-full flex flex-col items-center justify-center min-h-[540px] max-h-[640px] overflow-auto bg-slate-950/90">
                      <img
                        src={fullDocUrl}
                        alt="Invoice Preview"
                        style={{ transform: `scale(${zoomLevel})`, transformOrigin: "center center" }}
                        className="max-w-full max-h-[560px] rounded-lg border border-white/10 object-contain shadow-2xl transition-transform duration-150"
                        onError={(e) => {
                          e.currentTarget.style.display = "none";
                          const errDiv = document.getElementById("img-doc-err-msg");
                          if (errDiv) errDiv.classList.remove("hidden");
                        }}
                      />
                      <div
                        id="img-doc-err-msg"
                        className="hidden flex-col items-center justify-center p-8 text-center text-slate-400 gap-3"
                      >
                        <AlertTriangle className="size-8 text-amber-400" />
                        <p className="text-xs">Document file could not be displayed directly.</p>
                        <a
                          href={fullDocUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-xs text-cyan-400 underline hover:text-cyan-300"
                        >
                          <ExternalLink className="size-3" /> Open original image in new tab
                        </a>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* ========================================================================= */}
            {/* RIGHT COLUMN: FORENSIC AUDIT & DECISION TERMINAL (7 COLS) */}
            {/* ========================================================================= */}
            <div className="lg:col-span-7 space-y-5">
              {/* AI Recommended Action & Suggested Next Steps Banner */}
              <Card
                className={`border backdrop-blur shadow-xl overflow-hidden ${
                  (invoice.risk_level || "LOW").toUpperCase() === "CRITICAL"
                    ? "border-rose-500/40 bg-rose-950/20"
                    : (invoice.risk_level || "LOW").toUpperCase() === "HIGH"
                    ? "border-amber-500/40 bg-amber-950/20"
                    : (invoice.risk_level || "LOW").toUpperCase() === "MEDIUM"
                    ? "border-yellow-500/30 bg-yellow-950/15"
                    : "border-emerald-500/30 bg-emerald-950/15"
                }`}
              >
                <CardHeader className="pb-2 flex flex-row items-center justify-between gap-2 border-b border-white/5">
                  <div className="flex items-center gap-2">
                    <div
                      className={`p-1.5 rounded-md ${
                        (invoice.risk_level || "LOW").toUpperCase() === "CRITICAL"
                          ? "bg-rose-500/20 text-rose-300"
                          : (invoice.risk_level || "LOW").toUpperCase() === "HIGH"
                          ? "bg-amber-500/20 text-amber-300"
                          : (invoice.risk_level || "LOW").toUpperCase() === "MEDIUM"
                          ? "bg-yellow-500/20 text-yellow-300"
                          : "bg-emerald-500/20 text-emerald-300"
                      }`}
                    >
                      <Zap className="size-4" />
                    </div>
                    <div>
                      <CardTitle className="text-sm font-bold text-white flex items-center gap-2">
                        AI Recommended Action & Next Steps
                      </CardTitle>
                      <CardDescription className="text-[11px] text-slate-400">
                        Contextual advisory formulated from multi-rule validation & policy checks.
                      </CardDescription>
                    </div>
                  </div>

                  <span
                    className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider ${
                      (invoice.risk_level || "LOW").toUpperCase() === "CRITICAL"
                        ? "bg-rose-500/20 text-rose-300 border border-rose-500/40"
                        : (invoice.risk_level || "LOW").toUpperCase() === "HIGH"
                        ? "bg-amber-500/20 text-amber-300 border border-amber-500/40"
                        : (invoice.risk_level || "LOW").toUpperCase() === "MEDIUM"
                        ? "bg-yellow-500/20 text-yellow-300 border border-yellow-500/30"
                        : "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30"
                    }`}
                  >
                    {(invoice.risk_level || "LOW").toUpperCase() === "CRITICAL"
                      ? "Action Required"
                      : (invoice.risk_level || "LOW").toUpperCase() === "HIGH"
                      ? "Policy Advisory"
                      : (invoice.risk_level || "LOW").toUpperCase() === "MEDIUM"
                      ? "Verification Recommended"
                      : "Ready to Approve"}
                  </span>
                </CardHeader>
                <CardContent className="pt-3 pb-3 space-y-2.5">
                  <div className="rounded-lg bg-slate-950/70 p-3 border border-white/10 text-xs text-slate-100 flex items-start gap-2.5">
                    <Compass className="size-4 text-cyan-400 shrink-0 mt-0.5" />
                    <div className="space-y-1">
                      <span className="font-semibold text-cyan-300 block text-[11px] uppercase tracking-wide">
                        Advisory Directive
                      </span>
                      <p className="text-slate-200 leading-relaxed text-xs">
                        {invoice.recommended_action ||
                          "Review forensic audit findings and verify line items before authorizing payment release."}
                      </p>
                    </div>
                  </div>

                  {canMakeDecision && (
                    <div className="flex items-center justify-between pt-1 text-[11px] text-slate-400">
                      <span>Quick autofill recommendation into audit remarks:</span>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() =>
                          setDecisionNotes(
                            invoice.recommended_action || "Adhered to AI audit recommendation."
                          )
                        }
                        className="h-6 px-2 text-[11px] text-cyan-400 hover:text-cyan-300 hover:bg-cyan-500/10 border border-cyan-500/20"
                      >
                        Copy to Reviewer Notes
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Human-in-the-Loop Decision Workspace */}
              {canMakeDecision && (
                <Card className={`backdrop-blur shadow-xl ${
                  isDecided && isAdmin
                    ? "border-purple-500/40 bg-purple-950/20"
                    : "border-cyan-500/30 bg-cyan-950/20"
                }`}>
                  <CardHeader className="pb-3 border-b border-white/5">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-sm font-bold text-white flex items-center gap-2">
                        {isDecided && isAdmin ? (
                          <>
                            <Undo2 className="size-4 text-purple-400" /> Admin Decision Override & Undo Control
                          </>
                        ) : (
                          <>
                            <Sparkles className="size-4 text-cyan-400" /> Human-in-the-Loop Audit Action
                          </>
                        )}
                      </CardTitle>
                      <span className="text-[11px] text-slate-400">
                        Reviewer: <span className="text-white font-medium">{user?.name}</span> ({userRole})
                      </span>
                    </div>
                    <CardDescription className="text-xs text-slate-400 mt-0.5">
                      {isDecided && isAdmin
                        ? `This invoice was already finalized as '${invoice.human_status}'. You have administrator authority to undo this decision or modify the verdict.`
                        : "Approve, reject, or flag this invoice for executive audit."}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="pt-3 space-y-3">
                    <textarea
                      rows={2}
                      value={decisionNotes}
                      onChange={(e) => setDecisionNotes(e.target.value)}
                      placeholder={
                        isDecided && isAdmin
                          ? "Enter administrative override reason or justification for undoing decision..."
                          : "Optional audit justification, compliance remarks, or rejection notes..."
                      }
                      className="w-full rounded-md border border-white/10 bg-slate-950/70 p-2.5 text-xs text-slate-100 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-500"
                    />

                    <div className="flex flex-wrap items-center gap-2">
                      {/* If already decided and user is admin, show Undo / Reset button first */}
                      {isDecided && isAdmin && (
                        <Button
                          size="sm"
                          disabled={submittingAction}
                          onClick={() => handleDecision("RESET")}
                          className="bg-purple-600 hover:bg-purple-500 text-white font-semibold text-xs h-8 shadow-md"
                        >
                          {submittingAction ? <Loader2 className="size-3.5 animate-spin mr-1" /> : <Undo2 className="size-3.5 mr-1" />}
                          Undo Decision (Reopen for Review)
                        </Button>
                      )}

                      <Button
                        size="sm"
                        disabled={submittingAction || invoice.human_status === "APPROVED"}
                        onClick={() => handleDecision("APPROVED")}
                        className="bg-emerald-500 hover:bg-emerald-600 text-white font-semibold text-xs h-8"
                      >
                        {submittingAction ? <Loader2 className="size-3.5 animate-spin mr-1" /> : <Check className="size-3.5 mr-1" />}
                        Approve Invoice
                      </Button>

                      <Button
                        size="sm"
                        disabled={submittingAction || invoice.human_status === "REJECTED"}
                        onClick={() => handleDecision("REJECTED")}
                        className="bg-rose-500 hover:bg-rose-600 text-white font-semibold text-xs h-8"
                      >
                        {submittingAction ? <Loader2 className="size-3.5 animate-spin mr-1" /> : <X className="size-3.5 mr-1" />}
                        Reject Invoice
                      </Button>

                      <Button
                        size="sm"
                        variant="outline"
                        disabled={submittingAction || invoice.status === "FLAGGED"}
                        onClick={() => handleDecision("FLAGGED")}
                        className="border-amber-500/30 bg-amber-500/10 text-amber-300 hover:bg-amber-500/20 text-xs h-8"
                      >
                        <ShieldAlert className="size-3.5 mr-1 text-amber-400" />
                        Flag for Review
                      </Button>

                      {!isDecided && (
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={submittingAction || invoice.status === "PENDING_REVIEW"}
                          onClick={() => handleDecision("PENDING_REVIEW")}
                          className="border-white/10 bg-slate-900 text-slate-300 hover:bg-slate-800 text-xs h-8"
                        >
                          <Clock className="size-3.5 mr-1" />
                          Hold (Pending)
                        </Button>
                      )}
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Human Decision Audit Record (If reviewed or rejected with notes) */}
              {(invoice.decision_notes || invoice.human_status === "REJECTED" || invoice.human_status === "APPROVED" || invoice.decision_by_name) && (
                <Card className={`border backdrop-blur ${
                  invoice.human_status === "REJECTED" || invoice.status === "REJECTED"
                    ? "border-rose-500/40 bg-rose-950/20"
                    : invoice.human_status === "APPROVED" || invoice.status === "APPROVED"
                    ? "border-emerald-500/40 bg-emerald-950/20"
                    : "border-cyan-500/30 bg-cyan-950/20"
                }`}>
                  <CardHeader className="pb-2 flex flex-row items-center justify-between border-b border-white/5">
                    <CardTitle className="text-xs font-bold text-white flex items-center gap-2">
                      <Shield className="size-4 text-cyan-400" /> Human Review Audit Record
                    </CardTitle>
                    <span className="text-[11px] text-slate-400 font-mono">
                      {invoice.decision_at ? new Date(invoice.decision_at).toLocaleString() : "Audit timestamp recorded"}
                    </span>
                  </CardHeader>
                  <CardContent className="pt-2.5 space-y-2 text-xs">
                    <div className="flex flex-wrap items-center justify-between gap-2 text-slate-300">
                      <div>
                        <span className="text-slate-400">Reviewer: </span>
                        <span className="font-semibold text-white">
                          {invoice.decision_by_name || invoice.approver_name || "Authorized Auditor"}
                        </span>
                        {invoice.decision_by_role && (
                          <span className="text-[11px] text-cyan-300 ml-1">({invoice.decision_by_role})</span>
                        )}
                      </div>
                      <div className="flex items-center gap-1.5">
                        <span className="text-slate-400">Decision Verdict:</span>
                        {getStatusBadge(invoice.human_status || invoice.status)}
                      </div>
                    </div>
                    {invoice.decision_notes && (
                      <div className="p-2.5 rounded-lg bg-slate-950/80 border border-white/10 text-slate-200">
                        <span className="text-[10px] text-slate-400 block mb-0.5 font-mono uppercase tracking-wider">
                          Reviewer Remarks / Decision Notes:
                        </span>
                        <p className="text-xs leading-relaxed">{invoice.decision_notes}</p>
                      </div>
                    )}

                    {/* Locked Notice for Non-Admins */}
                    {isDecided && !isAdmin && (
                      <div className="flex items-center gap-2 p-2 rounded-md bg-slate-950/90 border border-amber-500/30 text-amber-300 text-xs mt-1">
                        <Lock className="size-3.5 text-amber-400 shrink-0" />
                        <span>Decision finalized ({invoice.human_status}). Review options are locked. Only an Administrator can undo or modify this decision.</span>
                      </div>
                    )}
                  </CardContent>
                </Card>
              )}

              {/* Overview Details Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-7 gap-3">
                <Card className="border-white/10 bg-slate-900/60 p-3">
                  <span className="text-slate-400 block text-[11px]">Vendor Name</span>
                  <span className="font-semibold text-xs text-white truncate block mt-0.5" title={invoice.vendor_name}>
                    {invoice.vendor_name || "Unidentified"}
                  </span>
                </Card>

                <Card className="border-white/10 bg-slate-900/60 p-3">
                  <span className="text-slate-400 block text-[11px]">Invoice Date</span>
                  <span className="font-semibold text-xs text-white block mt-0.5">
                    {invoice.invoice_date ? String(invoice.invoice_date) : "N/A"}
                  </span>
                </Card>

                <Card className="border-white/10 bg-slate-900/60 p-3">
                  <span className="text-slate-400 block text-[11px]">Pre-Tax Subtotal</span>
                  <span className="font-mono font-semibold text-xs text-slate-200 block mt-0.5">
                    {formatCurrency(invoice.subtotal ?? invoice.total_amount, invoice.currency)}
                  </span>
                </Card>

                <Card className="border-cyan-500/20 bg-cyan-950/20 p-3">
                  <span className="text-cyan-300 block text-[11px] font-medium">Tax Paid (GST/VAT)</span>
                  <span className="font-mono font-bold text-xs text-cyan-200 block mt-0.5">
                    {formatCurrency(invoice.tax_amount ?? 0.0, invoice.currency)}
                  </span>
                </Card>

                <Card className="border-white/10 bg-slate-900/60 p-3">
                  <span className="text-slate-400 block text-[11px]">Total Amount</span>
                  <span className="font-mono font-bold text-sm text-cyan-300 block mt-0.5">
                    {formatCurrency(invoice.total_amount, invoice.currency)}{" "}
                    <span className="text-[10px] text-slate-400 font-sans uppercase">({invoice.currency || "INR"})</span>
                  </span>
                </Card>

                <Card className="border-white/10 bg-slate-900/60 p-3">
                  <span className="text-slate-400 block text-[11px]">Overall Confidence</span>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <Sparkles className="size-3.5 text-emerald-400 shrink-0" />
                    <span className="font-bold text-xs text-emerald-400">
                      {Math.round(((invoice.overall_confidence ?? invoice.overall_confidance) ?? 0.95) * 100)}%
                    </span>
                  </div>
                </Card>

                <Card className="border-white/10 bg-slate-900/60 p-3">
                  <span className="text-slate-400 block text-[11px]">Risk Level / Score</span>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <span
                      className={`rounded px-1.5 py-0.5 text-[10px] font-bold ${
                        (invoice.risk_level || "LOW").toUpperCase() === "CRITICAL"
                          ? "bg-rose-500/20 text-rose-300 border border-rose-500/30"
                          : (invoice.risk_level || "LOW").toUpperCase() === "HIGH"
                          ? "bg-amber-500/20 text-amber-300 border border-amber-500/30"
                          : (invoice.risk_level || "LOW").toUpperCase() === "MEDIUM"
                          ? "bg-yellow-500/20 text-yellow-300 border border-yellow-500/30"
                          : "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30"
                      }`}
                    >
                      {invoice.risk_level || "LOW"} ({(invoice.risk_score ?? 0.05).toFixed(2)})
                    </span>
                  </div>
                </Card>
              </div>

              {/* Mathematical Consistency Card */}
              <Card className="border-white/10 bg-slate-900/60 backdrop-blur">
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                      <Calculator className="size-4 text-cyan-400" /> Mathematical Consistency Check
                    </CardTitle>
                    {isMathAccurate ? (
                      <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded">
                        <Check className="size-3" /> Exact Sum Verified
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-rose-400 bg-rose-500/10 border border-rose-500/20 px-2 py-0.5 rounded">
                        <AlertTriangle className="size-3" /> Sum Discrepancy ({formatCurrency(Math.abs(calculatedItemsSum - Number(invoice.total_amount)), invoice.currency)})
                      </span>
                    )}
                  </div>
                </CardHeader>
                <CardContent className="pt-0">
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs font-mono bg-slate-950/60 p-2.5 rounded-lg border border-white/5">
                    <div>
                      <span className="text-[10px] text-slate-400 block font-sans">Pre-Tax Subtotal</span>
                      <span className="text-slate-200 font-semibold">{formatCurrency(invoice.subtotal || calculatedItemsSum, invoice.currency)}</span>
                    </div>
                    <div>
                      <span className="text-[10px] text-cyan-400 block font-sans">Tax Paid Amount</span>
                      <span className="text-cyan-300 font-semibold">{formatCurrency(invoice.tax_amount || 0.0, invoice.currency)}</span>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-400 block font-sans">Invoice Total Amount</span>
                      <span className="text-white font-bold">{formatCurrency(invoice.total_amount, invoice.currency)}</span>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-400 block font-sans">Calculated Variance</span>
                      <span className={isMathAccurate ? "text-emerald-400 font-semibold" : "text-rose-400 font-semibold"}>
                        {formatCurrency(Math.abs(calculatedItemsSum - Number(invoice.total_amount)), invoice.currency)}
                      </span>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Itemized Line Items Table */}
              <Card className="border-white/10 bg-slate-900/60 backdrop-blur overflow-hidden">
                <CardHeader className="pb-3">
                  <CardTitle className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                    <Layers className="size-4 text-cyan-400" /> Extracted Line Items ({invoice.line_items?.length || 0})
                  </CardTitle>
                </CardHeader>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader className="bg-slate-950/60">
                      <TableRow className="border-white/10 hover:bg-transparent">
                        <TableHead className="text-slate-400 text-[11px]">Description</TableHead>
                        <TableHead className="text-slate-400 text-[11px] text-right">Quantity</TableHead>
                        <TableHead className="text-slate-400 text-[11px] text-right">Unit Price</TableHead>
                        <TableHead className="text-slate-400 text-[11px] text-right">Total Amount</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {!invoice.line_items || invoice.line_items.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={4} className="text-center text-xs text-slate-500 py-6">
                            No line items extracted.
                          </TableCell>
                        </TableRow>
                      ) : (
                        invoice.line_items.map((item, idx) => (
                          <TableRow key={idx} className="border-white/5 text-xs">
                            <TableCell className="font-medium text-slate-200">{item.description}</TableCell>
                            <TableCell className="text-slate-400 text-right font-mono">{item.quantity}</TableCell>
                            <TableCell className="text-slate-400 text-right font-mono">
                              {formatCurrency(item.unit_price, invoice.currency)}
                            </TableCell>
                            <TableCell className="font-mono text-right font-semibold text-white">
                              {formatCurrency(item.total_amount, invoice.currency)}
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </div>
              </Card>

              {/* AI Forensic Anomaly Findings */}
              <Card className="border-white/10 bg-slate-900/60 backdrop-blur">
                <CardHeader className="pb-3">
                  <CardTitle className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                    <ShieldAlert className="size-4 text-amber-400" /> AI Forensic Anomaly & Policy Evaluation
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2.5">
                  {!invoice.anomalies || invoice.anomalies.length === 0 ? (
                    <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/10 p-3.5 text-xs text-emerald-300 flex items-center gap-2.5">
                      <CheckCircle2 className="size-4 text-emerald-400 shrink-0" />
                      <div>
                        <span className="font-semibold block">Clean Audit Verdict</span>
                        <span className="text-[11px] text-emerald-400/80">
                          Invoice complies with all active corporate policies and mathematical standards.
                        </span>
                      </div>
                    </div>
                  ) : (
                    invoice.anomalies.map((anom, idx) => (
                      <div
                        key={idx}
                        className="rounded-lg border border-white/10 bg-slate-950/70 p-3 text-xs space-y-1.5"
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-semibold text-white flex items-center gap-1.5">
                            <AlertCircle className="size-3.5 text-amber-400" /> {anom.anomaly_flag || anom.anomaly_type}
                          </span>
                          <span
                            className={`rounded-md border px-2 py-0.5 text-[10px] font-bold ${getSeverityBadge(
                              anom.severity
                            )}`}
                          >
                            {anom.severity}
                          </span>
                        </div>
                        <p className="text-slate-300 leading-relaxed">{anom.reason || anom.explanation}</p>
                        {anom.evidence && (
                          <div className="rounded bg-slate-900/90 p-2 font-mono text-[11px] text-slate-400 border border-white/5">
                            Evidence: {anom.evidence}
                          </div>
                        )}
                      </div>
                    ))
                  )}
                </CardContent>
              </Card>
            </div>
          </div>
        )}
      </div>
    </AuthProvider>
  );
}
