"use client";

import { RootState } from "@/store/store";
import { useRouter } from "next/navigation";
import React, { useEffect } from "react";
import { useSelector } from "react-redux";
import Loading from "@/components/loading";
import PageNot from "./pageNot";

interface AuthProviderProps {
  children: React.ReactNode;
  role?: string;
  allowedRoles?: string[];
  allowedDepartments?: string[];
}

function AuthProvider({
  children,
  role,
  allowedRoles,
  allowedDepartments,
}: AuthProviderProps) {
  const {
    user,
    loading,
    role: userRole,
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

  // 1. Single role check
  if (role && userRole?.toUpperCase() !== role.toUpperCase()) {
    return <PageNot />;
  }

  // 2. Multi-role / Department access check
  if (allowedRoles && allowedRoles.length > 0) {
    const normalizedUserRole = (userRole || "").toUpperCase();
    const normalizedUserDept = (user?.department || "").toUpperCase();

    const hasRole = allowedRoles.some(
      (r) => r.toUpperCase() === normalizedUserRole
    );
    const hasDept = allowedDepartments
      ? allowedDepartments.some((d) => d.toUpperCase() === normalizedUserDept)
      : false;

    if (!hasRole && !hasDept) {
      return <PageNot />;
    }
  }

  return <>{children}</>;
}

export default AuthProvider;
