"use client";

import { useEffect, useRef, useState } from "react";
import { LoaderCircle, Plus, Sparkles, Trash2, WandSparkles, X } from "lucide-react";

import { Button } from "@/components/shared/button";
import { formatDateLabel } from "@/lib/daystack";
import { cn, getErrorMessage } from "@/lib/utils";

interface AiPlanModalProps {
  open: boolean;
  taskDate: string;
  onClose: () => void;
  onNotice: (notice: { message: string; type: "error" | "success" }) => void;
  onConfirm: () => void;
}

interface TaskEntry {
  id: string;
  title: string;
  durationMinutes: number;
}

interface PlannedTask {
  title: string;
  startTime: string;
  endTime: string;
}

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

function generateTaskId() {
  return crypto.randomUUID();
}

function createEmptyTask(): TaskEntry {
  return { id: generateTaskId(), title: "", durationMinutes: 60 };
}

export function AiPlanModal({ open, taskDate, onClose, onNotice, onConfirm }: AiPlanModalProps) {
  const [tasks, setTasks] = useState<TaskEntry[]>([createEmptyTask()]);
  const [startTime, setStartTime] = useState("09:00");
  const [endTime, setEndTime] = useState("17:00");
  const [plannedTasks, setPlannedTasks] = useState<PlannedTask[] | null>(null);
  const [isPlanning, setIsPlanning] = useState(false);
  const [isConfirming, setIsConfirming] = useState(false);
  const surfaceRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) {
      return;
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        handleClose();
      }
    }

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  function handleClose() {
    if (isPlanning || isConfirming) return;
    setTasks([createEmptyTask()]);
    setStartTime("09:00");
    setEndTime("17:00");
    setPlannedTasks(null);
    onClose();
  }

  function addTask() {
    setTasks((prev) => [...prev, createEmptyTask()]);
  }

  function removeTask(id: string) {
    setTasks((prev) => {
      const next = prev.filter((t) => t.id !== id);
      return next.length === 0 ? [createEmptyTask()] : next;
    });
  }

  function updateTask(id: string, field: "title" | "durationMinutes", value: string | number) {
    setTasks((prev) => prev.map((t) => (t.id === id ? { ...t, [field]: value } : t)));
  }

  const validTasks = tasks.filter((t) => t.title.trim().length > 0 && t.durationMinutes > 0);
  const canPlan = validTasks.length > 0 && !isPlanning && !isConfirming;

  async function handlePlan() {
    if (!canPlan) return;

    setIsPlanning(true);
    setPlannedTasks(null);

    try {
      const response = await fetch("/api/assistant/plan", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          date: taskDate,
          startTime,
          endTime,
          tasks: validTasks.map((t) => ({ title: t.title.trim(), durationMinutes: t.durationMinutes })),
        }),
      });

      if (!response.ok) {
        throw new Error("AI planning failed. Check your API keys.");
      }

      const data = (await response.json()) as { tasks: PlannedTask[] };
      setPlannedTasks(data.tasks);
    } catch (error) {
      onNotice({ message: getErrorMessage(error), type: "error" });
    } finally {
      setIsPlanning(false);
    }
  }

  async function handleConfirm() {
    if (!plannedTasks || plannedTasks.length === 0) return;

    setIsConfirming(true);

    try {
      const response = await fetch("/api/assistant/plan", {
        method: "PUT",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          date: taskDate,
          tasks: plannedTasks,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to create tasks.");
      }

      const result = (await response.json()) as {
        created: Array<{ title: string; id: string }>;
        errors: Array<{ title: string; error: string }>;
      };

      onNotice({
        message: `${result.created.length} task${result.created.length !== 1 ? "s" : ""} added to your schedule.`,
        type: "success",
      });

      setTasks([createEmptyTask()]);
      setStartTime("09:00");
      setEndTime("17:00");
      setPlannedTasks(null);
      onConfirm();
      onClose();
    } catch (error) {
      onNotice({ message: getErrorMessage(error), type: "error" });
    } finally {
      setIsConfirming(false);
    }
  }

  const dayMinutes = plannedTasks
    ? plannedTasks.map((t) => ({
        ...t,
        startM: minutesSinceMidnight(t.startTime),
        endM: minutesSinceMidnight(t.endTime),
        durationM: minutesSinceMidnight(t.endTime) - minutesSinceMidnight(t.startTime),
      }))
    : [];

  const windowStart = minutesSinceMidnight(startTime);
  const windowEnd = minutesSinceMidnight(endTime);
  const totalWindow = windowEnd - windowStart;

  return (
    <div
      className={cn(
        "fixed inset-0 z-50 transition-opacity duration-200 ease-[cubic-bezier(0.22,1,0.36,1)]",
        open ? "pointer-events-auto opacity-100" : "pointer-events-none opacity-0",
      )}
      aria-hidden={!open}
    >
      <button
        suppressHydrationWarning
        type="button"
        aria-label="Close"
        className="absolute inset-0 bg-slate-950/24 backdrop-blur-[4px] transition-opacity duration-200 ease-[cubic-bezier(0.22,1,0.36,1)]"
        onClick={handleClose}
      />

      <div className="absolute inset-0 overflow-y-auto overscroll-contain">
        <div className="flex min-h-full items-end justify-center p-0 sm:items-center sm:p-5">
          <div
            ref={surfaceRef}
            role="dialog"
            aria-modal="true"
            aria-label="AI Plan"
            className={cn(
              "relative flex w-full max-w-[42rem] flex-col overflow-hidden border border-white/70 bg-white/96 shadow-[0_28px_84px_rgba(15,23,42,0.16)] transition-[transform,opacity] duration-200 ease-[cubic-bezier(0.22,1,0.36,1)]",
              "h-[min(100dvh,100%)] max-h-[100dvh] rounded-t-[30px] sm:h-auto sm:max-h-[calc(100dvh-2.5rem)] sm:rounded-[28px]",
              open ? "translate-y-0 scale-100 opacity-100" : "translate-y-4 scale-[0.985] opacity-95",
            )}
          >
            {/* ── Header ── */}
            <div className="border-b border-border/80 px-5 py-4 sm:px-6 sm:py-[1.125rem]">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <p className="section-label">AI Planner</p>
                  <h2 className="mt-1 font-display text-[1.65rem] font-semibold tracking-tight text-foreground">
                    Plan with AI
                  </h2>
                  <p className="mt-1 text-sm leading-6 text-secondary-foreground">
                    Add your tasks and let AI schedule them at the best times for{" "}
                    {formatDateLabel(taskDate)}.
                  </p>
                </div>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-9 w-9 shrink-0 rounded-full px-0"
                  onClick={handleClose}
                  disabled={isPlanning || isConfirming}
                  aria-label="Close"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </div>

            {/* ── Content ── */}
            <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 py-4 soft-scrollbar sm:px-6 sm:py-5">
              {plannedTasks ? (
                /* ── AI Result ── */
                <div className="space-y-4">
                  <div className="rounded-[22px] border border-white/80 bg-white/94 shadow-[0_12px_30px_rgba(83,78,222,0.08)]">
                    <div className="bg-[linear-gradient(135deg,rgba(24,190,239,0.1),rgba(109,40,240,0.06))] border-b border-cyan-100/60 px-4 py-3">
                      <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
                        <Sparkles className="h-4 w-4 text-primary" />
                        AI-optimized schedule
                      </div>
                      <p className="mt-0.5 text-xs text-secondary-foreground">
                        {startTime} — {endTime} · {plannedTasks.length} task{plannedTasks.length !== 1 ? "s" : ""}
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
                        <span>{startTime}</span>
                        <span>{endTime}</span>
                      </div>
                    </div>

                    <div className="space-y-1 px-4 pb-3">
                      {dayMinutes.map((task, index) => (
                        <div
                          key={task.title}
                          className="flex items-center gap-3 rounded-[14px] border border-border/60 bg-muted/30 px-3 py-2"
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
                  </div>

                  <div className="flex gap-2">
                    <Button
                      variant="secondary"
                      size="sm"
                      className="flex-1"
                      onClick={() => setPlannedTasks(null)}
                      disabled={isConfirming}
                    >
                      Edit tasks
                    </Button>
                    <Button
                      size="sm"
                      className="flex-1"
                      onClick={handleConfirm}
                      disabled={isConfirming}
                    >
                      {isConfirming ? (
                        <LoaderCircle className="h-4 w-4 animate-spin" />
                      ) : (
                        <Sparkles className="h-4 w-4" />
                      )}
                      Confirm & create
                    </Button>
                  </div>
                </div>
              ) : (
                /* ── Task Input Form ── */
                <div className="space-y-4">
                  {/* Time window */}
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="mb-1.5 block text-xs font-semibold text-secondary-foreground">
                        Start time
                      </label>
                      <input
                        type="time"
                        value={startTime}
                        onChange={(e) => setStartTime(e.target.value)}
                        disabled={isPlanning}
                        className="w-full rounded-[14px] border border-border/70 bg-white/92 px-3 py-2.5 text-sm text-foreground outline-none focus:border-violet-300 focus:shadow-[0_0_0_3px_rgba(139,92,246,0.12)]"
                      />
                    </div>
                    <div>
                      <label className="mb-1.5 block text-xs font-semibold text-secondary-foreground">
                        End time
                      </label>
                      <input
                        type="time"
                        value={endTime}
                        onChange={(e) => setEndTime(e.target.value)}
                        disabled={isPlanning}
                        className="w-full rounded-[14px] border border-border/70 bg-white/92 px-3 py-2.5 text-sm text-foreground outline-none focus:border-violet-300 focus:shadow-[0_0_0_3px_rgba(139,92,246,0.12)]"
                      />
                    </div>
                  </div>

                  {/* Task list */}
                  <div className="space-y-2">
                    <p className="text-xs font-semibold text-secondary-foreground">Tasks</p>
                    {tasks.map((task, index) => (
                      <div key={task.id} className="flex items-start gap-2">
                        <div className="min-w-0 flex-1 space-y-2">
                          <input
                            type="text"
                            placeholder={index === 0 ? "e.g. Study calculus" : "e.g. Team standup"}
                            value={task.title}
                            onChange={(e) => updateTask(task.id, "title", e.target.value)}
                            disabled={isPlanning}
                            className="w-full rounded-[14px] border border-border/70 bg-white/92 px-3 py-2.5 text-sm text-foreground outline-none placeholder:text-secondary-foreground/50 focus:border-violet-300 focus:shadow-[0_0_0_3px_rgba(139,92,246,0.12)]"
                          />
                        </div>
                        <div className="w-28 shrink-0">
                          <div className="relative">
                            <input
                              type="number"
                              min={5}
                              max={1440}
                              step={5}
                              value={task.durationMinutes}
                              onChange={(e) => updateTask(task.id, "durationMinutes", Math.max(5, parseInt(e.target.value) || 5))}
                              disabled={isPlanning}
                              className="w-full rounded-[14px] border border-border/70 bg-white/92 px-3 py-2.5 pr-7 text-sm text-foreground outline-none focus:border-violet-300 focus:shadow-[0_0_0_3px_rgba(139,92,246,0.12)]"
                            />
                            <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs text-secondary-foreground/50">
                              min
                            </span>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => removeTask(task.id)}
                          disabled={isPlanning}
                          className="mt-2 flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-secondary-foreground/50 transition-colors hover:bg-red-50 hover:text-danger disabled:opacity-50"
                          aria-label="Remove task"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    ))}
                  </div>

                  {/* Add task button */}
                  <button
                    type="button"
                    onClick={addTask}
                    disabled={isPlanning}
                    className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-full border border-dashed border-border/70 text-sm font-semibold text-secondary-foreground transition-colors hover:border-primary/40 hover:text-foreground disabled:opacity-50"
                  >
                    <Plus className="h-4 w-4" />
                    Add another task
                  </button>

                  {/* Magic button */}
                  <button
                    type="button"
                    onClick={handlePlan}
                    disabled={!canPlan}
                    className={cn(
                      "inline-flex h-12 w-full items-center justify-center gap-2 rounded-full text-sm font-semibold shadow-[0_12px_24px_rgba(83,78,222,0.22)] transition-all",
                      canPlan
                        ? "bg-brand-gradient text-white hover:scale-[1.02] active:scale-[0.98]"
                        : "cursor-not-allowed bg-muted text-secondary-foreground/50",
                    )}
                  >
                    {isPlanning ? (
                      <LoaderCircle className="h-5 w-5 animate-spin" />
                    ) : (
                      <WandSparkles className="h-5 w-5" />
                    )}
                    {isPlanning ? "Optimizing schedule..." : "✨ Magic — schedule at best times"}
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
