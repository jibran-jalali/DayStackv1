"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { cn } from "@/lib/utils";

export type MobilePlannerView = "dashboard" | "grid" | "leaderboard" | "list" | "recurring";

interface MobileViewSwitcherProps {
  activeView: MobilePlannerView;
  disabled?: boolean;
  onChange: (view: MobilePlannerView) => void;
}

const views: Array<{ key: MobilePlannerView; label: string }> = [
  { key: "list", label: "Tasks" },
  { key: "grid", label: "Grid" },
  { key: "dashboard", label: "Overview" },
  { key: "recurring", label: "Repeat" },
  { key: "leaderboard", label: "Top" },
];

export function MobileViewSwitcher({ activeView, disabled, onChange }: MobileViewSwitcherProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [indicator, setIndicator] = useState({ left: 0, width: 0 });

  const updateIndicator = useCallback(() => {
    const container = containerRef.current;
    if (!container) return;

    const activeIndex = views.findIndex((v) => v.key === activeView);
    const buttons = container.querySelectorAll<HTMLButtonElement>("[data-view-btn]");
    const activeButton = buttons[activeIndex];
    if (!activeButton) return;

    setIndicator({
      left: activeButton.offsetLeft,
      width: activeButton.offsetWidth,
    });
  }, [activeView]);

  useEffect(() => {
    updateIndicator();
    window.addEventListener("resize", updateIndicator);
    return () => window.removeEventListener("resize", updateIndicator);
  }, [updateIndicator]);

  return (
    <section className="mobile-segmented mobile-stagger-3" aria-label="Planner view">
      <div ref={containerRef} className="mobile-segmented__track relative grid grid-cols-5 gap-0.5 p-1">
        <span
          className="mobile-segmented__indicator"
          style={{
            transform: `translateX(${indicator.left}px)`,
            width: indicator.width,
          }}
          aria-hidden
        />
        {views.map((view) => {
          const isActive = activeView === view.key;

          return (
            <button
              key={view.key}
              type="button"
              data-view-btn
              disabled={disabled}
              className={cn(
                "mobile-segmented__btn relative z-[1]",
                isActive && "mobile-segmented__btn--active",
              )}
              onClick={() => onChange(view.key)}
            >
              {view.label}
            </button>
          );
        })}
      </div>
    </section>
  );
}
