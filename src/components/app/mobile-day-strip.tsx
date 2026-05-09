"use client";

import { CalendarDays } from "lucide-react";

import { cn } from "@/lib/utils";
import { shiftDate } from "@/lib/daystack";

interface MobileDayStripProps {
  isPending: boolean;
  onSelectDate: (nextDate: string) => void;
  selectedDate: string;
  todayDate: string;
}

function formatDayLabel(dateKey: string) {
  const date = new Date(`${dateKey}T00:00:00`);

  return {
    dayNumber: new Intl.DateTimeFormat("en-US", { day: "numeric" }).format(date),
    monthLabel: new Intl.DateTimeFormat("en-US", { month: "short" }).format(date),
    weekdayLabel: new Intl.DateTimeFormat("en-US", { weekday: "short" }).format(date),
  };
}

export function MobileDayStrip({
  isPending,
  onSelectDate,
  selectedDate,
  todayDate,
}: MobileDayStripProps) {
  const days = Array.from({ length: 7 }, (_, index) => shiftDate(selectedDate, index - 3));

  return (
    <section className="mobile-surface px-2 py-2">
      <div className="grid grid-cols-4 gap-1.5">
        {days.map((dateKey) => {
          const isActive = dateKey === selectedDate;
          const isToday = dateKey === todayDate;
          const { dayNumber, monthLabel, weekdayLabel } = formatDayLabel(dateKey);

          return (
            <button
              key={dateKey}
              type="button"
              className={cn(
                "flex min-w-0 flex-col items-center rounded-[16px] px-1.5 py-2 text-center transition-[transform,box-shadow,background-color,color] duration-200 ease-[cubic-bezier(0.22,1,0.36,1)] active:scale-[0.98]",
                isActive
                  ? "bg-brand-gradient text-white shadow-[var(--shadow-brand-pill)]"
                  : "bg-muted/52 text-secondary-foreground hover:bg-white",
              )}
              onClick={() => onSelectDate(dateKey)}
              disabled={isPending}
            >
              <span className="text-[9px] font-semibold uppercase tracking-[0.12em] opacity-80">{weekdayLabel}</span>
              <span className="mt-1 text-lg font-semibold tracking-[-0.04em]">{dayNumber}</span>
              <span className="mt-0.5 text-[9px] font-medium opacity-80">{isToday ? "Today" : monthLabel}</span>
            </button>
          );
        })}

        <label className="flex min-w-0 cursor-pointer flex-col items-center rounded-[16px] border border-border/70 bg-white px-1.5 py-2 text-center text-secondary-foreground shadow-[0_8px_18px_rgba(15,23,42,0.06)] transition-[transform,box-shadow,background-color,color] duration-200 ease-[cubic-bezier(0.22,1,0.36,1)] active:scale-[0.98]">
          <CalendarDays className="h-4 w-4" />
          <span className="mt-1 text-xs font-semibold">Pick</span>
          <span className="mt-0.5 text-[9px] text-secondary-foreground/78">Date</span>
          <input
            type="date"
            value={selectedDate}
            disabled={isPending}
            onChange={(event) => onSelectDate(event.target.value)}
            className="sr-only"
            aria-label="Choose a different day"
          />
        </label>
      </div>
    </section>
  );
}
