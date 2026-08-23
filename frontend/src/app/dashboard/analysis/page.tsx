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
  TrendingUp,
  Wallet,
  DollarSign,
  CheckCircle2,
  PieChart,
  Building,
  Layers,
  BarChart3,
  ArrowUpRight,
  RefreshCw,
  FileSpreadsheet,
  ArrowLeft,
  Loader2,
  Tag,
  ShieldCheck,
  Search,
  ExternalLink,
  ChevronRight,
  Filter,
  Calendar,
  X,
  FileText,
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatCurrency } from "@/lib/utils";

interface SpendOverview {
  total_approved_spend: number;
  total_subtotal: number;
  total_tax_paid: number;
  invoice_count: number;
  avg_invoice_value: number;
  last_30_days_spend: number;
  prev_30_days_spend: number;
  mom_growth_pct: number;
  currency: string;
}

interface VendorSpend {
  vendor_name: string;
  total_spend: number;
  tax_paid: number;
  invoice_count: number;
  avg_invoice_amount?: number;
  share_percentage: number;
  latest_invoice_date?: string;
  currency?: string;
}

interface DepartmentSpend {
  department: string;
  total_spend: number;
  tax_paid?: number;
  invoice_count: number;
  share_percentage: number;
}

interface CategorySpend {
  category: string;
  total_spend: number;
  items_count: number;
  share_percentage: number;
}

interface MonthlyTrendItem {
  month: string;
  label: string;
  total_spend: number;
  tax_paid?: number;
  invoice_count: number;
}

interface SpendAnalysisData {
  overview: SpendOverview;
  top_vendors: VendorSpend[];
  departments: DepartmentSpend[];
  categories: CategorySpend[];
  monthly_trend: MonthlyTrendItem[];
  criteria: string;
}

interface VendorInvoiceItem {
  id: string;
  invoice_number: string;
  vendor_name: string;
  invoice_date?: string;
  total_amount: number;
  tax_amount: number;
  currency: string;
  status: string;
  human_status: string;
  submitter_name: string;
  submitter_department: string;
  created_at?: string;
}

