"use client";

import React, { useState, useEffect } from "react";
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
import Link from "next/link";
import { GalleryVerticalEnd, Loader2, AlertCircle } from "lucide-react";
import axios from "@/store/axios";
import { useRouter } from "next/navigation";
import { isAxiosError } from "axios";
import { useDispatch, useSelector } from "react-redux";
import { AppDispatch, RootState } from "@/store/store";
import { setAuthState } from "@/store/authSlice";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  const dispatch = useDispatch<AppDispatch>();
  const { user, isAuthenticated, loading: userLoading } = useSelector((state: RootState) => state.auth)

  const router = useRouter();

  const submitHandler = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setErrorMessage("");

    if (!email.trim() || !password) {
      setErrorMessage("Please enter both email and password.");
      return;
    }

    try {
      setLoading(true);
      const { data } = await axios.post("/auth/login", {
        email: email.trim().toLowerCase(),
        password,
      });

      if (data.access_token) {
        localStorage.setItem("token", data.access_token);
        if (data.role) {
          localStorage.setItem("role", data.role);
        }
        dispatch(setAuthState({ user: data.user, isAuthenticated: true, loading: false, role: data.user.role, token: data.access_token }));
        router.push("/dashboard");
      }
    } catch (error: unknown) {
      console.error("Error during login:", error);
      if (isAxiosError(error)) {
        setErrorMessage(
          error.response?.data?.detail || "Invalid email or password. Please try again."
        );
      } else {
        setErrorMessage("An unexpected error occurred during login.");
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
      <section className="flex flex-1 items-center justify-center bg-[radial-gradient(circle_at_top,_rgba(56,189,248,0.22),_transparent_42%),radial-gradient(circle_at_80%_20%,_rgba(251,146,60,0.22),_transparent_36%)] px-4 py-24">
        <div className="flex w-full max-w-sm flex-col gap-6">
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
                <CardTitle className="text-2xl font-bold text-white">Welcome back</CardTitle>
                <CardDescription className="text-slate-300 text-xs">
                  Login with email and password to access your dashboard.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={submitHandler} className="space-y-4">
                  <FieldGroup>
                    <Field>
                      <FieldLabel htmlFor="email" className="text-slate-200 text-xs font-semibold">
                        Work Email
                      </FieldLabel>
                      <Input
                        id="email"
                        type="email"
                        placeholder="m@example.com"
                        value={email}
                        onChange={(event) => setEmail(event.target.value)}
                        className="bg-slate-950/60 border-white/10 text-slate-100 placeholder:text-slate-500 focus-visible:ring-cyan-500 text-sm"
                        required
                      />
                    </Field>

                    <Field>
                      <div className="flex items-center">
                        <FieldLabel htmlFor="password" className="text-slate-200 text-xs font-semibold">
                          Password
                        </FieldLabel>
                      </div>
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

                    {errorMessage && (
                      <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-xs text-red-200 flex items-center gap-2">
                        <AlertCircle className="size-4 shrink-0 text-red-400" />
                        <span>{errorMessage}</span>
                      </div>
                    )}

                    <Field className="pt-2">
                      <Button
                        type="submit"
                        disabled={loading}
                        className="w-full bg-cyan-400 hover:bg-cyan-300 text-slate-950 font-semibold text-sm transition-all shadow-md shadow-cyan-950/50 h-10"
                      >
                        {loading ? (
                          <>
                            <Loader2 className="size-4 animate-spin mr-2" />
                            Signing in...
                          </>
                        ) : (
                          "Login"
                        )}
                      </Button>
                      <FieldDescription className="text-center text-xs text-slate-400 mt-2">
                        Don&apos;t have an account?{" "}
                        <Link href="/register" className="text-cyan-300 font-semibold hover:underline">
                          Sign up
                        </Link>
                      </FieldDescription>
                    </Field>
                  </FieldGroup>
                </form>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>
    </main>
  );
}
