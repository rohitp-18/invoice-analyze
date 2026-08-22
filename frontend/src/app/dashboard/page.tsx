"use client";

import React, { useEffect, useState } from "react";
import { useSelector } from "react-redux";
import { RootState } from "@/store/store";
import AuthProvider from "@/components/authProvider";
import axios from "@/store/axios";
import { isAxiosError } from "axios";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  FileText,
  DollarSign,
  CheckCircle2,
  Clock,
  AlertTriangle,
  XCircle,
  UploadCloud,
  RefreshCw,
  Scale,
  Plus,
  Shield,
  ShieldAlert,
  Building,
  User as UserIcon,
  FileSpreadsheet,
  ArrowRight,
  Eye,
  Check,
  X,
  Sparkles,
  Loader2,
  TrendingUp,
  Activity,
  Layers,
  ChevronRight,
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface MetricItem {
  id: string;
  title: string;
  value: string;
  detail: string;
  type: "primary" | "success" | "warning" | "danger";
}

interface RecentInvoice {
  id: string;
  invoice_number: string;
  vendor_name: string;
  invoice_date?: string;
  total_amount: number;
  currency: string;
  status: "APPROVED" | "PENDING_REVIEW" | "PROCESSING" | "FLAGGED" | "REJECTED";
  submitter_name?: string;
  submitter_department?: string;
  approver_name?: string;
  anomalies_count: number;
  created_at?: string;
}

interface DashboardData {
  user: {
    name?: string;
    email: string;
    role: string;
    department: string;
  };
  role_category: "ADMIN" | "FINANCE" | "COMPLIANCE" | "MANAGER" | "EMPLOYEE";
  metrics: MetricItem[];
  status_breakdown: {
    APPROVED: number;
    PENDING_REVIEW: number;
    PROCESSING: number;
    FLAGGED: number;
    REJECTED: number;
  };
  recent_invoices: RecentInvoice[];
  total_count: number;
  total_spend: number;
}

