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
        className="inline-flex items-center min-h-[var(--tap-target)] bg-transparent border-0 p-0 text-text text-body underline underline-offset-4 cursor-pointer"
      >
        티켓 조회
      </Link>
    </header>
  );
}
