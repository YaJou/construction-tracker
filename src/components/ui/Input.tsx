"use client";

import { cn } from "@/utils/cn";
import { InputHTMLAttributes, forwardRef } from "react";

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(
  ({ className, ...props }, ref) => (
    <input
      ref={ref}
      className={cn(
        "w-full rounded-lg border border-border bg-white px-3 py-2.5 text-ink placeholder:text-ink-subtle focus:outline-none focus:ring-2 focus:ring-ink/20 focus:border-transparent touch-target text-base",
        className
      )}
      {...props}
    />
  )
);
Input.displayName = "Input";
