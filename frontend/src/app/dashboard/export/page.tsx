"use client";

import React, { useEffect, useState, useMemo } from "react";
import AuthProvider from "@/components/authProvider";
import axios from "@/store/axios";
import { isAxiosError } from "axios";
import {
  Download,
  FileSpreadsheet,
  CheckSquare,
  Square,
  Filter,
  Copy,
  Check,
  RefreshCw,
  SlidersHorizontal,
  Table as TableIcon,
  Layers,
  FileText,
  Loader2,
  Calendar,
  Building,
  CheckCircle2,
  Sparkles,
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
  severity: string;
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
  status: string;
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

interface ExportColumn {
  key: string;
  label: string;
  category: "General" | "Financial" | "Audit" | "Metadata";
  defaultSelected: boolean;
  getter: (inv: Invoice) => string | number;
}

const AVAILABLE_COLUMNS: ExportColumn[] = [
  {
    key: "invoice_number",
    label: "Invoice Number",
    category: "General",
    defaultSelected: true,
    getter: (inv) => inv.invoice_number || "N/A",
  },
  {
    key: "vendor_name",
    label: "Vendor Name",
    category: "General",
    defaultSelected: true,
    getter: (inv) => inv.vendor_name || "Unidentified",
  },
  {
    key: "invoice_date",
    label: "Invoice Date",
    category: "General",
    defaultSelected: true,
    getter: (inv) => (inv.invoice_date ? String(inv.invoice_date) : "N/A"),
  },
  {
    key: "subtotal",
    label: "Pre-Tax Subtotal",
    category: "Financial",
    defaultSelected: true,
    getter: (inv) => (inv.subtotal !== undefined ? Number(inv.subtotal).toFixed(2) : Number(inv.total_amount || 0).toFixed(2)),
  },
  {
    key: "tax_amount",
    label: "Tax Paid Amount",
    category: "Financial",
    defaultSelected: true,
    getter: (inv) => (inv.tax_amount !== undefined ? Number(inv.tax_amount).toFixed(2) : "0.00"),
  },
  {
    key: "total_amount",
    label: "Total Amount",
    category: "Financial",
    defaultSelected: true,
    getter: (inv) => Number(inv.total_amount || 0).toFixed(2),
  },
  {
    key: "currency",
    label: "Currency",
    category: "Financial",
    defaultSelected: true,
    getter: (inv) => inv.currency || "USD",
  },
  {
    key: "status",
    label: "Overall Status",
    category: "Audit",
    defaultSelected: true,
    getter: (inv) => inv.status || "PENDING_REVIEW",
  },
  {
    key: "ai_status",
    label: "AI Assessment Status",
    category: "Audit",
    defaultSelected: true,
    getter: (inv) => inv.ai_status || inv.status || "PENDING_REVIEW",
  },
  {
    key: "human_status",
    label: "Human Review Status",
    category: "Audit",
    defaultSelected: true,
    getter: (inv) =>
      inv.human_status ||
      (inv.status === "APPROVED"
        ? "APPROVED"
        : inv.status === "REJECTED"
        ? "REJECTED"
        : "PENDING"),
  },
  {
    key: "decision_notes",
    label: "Auditor Decision Notes",
    category: "Audit",
    defaultSelected: true,
    getter: (inv) => inv.decision_notes || "N/A",
  },
  {
    key: "decision_by_name",
    label: "Auditor / Reviewer",
    category: "Audit",
    defaultSelected: true,
    getter: (inv) => inv.decision_by_name || inv.approver_name || "Unassigned",
  },
  {
    key: "decision_at",
    label: "Audit Decision Timestamp",
    category: "Audit",
    defaultSelected: false,
    getter: (inv) =>
      inv.decision_at ? new Date(inv.decision_at).toLocaleString() : "N/A",
  },
  {
    key: "overall_confidence",
    label: "AI Confidence (%)",
    category: "Audit",
    defaultSelected: true,
    getter: (inv) => `${Math.round(((inv.overall_confidence ?? inv.overall_confidance) ?? 0.95) * 100)}%`,
  },
  {
    key: "risk_level",
    label: "Risk Level",
    category: "Audit",
    defaultSelected: true,
    getter: (inv) => (inv.risk_level || "LOW").toUpperCase(),
  },
  {
    key: "risk_score",
    label: "Risk Score",
    category: "Audit",
    defaultSelected: true,
    getter: (inv) => (inv.risk_score !== undefined ? Number(inv.risk_score).toFixed(2) : "0.05"),
  },
  {
    key: "recommended_action",
    label: "Recommended Action",
    category: "Audit",
    defaultSelected: true,
    getter: (inv) => inv.recommended_action || "Standard Verification",
  },
  {
    key: "submitter_name",
    label: "Submitter Name",
    category: "Metadata",
    defaultSelected: true,
    getter: (inv) => inv.submitter_name || "Unknown",
  },
  {
    key: "submitter_email",
    label: "Submitter Email",
    category: "Metadata",
    defaultSelected: false,
    getter: (inv) => inv.submitter_email || "N/A",
  },
  {
    key: "submitter_department",
    label: "Department",
    category: "Metadata",
    defaultSelected: true,
    getter: (inv) => inv.submitter_department || "General",
  },
  {
    key: "approver_name",
    label: "Approver Name",
    category: "Metadata",
    defaultSelected: false,
    getter: (inv) => inv.approver_name || "Unassigned",
  },
  {
    key: "created_at",
    label: "Uploaded Date & Time",
    category: "Metadata",
    defaultSelected: true,
    getter: (inv) =>
      inv.created_at ? new Date(inv.created_at).toLocaleString() : "N/A",
  },
  {
    key: "line_items_count",
    label: "Line Items Count",
    category: "Financial",
    defaultSelected: false,
    getter: (inv) => (inv.line_items ? inv.line_items.length : 0),
  },
  {
    key: "line_items_summary",
    label: "Line Items Summary",
    category: "Financial",
    defaultSelected: false,
    getter: (inv) =>
      inv.line_items && inv.line_items.length > 0
        ? inv.line_items.map((li) => `${li.description} ($${Number(li.total_amount).toFixed(2)})`).join("; ")
        : "None",
  },
  {
    key: "anomalies_count",
    label: "Anomalies Count",
    category: "Audit",
    defaultSelected: true,
    getter: (inv) => (inv.anomalies ? inv.anomalies.length : 0),
  },
  {
    key: "anomalies_summary",
    label: "AI Audit Findings",
    category: "Audit",
    defaultSelected: false,
    getter: (inv) =>
      inv.anomalies && inv.anomalies.length > 0
        ? inv.anomalies.map((a) => `[${a.severity}] ${a.anomaly_flag || a.anomaly_type}: ${a.reason || a.explanation}`).join("; ")
        : "Clean Audit",
  },
  {
    key: "document_url",
    label: "Document URL",
    category: "Metadata",
    defaultSelected: false,
    getter: (inv) => inv.document_url || "",
  },
  {
    key: "id",
    label: "Invoice UUID",
    category: "Metadata",
    defaultSelected: false,
    getter: (inv) => inv.id || "",
  },
];

export default function ExportInvoicesPage() {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [copied, setCopied] = useState<boolean>(false);

  // Column selection state (Record<columnKey, boolean>)
  const [selectedColumns, setSelectedColumns] = useState<Record<string, boolean>>(() => {
    const initial: Record<string, boolean> = {};
    AVAILABLE_COLUMNS.forEach((col) => {
      initial[col.key] = col.defaultSelected;
    });
    return initial;
  });

  // Row filtering & scope state
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [deptFilter, setDeptFilter] = useState<string>("ALL");
  const [dateRangeFilter, setDateRangeFilter] = useState<string>("ALL");
  const [rowLimitMode, setRowLimitMode] = useState<"ALL" | "TOP_N" | "CUSTOM_RANGE">("ALL");
  const [topNCount, setTopNCount] = useState<number>(50);
  const [customStartRow, setCustomStartRow] = useState<number>(1);
  const [customEndRow, setCustomEndRow] = useState<number>(100);
  const [customFileName, setCustomFileName] = useState<string>(
    `invoices_export_${new Date().toISOString().split("T")[0]}.csv`
  );
  const [delimiter, setDelimiter] = useState<string>(",");

  // Fetch all invoice data from backend
  const fetchInvoices = async () => {
    try {
      setLoading(true);
      const res = await axios.get("/invoice/get-all-invoice");
      setInvoices(res.data || []);
    } catch (err) {
      console.error("Failed to fetch invoices for export:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchInvoices();
  }, []);

  // Filter and slice rows according to selected scope
  const filteredInvoices = useMemo(() => {
    let result = invoices.filter((inv) => {
      // 1. Status Filter
      if (statusFilter !== "ALL" && inv.status !== statusFilter) {
        return false;
      }

      // 2. Department Filter
      if (
        deptFilter !== "ALL" &&
        (inv.submitter_department || "").toUpperCase() !== deptFilter.toUpperCase()
      ) {
        return false;
      }

      // 3. Date Range Filter
      if (dateRangeFilter !== "ALL" && inv.created_at) {
        const invDate = new Date(inv.created_at).getTime();
        const now = new Date().getTime();
        const days = Number(dateRangeFilter);
        if (!isNaN(days) && now - invDate > days * 24 * 60 * 60 * 1000) {
          return false;
        }
      }

      return true;
    });

    // Apply row limits
    if (rowLimitMode === "TOP_N") {
      result = result.slice(0, Math.max(1, topNCount));
    } else if (rowLimitMode === "CUSTOM_RANGE") {
      const start = Math.max(0, customStartRow - 1);
      const end = Math.max(start + 1, customEndRow);
      result = result.slice(start, end);
    }

    return result;
  }, [
    invoices,
    statusFilter,
    deptFilter,
    dateRangeFilter,
    rowLimitMode,
    topNCount,
    customStartRow,
    customEndRow,
  ]);

  // Active selected columns in order
  const activeColumns = useMemo(() => {
    return AVAILABLE_COLUMNS.filter((c) => selectedColumns[c.key]);
  }, [selectedColumns]);

  // Toggle single column
  const toggleColumn = (key: string) => {
    setSelectedColumns((prev) => ({
      ...prev,
      [key]: !prev[key],
    }));
  };

  // Select all / none helpers
  const selectAllColumns = () => {
    const updated: Record<string, boolean> = {};
    AVAILABLE_COLUMNS.forEach((col) => {
      updated[col.key] = true;
    });
    setSelectedColumns(updated);
  };

  const selectDefaultColumns = () => {
    const updated: Record<string, boolean> = {};
    AVAILABLE_COLUMNS.forEach((col) => {
      updated[col.key] = col.defaultSelected;
    });
    setSelectedColumns(updated);
  };

  const deselectAllColumns = () => {
    const updated: Record<string, boolean> = {};
    AVAILABLE_COLUMNS.forEach((col) => {
      updated[col.key] = false;
    });
    setSelectedColumns(updated);
  };

  // Helper to escape CSV values
  const escapeCsvValue = (val: string | number, delim: string): string => {
    const str = String(val ?? "");
    if (
      str.includes(delim) ||
      str.includes('"') ||
      str.includes("\n") ||
      str.includes("\r")
    ) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  };

  // Generate CSV String Content
  const generateCsvContent = (): string => {
    if (activeColumns.length === 0) return "";

    const headers = activeColumns
      .map((col) => escapeCsvValue(col.label, delimiter))
      .join(delimiter);

    const rows = filteredInvoices.map((inv) =>
      activeColumns
        .map((col) => escapeCsvValue(col.getter(inv), delimiter))
        .join(delimiter)
    );

    return [headers, ...rows].join("\r\n");
  };

  // Trigger Download
  const handleDownloadCsv = () => {
    const content = generateCsvContent();
    if (!content) {
      alert("Please select at least one column to export.");
      return;
    }

    const blob = new Blob([content], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute(
      "download",
      customFileName.endsWith(".csv") || customFileName.endsWith(".tsv")
        ? customFileName
        : `${customFileName}.csv`
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // Copy to Clipboard
  const handleCopyToClipboard = async () => {
    const content = generateCsvContent();
    if (!content) return;

    try {
      await navigator.clipboard.writeText(content);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error("Clipboard copy failed:", err);
    }
  };

  return (
    <AuthProvider>
      <div className="flex-1 space-y-6 p-6 md:p-8 pt-6 min-h-screen bg-slate-950 text-slate-100">
        {/* Page Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-white/10 pb-5">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <div className="flex size-7 items-center justify-center rounded-lg bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                <FileSpreadsheet className="size-4" />
              </div>
              <h1 className="text-2xl font-bold tracking-tight text-white">
                Export Invoices (CSV / Excel)
              </h1>
            </div>
            <p className="text-xs text-slate-400">
              Customize exported columns, filter specific rows, or export the entire ledger into spreadsheet-ready CSV.
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
            <Button
              variant="outline"
              size="sm"
              onClick={handleCopyToClipboard}
              disabled={activeColumns.length === 0 || filteredInvoices.length === 0}
              className="border-white/10 bg-slate-900 text-slate-200 hover:bg-slate-800 text-xs h-9"
            >
              {copied ? (
                <>
                  <Check className="size-3.5 mr-1.5 text-emerald-400" />
                  Copied to Clipboard!
                </>
              ) : (
                <>
                  <Copy className="size-3.5 mr-1.5" />
                  Copy CSV
                </>
              )}
            </Button>
            <Button
              onClick={handleDownloadCsv}
              disabled={activeColumns.length === 0 || filteredInvoices.length === 0}
              className="bg-emerald-500 hover:bg-emerald-600 text-white font-semibold text-xs h-9 shadow-md shadow-emerald-950/40"
            >
              <Download className="size-4 mr-1.5" />
              Download CSV ({filteredInvoices.length} rows)
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* ========================================================================= */}
          {/* LEFT COLUMN: EXPORT CONFIGURATION (5 COLS) */}
          {/* ========================================================================= */}
          <div className="lg:col-span-5 space-y-6">
            {/* 1. Column Selection Card */}
            <Card className="border-white/10 bg-slate-900/60 backdrop-blur shadow-xl">
              <CardHeader className="pb-3 border-b border-white/10">
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-sm font-semibold text-white flex items-center gap-2">
                      <CheckSquare className="size-4 text-cyan-400" /> Select Columns to Export
                    </CardTitle>
                    <CardDescription className="text-xs text-slate-400 mt-0.5">
                      {activeColumns.length} of {AVAILABLE_COLUMNS.length} columns selected
                    </CardDescription>
                  </div>
                  <div className="flex items-center gap-1.5 text-xs">
                    <button
                      type="button"
                      onClick={selectAllColumns}
                      className="text-cyan-400 hover:underline text-[11px]"
                    >
                      All
                    </button>
                    <span className="text-slate-600">•</span>
                    <button
                      type="button"
                      onClick={selectDefaultColumns}
                      className="text-slate-300 hover:underline text-[11px]"
                    >
                      Default
                    </button>
                    <span className="text-slate-600">•</span>
                    <button
                      type="button"
                      onClick={deselectAllColumns}
                      className="text-slate-400 hover:underline text-[11px]"
                    >
                      Clear
                    </button>
                  </div>
                </div>
              </CardHeader>

              <CardContent className="p-4 space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                  {AVAILABLE_COLUMNS.map((col) => {
                    const isSelected = !!selectedColumns[col.key];
                    return (
                      <button
                        key={col.key}
                        type="button"
                        onClick={() => toggleColumn(col.key)}
                        className={`flex items-center gap-2.5 p-2 rounded-lg border text-left transition-all ${
                          isSelected
                            ? "bg-cyan-500/10 border-cyan-500/30 text-white"
                            : "bg-slate-950/40 border-white/5 text-slate-400 hover:border-white/20 hover:text-slate-200"
                        }`}
                      >
                        <div
                          className={`flex size-4 items-center justify-center rounded border transition-colors ${
                            isSelected
                              ? "border-cyan-400 bg-cyan-500 text-slate-950"
                              : "border-slate-600 bg-slate-900"
                          }`}
                        >
                          {isSelected && <Check className="size-3 stroke-[3]" />}
                        </div>
                        <span className="truncate font-medium">{col.label}</span>
                      </button>
                    );
                  })}
                </div>
              </CardContent>
            </Card>

            {/* 2. Row Selection & Scope Filter Card */}
            <Card className="border-white/10 bg-slate-900/60 backdrop-blur shadow-xl">
              <CardHeader className="pb-3 border-b border-white/10">
                <CardTitle className="text-sm font-semibold text-white flex items-center gap-2">
                  <Filter className="size-4 text-emerald-400" /> Row Scope & Filtering
                </CardTitle>
                <CardDescription className="text-xs text-slate-400">
                  Filter by status, department, date range, or limit row counts.
                </CardDescription>
              </CardHeader>

              <CardContent className="p-4 space-y-4 text-xs">
                {/* Row Scope Mode */}
                <div>
                  <label className="text-slate-300 font-semibold block mb-1.5">
                    How many rows to export?
                  </label>
                  <div className="grid grid-cols-3 gap-2">
                    <button
                      type="button"
                      onClick={() => setRowLimitMode("ALL")}
                      className={`p-2 rounded-lg border font-medium text-center transition-all ${
                        rowLimitMode === "ALL"
                          ? "bg-emerald-500/15 border-emerald-500/40 text-emerald-300"
                          : "bg-slate-950/60 border-white/10 text-slate-400 hover:text-slate-200"
                      }`}
                    >
                      Everything ({invoices.length})
                    </button>
                    <button
                      type="button"
                      onClick={() => setRowLimitMode("TOP_N")}
                      className={`p-2 rounded-lg border font-medium text-center transition-all ${
                        rowLimitMode === "TOP_N"
                          ? "bg-emerald-500/15 border-emerald-500/40 text-emerald-300"
                          : "bg-slate-950/60 border-white/10 text-slate-400 hover:text-slate-200"
                      }`}
                    >
                      First N Rows
                    </button>
                    <button
                      type="button"
                      onClick={() => setRowLimitMode("CUSTOM_RANGE")}
                      className={`p-2 rounded-lg border font-medium text-center transition-all ${
                        rowLimitMode === "CUSTOM_RANGE"
                          ? "bg-emerald-500/15 border-emerald-500/40 text-emerald-300"
                          : "bg-slate-950/60 border-white/10 text-slate-400 hover:text-slate-200"
                      }`}
                    >
                      Custom Range
                    </button>
                  </div>
                </div>

                {/* Conditional Row Count Inputs */}
                {rowLimitMode === "TOP_N" && (
                  <div className="rounded-lg bg-slate-950/60 border border-white/10 p-3">
                    <label className="text-slate-300 font-semibold block mb-1">
                      Max Rows to Export
                    </label>
                    <div className="flex items-center gap-2">
                      {[25, 50, 100, 250, 500].map((n) => (
                        <button
                          key={n}
                          type="button"
                          onClick={() => setTopNCount(n)}
                          className={`px-2.5 py-1 rounded text-xs border font-medium ${
                            topNCount === n
                              ? "bg-cyan-500/20 text-cyan-300 border-cyan-500/40"
                              : "bg-slate-900 border-white/10 text-slate-400 hover:text-white"
                          }`}
                        >
                          {n}
                        </button>
                      ))}
                      <Input
                        type="number"
                        min="1"
                        value={topNCount}
                        onChange={(e) => setTopNCount(Number(e.target.value) || 1)}
                        className="w-20 bg-slate-900 border-white/10 text-xs h-7 text-center font-mono"
                      />
                    </div>
                  </div>
                )}

                {rowLimitMode === "CUSTOM_RANGE" && (
                  <div className="rounded-lg bg-slate-950/60 border border-white/10 p-3 grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-slate-300 font-semibold block mb-1">
                        Start Row (1-indexed)
                      </label>
                      <Input
                        type="number"
                        min="1"
                        value={customStartRow}
                        onChange={(e) => setCustomStartRow(Number(e.target.value) || 1)}
                        className="bg-slate-900 border-white/10 text-xs h-8 font-mono"
                      />
                    </div>
                    <div>
                      <label className="text-slate-300 font-semibold block mb-1">
                        End Row
                      </label>
                      <Input
                        type="number"
                        min="1"
                        value={customEndRow}
                        onChange={(e) => setCustomEndRow(Number(e.target.value) || 1)}
                        className="bg-slate-900 border-white/10 text-xs h-8 font-mono"
                      />
                    </div>
                  </div>
                )}

                {/* Filters Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="text-slate-300 font-semibold block mb-1">
                      Status Filter
                    </label>
                    <select
                      value={statusFilter}
                      onChange={(e) => setStatusFilter(e.target.value)}
                      className="w-full h-8 rounded-md border border-white/10 bg-slate-950/60 px-2.5 text-xs text-slate-200 focus:outline-none focus:ring-1 focus:ring-cyan-500"
                    >
                      <option value="ALL">All Status</option>
                      <option value="APPROVED">Approved Only</option>
                      <option value="PENDING_REVIEW">Pending Review</option>
                      <option value="FLAGGED">Flagged Only</option>
                      <option value="REJECTED">Rejected Only</option>
                    </select>
                  </div>

                  <div>
                    <label className="text-slate-300 font-semibold block mb-1">
                      Department
                    </label>
                    <select
                      value={deptFilter}
                      onChange={(e) => setDeptFilter(e.target.value)}
                      className="w-full h-8 rounded-md border border-white/10 bg-slate-950/60 px-2.5 text-xs text-slate-200 focus:outline-none focus:ring-1 focus:ring-cyan-500"
                    >
                      <option value="ALL">All Depts</option>
                      <option value="FINANCE">Finance</option>
                      <option value="ENGINEERING">Engineering</option>
                      <option value="PROCUREMENT">Procurement</option>
                      <option value="COMPLIANCE">Compliance</option>
                      <option value="ADMIN">Admin</option>
                    </select>
                  </div>

                  <div>
                    <label className="text-slate-300 font-semibold block mb-1">
                      Time Range
                    </label>
                    <select
                      value={dateRangeFilter}
                      onChange={(e) => setDateRangeFilter(e.target.value)}
                      className="w-full h-8 rounded-md border border-white/10 bg-slate-950/60 px-2.5 text-xs text-slate-200 focus:outline-none focus:ring-1 focus:ring-cyan-500"
                    >
                      <option value="ALL">All Time</option>
                      <option value="7">Last 7 Days</option>
                      <option value="30">Last 30 Days</option>
                      <option value="90">Last 90 Days</option>
                    </select>
                  </div>
                </div>

                {/* File Options */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                  <div>
                    <label className="text-slate-300 font-semibold block mb-1">
                      File Name
                    </label>
                    <Input
                      value={customFileName}
                      onChange={(e) => setCustomFileName(e.target.value)}
                      className="bg-slate-950/60 border-white/10 text-xs h-8 font-mono"
                    />
                  </div>

                  <div>
                    <label className="text-slate-300 font-semibold block mb-1">
                      Delimiter Format
                    </label>
                    <select
                      value={delimiter}
                      onChange={(e) => setDelimiter(e.target.value)}
                      className="w-full h-8 rounded-md border border-white/10 bg-slate-950/60 px-2.5 text-xs text-slate-200 focus:outline-none focus:ring-1 focus:ring-cyan-500 font-mono"
                    >
                      <option value=",">Comma (Standard .CSV)</option>
                      <option value="&#9;">Tab Delimited (.TSV)</option>
                      <option value=";">Semicolon (European Excel)</option>
                    </select>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* ========================================================================= */}
          {/* RIGHT COLUMN: LIVE TABLE PREVIEW (7 COLS) */}
          {/* ========================================================================= */}
          <div className="lg:col-span-7 space-y-4">
            <Card className="border-white/10 bg-slate-900/60 backdrop-blur shadow-xl overflow-hidden">
              <CardHeader className="pb-3 border-b border-white/10 flex flex-row items-center justify-between">
                <div>
                  <CardTitle className="text-sm font-semibold text-white flex items-center gap-2">
                    <TableIcon className="size-4 text-cyan-400" /> Live Export Preview
                  </CardTitle>
                  <CardDescription className="text-xs text-slate-400 mt-0.5">
                    Ready to export <span className="text-white font-semibold">{filteredInvoices.length} records</span> with{" "}
                    <span className="text-white font-semibold">{activeColumns.length} columns</span>.
                  </CardDescription>
                </div>

                <div className="text-right">
                  <span className="font-mono text-xs text-emerald-400 font-semibold">
                    ${filteredInvoices.reduce((s, i) => s + Number(i.total_amount || 0), 0).toLocaleString("en-US", { minimumFractionDigits: 2 })}
                  </span>
                  <span className="text-[10px] text-slate-500 block">Total Filtered Value</span>
                </div>
              </CardHeader>

              <div className="overflow-x-auto max-h-[560px]">
                <Table>
                  <TableHeader className="bg-slate-950/80 sticky top-0 z-10 backdrop-blur">
                    <TableRow className="border-white/10 hover:bg-transparent">
                      <TableHead className="text-slate-400 text-[11px] w-12 font-mono">#</TableHead>
                      {activeColumns.map((col) => (
                        <TableHead key={col.key} className="text-slate-300 font-semibold text-xs whitespace-nowrap">
                          {col.label}
                        </TableHead>
                      ))}
                    </TableRow>
                  </TableHeader>

                  <TableBody>
                    {loading ? (
                      <TableRow>
                        <TableCell colSpan={activeColumns.length + 1} className="h-48 text-center text-slate-400">
                          <div className="flex flex-col items-center justify-center gap-2">
                            <Loader2 className="size-6 animate-spin text-cyan-400" />
                            <span className="text-xs">Loading ledger preview...</span>
                          </div>
                        </TableCell>
                      </TableRow>
                    ) : filteredInvoices.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={activeColumns.length + 1} className="h-48 text-center text-slate-400">
                          <div className="flex flex-col items-center justify-center gap-2">
                            <FileSpreadsheet className="size-8 text-slate-600" />
                            <span className="text-sm font-medium text-slate-300">
                              No records match current export scope.
                            </span>
                            <p className="text-xs text-slate-500">
                              Adjust status filters or expand row limits.
                            </p>
                          </div>
                        </TableCell>
                      </TableRow>
                    ) : activeColumns.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={2} className="h-48 text-center text-slate-400">
                          <span className="text-sm text-amber-300">
                            Please select at least one column from the left panel.
                          </span>
                        </TableCell>
                      </TableRow>
                    ) : (
                      filteredInvoices.map((inv, idx) => (
                        <TableRow key={inv.id || idx} className="border-white/5 hover:bg-slate-800/30 text-xs">
                          <TableCell className="font-mono text-slate-500 text-[11px]">{idx + 1}</TableCell>
                          {activeColumns.map((col) => {
                            const val = col.getter(inv);
                            return (
                              <TableCell key={col.key} className="whitespace-nowrap max-w-[200px] truncate text-slate-200">
                                {col.key === "status" ? (
                                  <span
                                    className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                                      val === "APPROVED"
                                        ? "bg-emerald-500/20 text-emerald-300"
                                        : val === "FLAGGED"
                                        ? "bg-rose-500/20 text-rose-300"
                                        : val === "PROCESSING"
                                        ? "bg-cyan-500/20 text-cyan-300"
                                        : "bg-amber-500/20 text-amber-300"
                                    }`}
                                  >
                                    {String(val)}
                                  </span>
                                ) : col.key === "total_amount" ? (
                                  <span className="font-mono font-semibold text-white">${String(val)}</span>
                                ) : (
                                  String(val)
                                )}
                              </TableCell>
                            );
                          })}
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </Card>
          </div>
        </div>
      </div>
    </AuthProvider>
  );
}
