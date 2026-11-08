import React from "react";

export interface InputProps
  extends React.InputHTMLAttributes<HTMLInputElement> {
  isInvalid?: boolean;
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ isInvalid, className = "", ...props }, ref) => {
    return (
      <input
        ref={ref}
        className={`w-full min-h-[var(--tap-target)] px-3 bg-surface text-text border ${
          isInvalid ? "border-error" : "border-border-strong"
        } rounded-md font-body text-body outline-none focus:outline focus:outline-[var(--focus-width)] focus:outline-focus focus:outline-offset-[var(--focus-width)] read-only:bg-bg read-only:border-border read-only:text-text-muted ${className}`}
        {...props}
      />
    );
  }
);

Input.displayName = "Input";
