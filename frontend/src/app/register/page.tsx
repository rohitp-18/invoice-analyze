"use client";

import React, { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import Link from "next/link";
import { GalleryVerticalEnd, Loader2, AlertCircle, CheckCircle2 } from "lucide-react";
import axios from "@/store/axios";
import { useRouter } from "next/navigation";
import { isAxiosError } from "axios";
import { useDispatch, useSelector } from "react-redux";
import { AppDispatch, RootState } from "@/store/store";
import { setAuthState } from "@/store/authSlice";

export default function RegisterPage() {
  const router = useRouter();

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [department, setDepartment] = useState("Finance");
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  const dispatch = useDispatch<AppDispatch>();
  const { user, isAuthenticated, loading: userLoading } = useSelector((state: RootState) => state.auth);

  const submitHandler = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setErrorMessage("");
    setSuccessMessage("");

    if (!name.trim() || !email.trim() || !password) {
      setErrorMessage("Please fill in all required fields.");
      return;
    }

    if (password.length < 6) {
      setErrorMessage("Password must be at least 6 characters long.");
      return;
    }

    try {
      setLoading(true);

      // 1. Send registration payload to backend
      await axios.post("/auth/register", {
        name: name.trim(),
        email: email.trim().toLowerCase(),
        password: password,
        department: department.trim() || "Finance",
        role: "EMPLOYEE",
      });

      // 2. Automatically authenticate the newly registered user
      try {
        const { data } = await axios.post("/auth/login", {
          email: email.trim().toLowerCase(),
          password: password,
        });

        if (!data) {
          setErrorMessage("No response from Login");
          return;
        }

        if (data?.access_token) {
          localStorage.setItem("token", data.access_token);
          if (data.role) {
            localStorage.setItem("role", data.role);
          }
          setSuccessMessage("Account created successfully! Redirecting to dashboard...");
          dispatch(setAuthState({ user: data.user, isAuthenticated: true, loading: false, role: data.user.role, token: data.access_token }));
          setTimeout(() => {
            router.push("/dashboard");
          }, 800);
          return;
        }
      } catch (loginErr) {
        console.warn("Auto-login post registration failed, routing to login page", loginErr);
      }

      setSuccessMessage("Registration successful! Redirecting to login...");
      setTimeout(() => {
        router.push("/login")
      }, 500)
    } catch (error: unknown) {
      console.error("Error during registration:", error);
      if (isAxiosError(error)) {
        setErrorMessage(
          error.response?.data?.detail || "Registration failed. Please check your credentials."
        );
      } else {
        setErrorMessage("An unexpected error occurred during registration.");
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!userLoading && isAuthenticated) {
      router.push("/dashboard");
    }
  }, [isAuthenticated, userLoading, router]);

  if (userLoading) return null;

  if (isAuthenticated) return null;

  return (
    <main className="flex min-h-svh flex-col bg-slate-950 text-white">
      <section className="flex flex-1 items-center justify-center bg-[radial-gradient(circle_at_top,_rgba(56,189,248,0.22),_transparent_42%),radial-gradient(circle_at_80%_20%,_rgba(251,146,60,0.22),_transparent_36%)] px-4 py-16">
        <div className="flex w-full max-w-md flex-col gap-6">
          <Link
            href="/"
            className="flex items-center gap-2 self-center font-medium"
          >
            <div className="flex size-7 items-center justify-center rounded-md bg-cyan-400 text-slate-950 font-bold">
              <GalleryVerticalEnd className="size-4" />
            </div>
            <span className="font-semibold text-lg tracking-tight">Invoice Validate AI</span>
          </Link>

          <div className="flex flex-col gap-6">
            <Card className="border-white/10 bg-slate-900/80 text-slate-100 backdrop-blur shadow-2xl">
              <CardHeader className="text-center pb-4">
                <CardTitle className="text-2xl font-bold text-white">
                  Create an Account
                </CardTitle>
                <CardDescription className="text-slate-300 text-xs">
                  Join your team to extract, validate, and audit invoices with AI.
                </CardDescription>
              </CardHeader>

              <CardContent>
                <form onSubmit={submitHandler} className="space-y-4">
                  <FieldGroup>
                    {/* Full Name */}
                    <Field>
                      <FieldLabel htmlFor="name" className="text-slate-200 text-xs font-semibold">
                        Full Name <span className="text-cyan-400">*</span>
                      </FieldLabel>
                      <Input
                        id="name"
                        type="text"
                        placeholder="Sarah Connor"
                        value={name}
                        onChange={(event) => setName(event.target.value)}
                        className="bg-slate-950/60 border-white/10 text-slate-100 placeholder:text-slate-500 focus-visible:ring-cyan-500 text-sm"
                        required
                      />
                    </Field>

                    {/* Email Address */}
                    <Field>
                      <FieldLabel htmlFor="email" className="text-slate-200 text-xs font-semibold">
                        Work Email <span className="text-cyan-400">*</span>
                      </FieldLabel>
                      <Input
                        id="email"
                        type="email"
                        placeholder="sarah@company.com"
                        value={email}
                        onChange={(event) => setEmail(event.target.value)}
                        className="bg-slate-950/60 border-white/10 text-slate-100 placeholder:text-slate-500 focus-visible:ring-cyan-500 text-sm"
                        required
                      />
                    </Field>

                    {/* Password */}
                    <Field>
                      <FieldLabel htmlFor="password" className="text-slate-200 text-xs font-semibold">
                        Password <span className="text-cyan-400">*</span>
                      </FieldLabel>
                      <Input
                        id="password"
                        type="password"
                        placeholder="••••••••"
                        value={password}
                        onChange={(event) => setPassword(event.target.value)}
                        className="bg-slate-950/60 border-white/10 text-slate-100 placeholder:text-slate-500 focus-visible:ring-cyan-500 text-sm"
                        required
                      />
                    </Field>

                    {/* Department (shadcn/ui Select) */}
                    <Field>
                      <FieldLabel htmlFor="department" className="text-slate-200 text-xs font-semibold">
                        Department
                      </FieldLabel>
                      <Select
                        value={department}
                        onValueChange={(val) => {
                          if (val) setDepartment(val);
                        }}
                      >
                        <SelectTrigger
                          id="department"
                          className="w-full bg-slate-950/60 border-white/10 text-slate-100 text-sm h-10 px-3 flex justify-between items-center"
                        >
                          <SelectValue placeholder="Select Department" />
                        </SelectTrigger>
                        <SelectContent className="border-white/10 bg-slate-900 text-slate-100">
                          <SelectGroup>
                            <SelectLabel className="text-slate-400 text-xs">Departments</SelectLabel>
                            <SelectItem value="Finance">Finance</SelectItem>
                            <SelectItem value="Procurement">Procurement</SelectItem>
                            <SelectItem value="Compliance">Compliance</SelectItem>
                            <SelectItem value="Operations">Operations</SelectItem>
                            <SelectItem value="Engineering">Engineering</SelectItem>
                          </SelectGroup>
                        </SelectContent>
                      </Select>
                    </Field>

                    {/* Error / Success Feedback */}
                    {errorMessage && (
                      <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-xs text-red-200 flex items-center gap-2">
                        <AlertCircle className="size-4 shrink-0 text-red-400" />
                        <span>{errorMessage}</span>
                      </div>
                    )}

                    {successMessage && (
                      <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-3 text-xs text-emerald-200 flex items-center gap-2">
                        <CheckCircle2 className="size-4 shrink-0 text-emerald-400" />
                        <span>{successMessage}</span>
                      </div>
                    )}

                    {/* Submit Button */}
                    <Field className="pt-2">
                      <Button
                        type="submit"
                        disabled={loading}
                        className="w-full bg-cyan-400 hover:bg-cyan-300 text-slate-950 font-semibold text-sm transition-all shadow-md shadow-cyan-950/50 h-10"
                      >
                        {loading ? (
                          <>
                            <Loader2 className="size-4 animate-spin mr-2" />
                            Creating Account...
                          </>
                        ) : (
                          "Register Account"
                        )}
                      </Button>

                      <FieldDescription className="text-center text-xs text-slate-400 mt-2">
                        Already have an account?{" "}
                        <Link href="/login" className="text-cyan-300 font-semibold hover:underline">
                          Sign in
                        </Link>
                      </FieldDescription>
                    </Field>
                  </FieldGroup>
                </form>
              </CardContent>
            </Card>

            <FieldDescription className="px-6 text-center text-xs text-slate-500">
              By registering, you agree to the{" "}
              <Link href="#" className="underline underline-offset-2 hover:text-slate-300">
                Terms of Service
              </Link>{" "}
              and{" "}
              <Link href="#" className="underline underline-offset-2 hover:text-slate-300">
                Privacy Policy
              </Link>
              .
            </FieldDescription>
          </div>
        </div>
      </section>
    </main>
  );
}
