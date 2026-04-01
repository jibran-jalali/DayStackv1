"use client";

import Link from "next/link";
import { Bell, CalendarDays, CheckCheck } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { NotificationCenter } from "@/components/app/notification-center";
import { PlannerHeader } from "@/components/app/planner-header";
import { buttonVariants } from "@/components/shared/button";
import { formatDateLabel } from "@/lib/daystack";
import type { TaskNotificationAcceptResult } from "@/types/daystack";

interface NotificationsShellProps {
  displayName: string;
  email?: string;
  returnDate?: string;
}

type NoticeState =
  | {
      type: "success" | "error";
      message: string;
    }
  | null;

function getPlannerHref(returnDate?: string) {
  if (!returnDate) {
    return "/app";
  }

  return `/app?date=${returnDate}`;
}

function getSettingsHref(returnDate?: string) {
  if (!returnDate) {
    return "/app/settings";
  }

  return `/app/settings?date=${returnDate}`;
}

export function NotificationsShell({
  displayName,
  email,
  returnDate,
}: NotificationsShellProps) {
  const [notice, setNotice] = useState<NoticeState>(null);
  const plannerHref = useMemo(() => getPlannerHref(returnDate), [returnDate]);
  const settingsHref = useMemo(() => getSettingsHref(returnDate), [returnDate]);

  useEffect(() => {
    if (notice?.type !== "success") {
      return;
    }

    const timer = window.setTimeout(() => {
      setNotice(null);
    }, 2400);

    return () => window.clearTimeout(timer);
  }, [notice]);

  function handleTaskAccepted(result: TaskNotificationAcceptResult) {
    if (result.outcome === "accepted") {
      setNotice({
        type: "success",
        message: "The meeting block was added to your timeline.",
      });
      return;
    }

    if (result.outcome === "already_accepted") {
      setNotice({
        type: "success",
        message: "That meeting block is already in your timeline.",
      });
      return;
    }

    setNotice({
      type: "error",
      message: "That meeting was deleted before you accepted it.",
    });
  }

  return (
    <main className="container-shell min-h-screen py-4 sm:py-6">
      <div className="space-y-4 sm:space-y-5">
        <PlannerHeader
          activePage="notifications"
          dateLabel="Notifications"
          displayName={displayName}
          email={email}
          metricIcon={Bell}
          metricLabel="Meeting mentions"
          metricTone="brand"
          plannerHref={plannerHref}
          settingsHref={settingsHref}
          subtitle="Approve meeting blocks and open the linked schedule in one place."
          onNotice={setNotice}
          onSignOutError={(message) =>
            setNotice({
              type: "error",
              message,
            })
          }
        />

        {notice ? (
          <div className="pointer-events-none fixed inset-x-0 top-20 z-40 flex justify-center px-4">
            <div
              aria-live="polite"
              className={`pointer-events-auto min-w-[16rem] rounded-full border px-4 py-2.5 text-sm shadow-[0_18px_40px_rgba(15,23,42,0.12)] backdrop-blur-xl ${
                notice.type === "success"
                  ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                  : "border-red-200 bg-red-50 text-danger"
              }`}
            >
              {notice.message}
            </div>
          </div>
        ) : null}

        <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_19rem]">
          <NotificationCenter
            limit={40}
            mode="page"
            onNotice={setNotice}
            onTaskAccepted={handleTaskAccepted}
          />

          <aside className="space-y-4 xl:sticky xl:top-24 xl:self-start">
            <section className="rounded-[22px] border border-border/70 bg-white/82 p-4 shadow-[0_12px_28px_rgba(15,23,42,0.05)]">
              <p className="section-label">Plan</p>
              <div className="mt-3 space-y-3">
                <div>
                  <p className="text-sm font-semibold text-foreground">{displayName}</p>
                  <p className="text-sm text-secondary-foreground">{email ?? "Focused operator"}</p>
                </div>
                {returnDate ? (
                  <div className="rounded-[18px] border border-border/70 bg-muted/35 px-3 py-2.5 text-sm text-secondary-foreground">
                    Return day: <span className="font-medium text-foreground">{formatDateLabel(returnDate)}</span>
                  </div>
                ) : null}
                <Link
                  href={plannerHref}
                  className={buttonVariants({ variant: "secondary", size: "sm", className: "w-full" })}
                >
                  <CalendarDays className="h-4 w-4" />
                  Back to plan
                </Link>
              </div>
            </section>

            <section className="rounded-[22px] border border-border/70 bg-white/82 p-4 shadow-[0_12px_28px_rgba(15,23,42,0.05)]">
              <div className="flex items-start gap-3">
                <span className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-cyan-50 text-sky-700">
                  <CheckCheck className="h-5 w-5" />
                </span>
                <div>
                  <p className="text-sm font-semibold text-foreground">Approval adds the block immediately</p>
                  <p className="mt-1 text-sm text-secondary-foreground">
                    Accepting a meeting mention clones the block into your schedule and keeps the meeting link attached.
                  </p>
                </div>
              </div>
            </section>
          </aside>
        </div>
      </div>
    </main>
  );
}
