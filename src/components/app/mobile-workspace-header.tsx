"use client";

import type { ReactNode } from "react";

import { LogoMark } from "@/components/shared/logo";
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

function HeaderMetric({
  label,
  tone = "default",
}: {
  label: string;
  tone?: "brand" | "default" | "success" | "warning";
}) {
  return (
    <span
      className={cn(
        "mobile-header-metric",
        tone === "brand" && "mobile-header-metric--brand",
        tone === "success" && "mobile-header-metric--success",
        tone === "warning" && "mobile-header-metric--warning",
      )}
    >
      {label}
    </span>
  );
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
  const hasMetrics = Boolean(metricLabel || secondaryMetricLabel);
  const showInlineMeta = compact || hasMetrics;

  return (
    <header className="mobile-header-bar mobile-header-bar--compact mobile-safe-x">
      <div className="mobile-shell-width mx-auto">
        <div className="flex items-center justify-between gap-2">
          <div className="flex min-w-0 flex-1 items-center gap-2">
            <LogoMark className="h-7 w-7 shrink-0 rounded-[12px] shadow-[0_4px_12px_rgba(24,190,239,0.18)]" />
            <div className="min-w-0">
              <h1 className="mobile-header-title truncate">{title}</h1>
              {showInlineMeta ? (
                <div className="mt-0.5 flex min-w-0 flex-wrap items-center gap-x-1.5 gap-y-0.5">
                  <p className="truncate text-[11px] font-medium text-secondary-foreground/85">{subtitle}</p>
                  {metricLabel ? (
                    <>
                      <span className="mobile-header-dot" aria-hidden />
                      <HeaderMetric label={metricLabel} tone={metricTone} />
                    </>
                  ) : null}
                  {secondaryMetricLabel ? (
                    <>
                      <span className="mobile-header-dot" aria-hidden />
                      <HeaderMetric label={secondaryMetricLabel} tone={secondaryMetricTone} />
                    </>
                  ) : null}
                </div>
              ) : (
                <p className="mt-0.5 truncate text-[11px] font-medium text-secondary-foreground/85">{subtitle}</p>
              )}
            </div>
          </div>
          {action ? <div className="shrink-0">{action}</div> : null}
        </div>
      </div>
    </header>
  );
}
