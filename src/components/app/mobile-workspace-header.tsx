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
    <header className="mobile-safe-x sticky top-0 z-30 border-b border-white/70 bg-[linear-gradient(180deg,rgba(250,252,255,0.97),rgba(250,252,255,0.88))] pb-2.5 pt-[calc(0.65rem+env(safe-area-inset-top))] backdrop-blur-xl">
      <div className="mobile-shell-width mx-auto">
        <div className="flex items-center justify-between gap-2.5">
          <div className="min-w-0 flex items-center gap-2.5">
            <LogoMark className="h-8 w-8 rounded-[14px]" />
            <div className="min-w-0">
              <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-secondary-foreground/68">
                DayStack
              </p>
              <h1 className="truncate font-display text-xl font-semibold leading-tight text-foreground">
                {title}
              </h1>
            </div>
          </div>
          {action ? <div className="shrink-0">{action}</div> : null}
        </div>

        {metricLabel || secondaryMetricLabel ? (
          <div className="mt-2 flex min-w-0 items-center gap-1.5">
            <p className="min-w-0 flex-1 truncate text-xs text-secondary-foreground">{subtitle}</p>
            {metricLabel ? (
              <StatusChip label={metricLabel} tone={metricTone} className="shrink-0 px-2 py-1 text-[10px]" />
            ) : null}
            {secondaryMetricLabel ? (
              <StatusChip
                label={secondaryMetricLabel}
                tone={secondaryMetricTone}
                className="shrink-0 px-2 py-1 text-[10px]"
              />
            ) : null}
          </div>
        ) : (
          <p className="mt-1.5 truncate text-xs text-secondary-foreground">{subtitle}</p>
        )}
      </div>
    </header>
  );
}
