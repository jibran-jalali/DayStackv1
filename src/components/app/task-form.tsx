"use client";

import { useState } from "react";
import { CalendarRange, Link2, MoonStar, Repeat, Trash2, Users, Video } from "lucide-react";

import { ParticipantPicker } from "@/components/app/participant-picker";
import { Button } from "@/components/shared/button";
import { Input } from "@/components/shared/input";
import { addMinutesToTime, formatDateLabel } from "@/lib/daystack";
import { cn } from "@/lib/utils";
import { taskFormSchema, type TaskFormValues } from "@/types/daystack";

interface TaskFormProps {
  currentUserId: string;
  mode: "create" | "edit";
  initialValues: TaskFormValues;
  isPending: boolean;
  onCancel: () => void;
  onDelete?: () => void;
  onSubmit: (values: TaskFormValues) => Promise<void> | void;
}

const WEEKDAY_OPTIONS = [
  { label: "Sun", value: 0 },
  { label: "Mon", value: 1 },
  { label: "Tue", value: 2 },
  { label: "Wed", value: 3 },
  { label: "Thu", value: 4 },
  { label: "Fri", value: 5 },
  { label: "Sat", value: 6 },
];

function SectionHeader({
  eyebrow,
  title,
  description,
}: {
  eyebrow: string;
  title: string;
  description?: string;
}) {
  return (
    <div className="space-y-1">
      <p className="section-label">{eyebrow}</p>
      <div className="space-y-1">
        <h3 className="text-[1.02rem] font-semibold tracking-tight text-foreground">{title}</h3>
        {description ? <p className="text-sm leading-5 text-secondary-foreground">{description}</p> : null}
      </div>
    </div>
  );
}

function FieldError({ message }: { message?: string }) {
  if (!message) {
    return null;
  }

  return <p className="text-xs font-medium text-danger">{message}</p>;
}

const fieldClassName =
  "h-11 rounded-[16px] border-border/80 bg-white/96 px-3.5 py-2.5 text-[15px] shadow-none";

function sortWeekdays(weekdays: number[]) {
  return [...weekdays].sort((left, right) => left - right);
}

function getWeekdayFromDateKey(taskDate: string) {
  const [year, month, day] = taskDate.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day)).getUTCDay();
}

