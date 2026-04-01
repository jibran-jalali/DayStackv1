"use client";

import { primePomodoroAudio } from "@/lib/pomodoro";

export type UiActionSoundKind = "add" | "complete" | "navigate";

export const UI_ACTION_SOUNDS_STORAGE_KEY = "daystack:ui-action-sounds:v1";
const UI_ACTION_SOUNDS_CHANGE_EVENT = "daystack:ui-action-sounds:change";

export function readUiActionSoundsEnabled() {
  if (typeof window === "undefined") {
    return false;
  }

  return window.localStorage.getItem(UI_ACTION_SOUNDS_STORAGE_KEY) === "1";
}

export function writeUiActionSoundsEnabled(nextValue: boolean) {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(UI_ACTION_SOUNDS_STORAGE_KEY, nextValue ? "1" : "0");
  window.dispatchEvent(new Event(UI_ACTION_SOUNDS_CHANGE_EVENT));
}

export function subscribeUiActionSoundsEnabled(onStoreChange: () => void) {
  if (typeof window === "undefined") {
    return () => undefined;
  }

  function handleStorage(event: StorageEvent) {
    if (!event.key || event.key === UI_ACTION_SOUNDS_STORAGE_KEY) {
      onStoreChange();
    }
  }

  window.addEventListener("storage", handleStorage);
  window.addEventListener(UI_ACTION_SOUNDS_CHANGE_EVENT, onStoreChange);

  return () => {
    window.removeEventListener("storage", handleStorage);
    window.removeEventListener(UI_ACTION_SOUNDS_CHANGE_EVENT, onStoreChange);
  };
}

function queueNote(
  audioContext: AudioContext,
  gainNode: GainNode,
  frequency: number,
  startOffset: number,
  duration: number,
  peakGain: number,
) {
  const oscillator = audioContext.createOscillator();
  oscillator.type = "sine";
  oscillator.frequency.setValueAtTime(frequency, audioContext.currentTime + startOffset);
  oscillator.connect(gainNode);

  const noteStart = audioContext.currentTime + startOffset;
  const notePeak = noteStart + Math.min(0.03, duration / 2);
  const noteEnd = noteStart + duration;

  gainNode.gain.setValueAtTime(0.0001, noteStart);
  gainNode.gain.exponentialRampToValueAtTime(peakGain, notePeak);
  gainNode.gain.exponentialRampToValueAtTime(0.0001, noteEnd);

  oscillator.start(noteStart);
  oscillator.stop(noteEnd + 0.02);
}

export async function playUiActionSound(kind: UiActionSoundKind) {
  const audioContext = await primePomodoroAudio();

  if (!audioContext) {
    return;
  }

  const gainNode = audioContext.createGain();
  gainNode.gain.setValueAtTime(0.0001, audioContext.currentTime);
  gainNode.connect(audioContext.destination);

  if (kind === "complete") {
    queueNote(audioContext, gainNode, 523.25, 0, 0.12, 0.05);
    queueNote(audioContext, gainNode, 659.25, 0.12, 0.14, 0.06);
    return;
  }

  if (kind === "add") {
    queueNote(audioContext, gainNode, 392, 0, 0.1, 0.04);
    queueNote(audioContext, gainNode, 523.25, 0.1, 0.14, 0.05);
    return;
  }

  queueNote(audioContext, gainNode, 349.23, 0, 0.08, 0.03);
  queueNote(audioContext, gainNode, 466.16, 0.08, 0.1, 0.035);
}
