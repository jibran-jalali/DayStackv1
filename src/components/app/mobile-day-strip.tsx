"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
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
  const [visibleSelectedDate, setVisibleSelectedDate] = useState(selectedDate);
  const [dayWindowCenter, setDayWindowCenter] = useState(selectedDate);
  const days = Array.from({ length: 61 }, (_, index) => shiftDate(dayWindowCenter, index - 30));
  const stripRef = useRef<HTMLDivElement | null>(null);
  const autoScrollTimerRef = useRef<number | null>(null);
  const frameRef = useRef<number | null>(null);
  const scrollSettleTimerRef = useRef<number | null>(null);
  const isAutoScrollingRef = useRef(false);
  const lastScrollLeftRef = useRef(0);
  const selectedDateRef = useRef(selectedDate);

  useEffect(() => {
    selectedDateRef.current = selectedDate;
    setVisibleSelectedDate(selectedDate);
    setDayWindowCenter(selectedDate);
  }, [selectedDate]);

  useLayoutEffect(() => {
    const strip = stripRef.current;
    const selectedButton = stripRef.current?.querySelector<HTMLButtonElement>("[data-active='true']");

    if (!strip || !selectedButton) {
      return;
    }

    isAutoScrollingRef.current = true;
    strip.scrollTo({
      behavior: "auto",
      left: selectedButton.offsetLeft - strip.clientWidth / 2 + selectedButton.clientWidth / 2,
    });
    lastScrollLeftRef.current = strip.scrollLeft;

    if (autoScrollTimerRef.current !== null) {
      window.clearTimeout(autoScrollTimerRef.current);
    }

    autoScrollTimerRef.current = window.setTimeout(() => {
      isAutoScrollingRef.current = false;
      autoScrollTimerRef.current = null;
    }, 90);
  }, [visibleSelectedDate]);

  useEffect(() => {
    return () => {
      if (autoScrollTimerRef.current !== null) {
        window.clearTimeout(autoScrollTimerRef.current);
      }

      if (frameRef.current !== null) {
        window.cancelAnimationFrame(frameRef.current);
      }

      if (scrollSettleTimerRef.current !== null) {
        window.clearTimeout(scrollSettleTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    const strip = stripRef.current;

    if (!strip) {
      return;
    }

    strip.addEventListener("scroll", handleStripScroll, { passive: true });

    return () => {
      strip.removeEventListener("scroll", handleStripScroll);
    };
  });

  function selectCenteredDay() {
    const strip = stripRef.current;

    if (!strip) {
      return;
    }

    const stripBounds = strip.getBoundingClientRect();
    const stripCenter = stripBounds.left + stripBounds.width / 2;
    const carousel = strip.closest<HTMLElement>(".mobile-day-carousel");
    const slotWidthValue = carousel
      ? getComputedStyle(carousel).getPropertyValue("--mobile-day-slot-width").trim()
      : "";
    const slotWidth = slotWidthValue.endsWith("rem")
      ? Number.parseFloat(slotWidthValue) * Number.parseFloat(getComputedStyle(document.documentElement).fontSize)
      : Number.parseFloat(slotWidthValue) || 95;
    const slotLeft = stripCenter - slotWidth / 2;
    const slotRight = stripCenter + slotWidth / 2;
    const isMovingForward = strip.scrollLeft > lastScrollLeftRef.current;
    const buttons = Array.from(strip.querySelectorAll<HTMLButtonElement>("[data-date]"));
    const buttonPositions = buttons.map((button) => {
      const bounds = button.getBoundingClientRect();
      return {
        bounds,
        button,
        center: bounds.left + bounds.width / 2,
      };
    });
    const buttonsFullyInsideSlot = buttonPositions.filter(
      ({ bounds }) => bounds.left >= slotLeft - 1 && bounds.right <= slotRight + 1,
    );
    const directionalButton =
      buttonsFullyInsideSlot.length > 0
        ? buttonsFullyInsideSlot.reduce((candidate, current) =>
            isMovingForward
              ? current.center > candidate.center
                ? current
                : candidate
              : current.center < candidate.center
                ? current
                : candidate,
          ).button
        : null;
    const nextDate = directionalButton?.dataset.date;

    lastScrollLeftRef.current = strip.scrollLeft;

    if (nextDate && nextDate !== selectedDateRef.current) {
      selectDate(nextDate);
    }
  }

  function handleStripScroll() {
    if (isAutoScrollingRef.current) {
      return;
    }

    if (scrollSettleTimerRef.current !== null) {
      window.clearTimeout(scrollSettleTimerRef.current);
    }

    scrollSettleTimerRef.current = window.setTimeout(() => {
      scrollSettleTimerRef.current = null;
      selectCenteredDay();
    }, 80);

    if (frameRef.current !== null) {
      return;
    }

    frameRef.current = window.requestAnimationFrame(() => {
      frameRef.current = null;
      selectCenteredDay();
    });
  }

  function selectDate(nextDate: string) {
    if (nextDate === selectedDateRef.current) {
      return;
    }

    selectedDateRef.current = nextDate;
    setVisibleSelectedDate(nextDate);
    onSelectDate(nextDate);
  }

  return (
    <section className="mobile-section mobile-day-section-prominent mobile-stagger-2" aria-label="Choose day">
      <div className="mobile-section__head">
        <p className="mobile-section__title">Schedule</p>
        <label className="mobile-day-pick-btn">
          <CalendarDays className="h-3.5 w-3.5" strokeWidth={2} />
          <span>Pick date</span>
          <input
            type="date"
            value={visibleSelectedDate}
            disabled={isPending}
            onChange={(event) => selectDate(event.target.value)}
            className="sr-only"
            aria-label="Choose a different day"
          />
        </label>
      </div>

      <div className="mobile-day-carousel">
        <div
          ref={stripRef}
          className="mobile-day-row"
          onScroll={handleStripScroll}
          onTouchMove={handleStripScroll}
          onWheel={handleStripScroll}
        >
          {days.map((dateKey) => {
            const isActive = dateKey === visibleSelectedDate;
            const isToday = dateKey === todayDate;
            const { dayNumber, monthLabel, weekdayLabel } = formatDayLabel(dateKey);

            return (
              <button
                key={dateKey}
                type="button"
                disabled={isPending}
                data-active={isActive ? "true" : undefined}
                data-date={dateKey}
                className={cn(
                  "mobile-day-pill",
                  isActive
                    ? "mobile-day-pill--active"
                    : isToday
                      ? "mobile-day-pill--today mobile-day-pill--idle"
                      : "mobile-day-pill--idle",
                )}
                onClick={() => selectDate(dateKey)}
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
      </div>
    </section>
  );
}