export function TaskForm({
  currentUserId,
  mode,
  initialValues,
  isPending,
  onCancel,
  onDelete,
  onSubmit,
}: TaskFormProps) {
  const [values, setValues] = useState<TaskFormValues>(initialValues);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isEndTimeDirty, setIsEndTimeDirty] = useState(mode === "edit");
  const canChangeMode = mode === "create";

  function setField<Name extends keyof TaskFormValues>(name: Name, value: TaskFormValues[Name]) {
    setValues((current) => {
      if (name === "startTime" && typeof value === "string") {
        return {
          ...current,
          startTime: value,
          endTime: isEndTimeDirty ? current.endTime : addMinutesToTime(value),
        };
      }

      if (name === "taskDate" && typeof value === "string" && current.blockMode === "recurring") {
        const weekday = getWeekdayFromDateKey(value);

        return {
          ...current,
          taskDate: value,
          weekdays: current.weekdays.includes(weekday)
            ? current.weekdays
            : sortWeekdays([...current.weekdays, weekday]),
        };
      }

      return {
        ...current,
        [name]: value,
      };
    });

    if (name === "endTime") {
      setIsEndTimeDirty(true);
    }

    setErrors((current) => ({
      ...current,
      [name]: "",
    }));
  }

  function setTaskType(taskType: TaskFormValues["taskType"]) {
    setValues((current) => ({
      ...current,
      taskType,
      meetingLink: taskType === "meeting" ? current.meetingLink : "",
      participants: taskType === "meeting" ? current.participants : [],
    }));
    setErrors((current) => ({
      ...current,
      taskType: "",
      meetingLink: "",
      participants: "",
    }));
  }

  function setBlockMode(blockMode: TaskFormValues["blockMode"]) {
    if (!canChangeMode) {
      return;
    }

    setValues((current) => ({
      ...current,
      blockMode,
      weekdays:
        blockMode === "recurring"
          ? sortWeekdays(current.weekdays.length > 0 ? current.weekdays : [getWeekdayFromDateKey(current.taskDate)])
          : [],
    }));
    setErrors((current) => ({
      ...current,
      weekdays: "",
    }));
  }

  function toggleWeekday(weekday: number) {
    setValues((current) => {
      const hasWeekday = current.weekdays.includes(weekday);
      const weekdays = hasWeekday
        ? current.weekdays.filter((value) => value !== weekday)
        : [...current.weekdays, weekday];

      return {
        ...current,
        weekdays: sortWeekdays(weekdays),
      };
    });
    setErrors((current) => ({
      ...current,
      weekdays: "",
    }));
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const parsed = taskFormSchema.safeParse(values);

    if (!parsed.success) {
      const flattened = parsed.error.flatten().fieldErrors;
      setErrors({
        title: flattened.title?.[0] ?? "",
        startTime: flattened.startTime?.[0] ?? "",
        endTime: flattened.endTime?.[0] ?? "",
        taskDate: flattened.taskDate?.[0] ?? "",
        taskType: flattened.taskType?.[0] ?? "",
        meetingLink: flattened.meetingLink?.[0] ?? "",
        participants: flattened.participants?.[0] ?? "",
        weekdays: flattened.weekdays?.[0] ?? "",
      });
      return;
    }

    await onSubmit(parsed.data);
  }

  return (
    <form className="space-y-4" onSubmit={handleSubmit}>
      <div className="rounded-[18px] border border-cyan-200/60 bg-[linear-gradient(135deg,rgba(24,190,239,0.08),rgba(109,40,240,0.04))] px-4 py-3 shadow-[0_12px_26px_rgba(15,23,42,0.04)]">
        <p className="section-label text-sky-700/80">
          {values.blockMode === "recurring" ? "Recurring start date" : "Planner date"}
        </p>
        <p className="mt-1 text-sm font-semibold text-foreground">{formatDateLabel(values.taskDate)}</p>
        <p className="mt-1 text-[13px] text-secondary-foreground">
          {values.blockMode === "recurring"
            ? "DayStack will repeat this block weekly from the selected date onward."
            : "Set one clear block for this day and keep the details tight."}
        </p>
      </div>

      <section className="rounded-[22px] border border-border/75 bg-muted/28 p-4 sm:p-5">
        <SectionHeader
          eyebrow="Block type"
          title="How should this block behave?"
          description="Choose the block style first so the rest of the form stays focused."
        />

        <div className="mt-3 grid gap-2.5 sm:grid-cols-3">
          {[
            {
              value: "generic",
              label: "Generic",
              icon: CalendarRange,
              description: "Flexible task block",
            },
            {
              value: "meeting",
              label: "Meeting",
              icon: Video,
              description: "Link and mentions",
            },
            {
              value: "blocked",
              label: "Blocked",
              icon: MoonStar,
              description: "Sleep, breaks, commute",
            },
          ].map((option) => {
            const Icon = option.icon;
            const isActive = values.taskType === option.value;

            return (
              <button
                key={option.value}
                suppressHydrationWarning
                type="button"
                className={cn(
                  "relative flex min-h-[5rem] items-start gap-3 rounded-[18px] border px-3.5 py-3 text-left transition-[transform,box-shadow,border-color,background-color] duration-150 ease-[cubic-bezier(0.22,1,0.36,1)]",
                  isActive
                    ? "border-primary/20 bg-[linear-gradient(135deg,rgba(24,190,239,0.14),rgba(109,40,240,0.08))] shadow-[var(--shadow-brand-sm)]"
                    : "border-border/80 bg-white/94 hover:border-primary/20 hover:bg-white",
                )}
                onClick={() => setTaskType(option.value as TaskFormValues["taskType"])}
                disabled={isPending}
              >
                <span
                  className={cn(
                    "absolute right-3 top-3 h-2.5 w-2.5 rounded-full border",
                    isActive ? "border-transparent bg-brand-gradient shadow-[0_0_0_4px_rgba(24,190,239,0.12)]" : "border-border/90 bg-white",
                  )}
                />
                <span
                  className={cn(
                    "inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full",
                    isActive ? "bg-brand-gradient text-white" : "bg-muted text-secondary-foreground",
                  )}
                >
                  <Icon className="h-4 w-4" />
                </span>
                <span className="min-w-0 pt-0.5">
                  <span className="block text-sm font-semibold tracking-tight text-foreground">{option.label}</span>
                  <span className="mt-1 block text-[12px] leading-5 text-secondary-foreground">{option.description}</span>
                </span>
              </button>
            );
          })}
        </div>
        <FieldError message={errors.taskType} />
      </section>

      <section className="rounded-[22px] border border-border/75 bg-white/78 p-4 shadow-[0_12px_28px_rgba(15,23,42,0.03)] sm:p-5">
        <SectionHeader
          eyebrow="Scheduling mode"
          title="One-time or recurring?"
          description="Use recurring only when this same block should keep coming back every week."
        />

        <div className="mt-3 grid gap-2.5 sm:grid-cols-2">
          {[
            {
              value: "one_time",
              label: "One-time block",
              icon: CalendarRange,
              description: "Just this one date",
            },
            {
              value: "recurring",
              label: "Recurring block",
              icon: Repeat,
              description: "Repeat weekly on selected days",
            },
          ].map((option) => {
            const Icon = option.icon;
            const isActive = values.blockMode === option.value;

            return (
              <button
                key={option.value}
                suppressHydrationWarning
                type="button"
                className={cn(
                  "relative flex min-h-[5rem] items-start gap-3 rounded-[18px] border px-3.5 py-3 text-left transition-[transform,box-shadow,border-color,background-color] duration-150 ease-[cubic-bezier(0.22,1,0.36,1)]",
                  isActive
                    ? "border-primary/20 bg-[linear-gradient(135deg,rgba(24,190,239,0.14),rgba(109,40,240,0.08))] shadow-[var(--shadow-brand-sm)]"
                    : "border-border/80 bg-white/94 hover:border-primary/20 hover:bg-white",
                  !canChangeMode ? "cursor-default opacity-95" : "",
                )}
                onClick={() => setBlockMode(option.value as TaskFormValues["blockMode"])}
                disabled={isPending || !canChangeMode}
              >
                <span
                  className={cn(
                    "absolute right-3 top-3 h-2.5 w-2.5 rounded-full border",
                    isActive ? "border-transparent bg-brand-gradient shadow-[0_0_0_4px_rgba(24,190,239,0.12)]" : "border-border/90 bg-white",
                  )}
                />
                <span
                  className={cn(
                    "inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full",
                    isActive ? "bg-brand-gradient text-white" : "bg-muted text-secondary-foreground",
                  )}
                >
                  <Icon className="h-4 w-4" />
                </span>
                <span className="min-w-0 pt-0.5">
                  <span className="block text-sm font-semibold tracking-tight text-foreground">{option.label}</span>
                  <span className="mt-1 block text-[12px] leading-5 text-secondary-foreground">{option.description}</span>
                </span>
              </button>
            );
          })}
        </div>

        {!canChangeMode ? (
          <p className="mt-3 text-[13px] leading-5 text-secondary-foreground">
            {values.blockMode === "recurring"
              ? "This block belongs to a recurring weekly series. Use the next prompt to decide whether your edits affect only this block or the future series."
              : "This is a one-time block."}
          </p>
        ) : null}

        {values.blockMode === "recurring" ? (
          <div className="mt-4 rounded-[18px] border border-amber-200/70 bg-amber-50/60 p-4">
            <div className="space-y-2">
              <p className="text-sm font-semibold tracking-tight text-foreground">Repeat on these weekdays</p>
              <p className="text-[13px] leading-5 text-secondary-foreground">
                Include the selected start date&apos;s weekday so the recurring block can begin on that day.
              </p>
            </div>

            <div className="mt-3 flex flex-wrap gap-2">
              {WEEKDAY_OPTIONS.map((option) => {
                const isSelected = values.weekdays.includes(option.value);

                return (
                  <button
                    key={option.value}
                    suppressHydrationWarning
                    type="button"
                    className={cn(
                      "inline-flex h-10 items-center justify-center rounded-full border px-3 text-sm font-semibold transition-[transform,box-shadow,border-color,background-color] duration-150 ease-[cubic-bezier(0.22,1,0.36,1)]",
                      isSelected
                        ? "border-amber-300 bg-amber-100 text-amber-800 shadow-[0_10px_22px_rgba(217,119,6,0.14)]"
                        : "border-border/80 bg-white/92 text-secondary-foreground hover:border-amber-200 hover:bg-white",
                    )}
                    onClick={() => toggleWeekday(option.value)}
                    disabled={isPending}
                    aria-pressed={isSelected}
                  >
                    {option.label}
                  </button>
                );
              })}
            </div>
            <FieldError message={errors.weekdays} />
          </div>
        ) : null}
      </section>

      {values.taskType === "blocked" ? (
        <section className="rounded-[20px] border border-slate-200 bg-slate-100/88 px-4 py-3.5 shadow-[0_10px_22px_rgba(15,23,42,0.03)]">
          <div className="flex items-start gap-3">
            <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-slate-200 text-slate-700">
              <MoonStar className="h-4 w-4" />
            </span>
            <div>
              <p className="text-sm font-semibold text-slate-800">Blocked time stays visible in the timeline.</p>
              <p className="mt-1 text-[13px] leading-5 text-slate-600">
                It holds space on the day, but does not count toward the execution score.
              </p>
            </div>
          </div>
        </section>
      ) : null}

      <section className="rounded-[22px] border border-border/75 bg-white/78 p-4 shadow-[0_12px_28px_rgba(15,23,42,0.03)] sm:p-5">
        <SectionHeader
          eyebrow="Block details"
          title="Title, date, and timing"
          description="Keep the core details precise so this block is easy to act on later."
        />

        <div className="mt-4 space-y-4">
          <label className="grid gap-1.5">
            <span className="text-sm font-semibold tracking-tight text-foreground">Task title</span>
            <Input
              autoFocus
              className={fieldClassName}
              placeholder="Write the block exactly how you want to execute it"
              value={values.title}
              error={errors.title}
              onChange={(event) => setField("title", event.target.value)}
            />
            <FieldError message={errors.title} />
          </label>

          <div className="grid gap-3 sm:grid-cols-[1.15fr_0.9fr_0.9fr]">
            <label className="grid gap-1.5">
              <span className="text-sm font-semibold tracking-tight text-foreground">
                {values.blockMode === "recurring" ? "Start date" : "Date"}
              </span>
              <Input
                className={fieldClassName}
                type="date"
                value={values.taskDate}
                error={errors.taskDate}
                onChange={(event) => setField("taskDate", event.target.value)}
              />
              <FieldError message={errors.taskDate} />
            </label>

            <label className="grid gap-1.5">
              <span className="text-sm font-semibold tracking-tight text-foreground">Start time</span>
              <Input
                className={fieldClassName}
                type="time"
                value={values.startTime}
                step={900}
                error={errors.startTime}
                onChange={(event) => setField("startTime", event.target.value)}
              />
              <FieldError message={errors.startTime} />
            </label>

            <label className="grid gap-1.5">
              <span className="text-sm font-semibold tracking-tight text-foreground">End time</span>
              <Input
                className={fieldClassName}
                type="time"
                value={values.endTime}
                step={900}
                error={errors.endTime}
                onChange={(event) => setField("endTime", event.target.value)}
              />
              <FieldError message={errors.endTime} />
            </label>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2 rounded-[16px] border border-border/70 bg-muted/30 px-3.5 py-2.5 text-[13px] leading-5 text-secondary-foreground">
            <span>
              {values.blockMode === "recurring"
                ? `This recurring block starts on ${formatDateLabel(values.taskDate)}.`
                : `This block lands on ${formatDateLabel(values.taskDate)}.`}
            </span>
            {!isEndTimeDirty && mode === "create" ? <span>End time follows the start until you change it.</span> : null}
          </div>
        </div>

        {values.taskType === "meeting" ? (
          <div className="mt-4 rounded-[22px] border border-cyan-200/65 bg-cyan-50/42 p-4 shadow-[0_12px_26px_rgba(24,190,239,0.05)] sm:p-5">
            <SectionHeader
              eyebrow="Meeting details"
              title="Link and mentions"
              description="Keep the join link close and mention the people who should see this block."
            />

            <div className="mt-4 grid gap-4">
              <label className="grid gap-1.5">
                <span className="inline-flex items-center gap-2 text-sm font-semibold tracking-tight text-foreground">
                  <Link2 className="h-4 w-4 text-secondary-foreground" />
                  Meeting link
                </span>
                <Input
                  className={fieldClassName}
                  type="url"
                  placeholder="https://meet.google.com/..."
                  value={values.meetingLink ?? ""}
                  error={errors.meetingLink}
                  onChange={(event) => setField("meetingLink", event.target.value)}
                />
                <FieldError message={errors.meetingLink} />
              </label>

              <div className="grid gap-2">
                <span className="inline-flex items-center gap-2 text-sm font-semibold tracking-tight text-foreground">
                  <Users className="h-4 w-4 text-secondary-foreground" />
                  Mention people
                </span>
                <p className="text-[13px] leading-5 text-secondary-foreground">
                  Mentioned people get a notification and can accept this task into their own timeline.
                </p>
                <ParticipantPicker
                  currentUserId={currentUserId}
                  value={values.participants}
                  onChange={(participants) => {
                    setValues((current) => ({
                      ...current,
                      participants,
                    }));
                    setErrors((current) => ({
                      ...current,
                      participants: "",
                    }));
                  }}
                  disabled={isPending}
                />
                <FieldError message={errors.participants} />
              </div>
            </div>
          </div>
        ) : null}
      </section>

      <div className="flex flex-col gap-3 border-t border-border/80 pt-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          {mode === "edit" && onDelete ? (
            <Button type="button" variant="danger" onClick={onDelete} disabled={isPending} className="min-w-[8.5rem]">
              <Trash2 className="h-4 w-4" />
              Delete block
            </Button>
          ) : null}
        </div>

        <div className="flex flex-col-reverse gap-2.5 sm:flex-row sm:items-center">
          <Button type="button" variant="secondary" onClick={onCancel} disabled={isPending} className="min-w-[7.5rem]">
            Cancel
          </Button>
          <Button type="submit" disabled={isPending} className="min-w-[8.5rem]">
            {mode === "create" ? "Save block" : "Update block"}
          </Button>
        </div>
      </div>
    </form>
  );
}
