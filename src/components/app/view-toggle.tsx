"use client";

import { LayoutDashboard, LayoutGrid, List } from "lucide-react";

import { cn } from "@/lib/utils";

export type PlannerViewMode = "dashboard" | "grid" | "list";

interface ViewToggleProps {
  value: PlannerViewMode;
  onChange: (value: PlannerViewMode) => void;
}

const options: Array<{
  value: PlannerViewMode;
  label: string;
  icon: typeof LayoutGrid;
}> = [
  { value: "dashboard", label: "Dashboard", icon: LayoutDashboard },
  { value: "grid", label: "Grid", icon: LayoutGrid },
  { value: "list", label: "List", icon: List },
];

export function ViewToggle({ value, onChange }: ViewToggleProps) {
  const activeIndex = Math.max(
    options.findIndex((option) => option.value === value),
    0,
  );

  return (
    <div
      className="relative inline-grid rounded-full border border-border/80 bg-white/90 p-1 shadow-[0_12px_28px_rgba(15,23,42,0.06)]"
      style={{ gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))` }}
    >
      <span
        className={cn(
          "pointer-events-none absolute inset-y-1 left-1 rounded-full bg-brand-gradient shadow-[0_14px_28px_rgba(23,102,214,0.2)] transition-transform duration-200 ease-[cubic-bezier(0.22,1,0.36,1)]",
        )}
        style={{
          width: `calc((100% - 0.5rem) / ${options.length})`,
          transform: `translateX(calc(${activeIndex} * 100%))`,
        }}
      />
      {options.map((option) => {
        const Icon = option.icon;
        const isActive = value === option.value;

        return (
          <button
            key={option.value}
            suppressHydrationWarning
            type="button"
            onClick={() => onChange(option.value)}
            className={cn(
              "relative z-10 inline-flex h-9 items-center justify-center gap-2 rounded-full px-3 text-sm font-semibold transition-[transform,color,opacity] duration-200 ease-[cubic-bezier(0.22,1,0.36,1)] focus:outline-none focus-visible:ring-4 focus-visible:ring-[var(--ring)] active:scale-[0.985] sm:px-4",
              isActive ? "text-white" : "text-secondary-foreground hover:text-foreground",
            )}
            aria-pressed={isActive}
          >
            <Icon className="h-4 w-4" />
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
