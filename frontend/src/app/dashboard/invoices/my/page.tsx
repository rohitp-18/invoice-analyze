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
	ExternalLink,
	ChevronRight,
	ShieldCheck,
	FileCheck2,
	Receipt,
	Layers,
	ArrowUpDown,
	Calendar,
	AlertCircle,
	Filter,
	Zap,
	Compass,
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
import { formatCurrency, getCurrencySymbol } from "@/lib/utils";
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
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import {
	Dialog,
	DialogContent,
	DialogDescription,
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
	created_at?: string;
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

interface InvoiceSummary {
	total_invoices: number;
	total_spend: number;
	currency: string;
	status_counts: Record<string, number>;
	total_anomalies: number;
	latest_submission?: string;
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

function MyInvoicesContent() {
	const router = useRouter();
	const { user } = useSelector((state: RootState) => state.auth);

	const [invoices, setInvoices] = useState<Invoice[]>([]);
	const [summary, setSummary] = useState<InvoiceSummary | null>(null);
	const [loading, setLoading] = useState<boolean>(true);
	const [errorMsg, setErrorMsg] = useState<string>("");
	const [searchQuery, setSearchQuery] = useState<string>("");
	const [statusFilter, setStatusFilter] = useState<string>("ALL");

	// Selected Invoice for Detailed Quick Modal View
	const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);
	const [isDetailsOpen, setIsDetailsOpen] = useState<boolean>(false);

	// Fetch My Invoices and Summary Data from backend API
	const fetchMyInvoices = async () => {
		try {
			setLoading(true);
			setErrorMsg("");

			const [invoicesRes, summaryRes] = await Promise.all([
				axios.get("/invoice/my-invoices"),
				axios.get("/invoice/my-invoices/summary").catch(() => null),
			]);

			setInvoices(invoicesRes.data || []);
			if (summaryRes && summaryRes.data) {
				setSummary(summaryRes.data);
			}
		} catch (err: unknown) {
			console.error("Error loading user invoices:", err);
			if (isAxiosError(err)) {
				setErrorMsg(
					err.response?.data?.detail || "Failed to load your submitted invoices."
				);
			} else {
				setErrorMsg("Failed to load your invoices from server.");
			}
		} finally {
			setLoading(false);
		}
	};

	useEffect(() => {
		fetchMyInvoices();
	}, []);

	// Filtered Invoices
	const filteredInvoices = useMemo(() => {
		return invoices.filter((inv) => {
			// Status Filter
			if (statusFilter !== "ALL" && inv.status !== statusFilter) {
				return false;
			}
			// Search Filter
			if (searchQuery.trim() !== "") {
				const query = searchQuery.toLowerCase().trim();
				const matchesNumber = inv.invoice_number.toLowerCase().includes(query);
				const matchesVendor = inv.vendor_name.toLowerCase().includes(query);
				if (!matchesNumber && !matchesVendor) return false;
			}
			return true;
		});
	}, [invoices, statusFilter, searchQuery]);

	// Status Badge Helper
	const renderStatusBadge = (status: string | undefined) => {
		const s = (status || "PENDING_REVIEW").toUpperCase();
		switch (s) {
			case "APPROVED":
				return (
					<span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
						<CheckCircle2 className="size-3.5" />
						Approved
					</span>
				);
			case "PENDING":
			case "PENDING_REVIEW":
				return (
					<span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/20">
						<Clock className="size-3.5" />
						Pending Review
					</span>
				);
			case "FLAGGED":
				return (
					<span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-rose-500/10 text-rose-400 border border-rose-500/20">
						<AlertTriangle className="size-3.5" />
						Flagged
					</span>
				);
			case "REJECTED":
				return (
					<span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-red-500/10 text-red-400 border border-red-500/20">
						<XCircle className="size-3.5" />
						Rejected
					</span>
				);
			case "PROCESSING":
			default:
				return (
					<span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 animate-pulse">
						<RefreshCw className="size-3.5 animate-spin" />
						AI Processing
					</span>
				);
		}
	};

	// Severity Badge Helper
	const renderSeverityBadge = (severity: string) => {
		const s = severity.toUpperCase();
		if (s === "CRITICAL") {
			return (
				<span className="px-2 py-0.5 rounded text-[10px] font-bold bg-red-500/20 text-red-400 border border-red-500/30 uppercase">
					Critical
				</span>
			);
		}
		if (s === "HIGH") {
			return (
				<span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500/20 text-amber-400 border border-amber-500/30 uppercase">
					High
				</span>
			);
		}
		if (s === "MEDIUM") {
			return (
				<span className="px-2 py-0.5 rounded text-[10px] font-bold bg-yellow-500/20 text-yellow-300 border border-yellow-500/30 uppercase">
					Medium
				</span>
			);
		}
		return (
			<span className="px-2 py-0.5 rounded text-[10px] font-bold bg-blue-500/20 text-blue-300 border border-blue-500/30 uppercase">
				Low
			</span>
		);
	};

	const handleOpenDetails = (inv: Invoice) => {
		setSelectedInvoice(inv);
		setIsDetailsOpen(true);
	};

	const stats = useMemo(() => {
		if (summary) {
			return {
				totalCount: summary.total_invoices,
				totalSpend: summary.total_spend,
				approved: summary.status_counts["APPROVED"] || 0,
				pending: summary.status_counts["PENDING_REVIEW"] || 0,
				processing: summary.status_counts["PROCESSING"] || 0,
				flagged: summary.status_counts["FLAGGED"] || 0,
				rejected: summary.status_counts["REJECTED"] || 0,
				anomalies: summary.total_anomalies,
			};
		}
		const totalCount = invoices.length;
		const totalSpend = invoices.reduce((acc, i) => acc + (i.total_amount || 0), 0);
		const approved = invoices.filter((i) => i.status === "APPROVED").length;
		const pending = invoices.filter((i) => i.status === "PENDING_REVIEW").length;
		const processing = invoices.filter((i) => i.status === "PROCESSING").length;
		const flagged = invoices.filter((i) => i.status === "FLAGGED").length;
		const rejected = invoices.filter((i) => i.status === "REJECTED").length;
		const anomalies = invoices.reduce((acc, i) => acc + (i.anomalies?.length || 0), 0);

		return { totalCount, totalSpend, approved, pending, processing, flagged, rejected, anomalies };
	}, [invoices, summary]);

	return (
		<div className="min-h-screen bg-slate-950 text-slate-100 p-4 sm:p-6 md:p-8 space-y-6">
			{/* Header Banner */}
			<div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-white/10 pb-6">
				<div>
					<div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-cyan-400 mb-1">
						<Receipt className="size-4" />
						<span>Personal Expense Ledger</span>
					</div>
					<h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-white flex items-center gap-2">
						My Submitted Invoices
					</h1>
					<p className="text-sm text-slate-400 mt-1">
						Track validation progress, AI OCR extraction, policy checks, and review decisions for all invoices posted by you ({user?.name || user?.email}).
					</p>
				</div>

				<div className="flex items-center gap-3">
					<Button
						variant="outline"
						size="sm"
						onClick={fetchMyInvoices}
						disabled={loading}
						className="border-white/10 bg-slate-900/60 hover:bg-slate-800 text-slate-300 gap-1.5 h-9"
					>
						<RefreshCw className={`size-3.5 ${loading ? "animate-spin text-cyan-400" : ""}`} />
						Refresh
					</Button>

					<Link href="/invoice/upload">
						<Button
							size="sm"
							className="bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white shadow-lg shadow-cyan-900/30 gap-1.5 h-9"
						>
							<UploadCloud className="size-4" />
							Upload New Invoice
						</Button>
					</Link>
				</div>
			</div>

			{/* KPI Metric Cards */}
			<div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
				{/* Total Invoices */}
				<Card className="bg-slate-900/50 border-white/10 backdrop-blur">
					<CardContent className="p-4 flex items-center justify-between">
						<div>
							<p className="text-xs font-medium text-slate-400">Total Submissions</p>
							<p className="text-2xl font-bold text-white mt-1">{stats.totalCount}</p>
							<p className="text-[11px] text-slate-500 mt-0.5">
								Total amount: <span className="text-slate-300 font-semibold">{formatCurrency(stats.totalSpend, summary?.currency || "INR")}</span>
							</p>
						</div>
						<div className="size-10 rounded-lg bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-cyan-400">
							<FileText className="size-5" />
						</div>
					</CardContent>
				</Card>

				{/* Approved Invoices */}
				<Card className="bg-slate-900/50 border-white/10 backdrop-blur">
					<CardContent className="p-4 flex items-center justify-between">
						<div>
							<p className="text-xs font-medium text-slate-400">Approved</p>
							<p className="text-2xl font-bold text-emerald-400 mt-1">{stats.approved}</p>
							<p className="text-[11px] text-slate-500 mt-0.5">Cleared for reimbursement</p>
						</div>
						<div className="size-10 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
							<CheckCircle2 className="size-5" />
						</div>
					</CardContent>
				</Card>

				{/* Pending & Processing */}
				<Card className="bg-slate-900/50 border-white/10 backdrop-blur">
					<CardContent className="p-4 flex items-center justify-between">
						<div>
							<p className="text-xs font-medium text-slate-400">In Review / Processing</p>
							<p className="text-2xl font-bold text-amber-400 mt-1">{stats.pending + stats.processing}</p>
							<p className="text-[11px] text-slate-500 mt-0.5">
								{stats.processing > 0 ? `${stats.processing} processing OCR` : "Awaiting reviewer audit"}
							</p>
						</div>
						<div className="size-10 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400">
							<Clock className="size-5" />
						</div>
					</CardContent>
				</Card>

				{/* Flagged / Anomalies */}
				<Card className="bg-slate-900/50 border-white/10 backdrop-blur">
					<CardContent className="p-4 flex items-center justify-between">
						<div>
							<p className="text-xs font-medium text-slate-400">Flagged / Anomalies</p>
							<p className="text-2xl font-bold text-rose-400 mt-1">{stats.flagged}</p>
							<p className="text-[11px] text-slate-500 mt-0.5">
								{stats.anomalies} total finding(s) detected
							</p>
						</div>
						<div className="size-10 rounded-lg bg-rose-500/10 border border-rose-500/20 flex items-center justify-center text-rose-400">
							<ShieldAlert className="size-5" />
						</div>
					</CardContent>
				</Card>
			</div>

			{/* Filter and Search Bar */}
			<Card className="bg-slate-900/60 border-white/10 backdrop-blur">
				<CardContent className="p-4">
					<div className="flex flex-col md:flex-row gap-3">
						{/* Search Input */}
						<div className="relative flex-1">
							<Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-slate-500" />
							<Input
								placeholder="Search by vendor name or invoice number..."
								value={searchQuery}
								onChange={(e) => setSearchQuery(e.target.value)}
								className="pl-9 bg-slate-950/70 border-white/10 text-slate-200 placeholder:text-slate-500 text-sm focus:border-cyan-500"
							/>
						</div>

						{/* Status Filter */}
						<div className="w-full md:w-56">
							<Select value={statusFilter} onValueChange={(val) => setStatusFilter(val || "ALL")}>
								<SelectTrigger className="bg-slate-950/70 border-white/10 text-slate-200 text-sm">
									<div className="flex items-center gap-2">
										<Filter className="size-3.5 text-slate-400" />
										<SelectValue placeholder="Filter by Status" />
									</div>
								</SelectTrigger>
								<SelectContent className="bg-slate-900 border-white/10 text-slate-200">
									<SelectItem value="ALL">All Statuses ({invoices.length})</SelectItem>
									<SelectItem value="APPROVED">Approved ({stats.approved})</SelectItem>
									<SelectItem value="PENDING_REVIEW">Pending Review ({stats.pending})</SelectItem>
									<SelectItem value="PROCESSING">Processing ({stats.processing})</SelectItem>
									<SelectItem value="FLAGGED">Flagged ({stats.flagged})</SelectItem>
									<SelectItem value="REJECTED">Rejected ({stats.rejected})</SelectItem>
								</SelectContent>
							</Select>
						</div>
					</div>
				</CardContent>
			</Card>

			{/* Error Message if any */}
			{errorMsg && (
				<div className="p-4 rounded-lg bg-red-500/10 border border-red-500/30 text-red-300 text-sm flex items-center gap-3">
					<AlertCircle className="size-5 shrink-0 text-red-400" />
					<span>{errorMsg}</span>
				</div>
			)}

			{/* Invoices List Table */}
			<Card className="bg-slate-900/60 border-white/10 overflow-hidden backdrop-blur">
				<CardHeader className="border-b border-white/10 px-6 py-4">
					<div className="flex items-center justify-between">
						<div>
							<CardTitle className="text-base font-semibold text-white flex items-center gap-2">
								<Receipt className="size-4 text-cyan-400" />
								Submitted Invoices Ledger
							</CardTitle>
							<CardDescription className="text-xs text-slate-400 mt-0.5">
								Showing {filteredInvoices.length} of {invoices.length} invoice record(s)
							</CardDescription>
						</div>
					</div>
				</CardHeader>

				<CardContent className="p-0">
					{loading ? (
						<div className="py-20 flex flex-col items-center justify-center space-y-3 text-slate-400">
							<RefreshCw className="size-8 animate-spin text-cyan-400" />
							<p className="text-sm font-medium">Fetching your invoices and audit findings...</p>
						</div>
					) : filteredInvoices.length === 0 ? (
						<div className="py-16 text-center space-y-4">
							<div className="size-12 rounded-full bg-slate-800/80 border border-white/10 flex items-center justify-center mx-auto text-slate-400">
								<FileText className="size-6" />
							</div>
							<div>
								<h3 className="text-sm font-semibold text-slate-200">No Invoices Found</h3>
								<p className="text-xs text-slate-400 max-w-sm mx-auto mt-1">
									{searchQuery || statusFilter !== "ALL"
										? "No invoices match your current search or filter criteria. Try clearing filters."
										: "You haven't submitted any invoices yet. Upload your first invoice to run AI validation and policy checks."}
								</p>
							</div>
							<Link href="/invoice/upload">
								<Button size="sm" className="bg-cyan-600 hover:bg-cyan-500 text-white text-xs mt-2">
									<UploadCloud className="size-3.5 mr-1.5" />
									Upload Invoice Now
								</Button>
							</Link>
						</div>
					) : (
						<div className="overflow-x-auto">
							<Table>
								<TableHeader className="bg-slate-950/60">
									<TableRow className="border-white/10 hover:bg-transparent">
										<TableHead className="text-slate-400 text-xs font-semibold">Invoice #</TableHead>
										<TableHead className="text-slate-400 text-xs font-semibold">Vendor</TableHead>
										<TableHead className="text-slate-400 text-xs font-semibold">Invoice Date</TableHead>
										<TableHead className="text-slate-400 text-xs font-semibold">Total Amount</TableHead>
										<TableHead className="text-slate-400 text-xs font-semibold">Status</TableHead>
										<TableHead className="text-slate-400 text-xs font-semibold">AI Findings</TableHead>
										<TableHead className="text-slate-400 text-xs font-semibold">Line Items</TableHead>
										<TableHead className="text-slate-400 text-xs font-semibold text-right">Actions</TableHead>
									</TableRow>
								</TableHeader>
								<TableBody>
									{filteredInvoices.map((inv) => {
										const anomalyCount = inv.anomalies?.length || 0;
										const criticalAnomalies = inv.anomalies?.filter(
											(a) => a.severity === "CRITICAL" || a.severity === "HIGH"
										).length || 0;

										return (
											<TableRow
												key={inv.id}
												className="border-white/5 hover:bg-slate-800/40 transition-colors cursor-pointer"
												onClick={() => handleOpenDetails(inv)}
											>
												{/* Invoice Number */}
												<TableCell className="font-mono text-xs font-semibold text-cyan-300">
													{inv.invoice_number || "INV-PENDING"}
												</TableCell>

												{/* Vendor Name */}
												<TableCell>
													<div className="flex items-center gap-2">
														<Building className="size-3.5 text-slate-400 shrink-0" />
														<span className="text-sm font-medium text-slate-200 max-w-[180px] truncate">
															{inv.vendor_name || "Unknown Vendor"}
														</span>
													</div>
												</TableCell>

												{/* Invoice Date */}
												<TableCell className="text-xs text-slate-300">
													{inv.invoice_date || "—"}
												</TableCell>

												{/* Total Amount */}
												<TableCell>
													<div>
														<span className="text-sm font-bold text-white">
															{formatCurrency(inv.total_amount, inv.currency)}
														</span>
														<span className="text-[10px] text-slate-400 ml-1 uppercase">
															{inv.currency || "INR"}
														</span>
													</div>
													{Boolean(inv.tax_amount && inv.tax_amount > 0) && (
														<div className="text-[10px] text-cyan-400">
															Tax: {formatCurrency(inv.tax_amount || 0, inv.currency)}
														</div>
													)}
												</TableCell>

												{/* Status */}
												<TableCell>
													<div className="flex flex-col gap-1">
														<div>
															{renderStatusBadge(
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
																className="text-[10px] text-slate-400 max-w-[150px] truncate"
																title={`Reviewer Notes: ${inv.decision_notes}`}
															>
																Note: {inv.decision_notes}
															</div>
														)}
													</div>
												</TableCell>
												{/* Anomalies Badge */}
												<TableCell>
													<div className="flex flex-col gap-1">
														<div className="flex items-center gap-1.5">
															{anomalyCount > 0 ? (
																<span
																	className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold ${criticalAnomalies > 0
																		? "bg-rose-500/20 text-rose-300 border border-rose-500/30"
																		: "bg-amber-500/20 text-amber-300 border border-amber-500/30"
																		}`}
																>
																	<ShieldAlert className="size-2.5" />
																	{anomalyCount} {anomalyCount === 1 ? "flag" : "flags"}
																</span>
															) : (
																<span className="inline-flex items-center gap-1 text-[11px] text-emerald-400 font-medium">
																	<ShieldCheck className="size-3" />
																	Clean
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
															Conf: {Math.round(((inv.overall_confidence ?? inv.overall_confidance) ?? 0.95) * 100)}%
														</span>
														{inv.recommended_action && (
															<span className="text-[10px] text-slate-300 max-w-[180px] truncate" title={inv.recommended_action}>
																💡 {inv.recommended_action}
															</span>
														)}
													</div>
												</TableCell>

												{/* Line Items Count */}
												<TableCell className="text-xs text-slate-400">
													<div className="flex items-center gap-1">
														<Layers className="size-3 text-slate-500" />
														<span>{inv.line_items?.length || 0} items</span>
													</div>
												</TableCell>

												{/* Actions */}
												<TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
													<div className="flex items-center justify-end gap-1">
														<Button
															variant="ghost"
															size="icon-sm"
															onClick={() => handleOpenDetails(inv)}
															className="size-7 text-slate-300 hover:text-white hover:bg-slate-800"
															title="View Details"
														>
															<Eye className="size-3.5" />
														</Button>
														<Link href={`/dashboard/invoices/${inv.id}`}>
															<Button
																variant="ghost"
																size="icon-sm"
																className="size-7 text-cyan-400 hover:text-cyan-300 hover:bg-cyan-500/10"
																title="Full Inspection Page"
															>
																<ExternalLink className="size-3.5" />
															</Button>
														</Link>
													</div>
												</TableCell>
											</TableRow>
										);
									})}
								</TableBody>
							</Table>
						</div>
					)}
				</CardContent>
			</Card>

			{/* ========================================================================= */}
			{/* QUICK INVOICE DETAIL MODAL */}
			{/* ========================================================================= */}
			<Dialog open={isDetailsOpen} onOpenChange={setIsDetailsOpen}>
				<DialogContent className="sm:max-w-2xl max-h-[85vh] overflow-y-auto border-white/10 bg-slate-900 text-slate-100 backdrop-blur-xl">
					<DialogHeader>
						<div className="flex items-center justify-between pr-4">
							<DialogTitle className="text-base font-bold text-white flex items-center gap-2">
								<Receipt className="size-5 text-cyan-400" />
								Invoice: {selectedInvoice?.invoice_number || "Invoice Overview"}
							</DialogTitle>
							{selectedInvoice && renderStatusBadge(selectedInvoice.status)}
						</div>
						<DialogDescription className="text-xs text-slate-400">
							Submitted on{" "}
							{selectedInvoice?.created_at
								? new Date(selectedInvoice.created_at).toLocaleString()
								: "N/A"}
						</DialogDescription>
					</DialogHeader>

					{selectedInvoice && (
						<div className="space-y-4 py-2">
							{/* Overview Grid */}
							<div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-3 rounded-lg bg-slate-950/60 border border-white/5 text-xs">
								<div>
									<p className="text-[11px] text-slate-400">Vendor</p>
									<p className="text-sm font-semibold text-slate-200 mt-0.5 truncate">
										{selectedInvoice.vendor_name || "Unknown"}
									</p>
								</div>
								<div>
									<p className="text-[11px] text-slate-400">Invoice Date</p>
									<p className="text-sm font-semibold text-slate-200 mt-0.5">
										{selectedInvoice.invoice_date || "—"}
									</p>
								</div>
								<div>
									<p className="text-[11px] text-slate-400">Pre-Tax Subtotal</p>
									<p className="text-sm font-semibold text-slate-200 mt-0.5">
										{formatCurrency(selectedInvoice.subtotal ?? selectedInvoice.total_amount, selectedInvoice.currency)}
									</p>
								</div>
								<div>
									<p className="text-[11px] text-cyan-400">Tax Paid (GST/VAT)</p>
									<p className="text-sm font-bold text-cyan-300 mt-0.5">
										{formatCurrency(selectedInvoice.tax_amount || 0.0, selectedInvoice.currency)}
									</p>
								</div>
								<div>
									<p className="text-[11px] text-slate-400">Total Amount</p>
									<p className="text-base font-bold text-white mt-0.5">
										{formatCurrency(selectedInvoice.total_amount, selectedInvoice.currency)}
									</p>
								</div>
								<div>
									<p className="text-[11px] text-slate-400">Overall Confidence</p>
									<p className="text-sm font-bold text-emerald-400 mt-0.5">
										{Math.round(((selectedInvoice.overall_confidence ?? selectedInvoice.overall_confidance) ?? 0.95) * 100)}%
									</p>
								</div>
								<div>
									<p className="text-[11px] text-slate-400">Risk Level / Score</p>
									<span
										className={`inline-block rounded px-1.5 py-0.5 text-[10px] font-bold mt-0.5 ${(selectedInvoice.risk_level || "LOW").toUpperCase() === "CRITICAL"
												? "bg-rose-500/20 text-rose-300 border border-rose-500/30"
												: (selectedInvoice.risk_level || "LOW").toUpperCase() === "HIGH"
													? "bg-amber-500/20 text-amber-300 border border-amber-500/30"
													: (selectedInvoice.risk_level || "LOW").toUpperCase() === "MEDIUM"
														? "bg-yellow-500/20 text-yellow-300 border border-yellow-500/30"
														: "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30"
											}`}
									>
										{selectedInvoice.risk_level || "LOW"} ({(selectedInvoice.risk_score ?? 0.05).toFixed(2)})
									</span>
								</div>
								<div>
									<p className="text-[11px] text-slate-400">Auditor / Reviewer</p>
									<p className="text-sm font-semibold text-slate-200 mt-0.5 truncate">
										{selectedInvoice.decision_by_name || selectedInvoice.approver_name || "Pending Review"}
									</p>
								</div>
							</div>

							{/* Reviewer Decision Note (If rejected or approved with remarks) */}
							{selectedInvoice.decision_notes && (
								<div className={`p-3 rounded-lg border text-xs space-y-1 ${
									selectedInvoice.human_status === "REJECTED" || selectedInvoice.status === "REJECTED"
										? "bg-rose-950/30 border-rose-500/40 text-rose-200"
										: "bg-slate-900 border-white/10 text-slate-200"
								}`}>
									<p className="text-[10px] uppercase font-mono text-slate-400 tracking-wider">
										Auditor Decision Notes / Remarks:
									</p>
									<p className="leading-relaxed">{selectedInvoice.decision_notes}</p>
								</div>
							)}

							{/* AI Recommended Action Card */}
							<div
								className={`p-3 rounded-lg border text-xs space-y-1.5 ${(selectedInvoice.risk_level || "LOW").toUpperCase() === "CRITICAL"
										? "bg-rose-950/30 border-rose-500/30"
										: (selectedInvoice.risk_level || "LOW").toUpperCase() === "HIGH"
											? "bg-amber-950/30 border-amber-500/30"
											: (selectedInvoice.risk_level || "LOW").toUpperCase() === "MEDIUM"
												? "bg-yellow-950/20 border-yellow-500/20"
												: "bg-emerald-950/20 border-emerald-500/20"
									}`}
							>
								<div className="flex items-center justify-between">
									<span className="font-semibold text-white flex items-center gap-1.5 text-xs">
										<Zap className="size-3.5 text-cyan-400" /> AI Recommended Action & Next Step
									</span>
									<span
										className={`px-2 py-0.5 rounded text-[10px] font-bold ${(selectedInvoice.risk_level || "LOW").toUpperCase() === "CRITICAL"
												? "bg-rose-500/20 text-rose-300"
												: (selectedInvoice.risk_level || "LOW").toUpperCase() === "HIGH"
													? "bg-amber-500/20 text-amber-300"
													: (selectedInvoice.risk_level || "LOW").toUpperCase() === "MEDIUM"
														? "bg-yellow-500/20 text-yellow-300"
														: "bg-emerald-500/20 text-emerald-300"
											}`}
									>
										{(selectedInvoice.risk_level || "LOW").toUpperCase()} RISK
									</span>
								</div>
								<p className="text-slate-200 leading-relaxed text-xs">
									{selectedInvoice.recommended_action ||
										"Invoice submitted. Ready for manager audit and standard verification."}
								</p>
							</div>

							{/* Anomalies Section if any */}
							{selectedInvoice.anomalies && selectedInvoice.anomalies.length > 0 && (
								<div className="space-y-3">
									<div className="flex items-center justify-between">
										<h4 className="text-xs font-semibold uppercase tracking-wider text-rose-400 flex items-center gap-1.5">
											<ShieldAlert className="size-4" />
											AI Audit Findings & Policy Violations ({selectedInvoice.anomalies.length})
										</h4>
									</div>

									<div className="space-y-2">
										{selectedInvoice.anomalies.map((anom, idx) => (
											<div
												key={idx}
												className="p-3 rounded-lg bg-rose-500/10 border border-rose-500/20 text-xs space-y-1"
											>
												<div className="flex items-center justify-between">
													<span className="font-semibold text-rose-200">{anom.anomaly_flag || anom.anomaly_type}</span>
													{renderSeverityBadge(anom.severity)}
												</div>
												<p className="text-slate-300 text-[12px]">{anom.reason || anom.explanation}</p>
												{anom.evidence && (
													<p className="text-[11px] text-slate-400 italic">
														Evidence: {anom.evidence}
													</p>
												)}
											</div>
										))}
									</div>
								</div>
							)}

							{/* Line Items Table */}
							<div className="space-y-2">
								<h4 className="text-xs font-semibold uppercase tracking-wider text-slate-300 flex items-center gap-1.5">
									<Layers className="size-4 text-cyan-400" />
									Extracted Line Items ({selectedInvoice.line_items?.length || 0})
								</h4>

								{selectedInvoice.line_items && selectedInvoice.line_items.length > 0 ? (
									<div className="border border-white/10 rounded-lg overflow-hidden">
										<Table>
											<TableHeader className="bg-slate-950">
												<TableRow className="border-white/10 text-xs">
													<TableHead className="text-slate-400">Description</TableHead>
													<TableHead className="text-slate-400">Category</TableHead>
													<TableHead className="text-slate-400 text-right">Qty</TableHead>
													<TableHead className="text-slate-400 text-right">Unit Price</TableHead>
													<TableHead className="text-slate-400 text-right">Total</TableHead>
												</TableRow>
											</TableHeader>
											<TableBody>
												{selectedInvoice.line_items.map((item, idx) => (
													<TableRow key={idx} className="border-white/5 text-xs">
														<TableCell className="font-medium text-slate-200">
															{item.description}
														</TableCell>
														<TableCell className="text-slate-400">
															{item.category || "General"}
														</TableCell>
														<TableCell className="text-right text-slate-300">
															{item.quantity}
														</TableCell>
														<TableCell className="text-right text-slate-300">
															{formatCurrency(item.unit_price, selectedInvoice.currency)}
														</TableCell>
														<TableCell className="text-right font-semibold text-white">
															{formatCurrency(item.total_amount, selectedInvoice.currency)}
														</TableCell>
													</TableRow>
												))}
											</TableBody>
										</Table>
									</div>
								) : (
									<p className="text-xs text-slate-400 italic p-3 bg-slate-950/40 rounded border border-white/5">
										No individual line items parsed.
									</p>
								)}
							</div>

							{/* Modal Footer Actions */}
							<div className="flex items-center justify-between border-t border-white/10 pt-4">
								{selectedInvoice.document_url ? (
									<a
										href={getDocumentUrl(selectedInvoice.document_url)}
										target="_blank"
										rel="noreferrer"
										className="inline-flex items-center gap-1 text-xs text-cyan-400 hover:text-cyan-300 underline"
									>
										<ExternalLink className="size-3.5" />
										View Original Document
									</a>
								) : (
									<span />
								)}

								<div className="flex items-center gap-2">
									<Button
										variant="outline"
										size="sm"
										onClick={() => setIsDetailsOpen(false)}
										className="border-white/10 bg-slate-800 hover:bg-slate-700 text-xs text-slate-200"
									>
										Close
									</Button>
									<Link href={`/dashboard/invoices/${selectedInvoice.id}`}>
										<Button
											size="sm"
											className="bg-cyan-600 hover:bg-cyan-500 text-white text-xs gap-1.5"
										>
											Open Full Page
											<ChevronRight className="size-3.5" />
										</Button>
									</Link>
								</div>
							</div>
						</div>
					)}
				</DialogContent>
			</Dialog>
		</div>
	);
}

export default function MyInvoicesPage() {
	return (
		<AuthProvider>
			<MyInvoicesContent />
		</AuthProvider>
	);
}