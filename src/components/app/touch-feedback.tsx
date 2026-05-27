"use client";

import { useEffect } from "react";

function isInteractiveElement(target: EventTarget | null) {
  if (!(target instanceof Element)) {
    return false;
  }

  const interactiveElement = target.closest(
    'button, a, [role="button"], input[type="checkbox"], input[type="radio"], summary',
  );

  if (!interactiveElement) {
    return false;
  }

  if (
    interactiveElement.hasAttribute("disabled") ||
    interactiveElement.getAttribute("aria-disabled") === "true"
  ) {
    return false;
  }

  return true;
}

export function TouchFeedback() {
  useEffect(() => {
    function handlePointerUp(event: PointerEvent) {
      if (!isInteractiveElement(event.target)) {
        return;
      }

      window.navigator.vibrate?.(8);
    }

    window.addEventListener("pointerup", handlePointerUp, { passive: true });
    return () => window.removeEventListener("pointerup", handlePointerUp);
  }, []);

  return null;
}
