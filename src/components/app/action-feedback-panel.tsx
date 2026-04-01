"use client";

import { Volume2, VolumeX } from "lucide-react";

import { cn } from "@/lib/utils";

interface ActionFeedbackPanelProps {
  enabled: boolean;
  onToggle: (nextValue: boolean) => void;
}

export function ActionFeedbackPanel({ enabled, onToggle }: ActionFeedbackPanelProps) {
  return (
    <section className="rounded-[22px] border border-border/70 bg-white/82 p-4 shadow-[0_12px_28px_rgba(15,23,42,0.05)]">
      <div className="flex items-start gap-3">
        <span
          className={cn(
            "inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full",
            enabled ? "bg-brand-gradient text-white shadow-[var(--shadow-brand-pill)]" : "bg-muted text-secondary-foreground",
          )}
        >
          {enabled ? <Volume2 className="h-5 w-5" /> : <VolumeX className="h-5 w-5" />}
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-foreground">Action sounds</p>
          <p className="mt-1 text-sm text-secondary-foreground">
            Play subtle sound feedback when you add a block, complete a task, or move between app tabs.
          </p>
          <button
            type="button"
            className={cn(
              "mt-4 inline-flex h-11 items-center justify-center rounded-full px-4 text-sm font-semibold transition-[transform,box-shadow,background-color,color] duration-200 ease-[cubic-bezier(0.22,1,0.36,1)] active:scale-[0.98]",
              enabled
                ? "bg-brand-gradient text-white shadow-[var(--shadow-brand-pill)]"
                : "border border-border/80 bg-white text-foreground shadow-[0_10px_24px_rgba(15,23,42,0.05)]",
            )}
            onClick={() => onToggle(!enabled)}
          >
            {enabled ? "Sounds on" : "Turn sounds on"}
          </button>
          <p className="mt-2 text-xs text-secondary-foreground/78">Default is off. Works only after direct taps.</p>
        </div>
      </div>
    </section>
  );
}
