import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface StatusChipProps {
  label: string;
  tone?: "default" | "success" | "warning" | "brand";
  className?: string;
  icon?: LucideIcon;
}

const tones: Record<NonNullable<StatusChipProps["tone"]>, string> = {
  default: "border-border/80 bg-white/88 text-secondary-foreground",
  success: "border-emerald-200 bg-emerald-50 text-emerald-700",
  warning: "border-amber-200 bg-amber-50 text-amber-700",
  brand: "border-cyan-200 bg-cyan-50 text-sky-700",
};

export function StatusChip({ label, tone = "default", className, icon: Icon }: StatusChipProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold shadow-[0_8px_20px_rgba(15,23,42,0.05)] transition-[transform,box-shadow,background-color,border-color,color] duration-200 ease-[cubic-bezier(0.22,1,0.36,1)]",
        tones[tone],
        className,
      )}
    >
      {Icon ? <Icon className="h-3.5 w-3.5" /> : null}
      {label}
    </span>
  );
}
