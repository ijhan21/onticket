import React from "react";

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "default" | "book" | "small";
  isLoading?: boolean;
}

export function Button({
  children,
  variant = "default",
  isLoading = false,
  className = "",
  disabled,
  ...props
}: ButtonProps) {
  const baseClasses =
    "inline-flex items-center justify-center gap-2 font-body transition-colors duration-[120ms]";

  let variantClasses = "";
  if (variant === "book") {
    // S02 예매 버튼: 오렌지 배경, on-accent 글자, 굵게
    variantClasses =
      "w-full min-h-[var(--tap-target)] px-4 bg-accent text-on-accent border border-accent rounded-md font-bold hover:bg-accent disabled:bg-surface-2 disabled:border-border disabled:text-text-muted disabled:cursor-not-allowed";
  } else if (variant === "small") {
    variantClasses =
      "min-h-[var(--tap-target)] px-3 bg-surface-2 text-text border border-border-strong rounded-md text-caption font-medium hover:bg-surface-3 disabled:opacity-50 disabled:cursor-not-allowed";
  } else {
    variantClasses =
      "min-h-[var(--tap-target)] px-4 bg-surface-2 text-text border border-border-strong rounded-md text-body font-medium hover:bg-surface-3 disabled:bg-surface disabled:border-border disabled:text-text-muted disabled:cursor-not-allowed";
  }

  return (
    <button
      className={`${baseClasses} ${variantClasses} ${className}`}
      disabled={disabled || isLoading}
      {...props}
    >
      {isLoading ? (
        <span className="spinner" aria-label="기다리는 중" />
      ) : (
        children
      )}
    </button>
  );
}
