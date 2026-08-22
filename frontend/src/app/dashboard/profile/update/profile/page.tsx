"use client";

import React, { useState, useEffect } from "react";
import { useSelector, useDispatch } from "react-redux";
import { AppDispatch, RootState } from "@/store/store";
import { setAuthState } from "@/store/authSlice";
import AuthProvider from "@/components/authProvider";
import axios from "@/store/axios";
import { isAxiosError } from "axios";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
	User as UserIcon,
	ArrowLeft,
	Save,
	Loader2,
	CheckCircle2,
	AlertCircle,
	Building,
	Mail,
	Shield,
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

export default function UpdateProfilePage() {
	const router = useRouter();
	const dispatch = useDispatch<AppDispatch>();
	const { user, role } = useSelector((state: RootState) => state.auth);

	const [name, setName] = useState<string>(user?.name || "");
	const [department, setDepartment] = useState<string>(user?.department || "Finance");
	const [submitting, setSubmitting] = useState<boolean>(false);
	const [successMsg, setSuccessMsg] = useState<string>("");
	const [errorMsg, setErrorMsg] = useState<string>("");

	useEffect(() => {
		if (user) {
			setName(user.name || "");
			setDepartment(user.department || "Finance");
		}
	}, [user]);

	const userRole = (role || user?.role || "EMPLOYEE").toUpperCase();

	const handleUpdate = async (e: React.FormEvent) => {
		e.preventDefault();
		setSuccessMsg("");
		setErrorMsg("");

		if (!name.trim()) {
			setErrorMsg("Full name cannot be empty.");
			return;
		}

		try {
			setSubmitting(true);
			const res = await axios.put("/auth/me", {
				name: name.trim(),
				department: department.trim(),
			});

			// Update Redux state
			dispatch(setAuthState(res.data));
			setSuccessMsg("Profile updated successfully!");

			setTimeout(() => {
				router.push("/dashboard/profile");
			}, 1200);
		} catch (err: unknown) {
			console.error("Profile update failed:", err);
			if (isAxiosError(err)) {
				setErrorMsg(err.response?.data?.detail || "Failed to update profile.");
			} else {
				setErrorMsg("An unexpected error occurred while updating profile.");
			}
		} finally {
			setSubmitting(false);
		}
	};

	return (
		<AuthProvider>
			<div className="flex-1 space-y-6 p-6 md:p-8 pt-6 min-h-screen bg-slate-950 text-slate-100">
				{/* Top Header */}
				<div className="flex items-center justify-between border-b border-white/10 pb-4">
					<div className="flex items-center gap-3">
						<Link
							href="/dashboard/profile"
							className="flex size-8 items-center justify-center rounded-lg border border-white/10 bg-slate-900 text-slate-300 hover:bg-slate-800 hover:text-white transition-colors"
						>
							<ArrowLeft className="size-4" />
						</Link>
						<div>
							<h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2">
								<UserIcon className="size-6 text-cyan-400" /> Edit Profile Information
							</h1>
							<p className="text-xs text-slate-400">
								Update your display name and corporate department assignment.
							</p>
						</div>
					</div>

					<div className="flex items-center gap-2">
						<Button
							variant="outline"
							onClick={() => router.push("/dashboard/profile")}
							className="border-white/10 bg-slate-900 text-slate-300 hover:bg-slate-800 text-xs h-9"
						>
							Cancel
						</Button>
						<Button
							onClick={handleUpdate}
							disabled={submitting}
							className="bg-cyan-400 hover:bg-cyan-300 text-slate-950 font-semibold text-xs h-9 shadow-md shadow-cyan-950/40"
						>
							{submitting ? (
								<>
									<Loader2 className="size-3.5 animate-spin mr-1.5" />
									Saving...
								</>
							) : (
								<>
									<Save className="size-3.5 mr-1.5" />
									Save Changes
								</>
							)}
						</Button>
					</div>
				</div>

				{/* Feedback Alerts */}
				{errorMsg && (
					<div className="rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-xs text-red-200 flex items-center gap-2.5 max-w-2xl">
						<AlertCircle className="size-4 text-red-400 shrink-0" />
						<span>{errorMsg}</span>
					</div>
				)}

				{successMsg && (
					<div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-4 text-xs text-emerald-200 flex items-center gap-2.5 max-w-2xl">
						<CheckCircle2 className="size-4 text-emerald-400 shrink-0" />
						<span>{successMsg}</span>
					</div>
				)}

				{/* Edit Form Card */}
				<div className="max-w-2xl">
					<Card className="border-white/10 bg-slate-900/60 backdrop-blur shadow-xl">
						<CardHeader className="pb-4 border-b border-white/10">
							<CardTitle className="text-base font-semibold text-white">
								Personal Information
							</CardTitle>
							<CardDescription className="text-xs text-slate-400">
								Modify your identity details and team classification across the organization.
							</CardDescription>
						</CardHeader>

						<CardContent className="p-6">
							<form onSubmit={handleUpdate} className="space-y-4 text-xs">
								{/* Full Name */}
								<div>
									<label className="text-slate-200 font-semibold block mb-1.5">
										Full Name <span className="text-cyan-400">*</span>
									</label>
									<Input
										value={name}
										onChange={(e) => setName(e.target.value)}
										placeholder="e.g. Alex Morgan"
										required
										className="bg-slate-950/60 border-white/10 text-slate-100 text-sm h-10"
									/>
								</div>

								{/* Email (Read-Only) */}
								<div>
									<label className="text-slate-200 font-semibold block mb-1.5 flex items-center justify-between">
										<span>Email Address (Account Identifier)</span>
										<span className="text-slate-500 text-[11px] font-normal">Read-only</span>
									</label>
									<div className="relative">
										<Input
											value={user?.email || ""}
											disabled
											className="bg-slate-950/40 border-white/10 text-slate-400 text-sm h-10 pl-9 cursor-not-allowed"
										/>
										<Mail className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-slate-500" />
									</div>
									<p className="text-[10px] text-slate-500 mt-1">
										Contact your system administrator to request an email update.
									</p>
								</div>

								{/* Department */}
								<div>
									<label className="text-slate-200 font-semibold block mb-1.5">
										Department
									</label>
									<select
										value={department}
										onChange={(e) => setDepartment(e.target.value)}
										className="w-full h-10 rounded-md border border-white/10 bg-slate-950/60 px-3 text-sm text-slate-200 focus:outline-none focus:ring-2 focus:ring-cyan-500"
									>
										<option value="Finance">Finance</option>
										<option value="Engineering">Engineering</option>
										<option value="Compliance">Compliance</option>
										<option value="Admin">Admin</option>
										<option value="General">General</option>
									</select>
								</div>

								{/* Assigned Role (Read-Only) */}
								<div>
									<label className="text-slate-200 font-semibold block mb-1.5 flex items-center justify-between">
										<span>Assigned Role</span>
										<span className="text-slate-500 text-[11px] font-normal">Controlled by Admin</span>
									</label>
									<div className="relative">
										<Input
											value={userRole}
											disabled
											className="bg-slate-950/40 border-white/10 text-slate-400 text-sm h-10 pl-9 font-semibold uppercase cursor-not-allowed"
										/>
										<Shield className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-slate-500" />
									</div>
								</div>

								<div className="flex items-center justify-end pt-4 gap-2">
									<Button
										type="button"
										variant="outline"
										onClick={() => router.push("/dashboard/profile")}
										className="border-white/10 bg-slate-950/60 text-slate-300 text-xs h-9"
									>
										Cancel
									</Button>
									<Button
										type="submit"
										disabled={submitting}
										className="bg-cyan-400 hover:bg-cyan-300 text-slate-950 font-semibold text-xs h-9 shadow-md shadow-cyan-950/40"
									>
										{submitting ? (
											<>
												<Loader2 className="size-3.5 animate-spin mr-1.5" />
												Saving...
											</>
										) : (
											<>
												<Save className="size-3.5 mr-1.5" />
												Save Profile
											</>
										)}
									</Button>
								</div>
							</form>
						</CardContent>
					</Card>
				</div>
			</div>
		</AuthProvider>
	);
}
