"use client";

import Link from "next/link";
import { Bell, CalendarDays, MessageSquareText, Settings2, UserRoundPlus } from "lucide-react";

import { cn } from "@/lib/utils";

type MobileBottomNavTab = "assistant" | "friends" | "notifications" | "plan" | "settings";

interface MobileBottomNavProps {
  activeTab?: MobileBottomNavTab | null;
  assistantHref?: string;
  friendsHref?: string;
  onOpenAssistant?: () => void;
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
    icon: MessageSquareText,
    key: "assistant",
    label: "Assistant",
  },
  {
    icon: Bell,
    key: "notifications",
    label: "Inbox",
  },
  {
    icon: UserRoundPlus,
    key: "friends",
    label: "Friends",
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
  assistantHref = "/app?tab=assistant",
  onOpenAssistant,
  notificationsHref = "/app?tab=notifications",
  onOpenNotifications,
  onOpenPlan,
  onOpenSettings,
  onPlayNavigate,
  friendsHref = "/app/friends",
  plannerHref = "/app",
  settingsHref = "/app?tab=settings",
}: MobileBottomNavProps) {
  return (
    <div className="mobile-safe-x shrink-0 pb-[calc(0.55rem+env(safe-area-inset-bottom))] pt-2 lg:hidden">
      <nav className="mobile-shell-width mobile-nav-shell mx-auto flex items-center gap-1 px-1 py-1.5">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.key;
          const baseClassName = cn(
            "inline-flex min-w-0 flex-1 basis-0 flex-col items-center justify-center gap-0.5 rounded-[17px] px-1 py-1.5 text-[10px] font-semibold transition-[transform,box-shadow,background-color,color,opacity] duration-200 ease-[cubic-bezier(0.22,1,0.36,1)] active:scale-[0.98]",
            isActive
              ? "bg-brand-gradient text-white shadow-[var(--shadow-brand-pill)]"
              : "text-secondary-foreground hover:bg-muted/70 hover:text-foreground",
          );

          if (item.key === "plan") {
            return onOpenPlan ? (
              <button
                key={item.key}
                suppressHydrationWarning
                type="button"
                className={baseClassName}
                onClick={onOpenPlan}
              >
                <Icon className="h-4 w-4" />
                {item.label}
              </button>
            ) : (
              <Link
                key={item.key}
                href={plannerHref}
                className={baseClassName}
                onClick={() => onPlayNavigate?.()}
              >
                <Icon className="h-4 w-4" />
                {item.label}
              </Link>
            );
          }

          if (item.key === "notifications") {
            return onOpenNotifications ? (
              <button
                key={item.key}
                suppressHydrationWarning
                type="button"
                className={baseClassName}
                onClick={onOpenNotifications}
              >
                <Icon className="h-4 w-4" />
                {item.label}
              </button>
            ) : (
              <Link
                key={item.key}
                href={notificationsHref}
                className={baseClassName}
                onClick={() => onPlayNavigate?.()}
              >
                <Icon className="h-4 w-4" />
                {item.label}
              </Link>
            );
          }

          if (item.key === "assistant") {
            return onOpenAssistant ? (
              <button
                key={item.key}
                suppressHydrationWarning
                type="button"
                className={baseClassName}
                onClick={onOpenAssistant}
              >
                <Icon className="h-4 w-4" />
                {item.label}
              </button>
            ) : (
              <Link
                key={item.key}
                href={assistantHref}
                className={baseClassName}
                onClick={() => onPlayNavigate?.()}
              >
                <Icon className="h-4 w-4" />
                {item.label}
              </Link>
            );
          }

          if (item.key === "settings") {
            return onOpenSettings ? (
              <button
                key={item.key}
                suppressHydrationWarning
                type="button"
                className={baseClassName}
                onClick={onOpenSettings}
              >
                <Icon className="h-4 w-4" />
                {item.label}
              </button>
            ) : (
              <Link
                key={item.key}
                href={settingsHref}
                className={baseClassName}
                onClick={() => onPlayNavigate?.()}
              >
                <Icon className="h-4 w-4" />
                {item.label}
              </Link>
            );
          }

          if (item.key === "friends") {
            return (
              <Link
                key={item.key}
                href={friendsHref}
                className={baseClassName}
                onClick={() => onPlayNavigate?.()}
              >
                <Icon className="h-4 w-4" />
                {item.label}
              </Link>
            );
          }
        })}
      </nav>
    </div>
  );
}
