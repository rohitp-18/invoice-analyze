"use client";

import React, { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import axios from "@/store/axios";
import { isAxiosError } from "axios";
import {
  Users,
  Shield,
  Briefcase,
  Search,
  ArrowRight,
  RefreshCw,
  Plus,
  AlertCircle,
  Building2,
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

interface TeamItem {
  team_name: string;
  member_count: number;
}

export default function TeamsOverviewPage() {
  const [teams, setTeams] = useState<TeamItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState<string>("");

  const fetchTeams = async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    setErrorMessage(null);

    try {
      // Call backend API: GET /api/v1/admin/teams
      const response = await axios.get<TeamItem[]>("/admin/teams");
      setTeams(response.data);
    } catch (err: unknown) {
      if (isAxiosError(err)) {
        if (err.response?.status === 401) {
          setErrorMessage("Unauthorized. Please log in to access teams.");
        } else {
          setErrorMessage(err.response?.data?.detail || "Failed to load teams list.");
        }
      } else {
        setErrorMessage("An unexpected error occurred while fetching teams.");
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchTeams();
  }, []);

  const filteredTeams = useMemo(() => {
    return teams.filter((team) =>
      team.team_name.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [teams, searchQuery]);

  const totalMembers = useMemo(() => {
    return teams.reduce((acc, t) => acc + t.member_count, 0);
  }, [teams]);

  // Dynamic icon based on team name
  const getTeamIcon = (name: string) => {
    const n = name.toLowerCase();
    if (n.includes("finance")) return <Briefcase className="size-5 text-emerald-400" />;
    if (n.includes("compliance") || n.includes("audit"))
      return <Shield className="size-5 text-purple-400" />;
    if (n.includes("procurement"))
      return <Building2 className="size-5 text-amber-400" />;
    return <Users className="size-5 text-cyan-400" />;
  };

  return (
    <SidebarInset className="bg-slate-950 text-slate-100 min-h-screen">
      {/* Header */}
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
                <BreadcrumbPage className="font-semibold text-cyan-300">
                  Departments
                </BreadcrumbPage>
              </BreadcrumbItem>
            </BreadcrumbList>
          </Breadcrumb>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => fetchTeams(true)}
            disabled={refreshing || loading}
            className="border-white/10 bg-slate-900/60 text-xs text-slate-300 hover:bg-slate-800 hover:text-white"
          >
            <RefreshCw className={`size-3.5 mr-1.5 ${refreshing ? "animate-spin text-cyan-400" : ""}`} />
            Refresh
          </Button>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex flex-1 flex-col gap-6 p-4 md:p-8 max-w-7xl mx-auto w-full">
        {/* Banner */}
        <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-r from-blue-950/40 via-slate-900/80 to-cyan-950/40 p-6 md:p-8 backdrop-blur shadow-xl">
          <div className="absolute right-0 top-0 -mr-10 -mt-10 size-52 rounded-full bg-blue-500/10 blur-3xl pointer-events-none" />
          <div className="relative z-10 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border border-cyan-500/30 bg-cyan-500/10 px-3 py-1 text-xs font-medium text-cyan-300 mb-3">
                <Sparkles className="size-3" />
                Organization Directory
              </div>
              <h1 className="text-3xl md:text-4xl font-bold tracking-tight text-white">
                Departments
              </h1>
              <p className="mt-1.5 text-sm text-slate-400 max-w-xl">
                Browse department, monitor member distributions, and manage departmental permissions and invoice approval workflows.
              </p>
            </div>

            <div className="flex items-center gap-4 bg-slate-950/70 border border-white/10 rounded-xl p-4 self-start md:self-auto">
              <div className="text-center pr-4 border-r border-white/10">
                <div className="text-2xl font-bold text-white">{teams.length}</div>
                <div className="text-xs text-slate-400">Total Department</div>
              </div>
              <div className="text-center pl-1">
                <div className="text-2xl font-bold text-cyan-400">{totalMembers}</div>
                <div className="text-xs text-slate-400">Total Personnel</div>
              </div>
            </div>
          </div>
        </div>

        {/* Search Bar */}
        <div className="flex items-center justify-between gap-4 rounded-xl border border-white/10 bg-slate-900/70 p-4 backdrop-blur">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-slate-400" />
            <Input
              type="text"
              placeholder="Search teams by name..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 bg-slate-950/60 border-white/10 text-slate-200 placeholder:text-slate-500 focus-visible:ring-cyan-500"
            />
          </div>
          <div className="text-xs text-slate-400">
            Showing {filteredTeams.length} of {teams.length} departments
          </div>
        </div>

        {/* Loading State */}
        {loading && (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {[1, 2, 3, 4, 5, 6].map((n) => (
              <div
                key={n}
                className="h-44 animate-pulse rounded-xl border border-white/5 bg-slate-900/50"
              />
            ))}
          </div>
        )}

        {/* Error State */}
        {!loading && errorMessage && (
          <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-6 text-center">
            <AlertCircle className="size-8 text-red-400 mx-auto mb-3" />
            <h3 className="text-lg font-semibold text-red-200">Unable to load departments</h3>
            <p className="mt-1 text-sm text-red-300/80 max-w-md mx-auto">{errorMessage}</p>
            <Button
              variant="outline"
              size="sm"
              onClick={() => fetchTeams()}
              className="mt-4 border-red-500/30 text-red-200 hover:bg-red-500/20"
            >
              Retry
            </Button>
          </div>
        )}

        {/* Teams Cards Grid */}
        {!loading && !errorMessage && (
          <>
            {filteredTeams.length === 0 ? (
              <div className="rounded-xl border border-white/10 bg-slate-900/70 p-12 text-center">
                <Users className="size-10 text-slate-600 mx-auto mb-3" />
                <p className="text-slate-300 font-medium">No department found</p>
                <p className="text-xs text-slate-500 mt-1">
                  {searchQuery ? "No department matched your search." : "No department have been created yet."}
                </p>
                {searchQuery && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setSearchQuery("")}
                    className="mt-4 border-white/10 text-xs text-slate-300"
                  >
                    Clear Search
                  </Button>
                )}
              </div>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {filteredTeams.map((team) => (
                  <div
                    key={team.team_name}
                    className="group relative flex flex-col justify-between rounded-xl border border-white/10 bg-slate-900/70 p-5 backdrop-blur transition-all duration-200 hover:border-cyan-500/40 hover:bg-slate-900 hover:shadow-lg hover:shadow-cyan-950/30"
                  >
                    <div>
                      <div className="flex items-center justify-between mb-4">
                        <div className="flex size-10 items-center justify-center rounded-lg bg-slate-950/80 border border-white/10 group-hover:border-cyan-500/30 transition-colors">
                          {getTeamIcon(team.team_name)}
                        </div>
                        <span className="inline-flex items-center gap-1 rounded-full bg-cyan-500/10 border border-cyan-500/20 px-2.5 py-0.5 text-xs font-semibold text-cyan-300">
                          <Users className="size-3" />
                          {team.member_count} {team.member_count === 1 ? "member" : "members"}
                        </span>
                      </div>

                      <h3 className="text-lg font-semibold text-white capitalize group-hover:text-cyan-300 transition-colors">
                        {team.team_name}
                      </h3>
                      <p className="mt-1 text-xs text-slate-400">
                        Department workspace & invoice routing group
                      </p>
                    </div>

                    <div className="mt-6 pt-4 border-t border-white/5 flex items-center justify-between">
                      <span className="text-xs text-slate-500 font-medium">
                        Active Workspace
                      </span>
                      <Link
                        href={`/dashboard/actions/teams/${encodeURIComponent(team.team_name)}`}
                      >
                        <Button
                          size="sm"
                          className="h-8 gap-1.5 bg-slate-950 border border-white/10 hover:bg-cyan-500 hover:text-slate-950 text-slate-200 text-xs transition-colors"
                        >
                          View Department
                          <ArrowRight className="size-3.5 group-hover:translate-x-0.5 transition-transform" />
                        </Button>
                      </Link>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </main>
    </SidebarInset>
  );
}