export default function DashboardPage() {
  const router = useRouter();
  const { user, role } = useSelector((state: RootState) => state.auth);

  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [errorMsg, setErrorMsg] = useState<string>("");

  // Quick Decision Modal State
  const [selectedInvoice, setSelectedInvoice] = useState<RecentInvoice | null>(null);
  const [decisionAction, setDecisionAction] = useState<"APPROVED" | "REJECTED" | "FLAGGED" | null>(null);
  const [decisionNotes, setDecisionNotes] = useState<string>("");
  const [isDecisionOpen, setIsDecisionOpen] = useState<boolean>(false);
  const [actionSubmitting, setActionSubmitting] = useState<boolean>(false);

  const userRole = (role || user?.role || "EMPLOYEE").toUpperCase();
  const userDept = (user?.department || "General").toUpperCase();

  const canMakeDecision =
    ["ADMIN", "AUDITOR", "FINANCE", "COMPLIANCE", "MANAGER", "SUPERADMIN"].includes(userRole) ||
    ["FINANCE", "COMPLIANCE", "ADMIN", "AUDIT", "LEGAL"].includes(userDept);

  // Fetch Dashboard Stats
  const fetchDashboardStats = async () => {
    try {
      setLoading(true);
      setErrorMsg("");
      const res = await axios.get<DashboardData>("/dashboard/stats");
      setData(res.data);
    } catch (err: unknown) {
      console.error("Dashboard stats error:", err);
      if (isAxiosError(err)) {
        setErrorMsg(
          err.response?.data?.detail || "Failed to load dashboard analytics."
        );
      } else {
        setErrorMsg("Failed to connect to analytics server.");
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardStats();
  }, []);

  // Quick Decision Handlers
  const openDecisionModal = (
    inv: RecentInvoice,
    action: "APPROVED" | "REJECTED" | "FLAGGED",
    e?: React.MouseEvent
  ) => {
    if (e) e.stopPropagation();
    setSelectedInvoice(inv);
    setDecisionAction(action);
    setDecisionNotes("");
    setIsDecisionOpen(true);
  };

  const handleDecisionSubmit = async () => {
    if (!selectedInvoice || !decisionAction) return;

    try {
      setActionSubmitting(true);
      await axios.post(`/invoice/${selectedInvoice.id}/decision`, {
        status: decisionAction,
        notes: decisionNotes.trim() || undefined,
      });

      // Optimistic update
      setData((prev) => {
        if (!prev) return prev;
        const updatedInvoices = prev.recent_invoices.map((inv) =>
          inv.id === selectedInvoice.id
            ? { ...inv, status: decisionAction }
            : inv
        );
        return { ...prev, recent_invoices: updatedInvoices };
      });

      setIsDecisionOpen(false);
    } catch (err: unknown) {
      console.error("Decision update failed:", err);
      if (isAxiosError(err)) {
        alert(err.response?.data?.detail || "Failed to submit decision");
      }
    } finally {
      setActionSubmitting(false);
    }
  };

  const getMetricIcon = (id: string) => {
    switch (id) {
      case "total_invoices":
      case "total_spend":
      case "dept_spend":
      case "my_submissions":
        return <FileText className="size-4 text-cyan-400" />;
      case "ready_disbursement":
      case "dept_approved":
      case "my_approved":
      case "approved_clean":
        return <CheckCircle2 className="size-4 text-emerald-400" />;
      case "pending_action":
      case "pending_payout":
      case "awaiting_manager":
      case "my_pending":
        return <Clock className="size-4 text-amber-400" />;
      case "critical_risk":
      case "flagged_invoices":
      case "math_discrepancy":
      case "total_violations":
      case "dept_flagged":
      case "my_flagged":
        return <ShieldAlert className="size-4 text-rose-400" />;
      case "active_governance":
      case "active_policies":
        return <Scale className="size-4 text-purple-400" />;
      default:
        return <Activity className="size-4 text-slate-400" />;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "APPROVED":
        return (
          <span className="inline-flex items-center gap-1 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-[11px] font-semibold text-emerald-300">
            <CheckCircle2 className="size-3 text-emerald-400" /> Approved
          </span>
        );
      case "FLAGGED":
        return (
          <span className="inline-flex items-center gap-1 rounded-full border border-rose-500/30 bg-rose-500/10 px-2 py-0.5 text-[11px] font-semibold text-rose-300">
            <AlertTriangle className="size-3 text-rose-400" /> Flagged
          </span>
        );
      case "PROCESSING":
        return (
          <span className="inline-flex items-center gap-1 rounded-full border border-cyan-500/30 bg-cyan-500/10 px-2 py-0.5 text-[11px] font-semibold text-cyan-300">
            <Loader2 className="size-3 animate-spin text-cyan-400" /> Processing AI
          </span>
        );
      case "REJECTED":
        return (
          <span className="inline-flex items-center gap-1 rounded-full border border-red-500/30 bg-red-500/10 px-2 py-0.5 text-[11px] font-semibold text-red-300">
            <XCircle className="size-3 text-red-400" /> Rejected
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 rounded-full border border-amber-500/30 bg-amber-500/10 px-2 py-0.5 text-[11px] font-semibold text-amber-300">
            <Clock className="size-3 text-amber-400" /> Pending Review
          </span>
        );
    }
  };

  return (
    <AuthProvider>
      <div className="flex-1 space-y-6 p-6 md:p-8 pt-6 min-h-screen bg-slate-950 text-slate-100">
        {/* Welcome Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-white/10 pb-5">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="flex size-7 items-center justify-center rounded-lg bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">
                <Sparkles className="size-4" />
              </span>
              <h1 className="text-2xl font-bold tracking-tight text-white">
                Welcome back, {user?.name || "User"}
              </h1>
            </div>
            <p className="text-xs text-slate-400 flex items-center gap-2">
              <span>Department: <span className="text-slate-200 font-semibold">{userDept}</span></span>
              <span>•</span>
              <span>Role: <span className="text-cyan-300 font-semibold">{userRole}</span></span>
              <span>•</span>
              <span>{new Date().toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric" })}</span>
            </p>
          </div>

          <div className="flex items-center gap-2.5">
            <Button
              variant="outline"
              size="sm"
              onClick={fetchDashboardStats}
              disabled={loading}
              className="border-white/10 bg-slate-900 text-slate-300 hover:bg-slate-800 text-xs h-9"
            >
              <RefreshCw className={`size-3.5 mr-1.5 ${loading ? "animate-spin" : ""}`} />
              Refresh
            </Button>
            <Link href="/invoice/upload">
              <Button className="bg-cyan-400 hover:bg-cyan-300 text-slate-950 font-semibold text-xs h-9 shadow-md shadow-cyan-950/40">
                <UploadCloud className="size-4 mr-1.5" />
                Upload Invoice
              </Button>
            </Link>
          </div>
        </div>

        {/* Feedback Alert */}
        {errorMsg && (
          <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-3.5 text-xs text-red-200 flex items-center gap-2.5">
            <AlertTriangle className="size-4 text-red-400 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* Dynamic Role Metric Cards */}
        <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
          {loading && !data ? (
            Array.from({ length: 4 }).map((_, idx) => (
              <Card key={idx} className="border-white/10 bg-slate-900/40 p-4 animate-pulse">
                <div className="h-4 bg-slate-800 rounded w-24 mb-2" />
                <div className="h-8 bg-slate-800 rounded w-16 mb-2" />
                <div className="h-3 bg-slate-800 rounded w-32" />
              </Card>
            ))
          ) : (
            data?.metrics.map((metric) => (
              <Card
                key={metric.id}
                className="border-white/10 bg-slate-900/60 backdrop-blur hover:border-white/20 transition-colors shadow-lg"
              >
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-xs font-semibold text-slate-400">
                    {metric.title}
                  </CardTitle>
                  {getMetricIcon(metric.id)}
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-white tracking-tight">
                    {metric.value}
                  </div>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    {metric.detail}
                  </p>
                </CardContent>
              </Card>
            ))
          )}
        </div>

        {/* Status Distribution Banner */}
        {data && (
          <div className="rounded-xl border border-white/10 bg-slate-900/60 p-4 backdrop-blur shadow-md">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-3">
              <span className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                <Activity className="size-3.5 text-cyan-400" /> Ledger Health & Status Distribution
              </span>
              <span className="text-[11px] text-slate-400">
                Total Scoped Volume: <span className="text-white font-semibold">{data.total_count} invoices</span> (${data.total_spend.toLocaleString("en-US", { minimumFractionDigits: 2 })})
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5">
              <div className="rounded-lg bg-emerald-500/10 border border-emerald-500/20 p-2.5 text-center">
                <span className="text-[10px] text-emerald-400 font-medium block">Approved</span>
                <span className="text-base font-bold text-emerald-300 font-mono">
                  {data.status_breakdown.APPROVED}
                </span>
              </div>
              <div className="rounded-lg bg-amber-500/10 border border-amber-500/20 p-2.5 text-center">
                <span className="text-[10px] text-amber-400 font-medium block">Pending Review</span>
                <span className="text-base font-bold text-amber-300 font-mono">
                  {data.status_breakdown.PENDING_REVIEW}
                </span>
              </div>
              <div className="rounded-lg bg-cyan-500/10 border border-cyan-500/20 p-2.5 text-center">
                <span className="text-[10px] text-cyan-400 font-medium block">Processing AI</span>
                <span className="text-base font-bold text-cyan-300 font-mono">
                  {data.status_breakdown.PROCESSING}
                </span>
              </div>
              <div className="rounded-lg bg-rose-500/10 border border-rose-500/20 p-2.5 text-center">
                <span className="text-[10px] text-rose-400 font-medium block">Flagged (Risk)</span>
                <span className="text-base font-bold text-rose-300 font-mono">
                  {data.status_breakdown.FLAGGED}
                </span>
              </div>
              <div className="rounded-lg bg-red-500/10 border border-red-500/20 p-2.5 text-center">
                <span className="text-[10px] text-red-400 font-medium block">Rejected</span>
                <span className="text-base font-bold text-red-300 font-mono">
                  {data.status_breakdown.REJECTED}
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Main Content Grid: Recent Invoices Queue + Role Shortcuts */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* ========================================================================= */}
          {/* LEFT: RECENT INVOICES ACTION TABLE (8 COLS) */}
          {/* ========================================================================= */}
          <div className="lg:col-span-8 space-y-4">
            <Card className="border-white/10 bg-slate-900/60 backdrop-blur shadow-xl overflow-hidden">
              <CardHeader className="pb-3 border-b border-white/10 flex flex-row items-center justify-between">
                <div>
                  <CardTitle className="text-sm font-semibold text-white flex items-center gap-2">
                    <FileText className="size-4 text-cyan-400" />
                    {canMakeDecision ? "Recent Invoices & Audit Queue" : "My Recent Invoices"}
                  </CardTitle>
                  <CardDescription className="text-xs text-slate-400 mt-0.5">
                    {canMakeDecision
                      ? "Invoices awaiting verification, review, or payment clearance."
                      : "Your latest invoice claims and automated AI verification statuses."}
                  </CardDescription>
                </div>

                {canMakeDecision ? (
                  <Link href="/dashboard/invoices">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-cyan-300 hover:bg-cyan-500/10 text-xs h-8"
                    >
                      View All <ChevronRight className="size-3.5 ml-1" />
                    </Button>
                  </Link>
                ) : (
                  <Link href="/invoice/details">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-cyan-300 hover:bg-cyan-500/10 text-xs h-8"
                    >
                      View All <ChevronRight className="size-3.5 ml-1" />
                    </Button>
                  </Link>
                )}
              </CardHeader>

              <div className="overflow-x-auto">
                <Table>
                  <TableHeader className="bg-slate-950/60">
                    <TableRow className="border-white/10 hover:bg-transparent">
                      <TableHead className="text-slate-300 font-semibold text-xs w-28">
                        Invoice #
                      </TableHead>
                      <TableHead className="text-slate-300 font-semibold text-xs">
                        Vendor
                      </TableHead>
                      <TableHead className="text-slate-300 font-semibold text-xs">
                        Amount ($)
                      </TableHead>
                      <TableHead className="text-slate-300 font-semibold text-xs">
                        Status
                      </TableHead>
                      <TableHead className="text-slate-300 font-semibold text-xs text-right">
                        Action
                      </TableHead>
                    </TableRow>
                  </TableHeader>

                  <TableBody>
                    {loading ? (
                      <TableRow>
                        <TableCell colSpan={5} className="h-40 text-center text-slate-400">
                          <div className="flex flex-col items-center justify-center gap-2">
                            <Loader2 className="size-6 animate-spin text-cyan-400" />
                            <span className="text-xs">Loading recent ledger records...</span>
                          </div>
                        </TableCell>
                      </TableRow>
                    ) : !data?.recent_invoices || data.recent_invoices.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={5} className="h-40 text-center text-slate-400">
                          <div className="flex flex-col items-center justify-center gap-2">
                            <FileText className="size-7 text-slate-600" />
                            <span className="text-xs font-medium text-slate-300">
                              No invoices found for current scope.
                            </span>
                            <Link href="/invoice/upload">
                              <Button size="sm" className="bg-cyan-400 text-slate-950 text-xs mt-1 h-7">
                                Upload First Invoice
                              </Button>
                            </Link>
                          </div>
                        </TableCell>
                      </TableRow>
                    ) : (
                      data.recent_invoices.map((inv) => (
                        <TableRow
                          key={inv.id}
                          className="border-white/5 hover:bg-slate-800/40 transition-colors cursor-pointer text-xs"
                          onClick={() => router.push(`/dashboard/invoices/${inv.id}`)}
                        >
                          <TableCell className="font-mono font-semibold text-cyan-300">
                            {inv.invoice_number || "Processing..."}
                          </TableCell>

                          <TableCell>
                            <span className="font-semibold text-white block">
                              {inv.vendor_name || "Unidentified"}
                            </span>
                            <span className="text-[10px] text-slate-400">
                              By {inv.submitter_name} ({inv.submitter_department})
                            </span>
                          </TableCell>

                          <TableCell className="font-mono font-semibold text-white">
                            ${Number(inv.total_amount || 0).toLocaleString("en-US", { minimumFractionDigits: 2 })}
                          </TableCell>

                          <TableCell>{getStatusBadge(inv.status)}</TableCell>

                          <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                            <div className="flex items-center justify-end gap-1.5">
                              {canMakeDecision && inv.status === "PENDING_REVIEW" && (
                                <>
                                  <Button
                                    size="icon-sm"
                                    variant="ghost"
                                    onClick={(e) => openDecisionModal(inv, "APPROVED", e)}
                                    className="size-7 text-emerald-400 hover:bg-emerald-500/20"
                                    title="Quick Approve"
                                  >
                                    <Check className="size-3.5" />
                                  </Button>
                                  <Button
                                    size="icon-sm"
                                    variant="ghost"
                                    onClick={(e) => openDecisionModal(inv, "REJECTED", e)}
                                    className="size-7 text-rose-400 hover:bg-rose-500/20"
                                    title="Quick Reject"
                                  >
                                    <X className="size-3.5" />
                                  </Button>
                                </>
                              )}
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => router.push(`/dashboard/invoices/${inv.id}`)}
                                className="text-slate-300 hover:text-white hover:bg-white/10 text-xs h-7 px-2"
                              >
                                <Eye className="size-3.5 mr-1" /> View
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </Card>
          </div>

          {/* ========================================================================= */}
          {/* RIGHT: ROLE-CUSTOMIZED WORKSPACE SHORTCUTS (4 COLS) */}
          {/* ========================================================================= */}
          <div className="lg:col-span-4 space-y-5">
            {/* Quick Actions Card */}
            <Card className="border-white/10 bg-slate-900/60 backdrop-blur shadow-xl">
              <CardHeader className="pb-3 border-b border-white/10">
                <CardTitle className="text-sm font-semibold text-white flex items-center gap-2">
                  <Sparkles className="size-4 text-cyan-400" /> Authorized Actions
                </CardTitle>
                <CardDescription className="text-xs text-slate-400">
                  Quick links customized for {userRole}.
                </CardDescription>
              </CardHeader>

              <CardContent className="p-4 space-y-2 text-xs">
                <Link href="/invoice/upload" className="block">
                  <Button
                    variant="outline"
                    className="w-full justify-between border-white/10 bg-slate-950/60 hover:bg-slate-800 text-slate-200 text-xs h-9"
                  >
                    <span className="flex items-center gap-2">
                      <UploadCloud className="size-4 text-cyan-400" />
                      Upload New Receipt
                    </span>
                    <ArrowRight className="size-3 text-slate-500" />
                  </Button>
                </Link>

                {canMakeDecision && (
                  <Link href="/dashboard/invoices" className="block">
                    <Button
                      variant="outline"
                      className="w-full justify-between border-white/10 bg-slate-950/60 hover:bg-slate-800 text-slate-200 text-xs h-9"
                    >
                      <span className="flex items-center gap-2">
                        <FileText className="size-4 text-emerald-400" />
                        Full Invoices Ledger
                      </span>
                      <ArrowRight className="size-3 text-slate-500" />
                    </Button>
                  </Link>
                )}

                {["COMPLIANCE", "ADMIN", "SUPERADMIN"].includes(userRole) && (
                  <>
                    <Link href="/dashboard/compliance" className="block">
                      <Button
                        variant="outline"
                        className="w-full justify-between border-white/10 bg-slate-950/60 hover:bg-slate-800 text-slate-200 text-xs h-9"
                      >
                        <span className="flex items-center gap-2">
                          <Scale className="size-4 text-purple-400" />
                          Compliance Rules
                        </span>
                        <ArrowRight className="size-3 text-slate-500" />
                      </Button>
                    </Link>

                    <Link href="/dashboard/compliance/new" className="block">
                      <Button
                        variant="outline"
                        className="w-full justify-between border-white/10 bg-slate-950/60 hover:bg-slate-800 text-slate-200 text-xs h-9"
                      >
                        <span className="flex items-center gap-2">
                          <Plus className="size-4 text-cyan-400" />
                          New Compliance Policy
                        </span>
                        <ArrowRight className="size-3 text-slate-500" />
                      </Button>
                    </Link>
                  </>
                )}

                {canMakeDecision && (
                  <Link href="/dashboard/export" className="block">
                    <Button
                      variant="outline"
                      className="w-full justify-between border-white/10 bg-slate-950/60 hover:bg-slate-800 text-slate-200 text-xs h-9"
                    >
                      <span className="flex items-center gap-2">
                        <FileSpreadsheet className="size-4 text-emerald-400" />
                        Export Ledger (CSV)
                      </span>
                      <ArrowRight className="size-3 text-slate-500" />
                    </Button>
                  </Link>
                )}

                <Link href="/dashboard/profile" className="block">
                  <Button
                    variant="outline"
                    className="w-full justify-between border-white/10 bg-slate-950/60 hover:bg-slate-800 text-slate-200 text-xs h-9"
                  >
                    <span className="flex items-center gap-2">
                      <UserIcon className="size-4 text-amber-400" />
                      My Account & Roles
                    </span>
                    <ArrowRight className="size-3 text-slate-500" />
                  </Button>
                </Link>
              </CardContent>
            </Card>

            {/* AI Agent Engine Status */}
            <Card className="border-cyan-500/30 bg-cyan-950/20 backdrop-blur p-4">
              <div className="flex items-start gap-3">
                <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">
                  <Sparkles className="size-4" />
                </div>
                <div>
                  <span className="text-xs font-semibold text-white block">
                    LangGraph AI Engine Active
                  </span>
                  <p className="text-[11px] text-slate-400 mt-0.5 leading-relaxed">
                    Automated line item OCR extraction, math variance checks, and FAISS vector policy evaluation running on background workers.
                  </p>
                </div>
              </div>
            </Card>
          </div>
        </div>

        {/* Quick Decision Modal */}
        <Dialog open={isDecisionOpen} onOpenChange={setIsDecisionOpen}>
          <DialogContent className="sm:max-w-md border-white/10 bg-slate-900 text-slate-100 backdrop-blur-xl">
            <DialogHeader>
              <DialogTitle className="text-base font-bold text-white flex items-center gap-2">
                {decisionAction === "APPROVED" ? (
                  <CheckCircle2 className="size-5 text-emerald-400" />
                ) : (
                  <XCircle className="size-5 text-rose-400" />
                )}
                Confirm {decisionAction === "APPROVED" ? "Approval" : "Rejection"}
              </DialogTitle>
              <DialogDescription className="text-xs text-slate-400">
                Mark Invoice <span className="font-semibold text-white">{selectedInvoice?.invoice_number}</span> (${Number(selectedInvoice?.total_amount).toFixed(2)}) as{" "}
                <span className="font-bold text-cyan-300">{decisionAction}</span>?
              </DialogDescription>
            </DialogHeader>

            <div className="py-2 text-xs">
              <label className="text-slate-300 font-medium block mb-1">
                Reviewer Remarks (Optional)
              </label>
              <textarea
                rows={3}
                value={decisionNotes}
                onChange={(e) => setDecisionNotes(e.target.value)}
                placeholder="Enter audit approval remarks or rejection justification..."
                className="w-full rounded-md border border-white/10 bg-slate-950/70 p-2.5 text-xs text-slate-100 focus:outline-none focus:ring-2 focus:ring-cyan-500"
              />
            </div>

            <DialogFooter className="gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsDecisionOpen(false)}
                className="border-white/10 bg-slate-950/50 text-slate-300 text-xs"
              >
                Cancel
              </Button>
              <Button
                size="sm"
                onClick={handleDecisionSubmit}
                disabled={actionSubmitting}
                className={
                  decisionAction === "APPROVED"
                    ? "bg-emerald-500 hover:bg-emerald-600 text-white font-semibold text-xs"
                    : "bg-rose-500 hover:bg-rose-600 text-white font-semibold text-xs"
                }
              >
                {actionSubmitting ? <Loader2 className="size-3.5 animate-spin mr-1.5" /> : null}
                Confirm {decisionAction}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </AuthProvider>
  );
}
