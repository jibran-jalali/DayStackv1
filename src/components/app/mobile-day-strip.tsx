"use client";

import { useEffect, useRef } from "react";
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
  const scrollRef = useRef<HTMLDivElement>(null);
  const activeRef = useRef<HTMLButtonElement>(null);
  const days = Array.from({ length: 9 }, (_, index) => shiftDate(selectedDate, index - 4));

  useEffect(() => {
    activeRef.current?.scrollIntoView({ behavior: "smooth", inline: "center", block: "nearest" });
  }, [selectedDate]);

  return (
    <section className="mobile-stagger-2" aria-label="Choose day">
      <div ref={scrollRef} className="mobile-day-scroll mobile-safe-x">
        <div className="flex gap-2 pl-[max(0.75rem,env(safe-area-inset-left))] pr-[max(0.75rem,env(safe-area-inset-right))]">
          {days.map((dateKey) => {
            const isActive = dateKey === selectedDate;
            const isToday = dateKey === todayDate;
            const { dayNumber, monthLabel, weekdayLabel } = formatDayLabel(dateKey);

            return (
              <button
                key={dateKey}
                ref={isActive ? activeRef : undefined}
                type="button"
                disabled={isPending}
                className={cn(
                  "mobile-day-pill",
                  isActive
                    ? "mobile-day-pill--active"
                    : isToday
                      ? "mobile-day-pill--today mobile-day-pill--idle"
                      : "mobile-day-pill--idle",
                )}
                onClick={() => onSelectDate(dateKey)}
                aria-pressed={isActive}
                aria-label={`${weekdayLabel} ${dayNumber}${isToday ? ", today" : ""}`}
              >
                <span className="mobile-day-pill__weekday">{weekdayLabel}</span>
                <span className="mobile-day-pill__number">{dayNumber}</span>
                <span className="mobile-day-pill__meta">{isToday ? "Today" : monthLabel}</span>
              </button>
            );
          })}

          <label className="mobile-day-pick">
            <CalendarDays className="h-4 w-4" strokeWidth={2} />
            <span className="mt-1 text-[10px] font-semibold">Pick</span>
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
      </div>
    </section>
  );
}
