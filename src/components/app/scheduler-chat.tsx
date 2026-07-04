"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowUp, CheckCircle2, Loader2, Sparkles } from "lucide-react";

import { LogoMark } from "@/components/shared/logo";
import { formatDateLabel } from "@/lib/daystack";
import { cn, getErrorMessage } from "@/lib/utils";
import type { DashboardSnapshot } from "@/types/daystack";

interface SchedulerChatProps {
  onNotice: (notice: { message: string; type: "error" | "success" }) => void;
  onRefreshContext: (taskDate: string) => Promise<void>;
  snapshot: DashboardSnapshot;
}

interface PlannedTask {
  title: string;
  startTime: string;
  endTime: string;
}

interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  schedule?: {
    tasks: PlannedTask[];
    date: string;
    window: { start: string; end: string };
  };
}

const QUICK_PROMPTS = [
  "From 9 AM to 6 PM: code feature 3h, standup 30m, lunch 1h, PR review 1h, email 30m, gym 1h",
  "From 8 AM to 8 PM: calculus 2h, practice 90m, lunch 1h, notes 1h, textbook 90m, dinner 1h",
  "From 10 AM to 4 PM: morning routine 30m, admin 1h, lunch 1h, walk 30m, plan tomorrow 30m",
];

const TASK_COLORS = [
  "from-violet-500 to-violet-600",
  "from-blue-500 to-cyan-500",
  "from-emerald-500 to-teal-500",
  "from-amber-500 to-orange-500",
  "from-rose-500 to-pink-500",
  "from-indigo-500 to-purple-500",
  "from-sky-500 to-blue-500",
  "from-lime-500 to-green-500",
];

function minutesSinceMidnight(time: string) {
  const [h, m] = time.split(":").map(Number);
  return h * 60 + m;
}

function formatClock(time: string) {
  const [h, m] = time.split(":").map(Number);
  const period = h >= 12 ? "PM" : "AM";
  const hour = h % 12 || 12;
  return `${hour}:${m.toString().padStart(2, "0")} ${period}`;
}

