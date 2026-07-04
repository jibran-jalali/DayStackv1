"use client";

import { CalendarDays, ChevronLeft, ChevronRight } from "lucide-react";

import { Button } from "@/components/shared/button";
import { StatusChip } from "@/components/shared/status-chip";
import { shiftDate } from "@/lib/daystack";
import type { PlannerDateMode } from "@/types/daystack";

interface DateSwitcherProps {
  dateLabel: string;
  dateMode: PlannerDateMode;
  isPending: boolean;
  onSelectDate: (nextDate: string) => void;
  selectedDate: string;
  todayDate: string;
}

export function DateSwitcher({
  dateMode,
  isPending,
  onSelectDate,
  selectedDate,
  todayDate,
}: DateSwitcherProps) {
  return (
    <div className="rounded-[22px] border border-border/80 bg-white/82 p-3 shadow-[0_14px_30px_rgba(15,23,42,0.04)]">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <p className="section-label">Plan another day</p>
            <StatusChip
              label={dateMode === "today" ? "Today" : dateMode === "future" ? "Future" : "Past"}
              tone={dateMode === "today" ? "brand" : "default"}
            />
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button
            size="sm"
            variant="secondary"
            className="h-10 rounded-full px-3"
            onClick={() => onSelectDate(shiftDate(selectedDate, -1))}
            disabled={isPending}
            aria-label="Previous day"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>

          <label className="relative flex h-10 items-center overflow-hidden rounded-full border border-border/80 bg-white px-3 shadow-[0_10px_24px_rgba(15,23,42,0.05)]">
            <CalendarDays className="mr-2 h-4 w-4 text-secondary-foreground" />
            <input
              type="date"
              value={selectedDate}
              onChange={(event) => onSelectDate(event.target.value)}
              disabled={isPending}
              className="min-w-[9.75rem] bg-transparent text-sm font-medium text-foreground outline-none"
              aria-label="Choose the day you want to plan"
            />
          </label>

          <Button
            size="sm"
            variant="secondary"
            className="h-10 rounded-full px-3"
            onClick={() => onSelectDate(shiftDate(selectedDate, 1))}
            disabled={isPending}
            aria-label="Next day"
          >
            <ChevronRight className="h-4 w-4" />
          </Button>

          <Button
            size="sm"
            variant="ghost"
            className="h-10 rounded-full px-4"
            onClick={() => onSelectDate(todayDate)}
            disabled={isPending || selectedDate === todayDate}
          >
            Today
          </Button>
        </div>
      </div>
    </div>
  );
}
