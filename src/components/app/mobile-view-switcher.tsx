"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  LayoutGrid,
  List,
  Repeat2,
  Trophy,
  type LucideIcon,
} from "lucide-react";

import { cn } from "@/lib/utils";

export type MobilePlannerView = "grid" | "leaderboard" | "list" | "recurring";

interface MobileViewSwitcherProps {
  activeView: MobilePlannerView;
  disabled?: boolean;
  onChange: (view: MobilePlannerView) => void;
}

const views: Array<{ icon: LucideIcon; key: MobilePlannerView; label: string }> = [
  { key: "list", label: "Tasks", icon: List },
  { key: "grid", label: "Grid", icon: LayoutGrid },
  { key: "recurring", label: "Repeat", icon: Repeat2 },
  { key: "leaderboard", label: "Top", icon: Trophy },
];

export function MobileViewSwitcher({ activeView, disabled, onChange }: MobileViewSwitcherProps) {
  const trackRef = useRef<HTMLDivElement>(null);
  const [indicator, setIndicator] = useState({ left: 0, width: 0 });

  const updateIndicator = useCallback(() => {
    const track = trackRef.current;
    if (!track) return;

    const activeIndex = views.findIndex((view) => view.key === activeView);
    const buttons = track.querySelectorAll<HTMLElement>("[data-view-segment]");
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
    <section className="mobile-section mobile-stagger-3" aria-label="Planner view">
      <div className="mobile-segment-bar">
        <div ref={trackRef} className="mobile-segment-bar__track" role="tablist">
          <span
            className="mobile-segment-bar__indicator"
            style={{
              transform: `translateX(${indicator.left}px)`,
              width: indicator.width,
            }}
            aria-hidden
          />

          {views.map((view) => {
            const isActive = activeView === view.key;
            const Icon = view.icon;

            return (
              <button
                key={view.key}
                type="button"
                role="tab"
                data-view-segment
                aria-selected={isActive}
                disabled={disabled}
                className={cn("mobile-segment-bar__item", isActive && "mobile-segment-bar__item--active")}
                onClick={() => onChange(view.key)}
              >
                <Icon className="h-4 w-4 shrink-0" strokeWidth={isActive ? 2.25 : 2} />
                <span className="mobile-segment-bar__label">{view.label}</span>
              </button>
            );
          })}
        </div>
      </div>
    </section>
  );
}
