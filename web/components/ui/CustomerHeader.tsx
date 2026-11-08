import Link from "next/link";
import React from "react";

export function CustomerHeader() {
  return (
    <header className="flex items-center justify-between gap-3 min-h-[var(--tap-target)] px-4 py-2 border-b border-border">
      <Link href="/" className="wordmark">
        온티켓<span className="wordmark-dot">.</span>
      </Link>
      <Link
        href="/orders/lookup"
        className="inline-flex items-center justify-center min-h-[36px] px-3.5 py-1.5 bg-surface-2 text-text border border-border-strong rounded-md text-caption font-medium transition-colors hover:bg-surface-3 cursor-pointer"
      >
        티켓 확인
      </Link>
    </header>
  );
}
