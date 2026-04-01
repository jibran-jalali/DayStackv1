"use client";

import type { ReactNode } from "react";

import { LogoMark } from "@/components/shared/logo";
import { StatusChip } from "@/components/shared/status-chip";

interface MobileWorkspaceHeaderProps {
  action?: ReactNode;
  metricLabel?: string;
  metricTone?: "brand" | "default" | "success" | "warning";
  secondaryMetricLabel?: string;
  secondaryMetricTone?: "brand" | "default" | "success" | "warning";
  subtitle: string;
  title: string;
}

export function MobileWorkspaceHeader({
  action,
  metricLabel,
  metricTone = "brand",
  secondaryMetricLabel,
  secondaryMetricTone = "default",
  subtitle,
  title,
}: MobileWorkspaceHeaderProps) {
  return (
    <header className="mobile-safe-x sticky top-0 z-30 border-b border-white/60 bg-[linear-gradient(180deg,rgba(250,252,255,0.94),rgba(250,252,255,0.8))] pb-4 pt-[calc(0.9rem+env(safe-area-inset-top))] backdrop-blur-xl">
      <div className="mobile-shell-width mx-auto">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0 flex items-center gap-2">
            <LogoMark className="h-10 w-10 rounded-[18px]" />
            <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-secondary-foreground/72">
              DayStack
            </p>
          </div>
          {action ? <div className="shrink-0">{action}</div> : null}
        </div>

        <div className="mt-4 min-w-0">
          <h1 className="font-display text-[1.95rem] font-semibold tracking-[-0.04em] text-foreground">
            {title}
          </h1>
          <p className="mt-1 text-sm text-secondary-foreground">{subtitle}</p>
        </div>

        {metricLabel || secondaryMetricLabel ? (
          <div className="mt-4 flex flex-wrap items-center gap-2">
            {metricLabel ? <StatusChip label={metricLabel} tone={metricTone} /> : null}
            {secondaryMetricLabel ? <StatusChip label={secondaryMetricLabel} tone={secondaryMetricTone} /> : null}
          </div>
        ) : null}
      </div>
    </header>
  );
}
