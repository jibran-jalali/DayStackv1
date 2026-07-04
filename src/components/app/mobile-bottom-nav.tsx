"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { Bell, CalendarDays, MessageSquareText, Settings2, UserRoundPlus } from "lucide-react";

import { cn } from "@/lib/utils";

type MobileBottomNavTab = "assistant" | "friends" | "notifications" | "plan" | "settings";

interface MobileBottomNavProps {
  activeTab?: MobileBottomNavTab | null;
  assistantHref?: string;
  friendsHref?: string;
  notificationsHref?: string;
  onOpenAssistant?: () => void;
  onOpenFriends?: () => void;
  onOpenNotifications?: () => void;
  onOpenPlan?: () => void;
  onOpenSettings?: () => void;
  onPlayNavigate?: () => void;
  plannerHref?: string;
  settingsHref?: string;
}

const navItems = [
  { icon: CalendarDays, key: "plan", label: "Summary" },
  { icon: MessageSquareText, key: "assistant", label: "AI" },
  { icon: Bell, key: "notifications", label: "Inbox" },
  { icon: UserRoundPlus, key: "friends", label: "Friends" },
  { icon: Settings2, key: "settings", label: "Settings" },
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
  onOpenFriends,
  onOpenNotifications,
  onOpenPlan,
  onOpenSettings,
  onPlayNavigate,
  friendsHref = "/app/friends",
  plannerHref = "/app",
  settingsHref = "/app?tab=settings",
}: MobileBottomNavProps) {
  const trackRef = useRef<HTMLElement>(null);
  const [indicator, setIndicator] = useState({ left: 0, width: 0 });

  const updateIndicator = useCallback(() => {
    const track = trackRef.current;
    if (!track || !activeTab) return;

    const activeIndex = navItems.findIndex((item) => item.key === activeTab);
    const buttons = track.querySelectorAll<HTMLElement>("[data-nav-item]");
    const activeButton = buttons[activeIndex];
    if (!activeButton) return;

    setIndicator({
      left: activeButton.offsetLeft,
      width: activeButton.offsetWidth,
    });
  }, [activeTab]);

  useEffect(() => {
    updateIndicator();
    window.addEventListener("resize", updateIndicator);
    return () => window.removeEventListener("resize", updateIndicator);
  }, [updateIndicator]);

  const renderItem = (item: (typeof navItems)[number]) => {
    const Icon = item.icon;
    const isActive = activeTab === item.key;
    const className = cn("mobile-nav-item", isActive && "mobile-nav-item--active");

    const content = (
      <>
        <span className="mobile-nav-icon-shell">
          <Icon className={cn("h-[1.05rem] w-[1.05rem]", isActive && "drop-shadow-sm")} strokeWidth={isActive ? 2.4 : 2} />
        </span>
        <span>{item.label}</span>
      </>
    );

    if (item.key === "plan") {
      return onOpenPlan ? (
        <button key={item.key} type="button" data-nav-item className={className} onClick={onOpenPlan}>
          {content}
        </button>
      ) : (
        <Link key={item.key} href={plannerHref} data-nav-item className={className} onClick={() => onPlayNavigate?.()}>
          {content}
        </Link>
      );
    }

    if (item.key === "notifications") {
      return onOpenNotifications ? (
        <button key={item.key} type="button" data-nav-item className={className} onClick={onOpenNotifications}>
          {content}
        </button>
      ) : (
        <Link
          key={item.key}
          href={notificationsHref}
          data-nav-item
          className={className}
          onClick={() => onPlayNavigate?.()}
        >
          {content}
        </Link>
      );
    }

    if (item.key === "assistant") {
      return onOpenAssistant ? (
        <button key={item.key} type="button" data-nav-item className={className} onClick={onOpenAssistant}>
          {content}
        </button>
      ) : (
        <Link
          key={item.key}
          href={assistantHref}
          data-nav-item
          className={className}
          onClick={() => onPlayNavigate?.()}
        >
          {content}
        </Link>
      );
    }

    if (item.key === "settings") {
      return onOpenSettings ? (
        <button key={item.key} type="button" data-nav-item className={className} onClick={onOpenSettings}>
          {content}
        </button>
      ) : (
        <Link key={item.key} href={settingsHref} data-nav-item className={className} onClick={() => onPlayNavigate?.()}>
          {content}
        </Link>
      );
    }

    if (item.key === "friends") {
      return onOpenFriends ? (
        <button key={item.key} type="button" data-nav-item className={className} onClick={onOpenFriends}>
          {content}
        </button>
      ) : (
        <Link key={item.key} href={friendsHref} data-nav-item className={className} onClick={() => onPlayNavigate?.()}>
          {content}
        </Link>
      );
    }

    return null;
  };

  return (
    <div className="mobile-dock-wrap lg:hidden">
      <nav
        ref={trackRef}
        className="mobile-shell-width mobile-nav-shell relative mx-auto flex gap-1 px-1.5 py-1.5"
        aria-label="Main navigation"
      >
        {activeTab ? (
          <span
            className="mobile-nav-indicator"
            style={{
              transform: `translateX(${indicator.left}px)`,
              width: indicator.width,
            }}
            aria-hidden
          />
        ) : null}
        {navItems.map((item) => renderItem(item))}
      </nav>
    </div>
  );
}
