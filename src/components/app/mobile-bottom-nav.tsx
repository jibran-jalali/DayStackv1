"use client";

import Link from "next/link";
import { Bell, CalendarDays, Settings2 } from "lucide-react";

import { cn } from "@/lib/utils";

type MobileBottomNavTab = "notifications" | "plan" | "settings";

interface MobileBottomNavProps {
  activeTab?: MobileBottomNavTab | null;
  notificationsHref?: string;
  onOpenNotifications?: () => void;
  onOpenPlan?: () => void;
  onOpenSettings?: () => void;
  onPlayNavigate?: () => void;
  plannerHref?: string;
  settingsHref?: string;
}

const navItems = [
  {
    icon: CalendarDays,
    key: "plan",
    label: "Plan",
  },
  {
    icon: Bell,
    key: "notifications",
    label: "Inbox",
  },
  {
    icon: Settings2,
    key: "settings",
    label: "Settings",
  },
] as const satisfies Array<{
  icon: typeof CalendarDays;
  key: MobileBottomNavTab;
  label: string;
}>;

export function MobileBottomNav({
  activeTab,
  notificationsHref = "/app?tab=notifications",
  onOpenNotifications,
  onOpenPlan,
  onOpenSettings,
  onPlayNavigate,
  plannerHref = "/app",
  settingsHref = "/app?tab=settings",
}: MobileBottomNavProps) {
  return (
    <div className="mobile-safe-x pointer-events-none fixed inset-x-0 bottom-0 z-40 pb-[calc(0.85rem+env(safe-area-inset-bottom))] lg:hidden">
      <nav className="mobile-shell-width mobile-nav-shell pointer-events-auto mx-auto flex items-center gap-1.5 px-1.5 py-2">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.key;
          const baseClassName = cn(
            "inline-flex min-w-0 flex-1 basis-0 flex-col items-center justify-center gap-1 rounded-[22px] px-2 py-2 text-[11px] font-semibold transition-[transform,box-shadow,background-color,color,opacity] duration-200 ease-[cubic-bezier(0.22,1,0.36,1)] active:scale-[0.98]",
            isActive
              ? "bg-brand-gradient text-white shadow-[var(--shadow-brand-pill)]"
              : "text-secondary-foreground hover:bg-muted/70 hover:text-foreground",
          );

          if (item.key === "plan") {
            return onOpenPlan ? (
              <button
                key={item.key}
                type="button"
                className={baseClassName}
                onClick={onOpenPlan}
              >
                <Icon className="h-4.5 w-4.5" />
                {item.label}
              </button>
            ) : (
              <Link
                key={item.key}
                href={plannerHref}
                className={baseClassName}
                onClick={() => onPlayNavigate?.()}
              >
                <Icon className="h-4.5 w-4.5" />
                {item.label}
              </Link>
            );
          }

          if (item.key === "notifications") {
            return onOpenNotifications ? (
              <button
                key={item.key}
                type="button"
                className={baseClassName}
                onClick={onOpenNotifications}
              >
                <Icon className="h-4.5 w-4.5" />
                {item.label}
              </button>
            ) : (
              <Link
                key={item.key}
                href={notificationsHref}
                className={baseClassName}
                onClick={() => onPlayNavigate?.()}
              >
                <Icon className="h-4.5 w-4.5" />
                {item.label}
              </Link>
            );
          }

          if (item.key === "settings") {
            return onOpenSettings ? (
              <button
                key={item.key}
                type="button"
                className={baseClassName}
                onClick={onOpenSettings}
              >
                <Icon className="h-4.5 w-4.5" />
                {item.label}
              </button>
            ) : (
              <Link
                key={item.key}
                href={settingsHref}
                className={baseClassName}
                onClick={() => onPlayNavigate?.()}
              >
                <Icon className="h-4.5 w-4.5" />
                {item.label}
              </Link>
            );
          }

        })}
      </nav>
    </div>
  );
}
