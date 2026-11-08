import React from "react";

export function Badge({ children }: { children: React.ReactNode }) {
  return (
    <span className="self-start px-2 py-0 border border-border-strong rounded-sm text-caption font-medium text-text">
      {children}
    </span>
  );
}
