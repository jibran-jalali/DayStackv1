"use client";

import { CalendarDays, CalendarRange } from "lucide-react";

import { TaskModal } from "@/components/app/task-modal";
import { Button } from "@/components/shared/button";
import type { RecurringTaskScope } from "@/types/daystack";

interface RecurringScopeModalProps {
  actionLabel: string;
  onChoose: (scope: RecurringTaskScope) => void;
  onClose: () => void;
  open: boolean;
  taskTitle: string;
}

const OPTIONS: Array<{
  description: string;
  icon: typeof CalendarDays;
  label: string;
  scope: RecurringTaskScope;
}> = [
  {
    scope: "occurrence_only",
    label: "Only this block",
    description: "Change or remove just the block you are looking at right now.",
    icon: CalendarDays,
  },
  {
    scope: "this_and_future",
    label: "This and future",
    description: "Split the weekly schedule here and keep the earlier history untouched.",
    icon: CalendarRange,
  },
];

export function RecurringScopeModal({
  actionLabel,
  onChoose,
  onClose,
  open,
  taskTitle,
}: RecurringScopeModalProps) {
  return (
    <TaskModal
      open={open}
      onClose={onClose}
      title={`How should "${taskTitle}" ${actionLabel}?`}
      eyebrow="Recurring block"
      description="Pick the scope before DayStack changes a repeating schedule."
      maxWidthClassName="max-w-[34rem]"
    >
      <div className="space-y-3">
        {OPTIONS.map((option) => {
          const Icon = option.icon;

          return (
            <button
              key={option.scope}
              suppressHydrationWarning
              type="button"
              className="flex w-full items-start gap-3 rounded-[20px] border border-border/80 bg-white/94 px-4 py-4 text-left shadow-[0_12px_24px_rgba(15,23,42,0.04)] transition-[transform,box-shadow,border-color,background-color] duration-200 ease-[cubic-bezier(0.22,1,0.36,1)] hover:-translate-y-0.5 hover:border-primary/25 hover:bg-white hover:shadow-[0_16px_32px_rgba(15,23,42,0.08)]"
              onClick={() => onChoose(option.scope)}
            >
              <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[linear-gradient(135deg,rgba(24,190,239,0.14),rgba(109,40,240,0.12))] text-foreground">
                <Icon className="h-4 w-4" />
              </span>
              <span className="min-w-0">
                <span className="block text-sm font-semibold text-foreground">{option.label}</span>
                <span className="mt-1 block text-sm leading-5 text-secondary-foreground">{option.description}</span>
              </span>
            </button>
          );
        })}

        <div className="pt-2">
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
        </div>
      </div>
    </TaskModal>
  );
}
