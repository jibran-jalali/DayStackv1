"use client";

import { CalendarDays, Clock3, Link2, MoonStar, Pencil, Repeat, Trash2, Users, Video } from "lucide-react";

import { Button } from "@/components/shared/button";
import { formatDateLabel } from "@/lib/daystack";
import type { RecurringBlockSummary, TaskType } from "@/types/daystack";

interface RecurringBlocksViewProps {
  blocks: RecurringBlockSummary[];
  isPending: boolean;
  onDeleteBlock: (block: RecurringBlockSummary) => void;
  onEditBlock: (block: RecurringBlockSummary) => void;
}

const WEEKDAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function getBlockTypeMeta(taskType: TaskType) {
  switch (taskType) {
    case "meeting":
      return {
        icon: Video,
        label: "Meeting",
      };
    case "blocked":
      return {
        icon: MoonStar,
        label: "Blocked",
      };
    default:
      return {
        icon: CalendarDays,
        label: "Generic",
      };
  }
}

function formatWeekdays(weekdays: number[]) {
  return weekdays.map((weekday) => WEEKDAY_LABELS[weekday] ?? `Day ${weekday}`).join(", ");
}

export function RecurringBlocksView({
  blocks,
  isPending,
  onDeleteBlock,
  onEditBlock,
}: RecurringBlocksViewProps) {
  if (blocks.length === 0) {
    return (
      <div className="rounded-[28px] border border-dashed border-border/75 bg-white/72 px-6 py-10 text-center shadow-[0_14px_34px_rgba(15,23,42,0.04)]">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-[linear-gradient(135deg,rgba(24,190,239,0.12),rgba(109,40,240,0.08))] text-primary">
          <Repeat className="h-6 w-6" />
        </div>
        <h3 className="mt-4 font-display text-[1.45rem] font-semibold tracking-tight text-foreground">
          No recurring blocks yet
        </h3>
        <p className="mx-auto mt-2 max-w-xl text-sm leading-6 text-secondary-foreground">
          Create a recurring block in the task editor and it will show up here for quick edits and cleanup.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {blocks.map((block) => {
          const typeMeta = getBlockTypeMeta(block.taskType);
          const TypeIcon = typeMeta.icon;

          return (
            <article
              key={block.seriesId}
              className="relative overflow-hidden rounded-[28px] border border-border/80 bg-white/94 p-4 shadow-[0_18px_42px_rgba(15,23,42,0.06)]"
            >
              <div className="absolute inset-x-6 top-0 h-px bg-brand-gradient" />

              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="section-label">Recurring block</span>
                    <span className="inline-flex items-center gap-1 rounded-full border border-border/80 bg-muted/35 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-secondary-foreground">
                      <TypeIcon className="h-3.5 w-3.5" />
                      {typeMeta.label}
                    </span>
                  </div>
                  <h3 className="mt-2 line-clamp-2 font-display text-xl font-semibold tracking-tight text-foreground">
                    {block.title}
                  </h3>
                </div>

                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    variant="secondary"
                    className="h-9 px-3"
                    onClick={() => onEditBlock(block)}
                    disabled={isPending}
                    aria-label={`Edit ${block.title}`}
                  >
                    <Pencil className="h-4 w-4" />
                    Edit
                  </Button>
                  <Button
                    size="sm"
                    variant="danger"
                    className="h-9 px-3"
                    onClick={() => onDeleteBlock(block)}
                    disabled={isPending}
                    aria-label={`Delete ${block.title}`}
                  >
                    <Trash2 className="h-4 w-4" />
                    Delete
                  </Button>
                </div>
              </div>

              <div className="mt-4 space-y-3">
                <div className="rounded-[20px] border border-cyan-200/65 bg-cyan-50/44 px-3.5 py-3">
                  <div className="flex items-start gap-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brand-gradient text-white shadow-[var(--shadow-brand-pill)]">
                      <Repeat className="h-4 w-4" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-foreground">{formatWeekdays(block.weekdays)}</p>
                      <p className="mt-1 text-[13px] leading-5 text-secondary-foreground">
                        Repeats every week from {block.startTime.slice(0, 5)} to {block.endTime.slice(0, 5)}.
                      </p>
                    </div>
                  </div>
                </div>

                <div className="grid gap-2 text-sm text-secondary-foreground">
                  <div className="flex items-center gap-2">
                    <Clock3 className="h-4 w-4 text-secondary-foreground/80" />
                    <span>{block.startTime.slice(0, 5)} to {block.endTime.slice(0, 5)}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <CalendarDays className="h-4 w-4 text-secondary-foreground/80" />
                    <span>
                      Next block {block.nextOccurrenceDate ? formatDateLabel(block.nextOccurrenceDate) : "not scheduled"}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Repeat className="h-4 w-4 text-secondary-foreground/80" />
                    <span>Started {formatDateLabel(block.effectiveStartDate)}</span>
                  </div>
                  {block.taskType === "meeting" && block.meetingLink ? (
                    <div className="flex items-center gap-2">
                      <Link2 className="h-4 w-4 text-secondary-foreground/80" />
                      <span className="truncate">{block.meetingLink}</span>
                    </div>
                  ) : null}
                  {block.taskType === "meeting" ? (
                    <div className="flex items-center gap-2">
                      <Users className="h-4 w-4 text-secondary-foreground/80" />
                      <span>
                        {block.participants.length > 0
                          ? `${block.participants.length} participant${block.participants.length === 1 ? "" : "s"}`
                          : "No participants yet"}
                      </span>
                    </div>
                  ) : null}
                </div>
              </div>
            </article>
          );
        })}
      </div>
    </div>
  );
}
