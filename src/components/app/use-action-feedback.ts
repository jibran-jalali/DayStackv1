"use client";

import { useCallback, useSyncExternalStore } from "react";

import {
  playUiActionSound,
  readUiActionSoundsEnabled,
  subscribeUiActionSoundsEnabled,
  writeUiActionSoundsEnabled,
  type UiActionSoundKind,
} from "@/lib/ui-feedback";

interface UseActionFeedbackOptions {
  onNotice?: (notice: { message: string; type: "error" | "success" }) => void;
}

export function useActionFeedback({ onNotice }: UseActionFeedbackOptions = {}) {
  const soundsEnabled = useSyncExternalStore(
    subscribeUiActionSoundsEnabled,
    readUiActionSoundsEnabled,
    () => false,
  );

  const setSoundsEnabled = useCallback(
    (nextValue: boolean) => {
      writeUiActionSoundsEnabled(nextValue);
      onNotice?.({
        type: "success",
        message: nextValue ? "Action sounds enabled." : "Action sounds turned off.",
      });
    },
    [onNotice],
  );

  const playActionFeedback = useCallback(
    (kind: UiActionSoundKind) => {
      if (!soundsEnabled) {
        return;
      }

      void playUiActionSound(kind).catch(() => {
        return;
      });
    },
    [soundsEnabled],
  );

  return {
    playActionFeedback,
    setSoundsEnabled,
    soundsEnabled,
  };
}
