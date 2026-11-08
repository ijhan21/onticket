"use client";

import React, { useEffect } from "react";
import { useRouter } from "next/navigation";
import { AdminEventForm } from "@/components/admin/AdminEventForm";
import { useAdminAuth } from "@/components/admin/AdminAuthContext";

export default function AdminNewEventPage() {
  const router = useRouter();
  const { isAuthenticated } = useAdminAuth();

  useEffect(() => {
    if (!isAuthenticated) {
      router.replace("/admin/login");
    }
  }, [isAuthenticated, router]);

  if (!isAuthenticated) return null;

  return <AdminEventForm mode="new" />;
}
