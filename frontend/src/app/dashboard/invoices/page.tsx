"use client";

import React, { useEffect, useState, useMemo } from "react";
import { useSelector } from "react-redux";
import { RootState } from "@/store/store";
import AuthProvider from "@/components/authProvider";
import axios from "@/store/axios";
import { isAxiosError } from "axios";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  FileText,
  Search,
  Filter,
  RefreshCw,
  CheckCircle2,
  Clock,
  AlertTriangle,
  XCircle,
  Eye,
  Building,
  User as UserIcon,
  DollarSign,
  ShieldAlert,
  Sparkles,
  UploadCloud,
  Check,
  X,
  Loader2,
  ExternalLink,
  ChevronRight,
  ShieldCheck,
  FileCheck2,
  ArrowUpDown,
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
import { formatCurrency } from "@/lib/utils";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

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

interface Invoice {
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
  risk_level?: string;
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

export default function AllInvoicesPage() {
  const router = useRouter();
  const { user, role } = useSelector((state: RootState) => state.auth);

  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [errorMsg, setErrorMsg] = useState<string>("");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [deptFilter, setDeptFilter] = useState<string>("ALL");

  // Decision Modal State
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);
  const [decisionAction, setDecisionAction] = useState<"APPROVED" | "REJECTED" | "FLAGGED" | null>(null);
  const [decisionNotes, setDecisionNotes] = useState<string>("");
  const [isDecisionOpen, setIsDecisionOpen] = useState<boolean>(false);
  const [actionSubmitting, setActionSubmitting] = useState<boolean>(false);

  // User RBAC permissions: Only Finance, Auditor, and Admin can approve/reject invoices
  const userRole = (role || user?.role || "EMPLOYEE").toUpperCase();
  const userDept = (user?.department || "").toUpperCase();

  const canApproveReject =
    ["ADMIN", "AUDITOR", "FINANCE", "SUPERADMIN"].includes(userRole) ||
    ["FINANCE", "AUDIT", "ADMIN"].includes(userDept);

