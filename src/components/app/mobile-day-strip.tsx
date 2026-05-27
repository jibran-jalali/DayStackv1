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
    <section className="mobile-section mobile-day-section-prominent mobile-stagger-2" aria-label="Choose day">
      <div className="mobile-section__head">
        <p className="mobile-section__title">Schedule</p>
        <label className="mobile-day-pick-btn">
          <CalendarDays className="h-3.5 w-3.5" strokeWidth={2} />
          <span>Pick date</span>
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

      <div className="mobile-day-row">
        {days.map((dateKey) => {
          const isActive = dateKey === selectedDate;
          const isToday = dateKey === todayDate;
          const { dayNumber, monthLabel, weekdayLabel } = formatDayLabel(dateKey);

          return (
            <button
              key={dateKey}
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
              <span className="mobile-day-pill__weekday">{weekdayLabel.slice(0, 3)}</span>
              <span className="mobile-day-pill__number">{dayNumber}</span>
              <span className="mobile-day-pill__meta">{isToday ? "Today" : monthLabel}</span>
            </button>
          );
        })}
      </div>
    </section>
  );
}
