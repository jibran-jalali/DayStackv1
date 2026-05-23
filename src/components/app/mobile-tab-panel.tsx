"use client";

import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

interface MobileTabPanelProps {
  children: ReactNode;
  className?: string;
  /** Unique key — changing it triggers enter animation */
  panelKey: string;
}

export function MobileTabPanel({ children, className, panelKey }: MobileTabPanelProps) {
  return (
    <div key={panelKey} className={cn("mobile-tab-enter", className)}>
      {children}
    </div>
  );
}