  // Fetch all invoices
  const fetchInvoices = async () => {
    try {
      setLoading(true);
      setErrorMsg("");
      const res = await axios.get("/invoice/get-all-invoice");
      setInvoices(res.data || []);
    } catch (err: unknown) {
      console.error("Error loading invoices:", err);
      if (isAxiosError(err)) {
        setErrorMsg(
          err.response?.data?.detail || "Failed to load invoice records."
        );
      } else {
        setErrorMsg("Failed to load invoice records from server.");
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchInvoices();
  }, []);

  // Quick Decision Trigger
  const openDecisionModal = (inv: Invoice, action: "APPROVED" | "REJECTED" | "FLAGGED", e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setSelectedInvoice(inv);
    setDecisionAction(action);
    setDecisionNotes("");
    setIsDecisionOpen(true);
  };

  // Submit Decision
  const handleDecisionSubmit = async () => {
    if (!selectedInvoice || !decisionAction) return;

    try {
      setActionSubmitting(true);
      const res = await axios.post(`/invoice/${selectedInvoice.id}/decision`, {
        status: decisionAction,
        notes: decisionNotes.trim() || undefined,
      });

      // Optimistic update
      setInvoices((prev) =>
        prev.map((i) =>
          i.id === selectedInvoice.id
            ? { ...i, status: decisionAction, approver_name: user?.name || "Me" }
            : i
        )
      );

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

  // Filtered Invoices
  const filteredInvoices = useMemo(() => {
    return invoices.filter((inv) => {
      // Search
      const matchesSearch =
        (inv.invoice_number || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
        (inv.vendor_name || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
        (inv.submitter_name || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
        (inv.submitter_department || "").toLowerCase().includes(searchQuery.toLowerCase());

      // Status
      const matchesStatus =
        statusFilter === "ALL" || inv.status === statusFilter;

      // Department
      const matchesDept =
        deptFilter === "ALL" ||
        (inv.submitter_department || "").toUpperCase() === deptFilter.toUpperCase();

      return matchesSearch && matchesStatus && matchesDept;
    });
  }, [invoices, searchQuery, statusFilter, deptFilter]);

  // Aggregate Metrics
  const stats = useMemo(() => {
    const total = filteredInvoices.length;
    const totalValue = filteredInvoices.reduce(
      (sum, i) => sum + Number(i.total_amount || 0),
      0
    );
    const pending = filteredInvoices.filter(
      (i) => i.status === "PENDING_REVIEW" || i.status === "PROCESSING"
    ).length;
    const flagged = filteredInvoices.filter((i) => i.status === "FLAGGED").length;
    const approved = filteredInvoices.filter((i) => i.status === "APPROVED").length;

    return { total, totalValue, pending, flagged, approved };
  }, [filteredInvoices]);

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "APPROVED":
        return (
          <span className="inline-flex items-center gap-1 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-0.5 text-xs font-semibold text-emerald-300">
            <CheckCircle2 className="size-3 text-emerald-400" /> Approved
          </span>
        );
      case "FLAGGED":
        return (
          <span className="inline-flex items-center gap-1 rounded-full border border-rose-500/30 bg-rose-500/10 px-2.5 py-0.5 text-xs font-semibold text-rose-300">
            <AlertTriangle className="size-3 text-rose-400" /> Flagged
          </span>
        );
      case "PROCESSING":
        return (
          <span className="inline-flex items-center gap-1 rounded-full border border-cyan-500/30 bg-cyan-500/10 px-2.5 py-0.5 text-xs font-semibold text-cyan-300">
            <Loader2 className="size-3 animate-spin text-cyan-400" /> Processing AI
          </span>
        );
      case "REJECTED":
        return (
          <span className="inline-flex items-center gap-1 rounded-full border border-red-500/30 bg-red-500/10 px-2.5 py-0.5 text-xs font-semibold text-red-300">
            <XCircle className="size-3 text-red-400" /> Rejected
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 rounded-full border border-amber-500/30 bg-amber-500/10 px-2.5 py-0.5 text-xs font-semibold text-amber-300">
            <Clock className="size-3 text-amber-400" /> Pending Review
          </span>
        );
    }
  };

  return (
    <AuthProvider>
      <div className="flex-1 space-y-6 py-6 md:py-8 pt-6 min-h-screen bg-slate-950 text-slate-100">
        {/* Top Header */}
        <div className="flex flex-col px-6 md:px-6 sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-white/10 pb-5">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <div className="flex size-7 items-center justify-center rounded-lg bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">
                <FileText className="size-4" />
              </div>
              <h1 className="text-2xl font-bold tracking-tight text-white">
                Invoice Ledger & Forensic Review
              </h1>
            </div>
            <p className="text-xs text-slate-400">
              Complete invoice records with Human-in-the-Loop decision verification and AI audit findings.
            </p>
          </div>

          <div className="flex items-center gap-2.5">
            <Button
              variant="outline"
              size="sm"
              onClick={fetchInvoices}
              disabled={loading}
              className="border-white/10 bg-slate-900 text-slate-300 hover:bg-slate-800 text-xs h-9"
            >
              <RefreshCw className={`size-3.5 mr-1.5 ${loading ? "animate-spin" : ""}`} />
              Refresh
            </Button>
            <Link href="/invoice/upload">
              <Button className="bg-cyan-400 hover:bg-cyan-300 text-slate-950 font-semibold text-xs h-9 shadow-md shadow-cyan-950/40">
                <UploadCloud className="size-4 mr-1.5" />
                Upload New Invoice
              </Button>
            </Link>
          </div>
        </div>

        {/* Dynamic Metric Overview Cards */}
        <div className="grid gap-4 px-6 md:px-6 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
          <Card className="border-white/10 bg-slate-900/60 backdrop-blur">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-xs font-semibold text-slate-400">
                Total Invoices
              </CardTitle>
              <FileText className="size-4 text-cyan-400" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-white">{stats.total}</div>
              <p className="text-[11px] text-slate-400 mt-0.5">
                Total Value: ${stats.totalValue.toLocaleString("en-US", { minimumFractionDigits: 2 })}
              </p>
            </CardContent>
          </Card>

          <Card className="border-white/10 bg-slate-900/60 backdrop-blur">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-xs font-semibold text-slate-400">
                Awaiting Approval
              </CardTitle>
              <Clock className="size-4 text-amber-400" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-amber-400">{stats.pending}</div>
              <p className="text-[11px] text-slate-400 mt-0.5">
                Requires manager or auditor sign-off
              </p>
            </CardContent>
          </Card>

          <Card className="border-white/10 bg-slate-900/60 backdrop-blur">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-xs font-semibold text-slate-400">
                Flagged by AI / Policy
              </CardTitle>
              <ShieldAlert className="size-4 text-rose-400" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-rose-400">{stats.flagged}</div>
              <p className="text-[11px] text-slate-400 mt-0.5">
                Math discrepancies or policy flags
              </p>
            </CardContent>
          </Card>

          <Card className="border-white/10 bg-slate-900/60 backdrop-blur">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-xs font-semibold text-slate-400">
                Approved Invoices
              </CardTitle>
              <CheckCircle2 className="size-4 text-emerald-400" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-emerald-400">{stats.approved}</div>
              <p className="text-[11px] text-slate-400 mt-0.5">
                Cleared for payment processing
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Filter and Search Bar */}
        <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 bg-slate-900/60 border border-white/10 p-3.5 mx-6 md:mx-6 rounded-xl backdrop-blur">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-slate-400" />
            <Input
              placeholder="Search by invoice number, vendor, submitter, or department..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 bg-slate-950/60 border-white/10 text-slate-100 placeholder:text-slate-500 text-xs h-9"
            />
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            {/* Status Filter */}
            <div className="w-36">
              <Select value={statusFilter} onValueChange={(val) => val && setStatusFilter(val)}>
                <SelectTrigger className="w-full bg-slate-950/60 border-white/10 text-slate-200 text-xs h-9">
                  <SelectValue placeholder="All Status" />
                </SelectTrigger>
                <SelectContent className="border-white/10 bg-slate-900 text-slate-100">
                  <SelectGroup>
                    <SelectLabel className="text-slate-400 text-xs">Status</SelectLabel>
                    <SelectItem value="ALL">All Status</SelectItem>
                    <SelectItem value="PENDING_REVIEW">Pending Review</SelectItem>
                    <SelectItem value="FLAGGED">Flagged</SelectItem>
                    <SelectItem value="APPROVED">Approved</SelectItem>
                    <SelectItem value="REJECTED">Rejected</SelectItem>
                    <SelectItem value="PROCESSING">Processing</SelectItem>
                  </SelectGroup>
                </SelectContent>
              </Select>
            </div>

            {/* Department Filter */}
            <div className="w-36">
              <Select value={deptFilter} onValueChange={(val) => val && setDeptFilter(val)}>
                <SelectTrigger className="w-full bg-slate-950/60 border-white/10 text-slate-200 text-xs h-9">
                  <SelectValue placeholder="All Depts" />
                </SelectTrigger>
                <SelectContent className="border-white/10 bg-slate-900 text-slate-100">
                  <SelectGroup>
                    <SelectLabel className="text-slate-400 text-xs">Department</SelectLabel>
                    <SelectItem value="ALL">All Departments</SelectItem>
                    <SelectItem value="FINANCE">Finance</SelectItem>
                    <SelectItem value="ENGINEERING">Engineering</SelectItem>
                    <SelectItem value="PROCUREMENT">Procurement</SelectItem>
                    <SelectItem value="COMPLIANCE">Compliance</SelectItem>
                    <SelectItem value="ADMIN">Admin</SelectItem>
                  </SelectGroup>
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        {/* Error Alert */}
        {errorMsg && (
          <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-3.5 text-xs text-red-200 flex items-center mx-6 md:mx-6 gap-2">
            <AlertTriangle className="size-4 text-red-400 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* Invoices Table */}
        <Card className="border-white/10 mx-6 md:mx-6 bg-slate-900/60 backdrop-blur overflow-hidden">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader className="bg-slate-950/60">
                <TableRow className="border-white/10 hover:bg-transparent">
                  <TableHead className="text-slate-300 font-semibold text-xs w-[130px]">
                    Invoice #
                  </TableHead>
                  <TableHead className="text-slate-300 font-semibold text-xs">
                    Vendor & Date
                  </TableHead>
                  <TableHead className="text-slate-300 font-semibold text-xs">
                    Submitter & Dept
                  </TableHead>
                  <TableHead className="text-slate-300 font-semibold text-xs">
                    Amount ($)
                  </TableHead>
                  <TableHead className="text-slate-300 font-semibold text-xs">
                    Status
                  </TableHead>
                  <TableHead className="text-slate-300 font-semibold text-xs">
                    AI Audit Flags
                  </TableHead>
                  <TableHead className="text-slate-300 font-semibold text-xs text-right">
                    Human-in-Loop Actions
                  </TableHead>
                </TableRow>
              </TableHeader>

              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={7} className="h-40 text-center text-slate-400">
                      <div className="flex flex-col items-center justify-center gap-2">
                        <Loader2 className="size-6 animate-spin text-cyan-400" />
                        <span className="text-xs">Loading invoice ledger...</span>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : filteredInvoices.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="h-40 text-center text-slate-400">
                      <div className="flex flex-col items-center justify-center gap-2">
                        <FileText className="size-8 text-slate-600" />
                        <span className="text-sm font-medium text-slate-300">
                          No invoices matching the selected filters.
                        </span>
                        <p className="text-xs text-slate-500">
                          Upload an invoice or reset filter parameters.
                        </p>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredInvoices.map((inv) => (
                    <TableRow
                      key={inv.id}
                      className="border-white/10 hover:bg-slate-800/40 transition-colors cursor-pointer"
                      onClick={() => router.push(`/dashboard/invoices/${inv.id}`)}
                    >
                      {/* Invoice # */}
                      <TableCell className="font-mono text-xs font-semibold text-cyan-300">
                        {inv.invoice_number || "Processing..."}
                      </TableCell>

                      {/* Vendor & Date */}
                      <TableCell>
                        <div className="font-semibold text-sm text-white">
                          {inv.vendor_name || "Unidentified"}
                        </div>
                        <div className="text-xs text-slate-400">
                          {inv.invoice_date ? String(inv.invoice_date) : "Date Pending"}
                        </div>
                      </TableCell>

                      {/* Submitter */}
                      <TableCell>
                        <div className="text-xs text-slate-200 font-medium">
                          {inv.submitter_name || "Unknown"}
                        </div>
                        <div className="text-[11px] text-slate-400">
                          {inv.submitter_department || "General"}
                        </div>
                      </TableCell>

                      {/* Total Amount */}
                      <TableCell className="font-mono text-xs font-semibold text-white">
                        <div>
                          {formatCurrency(inv.total_amount, inv.currency)}{" "}
                          <span className="text-[10px] text-slate-400 font-sans">{inv.currency}</span>
                        </div>
                        {Boolean(inv.tax_amount && inv.tax_amount > 0) && (
                          <div className="text-[10px] text-cyan-400 font-sans">
                            Tax: {formatCurrency(inv.tax_amount || 0, inv.currency)}
                          </div>
                        )}
                      </TableCell>

                      {/* Status */}
                      <TableCell>
                        <div className="flex flex-col gap-1">
                          <div>
                            {getStatusBadge(
                              inv.human_status ||
                              (inv.status === "APPROVED"
                                ? "APPROVED"
                                : inv.status === "REJECTED"
                                  ? "REJECTED"
                                  : "PENDING_REVIEW")
                            )}
                          </div>
                          {inv.decision_notes && (
                            <div
                              className="text-[10px] text-slate-400 max-w-[160px] truncate font-sans"
                              title={`Reviewer Remarks: ${inv.decision_notes}`}
                            >
                              Note: {inv.decision_notes}
                            </div>
                          )}
                        </div>
                      </TableCell>

                      {/* AI Anomalies & Risk */}
                      <TableCell>
                        <div className="flex flex-col gap-1">
                          <div className="flex items-center gap-1.5">
                            {inv.anomalies && inv.anomalies.length > 0 ? (
                              <span className="inline-flex items-center gap-1 rounded border border-rose-500/30 bg-rose-500/10 px-1.5 py-0.5 text-[10px] font-semibold text-rose-300">
                                <AlertTriangle className="size-2.5 text-rose-400" />
                                {inv.anomalies.length} Flag{inv.anomalies.length > 1 ? "s" : ""}
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 rounded border border-emerald-500/20 bg-emerald-500/5 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-400">
                                <Check className="size-2.5" /> Clean Audit
                              </span>
                            )}
                            <span
                              className={`rounded px-1.5 py-0.5 text-[10px] font-bold ${(inv.risk_level || "LOW").toUpperCase() === "CRITICAL"
                                ? "bg-rose-500/20 text-rose-300 border border-rose-500/30"
                                : (inv.risk_level || "LOW").toUpperCase() === "HIGH"
                                  ? "bg-amber-500/20 text-amber-300 border border-amber-500/30"
                                  : (inv.risk_level || "LOW").toUpperCase() === "MEDIUM"
                                    ? "bg-yellow-500/20 text-yellow-300 border border-yellow-500/30"
                                    : "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30"
                                }`}
                            >
                              {inv.risk_level || "LOW"}
                            </span>
                          </div>
                          <span className="text-[10px] text-slate-400">
                            Conf: {Math.round(((inv.overall_confidence ?? inv.overall_confidance) ?? 0.95) * 100)}% | Risk: {((inv.risk_score ?? 0.05) * 100)}%
                          </span>
                        </div>
                      </TableCell>

                      {/* Human-in-the-Loop Actions */}
                      <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-end gap-1.5">
                          {canApproveReject && (inv.human_status !== "APPROVED" && inv.human_status !== "REJECTED") && (
                            <>
                              <Button
                                size="icon-sm"
                                variant="ghost"
                                onClick={(e) => openDecisionModal(inv, "APPROVED", e)}
                                className="size-7 text-emerald-400 hover:bg-emerald-500/20 hover:text-emerald-300"
                                title="Quick Approve"
                              >
                                <Check className="size-3.5" />
                              </Button>
                              <Button
                                size="icon-sm"
                                variant="ghost"
                                onClick={(e) => openDecisionModal(inv, "REJECTED", e)}
                                className="size-7 text-rose-400 hover:bg-rose-500/20 hover:text-rose-300"
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
                            className="text-cyan-300 hover:bg-cyan-500/10 text-xs h-7 px-2"
                          >
                            <Eye className="size-3.5 mr-1" /> View Full Audit
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

        {/* ========================================================================= */}
        {/* QUICK DECISION MODAL */}
        {/* ========================================================================= */}
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
                Are you sure you want to mark Invoice{" "}
                <span className="font-semibold text-white">
                  {selectedInvoice?.invoice_number}
                </span>{" "}
                (${Number(selectedInvoice?.total_amount).toFixed(2)}) as{" "}
                <span className="font-bold text-cyan-300">{decisionAction}</span>?
              </DialogDescription>
            </DialogHeader>

            <div className="py-2 text-xs">
              <label className="text-slate-300 font-medium block mb-1">
                Reviewer Notes (Optional)
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
