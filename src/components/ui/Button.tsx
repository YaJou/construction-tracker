"use client";

import { cn } from "@/utils/cn";
import { ButtonHTMLAttributes, forwardRef } from "react";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "ghost" | "danger";
  size?: "sm" | "md" | "lg";
  fullWidth?: boolean;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "primary", size = "md", fullWidth, children, ...props }, ref) => {
    return (
      <button
        ref={ref}
        className={cn(
          "inline-flex items-center justify-center font-medium rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-ink/20 disabled:opacity-50 disabled:pointer-events-none touch-target",
          variant === "primary" &&
            "bg-ink text-white hover:bg-ink/90 focus:ring-ink",
          variant === "secondary" &&
            "bg-surface-muted text-ink border border-border hover:bg-border focus:ring-ink/30",
          variant === "ghost" &&
            "bg-transparent text-ink-muted hover:bg-surface-muted hover:text-ink focus:ring-ink/20",
          variant === "danger" &&
            "bg-red-600 text-white hover:bg-red-700 focus:ring-red-500",
          size === "sm" && "px-3 py-1.5 text-sm",
          size === "md" && "px-4 py-2.5 text-sm",
          size === "lg" && "px-6 py-3 text-base",
          fullWidth && "w-full",
          className
        )}
        {...props}
      >
        {children}
      </button>
    );
  }
);
Button.displayName = "Button";
