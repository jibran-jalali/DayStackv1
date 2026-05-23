"use client";

import type { ReactNode } from "react";

import { LogoMark } from "@/components/shared/logo";
import { StatusChip } from "@/components/shared/status-chip";
import { cn } from "@/lib/utils";

interface MobileWorkspaceHeaderProps {
  action?: ReactNode;
  compact?: boolean;
  metricLabel?: string;
  metricTone?: "brand" | "default" | "success" | "warning";
  secondaryMetricLabel?: string;
  secondaryMetricTone?: "brand" | "default" | "success" | "warning";
  subtitle: string;
  title: string;
}

export function MobileWorkspaceHeader({
  action,
  compact = false,
  metricLabel,
  metricTone = "brand",
  secondaryMetricLabel,
  secondaryMetricTone = "default",
  subtitle,
  title,
}: MobileWorkspaceHeaderProps) {
  return (
    <header
      className={cn(
        "mobile-safe-x sticky top-0 z-30 border-b border-white/60",
        "bg-[rgba(250,252,255,0.78)] pb-3 pt-[calc(0.5rem+env(safe-area-inset-top))]",
        "backdrop-blur-2xl backdrop-saturate-150",
      )}
    >
      <div className="mobile-shell-width mx-auto">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            {!compact ? (
              <div className="mb-1 flex items-center gap-2">
                <LogoMark className="h-7 w-7 rounded-[12px] shadow-[0_4px_12px_rgba(24,190,239,0.2)]" />
                <p className="mobile-eyebrow">DayStack</p>
              </div>
            ) : null}
            <h1 className={cn("truncate", compact ? "text-xl font-semibold" : "mobile-header-large")}>{title}</h1>
            <p className="mt-1 truncate text-sm text-secondary-foreground">{subtitle}</p>
          </div>
          {action ? <div className="shrink-0 pt-0.5">{action}</div> : null}
        </div>

        {metricLabel || secondaryMetricLabel ? (
          <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
            {metricLabel ? (
              <StatusChip label={metricLabel} tone={metricTone} className="shrink-0 px-2.5 py-1 text-[10px]" />
            ) : null}
            {secondaryMetricLabel ? (
              <StatusChip
                label={secondaryMetricLabel}
                tone={secondaryMetricTone}
                className="shrink-0 px-2.5 py-1 text-[10px]"
              />
            ) : null}
          </div>
        ) : null}
      </div>
    </header>
  );
}
