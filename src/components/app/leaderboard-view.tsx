"use client";

import { Crown, Flame, Gauge, Star, Trophy } from "lucide-react";

import { EmptyState } from "@/components/shared/empty-state";
import { StatusChip } from "@/components/shared/status-chip";
import { cn } from "@/lib/utils";
import type { LeaderboardEntry } from "@/types/daystack";

interface LeaderboardViewProps {
  entries: LeaderboardEntry[];
  currentUserId?: string;
  mode?: "app" | "website";
}

function RankBadge({ rank }: { rank: number }) {
  return (
    <span
      className={cn(
        "inline-flex h-10 w-10 items-center justify-center rounded-full border text-sm font-semibold shadow-[0_10px_24px_rgba(15,23,42,0.05)]",
        rank === 1
          ? "border-cyan-200 bg-cyan-50 text-sky-700"
          : "border-border/70 bg-white/88 text-foreground",
      )}
    >
      {rank}
    </span>
  );
}

export function LeaderboardView({
  currentUserId,
  entries,
  mode = "app",
}: LeaderboardViewProps) {
  const leader = entries[0] ?? null;
  const leaderName = mode === "website" ? leader?.publicLabel : leader?.displayName;
  const showLeaderCelebration =
    mode === "app" && Boolean(currentUserId) && Boolean(leader) && leader?.userId === currentUserId;

  if (entries.length === 0) {
    return (
      <EmptyState
        icon={<Trophy className="h-5 w-5" />}
        title="Leaderboard will appear once streaks start."
        description="As people complete strong days, the top streaks will show up here."
      />
    );
  }

  return (
    <div className="mx-auto max-w-5xl space-y-5">
      <section className="relative overflow-hidden rounded-[28px] border border-white/70 bg-[linear-gradient(135deg,rgba(24,190,239,0.12),rgba(109,40,240,0.12))] p-5 shadow-[0_18px_40px_rgba(15,23,42,0.08)] sm:p-6">
        <div className="pointer-events-none absolute inset-y-0 right-0 w-[18rem] bg-[radial-gradient(circle_at_center,rgba(255,255,255,0.34),transparent_70%)]" />
        <div className="relative flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div className="space-y-3">
            {showLeaderCelebration ? (
              <div className="inline-flex w-fit items-center gap-2 rounded-full border border-lime-200 bg-[linear-gradient(135deg,rgba(236,253,245,0.98),rgba(254,249,195,0.92))] px-3 py-1.5 text-xs font-semibold text-lime-700 shadow-[0_10px_24px_rgba(132,204,22,0.16)]">
                <Star className="h-3.5 w-3.5 fill-current" />
                You&rsquo;re leading DayStack
              </div>
            ) : null}
            <p className="section-label">Global streak leaderboard</p>
            <div>
              <h2 className="font-display text-3xl font-semibold text-foreground sm:text-[2.6rem]">
                {leaderName}
              </h2>
              <p className="mt-1 text-sm text-secondary-foreground">
                Leading the board with the longest active streak right now.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <StatusChip label={`#${leader?.rank ?? 1}`} tone="brand" icon={Crown} />
            <StatusChip
              label={`${leader?.currentStreak ?? 0} day${leader?.currentStreak === 1 ? "" : "s"}`}
              tone="success"
              icon={Flame}
            />
            <StatusChip label={`${leader?.latestExecutionScore ?? 0}% latest`} tone="default" icon={Gauge} />
          </div>
        </div>
      </section>

      <section className="glass-panel overflow-hidden p-4 sm:p-5">
        <div className="flex items-start justify-between gap-3 border-b border-border/70 pb-4">
          <div>
            <p className="section-label">Top 10</p>
            <h2 className="mt-1 font-display text-2xl font-semibold text-foreground sm:text-[2rem]">
              Streak rankings
            </h2>
            <p className="mt-1.5 text-sm text-secondary-foreground">
              Ties are broken by the latest execution score.
            </p>
          </div>
          <StatusChip label={`${entries.length} ranked`} tone="brand" icon={Trophy} />
        </div>

        <div className="mt-4 space-y-3">
          {entries.map((entry) => {
            const displayName = mode === "website" ? entry.publicLabel : entry.displayName;
            const isCurrentUser = mode === "app" && Boolean(currentUserId) && entry.userId === currentUserId;

            return (
              <article
                key={entry.userId}
                className={cn(
                  "flex flex-col gap-3 rounded-[22px] border px-4 py-4 shadow-[0_12px_28px_rgba(15,23,42,0.05)] transition-[transform,box-shadow,border-color,background-color] duration-150 ease-[cubic-bezier(0.22,1,0.36,1)] sm:flex-row sm:items-center sm:justify-between",
                  entry.rank === 1
                    ? "border-cyan-200 bg-cyan-50/72"
                    : "border-border/70 bg-white/86",
                  isCurrentUser && "ring-2 ring-[var(--ring)]",
                )}
              >
                <div className="flex min-w-0 items-center gap-3">
                  <RankBadge rank={entry.rank} />
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="truncate text-base font-semibold text-foreground">{displayName}</p>
                      {isCurrentUser ? <StatusChip label="You" tone="brand" /> : null}
                    </div>
                    <p className="mt-1 text-sm text-secondary-foreground">
                      {entry.currentStreak === 0
                        ? "Waiting to start a new streak."
                        : `${entry.currentStreak} day${entry.currentStreak === 1 ? "" : "s"} active`}
                    </p>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <StatusChip
                    label={`${entry.currentStreak} day${entry.currentStreak === 1 ? "" : "s"}`}
                    tone={entry.rank === 1 ? "brand" : "success"}
                    icon={Flame}
                  />
                  <StatusChip label={`${entry.latestExecutionScore}% latest`} tone="default" icon={Gauge} />
                </div>
              </article>
            );
          })}
        </div>
      </section>
    </div>
  );
}
