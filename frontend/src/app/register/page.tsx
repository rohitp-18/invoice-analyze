"use client";

import React, { useState } from "react";
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

function Page() {
  const [name, setName] = useState("");
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

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
            TSC
          </Link>

          <div className={"flex flex-col gap-6"}>
            <Card>
              <CardHeader className="text-center">
                <CardTitle className="text-xl">Welcome</CardTitle>
                <CardDescription>
                  Create an account to get started
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form>
                  <FieldGroup>
                    <Field>
                      <FieldLabel htmlFor="name">Name</FieldLabel>
                      <Input
                        id="name"
                        type="text"
                        placeholder="John Doe"
                        value={name}
                        onChange={(event) => setName(event.target.value)}
                        required
                      />
                    </Field>
                    <Field>
                      <FieldLabel htmlFor="username">Username</FieldLabel>
                      <Input
                        id="username"
                        type="text"
                        placeholder="john_doe"
                        value={username}
                        onChange={(event) => setUsername(event.target.value)}
                        required
                      />
                    </Field>
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
                        <a
                          href="#"
                          className="ml-auto text-sm underline-offset-4 hover:underline"
                        >
                          Forgot your password?
                        </a>
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
                      <Button type="submit">Register</Button>
                      <FieldDescription className="text-center">
                        I have an account? <Link href="/login">Sign in</Link>
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
