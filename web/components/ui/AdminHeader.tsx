"use client";

import Link from "next/link";
import React from "react";
import { useAdminAuth } from "@/components/admin/AdminAuthContext";

interface AdminHeaderProps {
  subTitle?: string;
  onLogout?: () => void;
}

export function AdminHeader({ subTitle = "운영 서비스", onLogout }: AdminHeaderProps) {
  const { logout } = useAdminAuth();

  const handleLogout = () => {
    if (onLogout) {
      onLogout();
    } else {
      logout();
    }
  };

  return (
    <header className="flex items-center justify-between gap-3 min-h-[var(--tap-target)] px-4 py-2 border-b border-border">
      <div className="flex items-baseline gap-3 min-w-0">
        <Link href="/admin/events" className="wordmark">
          온티켓<span className="wordmark-dot">.</span>
        </Link>
        <span className="text-caption text-text-muted truncate">
          {subTitle}
        </span>
      </div>
      <button
        type="button"
        onClick={handleLogout}
        className="inline-flex items-center min-h-[var(--tap-target)] bg-transparent border-0 p-0 text-text text-body underline underline-offset-4 cursor-pointer"
      >
        나가기
      </button>
    </header>
  );
}
