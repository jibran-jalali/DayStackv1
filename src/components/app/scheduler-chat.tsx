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
  {
    title: "Plan a workday",
    description: "Feature work, standup, lunch, reviews, gym",
    prompt: "From 9 AM to 6 PM: code feature 3h, standup 30m, lunch 1h, PR review 1h, email 30m, gym 1h",
  },
  {
    title: "Study rhythm",
    description: "Deep work, practice, notes, meals",
    prompt: "From 8 AM to 8 PM: calculus 2h, practice 90m, lunch 1h, notes 1h, textbook 90m, dinner 1h",
  },
  {
    title: "Light reset",
    description: "Routine, admin, walk, tomorrow prep",
    prompt: "From 10 AM to 4 PM: morning routine 30m, admin 1h, lunch 1h, walk 30m, plan tomorrow 30m",
  },
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

function AssistantOrb({ className }: { className?: string }) {
  return (
    <span className={cn("relative inline-flex shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-[#07111f] shadow-[0_18px_42px_rgba(83,78,222,0.26)]", className)}>
      <span className="absolute inset-0 bg-[radial-gradient(circle_at_25%_20%,rgba(40,180,234,0.95),transparent_34%),radial-gradient(circle_at_76%_78%,rgba(108,49,239,0.95),transparent_40%),linear-gradient(135deg,#28b4ea,#6c31ef)]" />
      <LogoMark className="relative z-10 h-[68%] w-[68%] rounded-xl" />
    </span>
  );
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
    <div className="mt-4 overflow-hidden rounded-[26px] border border-white/80 bg-white/88 shadow-[0_24px_60px_rgba(83,78,222,0.12)] backdrop-blur-2xl">
      <div className="border-b border-white/70 bg-[linear-gradient(135deg,rgba(40,180,234,0.16),rgba(108,49,239,0.12),rgba(255,255,255,0.72))] px-4 py-3.5">
        <div className="flex items-center gap-2 text-sm font-bold text-foreground">
          <span className="grid h-8 w-8 place-items-center rounded-full bg-white/80 text-primary shadow-sm">
            <Sparkles className="h-4 w-4" />
          </span>
          Optimized timeline
        </div>
        <p className="mt-0.5 text-xs text-secondary-foreground">
          {formatClock(schedule.window.start)} to {formatClock(schedule.window.end)} · {schedule.tasks.length} task{schedule.tasks.length !== 1 ? "s" : ""}
        </p>
      </div>

      <div className="px-4 py-3.5">
        <div className="relative h-9 w-full overflow-hidden rounded-full border border-white/70 bg-slate-950/[0.04] shadow-inner">
          {dayMinutes.map((task, index) => {
            const left = ((task.startM - windowStart) / totalWindow) * 100;
            const width = (task.durationM / totalWindow) * 100;
            return (
              <div
                key={task.title}
                className={cn(
                  "absolute top-0 h-full rounded-full bg-gradient-to-r shadow-[0_10px_26px_rgba(83,78,222,0.2)] transition-all",
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
        <div className="mt-1.5 flex justify-between px-0.5 text-[10px] font-bold uppercase tracking-[0.12em] text-secondary-foreground/45">
          <span>{formatClock(schedule.window.start)}</span>
          <span>{formatClock(schedule.window.end)}</span>
        </div>
      </div>

      <div className="space-y-2 px-4 pb-4">
        {dayMinutes.map((task, index) => (
          <div
            key={task.title}
            className="flex items-center gap-3 rounded-[18px] border border-white/70 bg-white/72 px-3 py-2.5 shadow-[0_10px_26px_rgba(15,23,42,0.045)] transition hover:bg-white/92"
          >
            <span
              className={cn(
                "inline-flex h-2.5 w-2.5 shrink-0 rounded-full bg-gradient-to-r",
                TASK_COLORS[index % TASK_COLORS.length],
              )}
            />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-foreground">{task.title}</p>
              <p className="text-xs text-secondary-foreground/70">{task.durationM} min</p>
            </div>
            <div className="shrink-0 text-right">
              <p className="text-xs font-semibold text-foreground">{formatClock(task.startTime)}</p>
              <p className="text-[11px] text-secondary-foreground/60">{formatClock(task.endTime)}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="border-t border-white/70 bg-white/58 px-4 py-3.5">
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
              "Add a time window and durations so I can build the plan. Example:\n\nFrom 9 AM to 5 PM: calculus 2h, gym 1h, lunch 1h, review notes 45m",
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
          content: `Drafted a productive plan for ${formatClock(planInfo.startTime)} to ${formatClock(planInfo.endTime)}.\n\n${summary}`,
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
  const planDateLabel = formatDateLabel(snapshot.taskDate);
  const completedTasks = snapshot.summary.completedTasks;
  const totalTasks = snapshot.summary.totalTasks;

  return (
    <section className="glass-panel relative flex h-full min-h-0 flex-1 flex-col overflow-hidden border-white/80 bg-white/72 lg:h-[calc(100dvh-13rem)] lg:min-h-[640px]">
      <div className="pointer-events-none absolute -left-20 top-[-8rem] h-80 w-80 rounded-full bg-[#28b4ea]/18 blur-[95px]" />
      <div className="pointer-events-none absolute -right-24 bottom-[-8rem] h-96 w-96 rounded-full bg-[#6c31ef]/16 blur-[110px]" />
      <div className="pointer-events-none absolute inset-x-0 top-0 h-32 bg-[linear-gradient(90deg,rgba(66,133,244,0.08),rgba(171,71,188,0.08),rgba(40,180,234,0.08))]" />

      <div className="relative z-10 flex flex-wrap items-center gap-3 border-b border-white/70 bg-white/58 px-4 py-3 backdrop-blur-2xl sm:px-5 lg:px-6">
        <AssistantOrb className="h-11 w-11 rounded-[18px]" />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="font-display text-lg font-bold tracking-[-0.05em] text-foreground sm:text-xl">DayStack AI</h2>
            <span className="rounded-full border border-violet-200/70 bg-violet-50/80 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.16em] text-violet-700">
              Planner
            </span>
          </div>
          <p className="truncate text-xs font-medium text-secondary-foreground/68 sm:text-sm">Planning {planDateLabel}</p>
        </div>
        <div className="hidden items-center gap-2 sm:flex">
          <span className="rounded-full border border-white/70 bg-white/72 px-3 py-1.5 text-xs font-bold text-secondary-foreground shadow-sm">
            {totalTasks > 0 ? `${completedTasks}/${totalTasks} done` : "No blocks yet"}
          </span>
          <span className="rounded-full border border-emerald-200/70 bg-emerald-50/86 px-3 py-1.5 text-xs font-bold text-emerald-700">
            Best-time scheduling
          </span>
        </div>
      </div>

      <div className="relative z-10 flex min-h-0 flex-1">
        <div className="flex min-h-0 flex-1 flex-col">
          <div ref={chatRef} className="soft-scrollbar min-h-0 flex-1 overflow-y-auto">
            {!hasConversation ? (
              <div className="flex min-h-full items-center justify-center px-4 py-7 sm:px-6 lg:px-10">
                <div className="mx-auto w-full max-w-4xl text-center">
                  <div className="relative mx-auto grid h-24 w-24 place-items-center overflow-hidden rounded-[32px] border border-white/10 bg-[#05070d] shadow-[0_32px_90px_rgba(7,17,31,0.24)] sm:h-28 sm:w-28">
                    <div className="absolute inset-0 bg-[radial-gradient(circle_at_26%_20%,rgba(40,180,234,0.34),transparent_38%),radial-gradient(circle_at_74%_76%,rgba(108,49,239,0.38),transparent_44%),linear-gradient(135deg,#05070d,#0a1020)]" />
                    <div className="absolute inset-0 bg-[linear-gradient(135deg,rgba(255,255,255,0.08),transparent_45%)]" />
                    <LogoMark className="relative z-10 h-16 w-16 rounded-[22px] opacity-95 mix-blend-screen sm:h-20 sm:w-20" />
                  </div>
                  <h1 className="mx-auto mt-5 max-w-2xl font-display text-[2.25rem] font-bold leading-[0.98] tracking-[-0.075em] text-foreground sm:text-[3.4rem] lg:text-[4rem]">
                    What should we plan today?
                  </h1>
                  <p className="mx-auto mt-4 max-w-xl text-sm leading-7 text-secondary-foreground sm:text-base">
                    Give DayStack AI a time window and tasks with durations. It places deep work, admin, meals, meetings, and workouts around natural energy rhythms.
                  </p>

                  <div className="mt-7 grid gap-3 text-left sm:grid-cols-3">
                    {QUICK_PROMPTS.map((prompt) => (
                      <button
                        key={prompt.title}
                        type="button"
                        disabled={isBusy}
                        onClick={() => void handleSubmit(prompt.prompt)}
                        className="group rounded-[24px] border border-white/74 bg-white/64 p-4 text-left shadow-[0_18px_50px_rgba(15,23,42,0.07)] backdrop-blur-2xl transition-all hover:-translate-y-1 hover:border-primary/24 hover:bg-white/86 hover:shadow-[0_24px_60px_rgba(83,78,222,0.13)] disabled:translate-y-0 disabled:opacity-60"
                      >
                        <span className="mb-4 grid h-9 w-9 place-items-center rounded-2xl bg-[linear-gradient(135deg,rgba(40,180,234,0.16),rgba(108,49,239,0.16))] text-primary transition group-hover:scale-105">
                          <Sparkles className="h-4 w-4" />
                        </span>
                        <p className="text-sm font-bold text-foreground">{prompt.title}</p>
                        <p className="mt-1 text-xs leading-5 text-secondary-foreground/72">{prompt.description}</p>
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              <div className="mx-auto w-full max-w-3xl space-y-6 px-3 py-5 sm:px-6 lg:px-8">
                {messages.map((msg) => (
                  <div key={msg.id} className="fade-in-up">
                    {msg.role === "user" ? (
                      <div className="flex justify-end">
                        <div className="max-w-[min(88%,38rem)] rounded-[28px] rounded-br-[10px] bg-[#111827] px-4 py-3 text-[15px] leading-6 text-white shadow-[0_18px_42px_rgba(17,24,39,0.18)] sm:px-5">
                          <p className="whitespace-pre-wrap">{msg.content}</p>
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-start gap-2.5 sm:gap-3">
                        <AssistantOrb className="mt-0.5 h-9 w-9 rounded-2xl" />
                        <div className="min-w-0 flex-1">
                          <div className="mb-2 flex items-center gap-2">
                            <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-secondary-foreground/58">DayStack AI</p>
                            {msg.schedule ? (
                              <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-700">
                                Ready to create
                              </span>
                            ) : null}
                          </div>
                          <div className="max-w-[min(100%,46rem)] rounded-[28px] rounded-tl-[10px] border border-white/80 bg-white/78 px-4 py-3.5 text-[15px] leading-7 text-foreground shadow-[0_18px_50px_rgba(83,78,222,0.1)] backdrop-blur-2xl sm:px-5">
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

                {isPlanning ? (
                  <div className="flex items-start gap-3 fade-in-up">
                    <AssistantOrb className="h-9 w-9 rounded-2xl" />
                    <div className="rounded-[24px] rounded-tl-[8px] border border-white/80 bg-white/78 px-4 py-3 shadow-[0_18px_42px_rgba(83,78,222,0.1)] backdrop-blur-2xl">
                      <div className="flex items-center gap-3 text-sm font-semibold text-secondary-foreground/72">
                        <span>Finding the best times</span>
                        <span className="flex items-center gap-1 text-primary">
                          <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-current [animation-delay:-0.3s]" />
                          <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-current [animation-delay:-0.15s]" />
                          <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-current" />
                        </span>
                      </div>
                    </div>
                  </div>
                ) : null}

                <div className="h-4" />
              </div>
            )}
          </div>

          <div className="border-t border-white/70 bg-white/64 px-3 pb-[calc(env(safe-area-inset-bottom)+0.75rem)] pt-3 shadow-[0_-18px_50px_rgba(83,78,222,0.08)] backdrop-blur-2xl sm:px-6 lg:pb-4">
            <div className="mx-auto w-full max-w-3xl">
              <div
                className={cn(
                  "rounded-[30px] border bg-white/86 p-2.5 shadow-[0_20px_52px_rgba(83,78,222,0.12)] backdrop-blur-2xl transition-all",
                  isBusy
                    ? "border-white/60 opacity-80"
                    : "border-white/76 focus-within:border-violet-300/90 focus-within:bg-white/94 focus-within:shadow-[0_24px_60px_rgba(83,78,222,0.18)]",
                )}
              >
                <textarea
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  onKeyDown={handleKeyDown}
                  rows={1}
                  placeholder={hasConversation ? "Ask DayStack AI to adjust the plan..." : "From 9 to 5: calculus 2h, gym 1h, lunch 1h..."}
                  disabled={isBusy}
                  className="max-h-40 min-h-[2.75rem] w-full resize-none border-0 bg-transparent px-2 py-2 text-[16px] leading-6 text-foreground outline-none placeholder:text-secondary-foreground/45 disabled:opacity-60"
                />
                <div className="flex items-center justify-between gap-2 border-t border-border/50 px-1 pt-2">
                  <div className="flex min-w-0 items-center gap-1.5 text-[11px] font-medium text-secondary-foreground/48">
                    <Sparkles className="h-3.5 w-3.5 shrink-0 text-primary/70" />
                    <span className="truncate">Include durations like 30m, 1h, or 90m</span>
                  </div>
                  <button
                    type="button"
                    aria-label="Send"
                    disabled={!draft.trim() || isBusy}
                    onClick={() => void handleSubmit(draft)}
                    className={cn(
                      "flex h-10 w-10 shrink-0 items-center justify-center rounded-full transition-all",
                      draft.trim() && !isBusy
                        ? "bg-brand-gradient text-white shadow-[0_14px_30px_rgba(83,78,222,0.26)] hover:scale-105 active:scale-95"
                        : "cursor-not-allowed bg-muted text-secondary-foreground/40",
                    )}
                  >
                    {isPlanning ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowUp className="h-4 w-4" />}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
