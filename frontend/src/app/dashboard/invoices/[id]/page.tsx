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
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
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
  anomaly_type: string;
  severity: "CRITICAL" | "HIGH" | "MEDIUM" | "LOW";
  explanation: string;
  evidence?: string;
}

interface InvoiceDetail {
  id: string;
  invoice_number: string;
  vendor_name: string;
  invoice_date: string;
  total_amount: number;
  currency: string;
  status: "PROCESSING" | "PENDING_REVIEW" | "APPROVED" | "FLAGGED" | "REJECTED";
  document_url: string;
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

  // RBAC permissions
  const userRole = (role || user?.role || "EMPLOYEE").toUpperCase();
  const userDept = (user?.department || "").toUpperCase();

  const canMakeDecision =
    ["ADMIN", "AUDITOR", "FINANCE", "COMPLIANCE", "MANAGER", "SUPERADMIN"].includes(userRole) ||
    ["FINANCE", "COMPLIANCE", "ADMIN", "AUDIT", "LEGAL"].includes(userDept);

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

  // Handle Human Decision
  const handleDecision = async (
    targetStatus: "APPROVED" | "REJECTED" | "FLAGGED" | "PENDING_REVIEW"
  ) => {
    try {
      setSubmittingAction(true);
      setActionSuccessMsg("");
      const res = await axios.post(`/invoice/${invoiceId}/decision`, {
        status: targetStatus,
        notes: decisionNotes.trim() || undefined,
      });

      setActionSuccessMsg(
        res.data?.message || `Invoice marked as ${targetStatus} successfully.`
      );
      setInvoice((prev) =>
        prev
          ? {
              ...prev,
              status: targetStatus,
              approver_name: user?.name || "Me",
            }
          : null
      );
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
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-bold tracking-tight text-white flex items-center gap-2">
                  <FileText className="size-5 text-cyan-400" />
                  Invoice: {invoice?.invoice_number || invoiceId.slice(0, 8)}
                </h1>
                {invoice && getStatusBadge(invoice.status)}
              </div>
              <p className="text-xs text-slate-400">
                Submitted on{" "}
                {invoice?.created_at
                  ? new Date(invoice.created_at).toLocaleString()
                  : "N/A"}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {invoice?.document_url && (
              <a
                href={invoice.document_url}
                target="_blank"
                rel="noopener noreferrer"
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
                <CardHeader className="pb-3 border-b border-white/10 flex flex-row items-center justify-between">
                  <CardTitle className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                    <FileText className="size-4 text-cyan-400" /> Original Document
                  </CardTitle>
                  <a
                    href={invoice.document_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[11px] text-cyan-400 hover:underline flex items-center gap-1"
                  >
                    <ExternalLink className="size-3" /> Full Screen
                  </a>
                </CardHeader>
                <CardContent className="p-0 bg-slate-950/80 min-h-[520px] flex items-center justify-center">
                  {isPdf ? (
                    <iframe
                      src={`${invoice.document_url}#toolbar=0`}
                      title="Invoice PDF"
                      className="w-full h-[580px] border-none rounded-b-xl"
                    />
                  ) : (
                    <div className="p-3 w-full flex items-center justify-center overflow-auto max-h-[580px]">
                      <img
                        src={invoice.document_url}
                        alt="Invoice Preview"
                        className="max-w-full max-h-[540px] rounded-lg border border-white/10 object-contain shadow-2xl"
                      />
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* ========================================================================= */}
            {/* RIGHT COLUMN: FORENSIC AUDIT & DECISION TERMINAL (7 COLS) */}
            {/* ========================================================================= */}
            <div className="lg:col-span-7 space-y-5">
              {/* Human-in-the-Loop Decision Workspace */}
              {canMakeDecision && (
                <Card className="border-cyan-500/30 bg-cyan-950/20 backdrop-blur shadow-xl">
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-sm font-bold text-white flex items-center gap-2">
                        <Sparkles className="size-4 text-cyan-400" /> Human-in-the-Loop Audit Action
                      </CardTitle>
                      <span className="text-[11px] text-slate-400">
                        Reviewer: <span className="text-white font-medium">{user?.name}</span> ({userRole})
                      </span>
                    </div>
                    <CardDescription className="text-xs text-slate-400">
                      Approve, reject, or flag this invoice for executive audit.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <textarea
                      rows={2}
                      value={decisionNotes}
                      onChange={(e) => setDecisionNotes(e.target.value)}
                      placeholder="Optional audit justification, compliance remarks, or rejection notes..."
                      className="w-full rounded-md border border-white/10 bg-slate-950/70 p-2.5 text-xs text-slate-100 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-500"
                    />

                    <div className="flex flex-wrap items-center gap-2">
                      <Button
                        size="sm"
                        disabled={submittingAction || invoice.status === "APPROVED"}
                        onClick={() => handleDecision("APPROVED")}
                        className="bg-emerald-500 hover:bg-emerald-600 text-white font-semibold text-xs h-8"
                      >
                        {submittingAction ? <Loader2 className="size-3.5 animate-spin mr-1" /> : <Check className="size-3.5 mr-1" />}
                        Approve Invoice
                      </Button>

                      <Button
                        size="sm"
                        disabled={submittingAction || invoice.status === "REJECTED"}
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
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Overview Details Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <Card className="border-white/10 bg-slate-900/60 p-3.5">
                  <span className="text-slate-400 block text-[11px]">Vendor Name</span>
                  <span className="font-semibold text-xs text-white truncate block mt-0.5">
                    {invoice.vendor_name || "Unidentified"}
                  </span>
                </Card>

                <Card className="border-white/10 bg-slate-900/60 p-3.5">
                  <span className="text-slate-400 block text-[11px]">Invoice Date</span>
                  <span className="font-semibold text-xs text-white block mt-0.5">
                    {invoice.invoice_date ? String(invoice.invoice_date) : "N/A"}
                  </span>
                </Card>

                <Card className="border-white/10 bg-slate-900/60 p-3.5">
                  <span className="text-slate-400 block text-[11px]">Total Amount</span>
                  <span className="font-mono font-bold text-sm text-cyan-300 block mt-0.5">
                    ${Number(invoice.total_amount).toLocaleString("en-US", { minimumFractionDigits: 2 })}{" "}
                    <span className="text-[10px] text-slate-400">{invoice.currency}</span>
                  </span>
                </Card>

                <Card className="border-white/10 bg-slate-900/60 p-3.5">
                  <span className="text-slate-400 block text-[11px]">Submitter</span>
                  <span className="font-semibold text-xs text-slate-200 block truncate mt-0.5">
                    {invoice.submitter_name || "Unknown"}
                  </span>
                  <span className="text-[10px] text-slate-400 block">
                    {invoice.submitter_department || "General"}
                  </span>
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
                        <AlertTriangle className="size-3" /> Sum Discrepancy (${Math.abs(calculatedItemsSum - Number(invoice.total_amount)).toFixed(2)})
                      </span>
                    )}
                  </div>
                </CardHeader>
                <CardContent className="pt-0">
                  <div className="grid grid-cols-3 gap-2 text-xs font-mono bg-slate-950/60 p-2.5 rounded-lg border border-white/5">
                    <div>
                      <span className="text-[10px] text-slate-400 block font-sans">Line Items Total</span>
                      <span className="text-slate-200 font-semibold">${calculatedItemsSum.toFixed(2)}</span>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-400 block font-sans">Invoice Total Amount</span>
                      <span className="text-slate-200 font-semibold">${Number(invoice.total_amount).toFixed(2)}</span>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-400 block font-sans">Calculated Variance</span>
                      <span className={isMathAccurate ? "text-emerald-400 font-semibold" : "text-rose-400 font-semibold"}>
                        ${Math.abs(calculatedItemsSum - Number(invoice.total_amount)).toFixed(2)}
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
                              ${Number(item.unit_price).toFixed(2)}
                            </TableCell>
                            <TableCell className="font-mono text-right font-semibold text-white">
                              ${Number(item.total_amount).toFixed(2)}
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
                            <AlertCircle className="size-3.5 text-amber-400" /> {anom.anomaly_type}
                          </span>
                          <span
                            className={`rounded-md border px-2 py-0.5 text-[10px] font-bold ${getSeverityBadge(
                              anom.severity
                            )}`}
                          >
                            {anom.severity}
                          </span>
                        </div>
                        <p className="text-slate-300 leading-relaxed">{anom.explanation}</p>
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
