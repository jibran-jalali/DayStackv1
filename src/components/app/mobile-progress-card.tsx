"use client";

import { cn } from "@/lib/utils";
import type { DashboardSummary, PlannerDateMode } from "@/types/daystack";

interface MobileProgressCardProps {
  completionRate: number;
  dateMode: PlannerDateMode;
  isPending?: boolean;
  onSelectMode?: () => void;
  relativeDateLabel: string;
  showSelectButton?: boolean;
  streak: number;
  summary: DashboardSummary;
  taskCount: number;
}

export function MobileProgressCard({
  completionRate,
  dateMode,
  isPending,
  onSelectMode,
  relativeDateLabel,
  showSelectButton,
  streak,
  summary,
  taskCount,
}: MobileProgressCardProps) {
  return (
    <section className="mobile-hero-card mobile-stagger-1">
      <div className="mobile-hero-card__glow" aria-hidden />

      <div className="relative flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="mobile-eyebrow">Daily progress</p>
          <div className="mt-1.5 flex items-end gap-2">
            <p className="font-display text-[2.35rem] font-semibold leading-none tracking-[-0.06em] text-foreground">
              {completionRate}%
            </p>
            <p className="mb-1 min-w-0 flex-1 truncate text-xs font-medium text-secondary-foreground">
              {summary.summaryLine}
            </p>
          </div>
        </div>

        <div className="mobile-stat-pill shrink-0">
          <p className="mobile-stat-pill__label">{dateMode === "future" ? "Planned" : "Done"}</p>
          <p className="mobile-stat-pill__value">
            {dateMode === "future"
              ? summary.totalTasks
              : `${summary.completedTasks}/${summary.totalTasks || 0}`}
          </p>
        </div>
      </div>

      <div className="mobile-progress-track mt-3" role="progressbar" aria-valuenow={completionRate} aria-valuemin={0} aria-valuemax={100}>
        <div
          className="mobile-progress-fill"
          style={{ width: `${completionRate}%` }}
        />
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-1.5">
        <span className="mobile-chip">{relativeDateLabel}</span>
        <span className="mobile-chip">
          {taskCount} block{taskCount === 1 ? "" : "s"}
        </span>
        {streak > 0 ? (
          <span className="mobile-chip mobile-chip--success">{streak} day streak</span>
        ) : null}
        {showSelectButton && onSelectMode ? (
          <button
            type="button"
            className="mobile-text-btn ml-auto"
            onClick={onSelectMode}
            disabled={isPending}
          >
            Select
          </button>
        ) : null}
      </div>
    </section>
  );
}
