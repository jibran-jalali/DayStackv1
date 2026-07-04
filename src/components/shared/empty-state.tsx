import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

interface EmptyStateProps {
  icon: ReactNode;
  title: string;
  description: string;
  action?: ReactNode;
  className?: string;
}

export function EmptyState({ icon, title, description, action, className }: EmptyStateProps) {
  return (
    <div
      className={cn(
        "elevated-card flex flex-col items-start gap-4 rounded-[28px] border border-dashed border-border/80 bg-white/84 p-6 text-left",
        className,
      )}
    >
      <div className="rounded-2xl bg-muted p-3 text-primary">{icon}</div>
      <div className="space-y-2">
        <h3 className="font-display text-xl font-semibold text-foreground">{title}</h3>
        <p className="max-w-xl text-sm leading-7 text-secondary-foreground">{description}</p>
      </div>
      {action}
    </div>
  );
}
