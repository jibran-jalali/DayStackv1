"use client";

import { Volume2, VolumeX } from "lucide-react";

import { cn } from "@/lib/utils";

interface ActionFeedbackPanelProps {
  compact?: boolean;
  enabled: boolean;
  onToggle: (nextValue: boolean) => void;
}

export function ActionFeedbackPanel({ compact = false, enabled, onToggle }: ActionFeedbackPanelProps) {
  return (
    <section className={cn("rounded-[18px] border border-border/70 bg-white/82 shadow-[0_10px_24px_rgba(15,23,42,0.05)]", compact ? "p-3" : "p-4")}>
      <div className="flex items-start gap-2.5">
        <span
          className={cn(
            "inline-flex shrink-0 items-center justify-center rounded-full",
            compact ? "h-9 w-9" : "h-11 w-11",
            enabled ? "bg-brand-gradient text-white shadow-[var(--shadow-brand-pill)]" : "bg-muted text-secondary-foreground",
          )}
        >
          {enabled ? <Volume2 className={compact ? "h-4 w-4" : "h-5 w-5"} /> : <VolumeX className={compact ? "h-4 w-4" : "h-5 w-5"} />}
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-foreground">Action sounds</p>
          <p className={cn("mt-1 text-secondary-foreground", compact ? "text-xs" : "text-sm")}>
            Sound feedback for taps and tab changes.
          </p>
          <button
            suppressHydrationWarning
            type="button"
            className={cn(
              "inline-flex items-center justify-center rounded-full font-semibold transition-[transform,box-shadow,background-color,color] duration-200 ease-[cubic-bezier(0.22,1,0.36,1)] active:scale-[0.98]",
              compact ? "mt-2.5 h-9 px-3 text-xs" : "mt-4 h-11 px-4 text-sm",
              enabled
                ? "bg-brand-gradient text-white shadow-[var(--shadow-brand-pill)]"
                : "border border-border/80 bg-white text-foreground shadow-[0_10px_24px_rgba(15,23,42,0.05)]",
            )}
            onClick={() => onToggle(!enabled)}
          >
            {enabled ? "Sounds on" : "Turn sounds on"}
          </button>
          {!compact ? <p className="mt-2 text-xs text-secondary-foreground/78">Default is off. Works only after direct taps.</p> : null}
        </div>
      </div>
    </section>
  );
}
