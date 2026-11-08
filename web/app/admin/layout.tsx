"use client";

import React from "react";
import { AdminAuthProvider } from "@/components/admin/AdminAuthContext";

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <AdminAuthProvider>{children}</AdminAuthProvider>;
}
