"use client";

import React, { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import AuthProvider from "@/components/authProvider";
import axios from "@/store/axios";
import { isAxiosError } from "axios";
import {
  ShieldAlert,
  ShieldCheck,
  Plus,
  Search,
  Filter,
  CheckCircle2,
  AlertTriangle,
  FileText,
  DollarSign,
  Trash2,
  Edit,
  Power,
  Loader2,
  RefreshCw,
  SlidersHorizontal,
  Building,
  Scale,
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
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
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface Policy {
  id: string;
  title: string;
  policy_code: string;
  category: string;
  description: string;
  rule_type: string;
  max_amount: number | null;
  currency: string;
  severity: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  department: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export default function CompliancePoliciesPage() {
  const router = useRouter();
  const [policies, setPolicies] = useState<Policy[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [errorMsg, setErrorMsg] = useState<string>("");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [selectedCategory, setSelectedCategory] = useState<string>("ALL");
  const [statusFilter, setStatusFilter] = useState<string>("ALL");

  // Modal States
  const [isCreateOpen, setIsCreateOpen] = useState<boolean>(false);
  const [isEditOpen, setIsEditOpen] = useState<boolean>(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState<boolean>(false);
  const [selectedPolicy, setSelectedPolicy] = useState<Policy | null>(null);
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [syncingVector, setSyncingVector] = useState<boolean>(false);

  const handleSyncVectorStore = async () => {
    try {
      setSyncingVector(true);
      const res = await axios.post("/policies/sync-vector-store");
      alert(res.data?.message || "Successfully indexed active policies into Vector Store!");
    } catch (err: unknown) {
      console.error("Vector sync failed:", err);
      if (isAxiosError(err)) {
        alert(err.response?.data?.detail || "Failed to sync policies to Vector Store.");
      } else {
        alert("Failed to sync policies to Vector Store.");
      }
    } finally {
      setSyncingVector(false);
    }
  };

  // Form State
  const [formData, setFormData] = useState({
    title: "",
    policy_code: "",
    category: "THRESHOLD",
    rule_type: "MAX_AMOUNT",
    max_amount: "" as string | number,
    currency: "USD",
    severity: "HIGH",
    department: "All",
    description: "",
    is_active: true,
  });

  // Fetch policies from backend
  const fetchPolicies = async () => {
    try {
      setLoading(true);
      setErrorMsg("");
      const res = await axios.get("/policies");
      setPolicies(res.data.policies || []);
    } catch (err: unknown) {
      console.error("Error fetching compliance policies:", err);
      if (isAxiosError(err)) {
        setErrorMsg(
          err.response?.data?.detail || "Failed to load compliance policies."
        );
      } else {
        setErrorMsg("Failed to load policies from backend.");
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPolicies();
  }, []);

  // Filtered Policies
  const filteredPolicies = useMemo(() => {
    return policies.filter((p) => {
      const matchesSearch =
        p.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.policy_code.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.description.toLowerCase().includes(searchQuery.toLowerCase());

      const matchesCat =
        selectedCategory === "ALL" ||
        p.category.toUpperCase() === selectedCategory.toUpperCase();

      const matchesStatus =
        statusFilter === "ALL" ||
        (statusFilter === "ACTIVE" && p.is_active) ||
        (statusFilter === "INACTIVE" && !p.is_active);

      return matchesSearch && matchesCat && matchesStatus;
    });
  }, [policies, searchQuery, selectedCategory, statusFilter]);

  // Statistics calculation
  const stats = useMemo(() => {
    const total = policies.length;
    const active = policies.filter((p) => p.is_active).length;
    const critical = policies.filter(
      (p) => p.severity === "CRITICAL" || p.severity === "HIGH"
    ).length;
    const categoriesCount = new Set(policies.map((p) => p.category)).size;

    return { total, active, critical, categoriesCount };
  }, [policies]);

  // Handle Form Input Changes
  const handleInputChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  // Open Create Modal
  const openCreateModal = () => {
    setFormData({
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
    setIsCreateOpen(true);
  };

  // Open Edit Modal
  const openEditModal = (policy: Policy) => {
    setSelectedPolicy(policy);
    setFormData({
      title: policy.title,
      policy_code: policy.policy_code,
      category: policy.category,
      rule_type: policy.rule_type,
      max_amount: policy.max_amount !== null ? String(policy.max_amount) : "",
      currency: policy.currency,
      severity: policy.severity,
      department: policy.department || "All",
      description: policy.description,
      is_active: policy.is_active,
    });
    setIsEditOpen(true);
  };

  // Submit Create Policy
  const handleCreatePolicy = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.title.trim() || !formData.description.trim()) {
      alert("Please fill in Title and Description.");
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
      setPolicies((prev) => [res.data, ...prev]);
      setIsCreateOpen(false);
    } catch (err: unknown) {
      console.error("Create policy failed:", err);
      if (isAxiosError(err)) {
        alert(err.response?.data?.detail || "Failed to create policy");
      }
    } finally {
      setSubmitting(false);
    }
  };

  // Submit Edit Policy
  const handleUpdatePolicy = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPolicy) return;

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

      const res = await axios.put(`/policies/${selectedPolicy.id}`, payload);
      setPolicies((prev) =>
        prev.map((p) => (p.id === selectedPolicy.id ? res.data : p))
      );
      setIsEditOpen(false);
    } catch (err: unknown) {
      console.error("Update policy failed:", err);
      if (isAxiosError(err)) {
        alert(err.response?.data?.detail || "Failed to update policy");
      }
    } finally {
      setSubmitting(false);
    }
  };

  // Toggle Policy Active Status
  const handleToggleStatus = async (policy: Policy) => {
    try {
      // Optimistic update
      setPolicies((prev) =>
        prev.map((p) =>
          p.id === policy.id ? { ...p, is_active: !p.is_active } : p
        )
      );
      await axios.patch(`/policies/${policy.id}/toggle`);
    } catch (err) {
      console.error("Toggle status error:", err);
      // Revert if error
      fetchPolicies();
    }
  };

  // Delete Policy
  const handleDeletePolicy = async () => {
    if (!selectedPolicy) return;
    try {
      setSubmitting(true);
      await axios.delete(`/policies/${selectedPolicy.id}`);
      setPolicies((prev) => prev.filter((p) => p.id !== selectedPolicy.id));
      setIsDeleteOpen(false);
    } catch (err: unknown) {
      console.error("Delete policy failed:", err);
      if (isAxiosError(err)) {
        alert(err.response?.data?.detail || "Failed to delete policy");
      }
    } finally {
      setSubmitting(false);
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

  const getCategoryBadge = (cat: string) => {
    switch (cat.toUpperCase()) {
      case "THRESHOLD":
        return "bg-purple-500/15 text-purple-300 border-purple-500/30";
      case "TRAVEL":
        return "bg-sky-500/15 text-sky-300 border-sky-500/30";
      case "TAX":
        return "bg-emerald-500/15 text-emerald-300 border-emerald-500/30";
      case "PROCUREMENT":
        return "bg-indigo-500/15 text-indigo-300 border-indigo-500/30";
      default:
        return "bg-slate-500/15 text-slate-300 border-slate-500/30";
    }
  };

  return (
    <AuthProvider
      allowedRoles={["COMPLIANCE", "ADMIN", "AUDITOR", "SUPERADMIN"]}
      allowedDepartments={["COMPLIANCE", "ADMIN", "LEGAL", "AUDIT"]}
    >
      <div className="flex-1 space-y-6 py-6 md:py-8 pt-6 min-h-screen bg-slate-950 text-slate-100">
        {/* Page Header */}
        <div className="flex flex-col px-6 md:px-6 sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-white/10 pb-5">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <div className="flex size-7 items-center justify-center rounded-lg bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">
                <Scale className="size-4" />
              </div>
              <h1 className="text-2xl font-bold tracking-tight text-white">
                Compliance & Expense Policies
              </h1>
            </div>
            <p className="text-xs text-slate-400">
              Corporate audit rules and expenditure thresholds enforced by the LangGraph AI agents.
            </p>
          </div>

          <Button
            variant="outline"
            size="sm"
            onClick={handleSyncVectorStore}
            disabled={syncingVector}
            className="border-cyan-500/30 bg-cyan-950/30 text-cyan-300 hover:bg-cyan-900/40 text-xs h-9"
            title="Re-index all active policies into the active vector database (FAISS/Pinecone)"
          >
            <Sparkles className={`size-3.5 mr-1.5 ${syncingVector ? "animate-spin" : ""}`} />
            {syncingVector ? "Syncing..." : "Sync Vector AI"}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={fetchPolicies}
            disabled={loading}
            className="border-white/10 bg-slate-900 text-slate-300 hover:bg-slate-800 text-xs h-9"
          >
            <RefreshCw className={`size-3.5 mr-1.5 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
          <Link href="/dashboard/compliance/new">
            <Button className="bg-cyan-400 hover:bg-cyan-300 text-slate-950 font-semibold text-xs h-9 shadow-md shadow-cyan-950/40">
              <Plus className="size-4 mr-1.5" />
              New Policy Rule
            </Button>
          </Link>
        </div>


        {/* Top Metric Cards */}
        <div className="grid gap-4 px-6 md:px-6 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
          <Card className="border-white/10 bg-slate-900/60 backdrop-blur">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-xs font-semibold text-slate-400">
                Total Policies
              </CardTitle>
              <FileText className="size-4 text-cyan-400" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-white">{stats.total}</div>
              <p className="text-[11px] text-slate-400 mt-0.5">
                Corporate governance rules
              </p>
            </CardContent>
          </Card>

          <Card className="border-white/10 bg-slate-900/60 backdrop-blur">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-xs font-semibold text-slate-400">
                Active Enforcements
              </CardTitle>
              <ShieldCheck className="size-4 text-emerald-400" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-emerald-400">{stats.active}</div>
              <p className="text-[11px] text-slate-400 mt-0.5">
                Live rules checked by AI
              </p>
            </CardContent>
          </Card>

          <Card className="border-white/10 bg-slate-900/60 backdrop-blur">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-xs font-semibold text-slate-400">
                Critical / High Rules
              </CardTitle>
              <ShieldAlert className="size-4 text-rose-400" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-rose-400">{stats.critical}</div>
              <p className="text-[11px] text-slate-400 mt-0.5">
                Strict forensic flags
              </p>
            </CardContent>
          </Card>

          <Card className="border-white/10 bg-slate-900/60 backdrop-blur">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-xs font-semibold text-slate-400">
                Categories Covered
              </CardTitle>
              <Building className="size-4 text-purple-400" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-purple-400">
                {stats.categoriesCount}
              </div>
              <p className="text-[11px] text-slate-400 mt-0.5">
                Expense & Tax Domains
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Filter and Search Bar */}
        <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 bg-slate-900/60 border border-white/10 p-3.5 mx-6 md:mx-6  rounded-xl backdrop-blur">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-slate-400" />
            <Input
              placeholder="Search by policy code, title, or keyword..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 bg-slate-950/60 border-white/10 text-slate-100 placeholder:text-slate-500 text-xs h-9"
            />
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            {/* Category Filter */}
            <div className="w-40">
              <Select value={selectedCategory} onValueChange={(val) => val && setSelectedCategory(val)}>
                <SelectTrigger className="w-full bg-slate-950/60 border-white/10 text-slate-200 text-xs h-9">
                  <SelectValue placeholder="All Categories" />
                </SelectTrigger>
                <SelectContent className="border-white/10 bg-slate-900 text-slate-100">
                  <SelectGroup>
                    <SelectLabel className="text-slate-400 text-xs">Categories</SelectLabel>
                    <SelectItem value="ALL">All Categories</SelectItem>
                    <SelectItem value="THRESHOLD">Threshold Limit</SelectItem>
                    <SelectItem value="TRAVEL">Travel & Dining</SelectItem>
                    <SelectItem value="PROCUREMENT">Procurement</SelectItem>
                    <SelectItem value="TAX">Tax & Legal</SelectItem>
                    <SelectItem value="GENERAL">General Conduct</SelectItem>
                  </SelectGroup>
                </SelectContent>
              </Select>
            </div>

            {/* Status Filter */}
            <div className="w-36">
              <Select value={statusFilter} onValueChange={(val) => val && setStatusFilter(val)}>
                <SelectTrigger className="w-full bg-slate-950/60 border-white/10 text-slate-200 text-xs h-9">
                  <SelectValue placeholder="All Status" />
                </SelectTrigger>
                <SelectContent className="border-white/10 bg-slate-900 text-slate-100">
                  <SelectGroup>
                    <SelectLabel className="text-slate-400 text-xs">Status</SelectLabel>
                    <SelectItem value="ALL">All Statuses</SelectItem>
                    <SelectItem value="ACTIVE">Active Only</SelectItem>
                    <SelectItem value="INACTIVE">Inactive Only</SelectItem>
                  </SelectGroup>
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        {/* Error Alert */}
        {errorMsg && (
          <div className="rounded-xl px-6 md:px-6 border border-red-500/30 bg-red-500/10 p-3.5 text-xs text-red-200 flex items-center mx-6 md:mx-6 gap-2">
            <AlertTriangle className="size-4 text-red-400 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* Policies Data Table */}
        <Card className="border-white/10 px-6 md:px6 mx-6 md:mx-6 bg-slate-900/60 backdrop-blur overflow-hidden">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader className="bg-slate-950/60">
                <TableRow className="border-white/10 hover:bg-transparent">
                  <TableHead className="text-slate-300 font-semibold text-xs w-[140px]">
                    Policy Code
                  </TableHead>
                  <TableHead className="text-slate-300 font-semibold text-xs">
                    Policy Title & Details
                  </TableHead>
                  <TableHead className="text-slate-300 font-semibold text-xs">
                    Category
                  </TableHead>
                  <TableHead className="text-slate-300 font-semibold text-xs">
                    Max Threshold
                  </TableHead>
                  <TableHead className="text-slate-300 font-semibold text-xs">
                    Severity
                  </TableHead>
                  <TableHead className="text-slate-300 font-semibold text-xs">
                    Department
                  </TableHead>
                  <TableHead className="text-slate-300 font-semibold text-xs">
                    Status
                  </TableHead>
                  <TableHead className="text-slate-300 font-semibold text-xs text-right">
                    Actions
                  </TableHead>
                </TableRow>
              </TableHeader>

              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={8} className="h-40 text-center text-slate-400">
                      <div className="flex flex-col items-center justify-center gap-2">
                        <Loader2 className="size-6 animate-spin text-cyan-400" />
                        <span className="text-xs">Loading compliance policies...</span>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : filteredPolicies.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="h-40 text-center text-slate-400">
                      <div className="flex flex-col items-center justify-center gap-2">
                        <Scale className="size-8 text-slate-600" />
                        <span className="text-sm font-medium text-slate-300">
                          No compliance policies found.
                        </span>
                        <p className="text-xs text-slate-500">
                          Try adjusting search queries or click "New Policy Rule" to add one.
                        </p>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredPolicies.map((p) => (
                    <TableRow
                      key={p.id}
                      className="border-white/10 hover:bg-slate-800/40 transition-colors"
                    >
                      {/* Code */}
                      <TableCell className="font-mono text-xs font-semibold text-cyan-300">
                        {p.policy_code}
                      </TableCell>

                      {/* Title & Description */}
                      <TableCell className="max-w-md">
                        <div className="font-semibold text-sm text-white">
                          {p.title}
                        </div>
                        <div className="text-xs text-slate-400 line-clamp-2 mt-0.5">
                          {p.description}
                        </div>
                      </TableCell>

                      {/* Category */}
                      <TableCell>
                        <span
                          className={`inline-flex items-center rounded-md border px-2 py-0.5 text-[11px] font-semibold ${getCategoryBadge(
                            p.category
                          )}`}
                        >
                          {p.category}
                        </span>
                      </TableCell>

                      {/* Threshold */}
                      <TableCell className="text-xs font-medium text-slate-200">
                        {p.max_amount !== null ? (
                          <span className="font-mono">
                            ${Number(p.max_amount).toLocaleString("en-US", { minimumFractionDigits: 2 })}{" "}
                            <span className="text-[10px] text-slate-400">{p.currency}</span>
                          </span>
                        ) : (
                          <span className="text-slate-500 italic">No limit (Rule)</span>
                        )}
                      </TableCell>

                      {/* Severity */}
                      <TableCell>
                        <span
                          className={`inline-flex items-center rounded-md border px-2 py-0.5 text-[10px] font-bold ${getSeverityBadge(
                            p.severity
                          )}`}
                        >
                          {p.severity}
                        </span>
                      </TableCell>

                      {/* Department */}
                      <TableCell className="text-xs text-slate-300">
                        {p.department || "All"}
                      </TableCell>

                      {/* Active Status */}
                      <TableCell>
                        <button
                          type="button"
                          onClick={() => handleToggleStatus(p)}
                          className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-semibold border transition-all cursor-pointer ${p.is_active
                            ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/40 hover:bg-emerald-500/30"
                            : "bg-slate-800 text-slate-400 border-white/10 hover:bg-slate-700"
                            }`}
                        >
                          <span
                            className={`size-1.5 rounded-full ${p.is_active ? "bg-emerald-400 animate-pulse" : "bg-slate-500"
                              }`}
                          />
                          {p.is_active ? "Active" : "Disabled"}
                        </button>
                      </TableCell>

                      {/* Actions */}
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <Link href={`/dashboard/compliance/edit/${p.id}`}>
                            <Button
                              variant="ghost"
                              size="icon-sm"
                              className="text-slate-400 hover:text-cyan-300 hover:bg-cyan-500/10 size-8"
                              title="Edit Policy"
                            >
                              <Edit className="size-3.5" />
                            </Button>
                          </Link>
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            onClick={() => {
                              setSelectedPolicy(p);
                              setIsDeleteOpen(true);
                            }}
                            className="text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 size-8"
                            title="Delete Policy"
                          >
                            <Trash2 className="size-3.5" />
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
        {/* CREATE POLICY MODAL */}
        {/* ========================================================================= */}
        <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
          <DialogContent className="sm:max-w-lg border-white/10 bg-slate-900 text-slate-100 backdrop-blur-xl">
            <form onSubmit={handleCreatePolicy}>
              <DialogHeader>
                <DialogTitle className="text-lg font-bold text-white flex items-center gap-2">
                  <Scale className="size-5 text-cyan-400" /> Create Compliance Policy
                </DialogTitle>
                <DialogDescription className="text-xs text-slate-400">
                  Define a new corporate expenditure rule to be evaluated automatically during invoice extraction.
                </DialogDescription>
              </DialogHeader>

              <div className="grid gap-3 py-3 text-xs">
                <div>
                  <label className="text-slate-200 font-semibold block mb-1">
                    Policy Title <span className="text-cyan-400">*</span>
                  </label>
                  <Input
                    name="title"
                    value={formData.title}
                    onChange={handleInputChange}
                    placeholder="e.g. Executive Hotel Nightly Cap"
                    required
                    className="bg-slate-950/60 border-white/10 text-slate-100 text-xs h-9"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-slate-200 font-semibold block mb-1">
                      Policy Code (Optional)
                    </label>
                    <Input
                      name="policy_code"
                      value={formData.policy_code}
                      onChange={handleInputChange}
                      placeholder="e.g. POL-HOTEL-001"
                      className="bg-slate-950/60 border-white/10 text-slate-100 text-xs h-9 font-mono"
                    />
                  </div>

                  <div>
                    <label className="text-slate-200 font-semibold block mb-1">
                      Category
                    </label>
                    <select
                      value={formData.category}
                      onChange={(e) => setFormData((prev) => ({ ...prev, category: e.target.value }))}
                      className="w-full h-9 rounded-md border border-white/10 bg-slate-950/60 px-3 text-xs text-slate-200 focus:outline-none focus:ring-2 focus:ring-cyan-500"
                    >
                      <option value="THRESHOLD">Threshold</option>
                      <option value="TRAVEL">Travel & Dining</option>
                      <option value="PROCUREMENT">Procurement</option>
                      <option value="TAX">Tax & Compliance</option>
                      <option value="GENERAL">General</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-slate-200 font-semibold block mb-1">
                      Max Amount Threshold ($)
                    </label>
                    <Input
                      name="max_amount"
                      type="number"
                      step="0.01"
                      value={formData.max_amount}
                      onChange={handleInputChange}
                      placeholder="e.g. 5000.00"
                      className="bg-slate-950/60 border-white/10 text-slate-100 text-xs h-9"
                    />
                  </div>

                  <div>
                    <label className="text-slate-200 font-semibold block mb-1">
                      Severity on Violation
                    </label>
                    <select
                      value={formData.severity}
                      onChange={(e) => setFormData((prev) => ({ ...prev, severity: e.target.value }))}
                      className="w-full h-9 rounded-md border border-white/10 bg-slate-950/60 px-3 text-xs text-slate-200 focus:outline-none focus:ring-2 focus:ring-cyan-500"
                    >
                      <option value="CRITICAL">CRITICAL (Red Flag)</option>
                      <option value="HIGH">HIGH (Escalated Review)</option>
                      <option value="MEDIUM">MEDIUM (Manager Sign-Off)</option>
                      <option value="LOW">LOW (Notice Only)</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-slate-200 font-semibold block mb-1">
                      Applicable Department
                    </label>
                    <Input
                      name="department"
                      value={formData.department}
                      onChange={handleInputChange}
                      placeholder="e.g. All, Finance, Engineering"
                      className="bg-slate-950/60 border-white/10 text-slate-100 text-xs h-9"
                    />
                  </div>

                  <div>
                    <label className="text-slate-200 font-semibold block mb-1">
                      Rule Type
                    </label>
                    <select
                      value={formData.rule_type}
                      onChange={(e) => setFormData((prev) => ({ ...prev, rule_type: e.target.value }))}
                      className="w-full h-9 rounded-md border border-white/10 bg-slate-950/60 px-3 text-xs text-slate-200 focus:outline-none focus:ring-2 focus:ring-cyan-500"
                    >
                      <option value="MAX_AMOUNT">Maximum Amount Limit</option>
                      <option value="CATEGORY_RESTRICTION">Category Restriction</option>
                      <option value="VENDOR_RESTRICTION">Vendor Restriction</option>
                      <option value="MANDATORY_DOCUMENT">Mandatory Compliance Doc</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="text-slate-200 font-semibold block mb-1">
                    Rule Description & Audit Standard <span className="text-cyan-400">*</span>
                  </label>
                  <textarea
                    name="description"
                    rows={3}
                    value={formData.description}
                    onChange={handleInputChange}
                    placeholder="Describe exact criteria, authorization limits, and exception conditions..."
                    required
                    className="w-full rounded-md border border-white/10 bg-slate-950/60 p-2.5 text-xs text-slate-100 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-500"
                  />
                </div>
              </div>

              <DialogFooter className="gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsCreateOpen(false)}
                  className="border-white/10 bg-slate-950/50 text-slate-300 text-xs"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={submitting}
                  className="bg-cyan-400 hover:bg-cyan-300 text-slate-950 font-semibold text-xs"
                >
                  {submitting ? <Loader2 className="size-3.5 animate-spin mr-1.5" /> : null}
                  Create Policy
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>

        {/* ========================================================================= */}
        {/* EDIT POLICY MODAL */}
        {/* ========================================================================= */}
        <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
          <DialogContent className="sm:max-w-lg border-white/10 bg-slate-900 text-slate-100 backdrop-blur-xl">
            <form onSubmit={handleUpdatePolicy}>
              <DialogHeader>
                <DialogTitle className="text-lg font-bold text-white flex items-center gap-2">
                  <Edit className="size-5 text-cyan-400" /> Edit Policy: {selectedPolicy?.policy_code}
                </DialogTitle>
                <DialogDescription className="text-xs text-slate-400">
                  Update compliance limits or enforcement criteria.
                </DialogDescription>
              </DialogHeader>

              <div className="grid gap-3 py-3 text-xs">
                <div>
                  <label className="text-slate-200 font-semibold block mb-1">
                    Policy Title
                  </label>
                  <Input
                    name="title"
                    value={formData.title}
                    onChange={handleInputChange}
                    required
                    className="bg-slate-950/60 border-white/10 text-slate-100 text-xs h-9"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-slate-200 font-semibold block mb-1">
                      Category
                    </label>
                    <select
                      value={formData.category}
                      onChange={(e) => setFormData((prev) => ({ ...prev, category: e.target.value }))}
                      className="w-full h-9 rounded-md border border-white/10 bg-slate-950/60 px-3 text-xs text-slate-200 focus:outline-none focus:ring-2 focus:ring-cyan-500"
                    >
                      <option value="THRESHOLD">Threshold</option>
                      <option value="TRAVEL">Travel & Dining</option>
                      <option value="PROCUREMENT">Procurement</option>
                      <option value="TAX">Tax & Compliance</option>
                      <option value="GENERAL">General</option>
                    </select>
                  </div>

                  <div>
                    <label className="text-slate-200 font-semibold block mb-1">
                      Severity
                    </label>
                    <select
                      value={formData.severity}
                      onChange={(e) => setFormData((prev) => ({ ...prev, severity: e.target.value }))}
                      className="w-full h-9 rounded-md border border-white/10 bg-slate-950/60 px-3 text-xs text-slate-200 focus:outline-none focus:ring-2 focus:ring-cyan-500"
                    >
                      <option value="CRITICAL">CRITICAL</option>
                      <option value="HIGH">HIGH</option>
                      <option value="MEDIUM">MEDIUM</option>
                      <option value="LOW">LOW</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-slate-200 font-semibold block mb-1">
                      Max Amount Threshold ($)
                    </label>
                    <Input
                      name="max_amount"
                      type="number"
                      step="0.01"
                      value={formData.max_amount}
                      onChange={handleInputChange}
                      className="bg-slate-950/60 border-white/10 text-slate-100 text-xs h-9"
                    />
                  </div>

                  <div>
                    <label className="text-slate-200 font-semibold block mb-1">
                      Applicable Department
                    </label>
                    <Input
                      name="department"
                      value={formData.department}
                      onChange={handleInputChange}
                      className="bg-slate-950/60 border-white/10 text-slate-100 text-xs h-9"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-slate-200 font-semibold block mb-1">
                    Rule Description
                  </label>
                  <textarea
                    name="description"
                    rows={3}
                    value={formData.description}
                    onChange={handleInputChange}
                    required
                    className="w-full rounded-md border border-white/10 bg-slate-950/60 p-2.5 text-xs text-slate-100 focus:outline-none focus:ring-2 focus:ring-cyan-500"
                  />
                </div>
              </div>

              <DialogFooter className="gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsEditOpen(false)}
                  className="border-white/10 bg-slate-950/50 text-slate-300 text-xs"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={submitting}
                  className="bg-cyan-400 hover:bg-cyan-300 text-slate-950 font-semibold text-xs"
                >
                  {submitting ? <Loader2 className="size-3.5 animate-spin mr-1.5" /> : null}
                  Save Changes
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>

        {/* ========================================================================= */}
        {/* DELETE CONFIRMATION MODAL */}
        {/* ========================================================================= */}
        <Dialog open={isDeleteOpen} onOpenChange={setIsDeleteOpen}>
          <DialogContent className="sm:max-w-md border-rose-500/30 bg-slate-900 text-slate-100 backdrop-blur-xl">
            <DialogHeader>
              <DialogTitle className="text-lg font-bold text-white flex items-center gap-2">
                <Trash2 className="size-5 text-rose-400" /> Delete Policy Rule?
              </DialogTitle>
              <DialogDescription className="text-xs text-slate-300">
                Are you sure you want to permanently delete{" "}
                <span className="font-semibold text-rose-300">
                  {selectedPolicy?.policy_code} - {selectedPolicy?.title}
                </span>
                ? This rule will no longer be evaluated by the AI agents.
              </DialogDescription>
            </DialogHeader>

            <DialogFooter className="gap-2 mt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsDeleteOpen(false)}
                className="border-white/10 bg-slate-950/50 text-slate-300 text-xs"
              >
                Cancel
              </Button>
              <Button
                type="button"
                onClick={handleDeletePolicy}
                disabled={submitting}
                className="bg-rose-500 hover:bg-rose-600 text-white font-semibold text-xs"
              >
                {submitting ? <Loader2 className="size-3.5 animate-spin mr-1.5" /> : null}
                Confirm Deletion
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </AuthProvider>
  );
}
