"use client";

import { X } from "lucide-react";
import { useEffect, useRef, useState, type ReactNode } from "react";

import { Button } from "@/components/shared/button";
import { cn } from "@/lib/utils";

interface TaskModalProps {
  children: ReactNode;
  description: string;
  eyebrow?: string;
  maxWidthClassName?: string;
  onClose: () => void;
  open: boolean;
  title: string;
}

export function TaskModal({
  children,
  description,
  eyebrow = "Task editor",
  maxWidthClassName = "max-w-[42rem]",
  onClose,
  open,
  title,
}: TaskModalProps) {
  const surfaceRef = useRef<HTMLDivElement | null>(null);
  const [mobileViewportHeight, setMobileViewportHeight] = useState<number | null>(null);
  const [mobileKeyboardInset, setMobileKeyboardInset] = useState(0);

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

  useEffect(() => {
    if (!open) {
      return;
    }

    function updateViewportMetrics() {
      const isCompactViewport = window.innerWidth < 640;

      if (!isCompactViewport) {
        setMobileViewportHeight(null);
        setMobileKeyboardInset(0);
        return;
      }

      const viewport = window.visualViewport;

      if (!viewport) {
        setMobileViewportHeight(window.innerHeight);
        setMobileKeyboardInset(0);
        return;
      }

      const nextViewportHeight = Math.max(0, Math.round(viewport.height));
      const nextKeyboardInset = Math.max(
        0,
        Math.round(window.innerHeight - viewport.height - viewport.offsetTop),
      );

      setMobileViewportHeight(nextViewportHeight);
      setMobileKeyboardInset(nextKeyboardInset);
    }

    updateViewportMetrics();

    const viewport = window.visualViewport;
    window.addEventListener("resize", updateViewportMetrics);
    viewport?.addEventListener("resize", updateViewportMetrics);
    viewport?.addEventListener("scroll", updateViewportMetrics);

    return () => {
      window.removeEventListener("resize", updateViewportMetrics);
      viewport?.removeEventListener("resize", updateViewportMetrics);
      viewport?.removeEventListener("scroll", updateViewportMetrics);
    };
  }, [open]);

  useEffect(() => {
    if (!open || !surfaceRef.current) {
      return;
    }

    function handleFocusIn(event: FocusEvent) {
      if (window.innerWidth >= 640) {
        return;
      }

      const target = event.target;

      if (!(target instanceof HTMLElement) || !surfaceRef.current?.contains(target)) {
        return;
      }

      const isInputTarget =
        target instanceof HTMLInputElement ||
        target instanceof HTMLTextAreaElement ||
        target instanceof HTMLSelectElement ||
        target.isContentEditable;

      if (!isInputTarget) {
        return;
      }

      window.setTimeout(() => {
        target.scrollIntoView({
          behavior: "smooth",
          block: "center",
          inline: "nearest",
        });
      }, 160);
    }

    window.addEventListener("focusin", handleFocusIn);

    return () => {
      window.removeEventListener("focusin", handleFocusIn);
    };
  }, [open]);

  const mobileDialogStyle =
    mobileViewportHeight !== null
      ? {
          height: `${mobileViewportHeight}px`,
          maxHeight: `${mobileViewportHeight}px`,
        }
      : undefined;
  const mobileContentPadding = mobileViewportHeight !== null ? Math.max(24, mobileKeyboardInset + 24) : undefined;

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

      <div className="absolute inset-0 overflow-y-auto overscroll-contain">
        <div
          className="flex min-h-full items-end justify-center p-0 sm:items-center sm:p-5"
          style={mobileViewportHeight !== null ? { paddingBottom: `${mobileKeyboardInset}px` } : undefined}
        >
          <div
            ref={surfaceRef}
            role="dialog"
            aria-modal="true"
            aria-label={title}
            className={cn(
              "relative flex w-full flex-col overflow-hidden border border-white/70 bg-white/96 shadow-[0_28px_84px_rgba(15,23,42,0.16)] transition-[transform,opacity] duration-200 ease-[cubic-bezier(0.22,1,0.36,1)]",
              "h-[min(100dvh,100%)] max-h-[100dvh] rounded-t-[30px] sm:h-auto sm:max-h-[calc(100dvh-2.5rem)] sm:rounded-[28px]",
              maxWidthClassName,
              open ? "translate-y-0 scale-100 opacity-100" : "translate-y-4 scale-[0.985] opacity-95",
            )}
            style={mobileDialogStyle}
          >
            <div className="border-b border-border/80 px-5 py-4 sm:px-6 sm:py-[1.125rem]">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <p className="section-label">{eyebrow}</p>
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

            <div
              className="min-h-0 flex-1 overflow-y-auto px-5 py-4 overscroll-contain soft-scrollbar sm:px-6 sm:py-5"
              style={
                mobileContentPadding
                  ? {
                      paddingBottom: `${mobileContentPadding}px`,
                      scrollPaddingBottom: `${mobileContentPadding}px`,
                    }
                  : undefined
              }
            >
              {children}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
