import type { ButtonHTMLAttributes } from "react";

import { cn } from "@/lib/utils";

type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";
type ButtonSize = "sm" | "md" | "lg";

const variantStyles: Record<ButtonVariant, string> = {
  primary:
    "bg-brand-gradient text-white shadow-[var(--shadow-brand-md)] hover:brightness-[1.02] active:scale-[0.995] active:brightness-[0.985]",
  secondary:
    "border border-border/80 bg-white/92 text-foreground shadow-[0_10px_24px_rgba(15,23,42,0.05)] hover:bg-white active:scale-[0.995]",
  ghost: "text-secondary-foreground hover:bg-white/72 active:scale-[0.995]",
  danger:
    "border border-red-200 bg-red-50 text-danger shadow-[0_10px_24px_rgba(239,68,68,0.1)] hover:bg-red-100 active:scale-[0.995]",
};

const sizeStyles: Record<ButtonSize, string> = {
  sm: "h-10 rounded-full px-4 text-sm",
  md: "h-11 rounded-full px-5 text-sm",
  lg: "h-12 rounded-full px-6 text-sm",
};

export function buttonVariants({
  variant = "primary",
  size = "md",
  className,
}: {
  variant?: ButtonVariant;
  size?: ButtonSize;
  className?: string;
} = {}) {
  return cn(
    "ui-pressable inline-flex items-center justify-center gap-2 font-semibold focus:outline-none focus-visible:ring-4 focus-visible:ring-[var(--ring)] disabled:translate-y-0 disabled:opacity-60",
    variantStyles[variant],
    sizeStyles[size],
    className,
  );
}

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
}

export function Button({ className, variant, size, type = "button", ...props }: ButtonProps) {
  return <button suppressHydrationWarning type={type} className={buttonVariants({ variant, size, className })} {...props} />;
}