function TimelineCard({
  schedule,
  isConfirming,
  onConfirm,
}: {
  schedule: NonNullable<ChatMessage["schedule"]>;
  isConfirming: boolean;
  onConfirm: () => void;
}) {
  const dayMinutes = schedule.tasks.map((t) => ({
    ...t,
    startM: minutesSinceMidnight(t.startTime),
    endM: minutesSinceMidnight(t.endTime),
    durationM: minutesSinceMidnight(t.endTime) - minutesSinceMidnight(t.startTime),
  }));

  const windowStart = minutesSinceMidnight(schedule.window.start);
  const windowEnd = minutesSinceMidnight(schedule.window.end);
  const totalWindow = windowEnd - windowStart;

  return (
    <div className="mt-3 overflow-hidden rounded-[22px] border border-white/80 bg-white/94 shadow-[0_12px_30px_rgba(83,78,222,0.08)] backdrop-blur-xl">
      <div className="bg-[linear-gradient(135deg,rgba(24,190,239,0.1),rgba(109,40,240,0.06))] border-b border-cyan-100/60 px-4 py-3">
        <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
          <Sparkles className="h-4 w-4 text-primary" />
          Optimized plan
        </div>
        <p className="mt-0.5 text-xs text-secondary-foreground">
          {schedule.window.start} — {schedule.window.end} · {schedule.tasks.length} task{schedule.tasks.length !== 1 ? "s" : ""}
        </p>
      </div>

      <div className="px-4 py-3">
        <div className="relative h-8 w-full overflow-hidden rounded-full border border-border/50 bg-muted/60">
          {dayMinutes.map((task, index) => {
            const left = ((task.startM - windowStart) / totalWindow) * 100;
            const width = (task.durationM / totalWindow) * 100;
            return (
              <div
                key={task.title}
                className={cn(
                  "absolute top-0 h-full rounded-full bg-gradient-to-r transition-all",
                  TASK_COLORS[index % TASK_COLORS.length],
                )}
                style={{
                  left: `${Math.max(0, left)}%`,
                  width: `${Math.max(2, width)}%`,
                }}
                title={task.title}
              />
            );
          })}
        </div>
        <div className="mt-1 flex justify-between px-0.5 text-[10px] font-medium text-secondary-foreground/50">
          <span>{schedule.window.start}</span>
          <span>{schedule.window.end}</span>
        </div>
      </div>

      <div className="space-y-1 px-4 pb-3">
        {dayMinutes.map((task, index) => (
          <div
            key={task.title}
            className="flex items-center gap-3 rounded-[14px] border border-border/60 bg-muted/30 px-3 py-2 transition hover:bg-muted/60"
          >
            <span
              className={cn(
                "inline-flex h-2.5 w-2.5 shrink-0 rounded-full bg-gradient-to-r",
                TASK_COLORS[index % TASK_COLORS.length],
              )}
            />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-foreground">{task.title}</p>
              <p className="text-xs text-secondary-foreground/70">{task.durationM} min</p>
            </div>
            <div className="shrink-0 text-right">
              <p className="text-xs font-semibold text-foreground">{formatClock(task.startTime)}</p>
              <p className="text-[11px] text-secondary-foreground/60">{formatClock(task.endTime)}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="border-t border-border/50 px-4 py-3">
        <button
          type="button"
          onClick={onConfirm}
          disabled={isConfirming}
          className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-full bg-brand-gradient text-sm font-semibold text-white shadow-[0_12px_24px_rgba(83,78,222,0.22)] transition-all hover:scale-[1.02] active:scale-[0.98] disabled:opacity-60 disabled:hover:scale-100"
        >
          {isConfirming ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <CheckCircle2 className="h-4 w-4" />
          )}
          {isConfirming ? "Creating plan..." : "Create plan"}
        </button>
      </div>
    </div>
  );
}

function extractPlanInfo(text: string): {
  tasks: Array<{ title: string; durationMinutes: number }>;
  startTime: string;
  endTime: string;
} | null {
  const tasks: Array<{ title: string; durationMinutes: number }> = [];
  let startTime = "09:00";
  let endTime = "17:00";

  const timeRangeMatch = text.match(/from\s+(\d{1,2})(?::(\d{2}))?\s*(am|pm)?/i);
  const toMatch = text.match(/(?:to|until|till|-)\s+(\d{1,2})(?::(\d{2}))?\s*(am|pm)?/i);

  if (timeRangeMatch) {
    let h = parseInt(timeRangeMatch[1], 10);
    const m = timeRangeMatch[2] ? parseInt(timeRangeMatch[2], 10) : 0;
    const p = timeRangeMatch[3]?.toLowerCase();
    if (p === "pm" && h < 12) h += 12;
    if (p === "am" && h === 12) h = 0;
    startTime = `${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}`;
  }

  if (toMatch) {
    let h = parseInt(toMatch[1], 10);
    const m = toMatch[2] ? parseInt(toMatch[2], 10) : 0;
    const p = toMatch[3]?.toLowerCase();
    if (p === "pm" && h < 12) h += 12;
    if (p === "am" && h === 12) h = 0;
    endTime = `${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}`;
  }

  const taskRegex = /(?:^|[,;•\-])\s*(.+?)\s*(?:\((\d+)\s*(?:h(?:ou)?r?s?|min(?:ute)?s?)\)|\s+(\d+)\s*(?:h(?:ou)?r?s?|min(?:ute)?s?))/gi;
  let match;

  while ((match = taskRegex.exec(text)) !== null) {
    const title = match[1].trim();
    const duration = parseInt(match[2] || match[3], 10);
    const isHours = text.slice(match.index, match.index + match[0].length).includes("h");
    tasks.push({
      title,
      durationMinutes: isHours ? duration * 60 : duration,
    });
  }

  if (tasks.length === 0) {
    return null;
  }

  return { tasks, startTime, endTime };
}

export function SchedulerChat({
  onNotice,
  onRefreshContext,
  snapshot,
}: SchedulerChatProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [isPlanning, setIsPlanning] = useState(false);
  const [isConfirming, setIsConfirming] = useState(false);
  const chatRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (chatRef.current) {
      chatRef.current.scrollTo({ top: chatRef.current.scrollHeight, behavior: "smooth" });
    }
  }, [messages]);

  const hasConversation = messages.length > 0;

  async function handleSubmit(text: string) {
    const prompt = text.trim();
    if (!prompt || isPlanning || isConfirming) return;

    const userMsg: ChatMessage = { id: crypto.randomUUID(), role: "user", content: prompt };
    setMessages((prev) => [...prev, userMsg]);
    setDraft("");
    setIsPlanning(true);

    try {
      const planInfo = extractPlanInfo(prompt);

      if (!planInfo) {
        setMessages((prev) => [
          ...prev,
          {
            id: crypto.randomUUID(),
            role: "assistant",
            content:
              "Add a time window and durations. Example:\n\n" +
              "> *From 9 AM to 5 PM: calculus 2h, gym 1h, lunch 1h, review notes 45m*",
          },
        ]);
        setIsPlanning(false);
        return;
      }

      const response = await fetch("/api/assistant/plan", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          date: snapshot.taskDate,
          startTime: planInfo.startTime,
          endTime: planInfo.endTime,
          tasks: planInfo.tasks,
        }),
      });

      if (!response.ok) {
        throw new Error("AI planning failed. Check your API keys.");
      }

      const data = (await response.json()) as { tasks: PlannedTask[] };

      const summary = planInfo.tasks
        .map((t) => `${t.title} (${t.durationMinutes}m)`)
        .join(", ");

      setMessages((prev) => [
        ...prev,
        {
          id: crypto.randomUUID(),
          role: "assistant",
          content: `Drafted a productive plan for **${planInfo.startTime} — ${planInfo.endTime}**.\n\n> ${summary}`,
          schedule: {
            tasks: data.tasks,
            date: snapshot.taskDate,
            window: { start: planInfo.startTime, end: planInfo.endTime },
          },
        },
      ]);
    } catch (error) {
      setMessages((prev) => [
        ...prev,
        {
          id: crypto.randomUUID(),
          role: "assistant",
          content: `Something went wrong: ${getErrorMessage(error)}`,
        },
      ]);
      onNotice({ message: getErrorMessage(error), type: "error" });
    } finally {
      setIsPlanning(false);
    }
  }

  async function handleConfirmSchedule(schedule: NonNullable<ChatMessage["schedule"]>) {
    setIsConfirming(true);

    try {
      const response = await fetch("/api/assistant/plan", {
        method: "PUT",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          date: schedule.date,
          tasks: schedule.tasks,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to create tasks.");
      }

      const result = (await response.json()) as { created: Array<{ title: string; id: string }>; errors: Array<{ title: string; error: string }> };

      setMessages((prev) => [
        ...prev,
        {
          id: crypto.randomUUID(),
          role: "assistant",
            content: `Created ${result.created.length} task${result.created.length !== 1 ? "s" : ""}.${result.errors.length > 0 ? `\n${result.errors.length} failed.` : ""}`,
        },
      ]);

      onNotice({
        message: `${result.created.length} task${result.created.length !== 1 ? "s" : ""} added to your schedule.`,
        type: "success",
      });

      await onRefreshContext(schedule.date);
    } catch (error) {
      onNotice({ message: getErrorMessage(error), type: "error" });
    } finally {
      setIsConfirming(false);
    }
  }

  function handleKeyDown(event: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      void handleSubmit(draft);
    }
  }

  const isBusy = isPlanning || isConfirming;

  return (
    <section className="flex h-full min-h-0 flex-1 flex-col overflow-hidden">
      {/* ── Header ── */}
      <div className="flex items-center gap-3 border-b border-white/70 bg-white/78 px-4 py-3 backdrop-blur-xl sm:px-6 lg:px-8">
        <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-brand-gradient shadow-[0_8px_18px_rgba(83,78,222,0.18)]">
          <Sparkles className="h-4 w-4 text-white" />
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="font-display text-sm font-bold tracking-tight text-foreground">DayStack AI</h2>
          <p className="truncate text-[11px] text-secondary-foreground/60">Planning {formatDateLabel(snapshot.taskDate)}</p>
        </div>
        {snapshot.summary.totalTasks > 0 && (
          <div className="shrink-0 rounded-full border border-border/70 bg-white/80 px-3 py-1 text-[11px] font-semibold text-secondary-foreground shadow-sm">
            {snapshot.summary.completedTasks}/{snapshot.summary.totalTasks}
          </div>
        )}
      </div>

      {/* ── Chat area ── */}
      <div ref={chatRef} className="soft-scrollbar flex-1 overflow-y-auto">
        {!hasConversation ? (
          /* ── Welcome screen (like Claude/Gemini) ── */
          <div className="flex min-h-full flex-col items-center justify-center px-4 pb-4 pt-6 sm:px-6">
            <div className="mx-auto flex w-full max-w-lg flex-col items-center text-center">
              <span className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-gradient shadow-[0_14px_28px_rgba(83,78,222,0.22)] ring-1 ring-white/20">
                <Sparkles className="h-6 w-6 text-white" />
              </span>
              <h1 className="mt-4 font-display text-xl font-bold tracking-tight text-foreground">
                Build a better day
              </h1>
              <p className="mt-1.5 max-w-sm text-sm leading-6 text-secondary-foreground">
                Add your window and tasks. DayStack AI will place the work where it fits best.
              </p>

              <div className="mt-6 w-full space-y-2 text-left">
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-secondary-foreground/50">
                  Examples
                </p>
                {QUICK_PROMPTS.slice(0, 2).map((prompt) => (
                  <button
                    key={prompt}
                    type="button"
                    disabled={isBusy}
                    onClick={() => void handleSubmit(prompt)}
                    className="w-full rounded-[16px] border border-border/70 bg-white/92 px-4 py-3 text-left text-sm leading-5 text-foreground shadow-[0_4px_12px_rgba(15,23,42,0.04)] transition-all hover:border-primary/25 hover:bg-white hover:shadow-[0_8px_18px_rgba(83,78,222,0.08)] disabled:opacity-60"
                  >
                    <p className="line-clamp-2">{prompt}</p>
                  </button>
                ))}
              </div>
            </div>
          </div>
        ) : (
          /* ── Messages ── */
          <div className="mx-auto w-full max-w-2xl space-y-5 px-3 py-4 sm:px-6">
            {messages.map((msg) => (
              <div key={msg.id} className="fade-in-up">
                {msg.role === "user" ? (
                  <div className="flex justify-end">
                    <div className="max-w-[min(85%,36rem)] rounded-[22px] rounded-br-md bg-brand-gradient px-4 py-3 text-[15px] leading-6 text-white shadow-[0_14px_28px_rgba(83,78,222,0.22)]">
                      <p className="whitespace-pre-wrap">{msg.content}</p>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-start gap-2.5 sm:gap-3">
                    <span className="mt-0.5 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-brand-gradient shadow-[0_10px_20px_rgba(83,78,222,0.18)]">
                      <LogoMark className="h-5 w-5 rounded-lg" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="mb-1.5 flex items-center gap-2">
                        <p className="text-[10px] font-bold uppercase tracking-widest text-secondary-foreground/60">
                          DayStack AI
                        </p>
                        {msg.schedule ? (
                          <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-600">
                            Ready
                          </span>
                        ) : null}
                      </div>
                      <div className="max-w-[min(100%,44rem)] rounded-[22px] rounded-tl-md border border-white/80 bg-white/94 px-4 py-3.5 text-[15px] leading-7 text-foreground shadow-[0_12px_30px_rgba(83,78,222,0.08)] backdrop-blur-xl">
                        <p className="whitespace-pre-wrap">{msg.content}</p>
                        {msg.schedule ? (
                          <TimelineCard
                            schedule={msg.schedule}
                            isConfirming={isConfirming}
                            onConfirm={() => handleConfirmSchedule(msg.schedule!)}
                          />
                        ) : null}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ))}

            {/* Typing */}
            {isPlanning && (
              <div className="flex items-start gap-3 fade-in-up">
                <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-brand-gradient shadow-[0_4px_12px_rgba(99,102,241,0.35)]">
                  <LogoMark className="h-5 w-5 rounded-lg" />
                </span>
                <div className="rounded-[20px] rounded-tl-[6px] border border-border/60 bg-white px-4 py-3 shadow-[0_4px_16px_rgba(15,23,42,0.06)]">
                  <div className="flex items-center gap-1 text-secondary-foreground/60">
                    <span className="h-2 w-2 animate-bounce rounded-full bg-current [animation-delay:-0.3s]" />
                    <span className="h-2 w-2 animate-bounce rounded-full bg-current [animation-delay:-0.15s]" />
                    <span className="h-2 w-2 animate-bounce rounded-full bg-current" />
                  </div>
                </div>
              </div>
            )}

            <div className="h-4" />
          </div>
        )}
      </div>

      {/* ── Composer ── */}
      <div className="border-t border-white/70 bg-white/82 px-3 pb-[calc(env(safe-area-inset-bottom)+0.75rem)] pt-3 shadow-[0_-10px_28px_rgba(83,78,222,0.06)] backdrop-blur-xl sm:px-6 lg:pb-3">
        <div className="mx-auto w-full max-w-2xl">
          <div
            className={cn(
              "flex items-end gap-2.5 rounded-[24px] border bg-white/94 px-3.5 py-2.5 shadow-[0_12px_28px_rgba(83,78,222,0.09)] backdrop-blur-xl transition-all",
              isBusy
                ? "border-border/50 opacity-80"
                : "border-border/70 focus-within:border-violet-300 focus-within:shadow-[0_4px_20px_rgba(99,102,241,0.12)]",
            )}
          >
            <textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={handleKeyDown}
              rows={1}
              placeholder={hasConversation ? "Ask for changes..." : "From 9 to 5: calculus 2h, gym 1h, lunch 1h..."}
              disabled={isBusy}
              className="max-h-40 min-h-0 flex-1 resize-none border-0 bg-transparent py-1.5 text-[16px] leading-6 text-foreground outline-none placeholder:text-secondary-foreground/50 disabled:opacity-60"
            />
            <button
              type="button"
              aria-label="Send"
              disabled={!draft.trim() || isBusy}
              onClick={() => void handleSubmit(draft)}
              className={cn(
                "mb-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full transition-all",
                draft.trim() && !isBusy
                  ? "bg-brand-gradient text-white shadow-[0_12px_24px_rgba(83,78,222,0.22)] hover:scale-105 active:scale-95"
                  : "cursor-not-allowed bg-muted text-secondary-foreground/40",
              )}
            >
              {isPlanning ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <ArrowUp className="h-4 w-4" />
              )}
            </button>
          </div>

          <p className="mt-2 text-center text-[11px] text-secondary-foreground/45">
             {hasConversation ? "Ask for changes or start over" : "Include durations: 30m, 1h, 90m"}
          </p>
        </div>
      </div>
    </section>
  );
}