export default function SpendAnalysisDashboardPage() {
  const router = useRouter();
  const { user, role } = useSelector((state: RootState) => state.auth);

  const [spendData, setSpendData] = useState<SpendAnalysisData | null>(null);
  const [timeRange, setTimeRange] = useState<string>("all");
  const [selectedDept, setSelectedDept] = useState<string>("ALL");
  const [vendorSearch, setVendorSearch] = useState<string>("");
  const [loading, setLoading] = useState<boolean>(true);
  const [errorMsg, setErrorMsg] = useState<string>("");

  // Vendor Drilldown Modal State
  const [selectedVendorModal, setSelectedVendorModal] = useState<string | null>(null);
  const [vendorInvoices, setVendorInvoices] = useState<VendorInvoiceItem[]>([]);
  const [loadingVendorInvoices, setLoadingVendorInvoices] = useState<boolean>(false);

  const fetchSpendData = async (range = timeRange, dept = selectedDept) => {
    try {
      setLoading(true);
      setErrorMsg("");
      let url = `/spend-analysis/all?time_range=${range}`;
      if (dept && dept !== "ALL") {
        url += `&department=${encodeURIComponent(dept)}`;
      }
      const res = await axios.get<SpendAnalysisData>(url);
      setSpendData(res.data);
    } catch (err: unknown) {
      console.error("Spend analysis fetch failed:", err);
      if (isAxiosError(err)) {
        setErrorMsg(err.response?.data?.detail || "Failed to load corporate spend intelligence");
      } else {
        setErrorMsg("Failed to connect to analytics server");
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSpendData("all", "ALL");
  }, []);

  const handleRangeChange = (r: string) => {
    setTimeRange(r);
    fetchSpendData(r, selectedDept);
  };

  const handleDeptChange = (d: string) => {
    setSelectedDept(d);
    fetchSpendData(timeRange, d);
  };

  const openVendorDrilldown = async (vendorName: string) => {
    setSelectedVendorModal(vendorName);
    try {
      setLoadingVendorInvoices(true);
      const res = await axios.get<{ invoices: VendorInvoiceItem[] }>(
        `/spend-analysis/vendor/${encodeURIComponent(vendorName)}/invoices`
      );
      setVendorInvoices(res.data.invoices || []);
    } catch (err) {
      console.error("Vendor invoices fetch failed:", err);
      setVendorInvoices([]);
    } finally {
      setLoadingVendorInvoices(false);
    }
  };

  // Filtered vendors by local search input
  const filteredVendors = useMemo(() => {
    if (!spendData?.top_vendors) return [];
    if (!vendorSearch.trim()) return spendData.top_vendors;
    const q = vendorSearch.toLowerCase();
    return spendData.top_vendors.filter((v) =>
      v.vendor_name.toLowerCase().includes(q)
    );
  }, [spendData?.top_vendors, vendorSearch]);

  return (
    <AuthProvider>
      <div className="flex-1 space-y-6 p-6 md:p-8 pt-6 min-h-screen bg-slate-950 text-slate-100">
        {/* Top Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-white/10 pb-5">
          <div className="flex items-center gap-3">
            <Link
              href="/dashboard"
              className="flex size-9 items-center justify-center rounded-lg border border-white/10 bg-slate-900 text-slate-300 hover:bg-slate-800 hover:text-white transition-colors"
            >
              <ArrowLeft className="size-4" />
            </Link>
            <div>
              <div className="flex items-center gap-2">
                <span className="flex size-7 items-center justify-center rounded-lg bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                  <TrendingUp className="size-4" />
                </span>
                <h1 className="text-2xl font-bold tracking-tight text-white">
                  Corporate Spend Analysis & Financial Intelligence
                </h1>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Multi-dimensional financial insights calculated strictly from Approved Invoices (Human & AI). Human rejections are strictly excluded.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            <Link href="/dashboard/export">
              <Button
                variant="outline"
                size="sm"
                className="border-white/10 bg-slate-900 text-slate-300 hover:bg-slate-800 text-xs h-9"
              >
                <FileSpreadsheet className="size-3.5 mr-1.5 text-emerald-400" />
                Export Ledger
              </Button>
            </Link>

            <Button
              variant="outline"
              size="sm"
              onClick={() => fetchSpendData()}
              disabled={loading}
              className="border-white/10 bg-slate-900 text-slate-300 hover:bg-slate-800 text-xs h-9"
            >
              <RefreshCw className={`size-3.5 mr-1.5 ${loading ? "animate-spin" : ""}`} />
              Refresh
            </Button>
          </div>
        </div>

        {/* Filter Controls Bar */}
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-white/10 bg-slate-900/60 p-3.5 backdrop-blur shadow-md">
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-1.5">
              <span className="text-xs font-semibold text-slate-400 flex items-center gap-1">
                <Calendar className="size-3.5 text-cyan-400" /> Time Range:
              </span>
              <div className="flex items-center gap-1 bg-slate-950 border border-white/10 p-0.5 rounded-lg">
                {[
                  { label: "30 Days", val: "30d" },
                  { label: "90 Days", val: "90d" },
                  { label: "6 Months", val: "6m" },
                  { label: "1 Year", val: "1y" },
                  { label: "All Time", val: "all" },
                ].map((pill) => (
                  <button
                    key={pill.val}
                    type="button"
                    onClick={() => handleRangeChange(pill.val)}
                    className={`px-3 py-1 rounded text-xs font-semibold transition-colors ${
                      timeRange === pill.val
                        ? "bg-cyan-500 text-slate-950 shadow-sm font-bold"
                        : "text-slate-400 hover:text-white hover:bg-slate-800"
                    }`}
                  >
                    {pill.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Department Filter Selector */}
            {spendData?.departments && spendData.departments.length > 0 && (
              <div className="flex items-center gap-1.5">
                <span className="text-xs font-semibold text-slate-400 flex items-center gap-1">
                  <Layers className="size-3.5 text-purple-400" /> Department:
                </span>
                <select
                  value={selectedDept}
                  onChange={(e) => handleDeptChange(e.target.value)}
                  className="rounded-lg border border-white/10 bg-slate-950 px-2.5 py-1 text-xs text-slate-200 focus:outline-none focus:ring-1 focus:ring-cyan-500"
                >
                  <option value="ALL">All Departments</option>
                  {spendData.departments.map((d) => (
                    <option key={d.department} value={d.department}>
                      {d.department}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>

          <div className="flex items-center gap-2 text-xs text-slate-400">
            <ShieldCheck className="size-4 text-emerald-400 shrink-0" />
            <span className="font-mono text-[11px] text-emerald-300">Strict Human/AI Approval Ledger Filter</span>
          </div>
        </div>

        {/* Top 4 KPI Metrics */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card className="border-emerald-500/30 bg-emerald-950/20 backdrop-blur p-4">
            <div className="flex items-center justify-between text-xs text-emerald-300 font-semibold mb-1">
              <span>Total Approved Spend</span>
              <Wallet className="size-4 text-emerald-400" />
            </div>
            <div className="text-2xl font-bold font-mono text-white">
              {formatCurrency(spendData?.overview?.total_approved_spend || 0, spendData?.overview?.currency || "INR")}
            </div>
            <div className="flex items-center gap-1.5 text-[11px] text-slate-300 mt-1">
              {Boolean(spendData?.overview?.mom_growth_pct && spendData.overview.mom_growth_pct > 0) ? (
                <span className="text-emerald-400 font-semibold flex items-center">
                  <ArrowUpRight className="size-3" /> +{spendData?.overview?.mom_growth_pct}% MoM Growth
                </span>
              ) : (
                <span className="text-slate-400">Stable MoM Velocity</span>
              )}
            </div>
          </Card>

          <Card className="border-white/10 bg-slate-900/60 backdrop-blur p-4">
            <div className="flex items-center justify-between text-xs text-slate-300 font-semibold mb-1">
              <span>Pre-Tax Base vs Tax Paid</span>
              <DollarSign className="size-4 text-cyan-400" />
            </div>
            <div className="text-2xl font-bold font-mono text-cyan-300">
              {formatCurrency(spendData?.overview?.total_subtotal || 0, spendData?.overview?.currency || "INR")}
            </div>
            <div className="text-[11px] text-slate-400 mt-1">
              Tax Paid (GST/VAT): <span className="font-semibold text-slate-200">{formatCurrency(spendData?.overview?.total_tax_paid || 0, spendData?.overview?.currency || "INR")}</span>
            </div>
          </Card>

          <Card className="border-white/10 bg-slate-900/60 backdrop-blur p-4">
            <div className="flex items-center justify-between text-xs text-slate-300 font-semibold mb-1">
              <span>Approved Claims</span>
              <CheckCircle2 className="size-4 text-emerald-400" />
            </div>
            <div className="text-2xl font-bold font-mono text-white">
              {spendData?.overview?.invoice_count || 0}{" "}
              <span className="text-xs font-normal text-slate-400">invoices</span>
            </div>
            <div className="text-[11px] text-slate-400 mt-1">
              Cleared through human & AI policies
            </div>
          </Card>

          <Card className="border-white/10 bg-slate-900/60 backdrop-blur p-4">
            <div className="flex items-center justify-between text-xs text-slate-300 font-semibold mb-1">
              <span>Average Claim Size</span>
              <PieChart className="size-4 text-purple-400" />
            </div>
            <div className="text-2xl font-bold font-mono text-white">
              {formatCurrency(spendData?.overview?.avg_invoice_value || 0, spendData?.overview?.currency || "INR")}
            </div>
            <div className="text-[11px] text-slate-400 mt-1">
              Per approved transaction
            </div>
          </Card>
        </div>

        {/* Vendors, Departments & Categories Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Top Vendors by Approved Spend (7 Cols) */}
          <Card className="lg:col-span-7 border-white/10 bg-slate-900/60 backdrop-blur shadow-lg">
            <CardHeader className="pb-3 border-b border-white/10 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <CardTitle className="text-xs font-bold text-white flex items-center gap-2">
                  <Building className="size-4 text-cyan-400" /> Top Vendors Ranked by Spend
                </CardTitle>
                <CardDescription className="text-[11px] text-slate-400">
                  Click any vendor to view itemized approved invoice claims.
                </CardDescription>
              </div>

              {/* Vendor Search Input */}
              <div className="relative w-48">
                <Search className="size-3.5 absolute left-2.5 top-2.5 text-slate-500" />
                <input
                  type="text"
                  value={vendorSearch}
                  onChange={(e) => setVendorSearch(e.target.value)}
                  placeholder="Filter vendors..."
                  className="w-full rounded-md border border-white/10 bg-slate-950/80 pl-8 pr-2.5 py-1 text-xs text-slate-100 placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-cyan-500"
                />
              </div>
            </CardHeader>
            <CardContent className="pt-4 space-y-3.5">
              {loading ? (
                <div className="h-64 flex items-center justify-center">
                  <Loader2 className="size-6 animate-spin text-cyan-400" />
                </div>
              ) : filteredVendors.length === 0 ? (
                <div className="h-64 flex flex-col items-center justify-center text-xs text-slate-500 gap-2">
                  <Building className="size-8 text-slate-600" />
                  <span>No approved vendor spending found for selected filters.</span>
                </div>
              ) : (
                filteredVendors.map((v, i) => (
                  <div
                    key={v.vendor_name}
                    onClick={() => openVendorDrilldown(v.vendor_name)}
                    className="p-2.5 rounded-lg border border-white/5 bg-slate-950/50 hover:bg-slate-800/60 hover:border-cyan-500/30 transition-all cursor-pointer space-y-1.5 text-xs group"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-slate-500 font-mono text-[11px]">#{i + 1}</span>
                        <span className="font-semibold text-slate-100 group-hover:text-cyan-300 transition-colors">
                          {v.vendor_name}
                        </span>
                        <span className="text-[10px] text-slate-400 bg-slate-900 border border-white/10 px-1.5 py-0.2 rounded font-mono">
                          {v.invoice_count} claim{v.invoice_count > 1 ? "s" : ""}
                        </span>
                      </div>
                      <div className="text-right font-mono flex items-center gap-2">
                        <span className="font-bold text-white text-xs">
                          {formatCurrency(v.total_spend, "INR")}
                        </span>
                        <span className="text-[10px] text-slate-400 font-sans">
                          ({v.share_percentage}%)
                        </span>
                        <ChevronRight className="size-3.5 text-slate-500 group-hover:text-cyan-400 group-hover:translate-x-0.5 transition-all" />
                      </div>
                    </div>
                    <div className="w-full bg-slate-900 rounded-full h-2 overflow-hidden">
                      <div
                        className="bg-cyan-400 h-2 rounded-full transition-all duration-300 group-hover:bg-cyan-300"
                        style={{ width: `${Math.min(100, Math.max(5, v.share_percentage))}%` }}
                      />
                    </div>
                    {v.tax_paid > 0 && (
                      <div className="flex items-center justify-between text-[10px] text-slate-500 pt-0.5">
                        <span>Tax Amount: {formatCurrency(v.tax_paid, "INR")}</span>
                        {v.latest_invoice_date && (
                          <span>Latest Invoice: {v.latest_invoice_date}</span>
                        )}
                      </div>
                    )}
                  </div>
                ))
              )}
            </CardContent>
          </Card>

          {/* Department Breakdown & Categories (5 Cols) */}
          <div className="lg:col-span-5 space-y-6">
            {/* Department Cost Centers */}
            <Card className="border-white/10 bg-slate-900/60 backdrop-blur shadow-lg">
              <CardHeader className="pb-3 border-b border-white/10 flex flex-row items-center justify-between">
                <CardTitle className="text-xs font-bold text-white flex items-center gap-2">
                  <Layers className="size-4 text-purple-400" /> Department Cost Allocation
                </CardTitle>
                <span className="text-[10px] text-slate-400 font-mono">Internal Submissions</span>
              </CardHeader>
              <CardContent className="pt-4 space-y-3">
                {!spendData?.departments || spendData.departments.length === 0 ? (
                  <div className="h-32 flex items-center justify-center text-xs text-slate-500">
                    No departmental spend data.
                  </div>
                ) : (
                  spendData.departments.map((d) => (
                    <div key={d.department} className="space-y-1 text-xs">
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-slate-200">{d.department}</span>
                        <span className="font-mono text-slate-300">
                          {formatCurrency(d.total_spend, "INR")}{" "}
                          <span className="text-[10px] text-slate-400 font-sans">({d.share_percentage}%)</span>
                        </span>
                      </div>
                      <div className="w-full bg-slate-950 rounded-full h-2 overflow-hidden">
                        <div
                          className="bg-purple-400 h-2 rounded-full"
                          style={{ width: `${Math.min(100, Math.max(5, d.share_percentage))}%` }}
                        />
                      </div>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>

            {/* Line Item Categories */}
            <Card className="border-white/10 bg-slate-900/60 backdrop-blur shadow-lg">
              <CardHeader className="pb-3 border-b border-white/10 flex flex-row items-center justify-between">
                <CardTitle className="text-xs font-bold text-white flex items-center gap-2">
                  <Tag className="size-4 text-amber-400" /> Expense Category Classification
                </CardTitle>
                <span className="text-[10px] text-slate-400 font-mono">Line Item Types</span>
              </CardHeader>
              <CardContent className="pt-4 space-y-3">
                {!spendData?.categories || spendData.categories.length === 0 ? (
                  <div className="h-32 flex items-center justify-center text-xs text-slate-500">
                    No line item categories recorded.
                  </div>
                ) : (
                  spendData.categories.map((c) => (
                    <div key={c.category} className="space-y-1 text-xs">
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-slate-200">{c.category}</span>
                        <span className="font-mono text-slate-300">
                          {formatCurrency(c.total_spend, "INR")}{" "}
                          <span className="text-[10px] text-slate-400 font-sans">({c.share_percentage}%)</span>
                        </span>
                      </div>
                      <div className="w-full bg-slate-950 rounded-full h-2 overflow-hidden">
                        <div
                          className="bg-amber-400 h-2 rounded-full"
                          style={{ width: `${Math.min(100, Math.max(5, c.share_percentage))}%` }}
                        />
                      </div>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Monthly Trend Timeline */}
        <Card className="border-white/10 bg-slate-900/60 backdrop-blur shadow-lg">
          <CardHeader className="pb-3 border-b border-white/10 flex flex-row items-center justify-between">
            <CardTitle className="text-xs font-bold text-white flex items-center gap-2">
              <BarChart3 className="size-4 text-emerald-400" /> Historical Monthly Run-Rate Velocity
            </CardTitle>
            <span className="text-[10px] text-slate-400 font-mono">Last 6 Months Trend</span>
          </CardHeader>
          <CardContent className="pt-4">
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 text-center">
              {spendData?.monthly_trend?.map((item) => (
                <div key={item.month} className="bg-slate-950/70 p-3.5 rounded-xl border border-white/5 space-y-1">
                  <span className="text-[11px] text-slate-400 block font-mono">{item.label}</span>
                  <span className="text-sm font-bold text-emerald-300 font-mono block">
                    {formatCurrency(item.total_spend, "INR").replace(".00", "")}
                  </span>
                  <span className="text-[10px] text-slate-500 block">{item.invoice_count} approved claims</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Vendor Invoices Drilldown Modal */}
        <Dialog open={Boolean(selectedVendorModal)} onOpenChange={(open) => !open && setSelectedVendorModal(null)}>
          <DialogContent className="sm:max-w-3xl border-white/10 bg-slate-900 text-slate-100 backdrop-blur-xl max-h-[85vh] overflow-hidden flex flex-col">
            <DialogHeader className="border-b border-white/10 pb-3">
              <DialogTitle className="text-base font-bold text-white flex items-center gap-2">
                <Building className="size-5 text-cyan-400" />
                Vendor Ledger: {selectedVendorModal}
              </DialogTitle>
              <DialogDescription className="text-xs text-slate-400">
                Itemized list of approved invoices and disbursement amounts for this vendor.
              </DialogDescription>
            </DialogHeader>

            <div className="overflow-y-auto flex-1 p-1">
              {loadingVendorInvoices ? (
                <div className="h-48 flex items-center justify-center gap-2">
                  <Loader2 className="size-5 animate-spin text-cyan-400" />
                  <span className="text-xs text-slate-400">Loading vendor transactions...</span>
                </div>
              ) : vendorInvoices.length === 0 ? (
                <div className="h-48 flex items-center justify-center text-xs text-slate-400">
                  No approved invoice records found for this vendor.
                </div>
              ) : (
                <Table>
                  <TableHeader className="bg-slate-950">
                    <TableRow className="border-white/10 text-xs">
                      <TableHead className="text-slate-300">Invoice #</TableHead>
                      <TableHead className="text-slate-300">Invoice Date</TableHead>
                      <TableHead className="text-slate-300">Submitter</TableHead>
                      <TableHead className="text-slate-300">Amount</TableHead>
                      <TableHead className="text-slate-300 text-right">Action</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {vendorInvoices.map((inv) => (
                      <TableRow key={inv.id} className="border-white/5 hover:bg-slate-800/40 text-xs">
                        <TableCell className="font-mono font-semibold text-cyan-300">
                          {inv.invoice_number}
                        </TableCell>
                        <TableCell className="text-slate-300">
                          {inv.invoice_date || "N/A"}
                        </TableCell>
                        <TableCell className="text-slate-300">
                          {inv.submitter_name} ({inv.submitter_department})
                        </TableCell>
                        <TableCell className="font-mono font-bold text-white">
                          {formatCurrency(inv.total_amount, inv.currency)}
                        </TableCell>
                        <TableCell className="text-right">
                          <Link href={`/dashboard/invoices/${inv.id}`}>
                            <Button size="sm" variant="ghost" className="h-7 text-xs text-cyan-300 hover:bg-cyan-500/10">
                              Inspect <ExternalLink className="size-3 ml-1" />
                            </Button>
                          </Link>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </AuthProvider>
  );
}
