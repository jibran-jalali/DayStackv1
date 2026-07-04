import type { InputHTMLAttributes } from "react";

import { cn } from "@/lib/utils";

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  error?: string;
}

export function Input({ className, error, ...props }: InputProps) {
  return (
    <input
      suppressHydrationWarning
      className={cn(
        "input-shell focus:border-primary/70 focus:bg-white focus:shadow-[0_0_0_4px_var(--ring)]",
        error && "border-danger/60 bg-red-50/70 focus:border-danger/60 focus:shadow-[0_0_0_4px_rgba(239,68,68,0.12)]",
        className,
      )}
      {...props}
    />
  );
}
