"use client";

import { X } from "lucide-react";
import { useEffect, type ReactNode } from "react";

import { Button } from "@/components/shared/button";
import { cn } from "@/lib/utils";

interface TaskModalProps {
  children: ReactNode;
  description: string;
  onClose: () => void;
  open: boolean;
  title: string;
}

export function TaskModal({ children, description, onClose, open, title }: TaskModalProps) {
  useEffect(() => {
    if (!open) {
      return;
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onClose();
      }
    }

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [open, onClose]);

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
        aria-label="Close task modal"
        className="absolute inset-0 bg-slate-950/24 backdrop-blur-[4px] transition-opacity duration-200 ease-[cubic-bezier(0.22,1,0.36,1)]"
        onClick={onClose}
      />

      <div className="absolute inset-0 overflow-y-auto">
        <div className="flex min-h-full items-center justify-center p-2.5 sm:p-5">
          <div
            role="dialog"
            aria-modal="true"
            aria-label={title}
            className={cn(
              "relative flex w-full max-w-[42rem] flex-col overflow-hidden rounded-[28px] border border-white/70 bg-white/96 shadow-[0_28px_84px_rgba(15,23,42,0.16)] transition-[transform,opacity] duration-200 ease-[cubic-bezier(0.22,1,0.36,1)]",
              "max-h-[calc(100dvh-1.25rem)] sm:max-h-[calc(100dvh-2.5rem)]",
              open ? "translate-y-0 scale-100 opacity-100" : "translate-y-4 scale-[0.985] opacity-95",
            )}
          >
            <div className="border-b border-border/80 px-5 py-4 sm:px-6 sm:py-[1.125rem]">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <p className="section-label">Task editor</p>
                  <h2 className="mt-1 font-display text-[1.65rem] font-semibold tracking-tight text-foreground">{title}</h2>
                  <p className="mt-1 text-sm leading-6 text-secondary-foreground">{description}</p>
                </div>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-9 w-9 shrink-0 rounded-full px-0"
                  onClick={onClose}
                  aria-label="Close task modal"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4 overscroll-contain soft-scrollbar sm:px-6 sm:py-5">
              {children}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
