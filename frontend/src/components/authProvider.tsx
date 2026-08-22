"use client";

import { RootState } from "@/store/store";
import { useRouter } from "next/navigation";
import React, { useEffect } from "react";
import { useSelector } from "react-redux";
import Loading from "@/components/loading";
import PageNot from "./pageNot";

function AuthProvider({
  children,
  role,
}: {
  children: React.ReactNode;
  role?: string;
}) {
  const {
    user,
    loading,
    role: requiredRole,
  } = useSelector((state: RootState) => state.auth);

  const router = useRouter();

  useEffect(() => {
    if (!user && !loading) {
      router.push("/login");
    }
  }, [user, router, loading]);

  if (!user && loading) {
    return <Loading />;
  }

  if (!user && !loading) return null;

  if (user && role && requiredRole !== role) {
    return <PageNot />;
  }

  return children;
}

export default AuthProvider;
