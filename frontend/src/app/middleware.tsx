"use client";

import { fetchUser } from "@/store/authSlice";
import store from "@/store/store";
import React, { useEffect } from "react";
import { Provider } from "react-redux";

function Middleware({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    if (typeof window === "undefined") return;
    const token = localStorage.getItem("token");
    if (token) {
      store.dispatch(fetchUser(token));
    }
  }, []);
  return <Provider store={store}>{children}</Provider>;
}

export default Middleware;
