"use client";

import { cn } from "@/lib/utils";

interface MobileToastProps {
  message: string;
  offset?: "header" | "top";
  type: "error" | "success";
}

export function MobileToast({ message, offset = "header", type }: MobileToastProps) {
  return (
    <div
      className={cn(
        "pointer-events-none fixed inset-x-0 z-50 flex justify-center mobile-safe-x lg:hidden",
        offset === "top"
          ? "top-[calc(env(safe-area-inset-top)+0.75rem)]"
          : "top-[calc(env(safe-area-inset-top)+5.5rem)]",
      )}
    >
      <div
        aria-live="polite"
        className={cn(
          "mobile-toast pointer-events-auto",
          type === "success" ? "mobile-toast--success" : "mobile-toast--error",
        )}
      >
        {message}
      </div>
    </div>
  );
}
