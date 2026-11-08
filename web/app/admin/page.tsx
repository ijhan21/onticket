"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAdminAuth } from "@/components/admin/AdminAuthContext";

export default function AdminIndexPage() {
  const router = useRouter();
  const { isAuthenticated } = useAdminAuth();

  useEffect(() => {
    if (isAuthenticated) {
      router.replace("/admin/events");
    } else {
      router.replace("/admin/login");
    }
  }, [isAuthenticated, router]);

  return null;
}
