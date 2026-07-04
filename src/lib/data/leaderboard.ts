import "server-only";

import { desc, eq, inArray } from "drizzle-orm";

import { getDb, withDbReconnectRetry } from "@/db/client";
import { daily_summaries, users } from "@/db/schema";
import { calculateActiveStreak, deriveDisplayName, formatDateKey } from "@/lib/daystack";
import type { DailySummaryRecord, LeaderboardEntry } from "@/types/daystack";

function getPublicLabel(displayName: string) {
  const firstToken = displayName.trim().split(/\s+/)[0] ?? displayName.trim();
  const cleaned = firstToken.split(/[._-]/)[0]?.trim();

  return cleaned || firstToken || "User";
}

export async function fetchLeaderboard(limit = 10): Promise<LeaderboardEntry[]> {
  if (limit <= 0) {
    return [];
  }

  const db = getDb();

  if (!db) {
    return [];
  }

  return withDbReconnectRetry(async (client) => {
    const userRows = await client
      .select({
        email: users.email,
        full_name: users.full_name,
        id: users.id,
      })
      .from(users)
      .where(eq(users.status, "active"));

    if (userRows.length === 0) {
      return [];
    }

    const userIds = userRows.map((user) => user.id);
    const summaryRows = await client
      .select()
      .from(daily_summaries)
      .where(inArray(daily_summaries.user_id, userIds))
      .orderBy(desc(daily_summaries.summary_date));

    if (summaryRows.length === 0) {
      return [];
    }

    const summariesByUserId = summaryRows.reduce<Map<string, DailySummaryRecord[]>>((accumulator, summary) => {
      const current = accumulator.get(summary.user_id) ?? [];
      current.push(summary);
      accumulator.set(summary.user_id, current);
      return accumulator;
    }, new Map());
    const todayDate = formatDateKey(new Date());

    return userRows
      .flatMap((user) => {
        const userSummaries = summariesByUserId.get(user.id);

        if (!userSummaries || userSummaries.length === 0) {
          return [];
        }

        const currentStreak = calculateActiveStreak(userSummaries, todayDate);

        if (currentStreak <= 0) {
          return [];
        }

        const displayName = deriveDisplayName(user.full_name, user.email);

        return [
          {
            currentStreak,
            displayName,
            latestExecutionScore: userSummaries[0]?.execution_score ?? 0,
            publicLabel: getPublicLabel(displayName),
            userId: user.id,
          },
        ];
      })
      .sort((left, right) => {
        const byStreak = right.currentStreak - left.currentStreak;

        if (byStreak !== 0) {
          return byStreak;
        }

        const byScore = right.latestExecutionScore - left.latestExecutionScore;

        if (byScore !== 0) {
          return byScore;
        }

        return left.displayName.localeCompare(right.displayName);
      })
      .slice(0, limit)
      .map(
        (entry, index) =>
          ({
            ...entry,
            rank: index + 1,
          }) satisfies LeaderboardEntry,
      );
  });
}
