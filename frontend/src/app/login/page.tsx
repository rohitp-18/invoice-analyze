"use client";

import React, { useCallback, useState } from "react";
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
import { GalleryVerticalEnd } from "lucide-react";
import axios from "@/store/axios";
import { useRouter } from "next/navigation";
import { json } from "stream/consumers";

function Page() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const router = useRouter();

  const submitHandler = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    try {
      setLoading(true);
      const { data } = await axios.post("/auth/login", {
        email,
        password,
      });
      console.log(data);
      localStorage.setItem("token", data.access_token);
      // router.push("/dashboard");
    } catch (error) {
      console.error("Error during login:", error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="flex min-h-svh flex-col bg-slate-950 text-white">
      <section className="flex flex-1 items-center justify-center bg-[radial-gradient(circle_at_top,_rgba(56,189,248,0.22),_transparent_42%),radial-gradient(circle_at_80%_20%,_rgba(251,146,60,0.22),_transparent_36%)] px-6 py-24">
        <div className="flex w-full max-w-sm flex-col gap-6">
          <Link
            href="/"
            className="flex items-center gap-2 self-center font-medium"
          >
            <div className="flex size-6 items-center justify-center rounded-md bg-primary text-primary-foreground">
              <GalleryVerticalEnd className="size-4" />
            </div>
            Acme Inc.
          </Link>

          <div className={"flex flex-col gap-6"}>
            <Card>
              <CardHeader className="text-center">
                <CardTitle className="text-xl">Welcome back</CardTitle>
                <CardDescription>
                  Login with email and password to your account
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={submitHandler}>
                  <FieldGroup>
                    <Field>
                      <FieldLabel htmlFor="email">Email</FieldLabel>
                      <Input
                        id="email"
                        type="email"
                        placeholder="m@example.com"
                        value={email}
                        onChange={(event) => setEmail(event.target.value)}
                        required
                      />
                    </Field>
                    <Field>
                      <div className="flex items-center">
                        <FieldLabel htmlFor="password">Password</FieldLabel>
                        <Link
                          href="/forgot-password"
                          className="ml-auto text-sm underline-offset-4 hover:underline"
                        >
                          Forgot your password?
                        </Link>
                      </div>
                      <Input
                        id="password"
                        type="password"
                        value={password}
                        onChange={(event) => setPassword(event.target.value)}
                        required
                      />
                    </Field>
                    <Field>
                      <Button type="submit">Login</Button>
                      <FieldDescription className="text-center">
                        Don&apos;t have an account?{" "}
                        <Link href="/register">Sign up</Link>
                      </FieldDescription>
                    </Field>
                  </FieldGroup>
                </form>
              </CardContent>
            </Card>
            <FieldDescription className="px-6 text-center">
              By clicking continue, you agree to our{" "}
              <Link href="/terms">Terms of Service</Link> and{" "}
              <Link href="/policies">Privacy Policy</Link>.
            </FieldDescription>
          </div>
        </div>
      </section>
    </main>
  );
}

export default Page;
