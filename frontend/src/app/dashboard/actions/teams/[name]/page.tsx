"use client";

import React, { useEffect, useState, useMemo } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import axios from "@/store/axios";
import { isAxiosError } from "axios";
import {
  Users,
  Shield,
  Briefcase,
  Search,
  ArrowLeft,
  RefreshCw,
  Mail,
  Calendar,
  UserCheck,
  AlertCircle,
  Clock,
  Sparkles,
} from "lucide-react";
import {
  SidebarInset,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import { Separator } from "@/components/ui/separator";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface TeamMember {
  id: string;
  name: string;
  email: string;
  department: string | null;
  role: string;
  created_at: string | null;
}

interface TeamDetail {
  team_name: string;
  member_count: number;
  members: TeamMember[];
}

export default function TeamDetailsPage() {
  const params = useParams();
  const router = useRouter();

  // Decode the URL parameter (e.g. "Finance", "procurement")
  const rawName = Array.isArray(params?.name) ? params.name[0] : params?.name || "";
  const teamName = decodeURIComponent(rawName);

  const [teamData, setTeamData] = useState<TeamDetail | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [roleFilter, setRoleFilter] = useState<string>("ALL");

  const fetchTeamDetails = async (isRefresh = false) => {
    if (!teamName) return;
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    setErrorMessage(null);

    try {
      // Call the backend endpoint: GET /api/v1/admin/teams/{team_name}
      const response = await axios.get<TeamDetail>(`/admin/teams/${encodeURIComponent(teamName)}`);
      setTeamData(response.data);
    } catch (err: unknown) {
      if (isAxiosError(err)) {
        if (err.response?.status === 401) {
          setErrorMessage("Unauthorized. Please log in to view department members.");
        } else if (err.response?.status === 404) {
          setErrorMessage(`Department '${teamName}' not found or has no assigned members.`);
        } else {
          setErrorMessage(err.response?.data?.detail || "Failed to load department details.");
        }
      } else {
        setErrorMessage("An unexpected error occurred while fetching department data.");
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchTeamDetails();
  }, [teamName]);

  // Filtered members list based on search and selected role filter
  const filteredMembers = useMemo(() => {
    if (!teamData?.members) return [];
    return teamData.members.filter((member) => {
      const matchesSearch =
        member.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        member.email.toLowerCase().includes(searchQuery.toLowerCase());

      const matchesRole =
        roleFilter === "ALL" || member.role.toUpperCase() === roleFilter.toUpperCase();

      return matchesSearch && matchesRole;
    });
  }, [teamData, searchQuery, roleFilter]);

  // Compute role breakdown counts
  const roleCounts = useMemo(() => {
    if (!teamData?.members) return { managers: 0, employees: 0, auditors: 0, others: 0 };
    return teamData.members.reduce(
      (acc, member) => {
        const role = (member.role || "").toUpperCase();
        if (role === "MANAGER") acc.managers++;
        else if (role === "EMPLOYEE") acc.employees++;
        else if (role === "AUDITOR") acc.auditors++;
        else acc.others++;
        return acc;
      },
      { managers: 0, employees: 0, auditors: 0, others: 0 }
    );
  }, [teamData]);

  // Helper for role pill style
  const getRoleBadgeStyle = (role: string) => {
    const r = (role || "").toUpperCase();
    switch (r) {
      case "MANAGER":
        return "bg-amber-500/10 text-amber-300 border-amber-500/30";
      case "AUDITOR":
        return "bg-purple-500/10 text-purple-300 border-purple-500/30";
      case "ADMIN":
        return "bg-rose-500/10 text-rose-300 border-rose-500/30";
      default:
        return "bg-cyan-500/10 text-cyan-300 border-cyan-500/30";
    }
  };

  return (
    <SidebarInset className="bg-slate-950 text-slate-100 min-h-screen">
      {/* Top Header & Breadcrumb Navigation */}
      <header className="sticky top-0 z-10 flex h-16 shrink-0 items-center justify-between border-b border-white/10 bg-slate-950/80 px-4 md:px-6 backdrop-blur">
        <div className="flex items-center gap-2">
          <SidebarTrigger className="-ml-1 text-slate-400 hover:text-white" />
          <Separator orientation="vertical" className="mr-2 h-4 bg-white/10" />
          <Breadcrumb>
            <BreadcrumbList>
              <BreadcrumbItem>
                <BreadcrumbLink href="/dashboard" className="text-slate-400 hover:text-white">
                  Dashboard
                </BreadcrumbLink>
              </BreadcrumbItem>
              <BreadcrumbSeparator className="text-slate-600" />
              <BreadcrumbItem>
                <BreadcrumbLink href="/dashboard/actions/teams" className="text-slate-400 hover:text-white">
                  Department
                </BreadcrumbLink>
              </BreadcrumbItem>
              <BreadcrumbSeparator className="text-slate-600" />
              <BreadcrumbItem>
                <BreadcrumbPage className="font-semibold text-cyan-300 capitalize">
                  {teamName || "Department Details"}
                </BreadcrumbPage>
              </BreadcrumbItem>
            </BreadcrumbList>
          </Breadcrumb>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => fetchTeamDetails(true)}
            disabled={refreshing || loading}
            className="border-white/10 bg-slate-900/60 text-xs text-slate-300 hover:bg-slate-800 hover:text-white"
          >
            <RefreshCw className={`size-3.5 mr-1.5 ${refreshing ? "animate-spin text-cyan-400" : ""}`} />
            Refresh
          </Button>
          <Link href="/dashboard/actions/teams">
            <Button
              variant="outline"
              size="sm"
              className="border-white/10 bg-slate-900/60 text-xs text-slate-300 hover:bg-slate-800 hover:text-white"
            >
              <ArrowLeft className="size-3.5 mr-1.5" />
              Back to Department
            </Button>
          </Link>
        </div>
      </header>

      {/* Main Content Body */}
      <main className="flex flex-1 flex-col gap-6 p-4 md:p-8 max-w-7xl mx-auto w-full">
        {/* Banner Section */}
        <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-r from-cyan-950/40 via-slate-900/80 to-slate-900/40 p-6 md:p-8 backdrop-blur shadow-xl">
          <div className="absolute right-0 top-0 -mr-10 -mt-10 size-52 rounded-full bg-cyan-500/10 blur-3xl pointer-events-none" />
          <div className="relative z-10 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border border-cyan-500/30 bg-cyan-500/10 px-3 py-1 text-xs font-medium text-cyan-300 mb-3">
                <Sparkles className="size-3" />
                Department Workspace
              </div>
              <h1 className="text-3xl md:text-4xl font-bold tracking-tight text-white capitalize">
                {teamName} Department
              </h1>
              <p className="mt-1.5 text-sm text-slate-400 max-w-xl">
                Manage members, roles, and invoice review assignments for the{" "}
                <span className="font-semibold text-slate-200 capitalize">{teamName}</span> department.
              </p>
            </div>

            {teamData && (
              <div className="flex items-center gap-3 self-start md:self-auto bg-slate-950/70 border border-white/10 rounded-xl px-4 py-3">
                <div className="flex size-10 items-center justify-center rounded-lg bg-cyan-500/20 text-cyan-300">
                  <Users className="size-5" />
                </div>
                <div>
                  <div className="text-2xl font-bold text-white">{teamData.member_count}</div>
                  <div className="text-xs text-slate-400">Total Members</div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Loading State */}
        {loading && (
          <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-4">
            {[1, 2, 3, 4].map((n) => (
              <div
                key={n}
                className="h-24 animate-pulse rounded-xl border border-white/5 bg-slate-900/50"
              />
            ))}
          </div>
        )}

        {/* Error State */}
        {!loading && errorMessage && (
          <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-6 text-center">
            <AlertCircle className="size-8 text-red-400 mx-auto mb-3" />
            <h3 className="text-lg font-semibold text-red-200">Unable to load Department</h3>
            <p className="mt-1 text-sm text-red-300/80 max-w-md mx-auto">{errorMessage}</p>
            <div className="mt-4 flex justify-center gap-3">
              <Button
                variant="outline"
                size="sm"
                onClick={() => fetchTeamDetails()}
                className="border-red-500/30 text-red-200 hover:bg-red-500/20"
              >
                Retry
              </Button>
              <Link href="/dashboard/actions/teams">
                <Button size="sm" className="bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-medium">
                  View All Departments
                </Button>
              </Link>
            </div>
          </div>
        )}

        {/* Loaded Data View */}
        {!loading && !errorMessage && teamData && (
          <>
            {/* Stats Metrics Row */}
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <div className="rounded-xl border border-white/10 bg-slate-900/60 p-4 backdrop-blur shadow-sm">
                <div className="flex items-center justify-between text-xs text-slate-400">
                  <span>Total Members</span>
                  <Users className="size-4 text-cyan-400" />
                </div>
                <div className="mt-2 text-2xl font-bold text-white">{teamData.member_count}</div>
                <div className="mt-1 text-xs text-emerald-400 flex items-center gap-1">
                  <UserCheck className="size-3" /> All active
                </div>
              </div>

              <div className="rounded-xl border border-white/10 bg-slate-900/60 p-4 backdrop-blur shadow-sm">
                <div className="flex items-center justify-between text-xs text-slate-400">
                  <span>Managers</span>
                  <Briefcase className="size-4 text-amber-400" />
                </div>
                <div className="mt-2 text-2xl font-bold text-white">{roleCounts.managers}</div>
                <div className="mt-1 text-xs text-slate-400">Approval authority</div>
              </div>

              <div className="rounded-xl border border-white/10 bg-slate-900/60 p-4 backdrop-blur shadow-sm">
                <div className="flex items-center justify-between text-xs text-slate-400">
                  <span>Auditors</span>
                  <Shield className="size-4 text-purple-400" />
                </div>
                <div className="mt-2 text-2xl font-bold text-white">{roleCounts.auditors}</div>
                <div className="mt-1 text-xs text-slate-400">Compliance & Review</div>
              </div>

              <div className="rounded-xl border border-white/10 bg-slate-900/60 p-4 backdrop-blur shadow-sm">
                <div className="flex items-center justify-between text-xs text-slate-400">
                  <span>Employees</span>
                  <Users className="size-4 text-cyan-400" />
                </div>
                <div className="mt-2 text-2xl font-bold text-white">{roleCounts.employees}</div>
                <div className="mt-1 text-xs text-slate-400">Standard submitters</div>
              </div>
            </div>

            {/* Filter & Search Bar */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 rounded-xl border border-white/10 bg-slate-900/70 p-4 backdrop-blur">
              <div className="relative flex-1 max-w-md">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-slate-400" />
                <Input
                  type="text"
                  placeholder="Search members by name or email..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9 bg-slate-950/60 border-white/10 text-slate-200 placeholder:text-slate-500 focus-visible:ring-cyan-500"
                />
              </div>

              {/* Role filter buttons */}
              <div className="flex flex-wrap items-center gap-1.5 text-xs">
                <span className="text-slate-400 mr-1 hidden sm:inline">Role:</span>
                {["ALL", "EMPLOYEE", "MANAGER", "AUDITOR"].map((role) => (
                  <button
                    key={role}
                    onClick={() => setRoleFilter(role)}
                    className={`rounded-lg px-3 py-1.5 font-medium transition-all ${roleFilter === role
                      ? "bg-cyan-500 text-slate-950 shadow-md font-semibold"
                      : "bg-slate-950/60 border border-white/10 text-slate-400 hover:text-white hover:bg-slate-800"
                      }`}
                  >
                    {role === "ALL" ? "All Roles" : role.charAt(0) + role.slice(1).toLowerCase()}
                  </button>
                ))}
              </div>
            </div>

            {/* Members List Table / Cards */}
            <div className="rounded-xl border border-white/10 bg-slate-900/70 backdrop-blur shadow-sm overflow-hidden">
              <div className="px-6 py-4 border-b border-white/10 flex items-center justify-between">
                <div>
                  <h2 className="text-base font-semibold text-white">Department Roster</h2>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Showing {filteredMembers.length} of {teamData.members.length} members
                  </p>
                </div>
              </div>

              {filteredMembers.length === 0 ? (
                <div className="p-12 text-center">
                  <Users className="size-10 text-slate-600 mx-auto mb-3" />
                  <p className="text-slate-300 font-medium">No members found</p>
                  <p className="text-xs text-slate-500 mt-1">
                    Try adjusting your search query or role filter.
                  </p>
                  {(searchQuery || roleFilter !== "ALL") && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setSearchQuery("");
                        setRoleFilter("ALL");
                      }}
                      className="mt-4 border-white/10 text-xs text-slate-300"
                    >
                      Clear Filters
                    </Button>
                  )}
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead>
                      <tr className="border-b border-white/10 bg-slate-950/40 text-xs font-semibold uppercase tracking-wider text-slate-400">
                        <th className="py-3.5 pl-6 pr-4">Member</th>
                        <th className="py-3.5 px-4">Role</th>
                        <th className="py-3.5 px-4">Department</th>
                        <th className="py-3.5 px-4">Joined Date</th>
                        <th className="py-3.5 pr-6 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                      {filteredMembers.map((member) => {
                        const initial = (member.name || member.email || "U")
                          .charAt(0)
                          .toUpperCase();

                        const formattedDate = member.created_at
                          ? new Date(member.created_at).toLocaleDateString("en-US", {
                            month: "short",
                            day: "numeric",
                            year: "numeric",
                          })
                          : "N/A";

                        return (
                          <tr
                            key={member.id}
                            className="hover:bg-white/[0.02] transition-colors group"
                          >
                            {/* Member Info */}
                            <td className="py-3.5 pl-6 pr-4">
                              <div className="flex items-center gap-3">
                                <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-tr from-cyan-600 to-blue-600 font-semibold text-white text-xs shadow-inner">
                                  {initial}
                                </div>
                                <div>
                                  <div className="font-medium text-white group-hover:text-cyan-300 transition-colors">
                                    {member.name || "Unnamed Member"}
                                  </div>
                                  <div className="text-xs text-slate-400 flex items-center gap-1.5 mt-0.5">
                                    <Mail className="size-3 text-slate-500" />
                                    {member.email}
                                  </div>
                                </div>
                              </div>
                            </td>

                            {/* Role Badge */}
                            <td className="py-3.5 px-4">
                              <span
                                className={`inline-flex items-center gap-1 rounded-md border px-2.5 py-0.5 text-xs font-medium ${getRoleBadgeStyle(
                                  member.role
                                )}`}
                              >
                                {member.role}
                              </span>
                            </td>

                            {/* Department */}
                            <td className="py-3.5 px-4">
                              <span className="text-xs text-slate-300 capitalize">
                                {member.department || teamName}
                              </span>
                            </td>

                            {/* Joined Date */}
                            <td className="py-3.5 px-4">
                              <div className="text-xs text-slate-400 flex items-center gap-1.5">
                                <Calendar className="size-3 text-slate-500" />
                                {formattedDate}
                              </div>
                            </td>

                            {/* Actions */}
                            <td className="py-3.5 pr-6 text-right">
                              <a
                                href={`mailto:${member.email}`}
                                className="inline-flex items-center justify-center size-8 rounded-lg border border-white/10 bg-slate-950/60 text-slate-400 hover:text-cyan-300 hover:border-cyan-500/40 hover:bg-slate-900 transition-colors"
                                title={`Email ${member.name || member.email}`}
                              >
                                <Mail className="size-3.5" />
                              </a>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </>
        )}
      </main>
    </SidebarInset>
  );
}
