"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowUp,
  CheckCircle2,
  Clock3,
  ExternalLink,
  ListTodo,
  Loader2,
  Mic,
  MicOff,
  Search,
  Sparkles,
  Star,
  Volume2,
  VolumeX,
  X,
} from "lucide-react";

import { LogoMark } from "@/components/shared/logo";
import { getAssistantActionLines, getAssistantActionTitle } from "@/lib/assistant/actions";
import { confirmAssistantAction, sendAssistantMessage } from "@/lib/client/assistant";
import { formatDateLabel } from "@/lib/daystack";
import { cn, getErrorMessage } from "@/lib/utils";
import type {
  AssistantAnswerSource,
  AssistantContext,
  AssistantConversationMessage,
  AssistantFollowUpContext,
  AssistantMutationAction,
  AssistantResponseMode,
} from "@/types/assistant";
import type { DashboardSnapshot } from "@/types/daystack";

interface AssistantShellProps {
  onNotice: (notice: { message: string; type: "error" | "success" }) => void;
  onRefreshContext: (taskDate: string) => Promise<void>;
  snapshot: DashboardSnapshot;
}

interface ChatMessage {
  action?: AssistantMutationAction;
  content: string;
  id: string;
  mode: AssistantResponseMode;
  role: "assistant" | "user";
  sources: AssistantAnswerSource[];
}

interface SpeechRecognitionResultLike {
  isFinal: boolean;
  item(index: number): {
    transcript: string;
  };
}

interface SpeechRecognitionEventLike extends Event {
  resultIndex: number;
  results: {
    length: number;
    item(index: number): SpeechRecognitionResultLike;
  };
}

interface SpeechRecognitionLike extends EventTarget {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onend: (() => void) | null;
  onerror: ((event: Event) => void) | null;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  start: () => void;
  stop: () => void;
}

type SpeechRecognitionConstructor = new () => SpeechRecognitionLike;

const STARTER_PROMPTS = [
  { icon: Sparkles, text: "Add study from 6 to 7 PM", color: "from-violet-500 to-fuchsia-500" },
  { icon: ListTodo, text: "Move all pending tasks to tomorrow", color: "from-emerald-500 to-teal-500" },
  { icon: Star, text: "Mark all pending tasks complete", color: "from-amber-500 to-orange-500" },
  { icon: Clock3, text: "Plan my day: study, gym, review notes", color: "from-blue-500 to-cyan-500" },
] as const;

const CAPABILITY_CHIPS = [
  { label: "Create blocks", icon: "✦" },
  { label: "Edit & reschedule", icon: "✦" },
  { label: "Mark complete", icon: "✦" },
  { label: "Delete tasks", icon: "✦" },
  { label: "Batch schedule", icon: "✦" },
  { label: "Web search", icon: "✦" },
];

function createMessage(
  role: ChatMessage["role"],
  content: string,
  options?: {
    action?: AssistantMutationAction;
    mode?: AssistantResponseMode;
    sources?: AssistantAnswerSource[];
  },
): ChatMessage {
  return {
    action: options?.action,
    content,
    id: crypto.randomUUID(),
    mode: options?.mode ?? "planner",
    role,
    sources: options?.sources ?? [],
  };
}

function buildAssistantContext(snapshot: DashboardSnapshot): AssistantContext {
  return {
    currentDate: snapshot.taskDate,
    currentTimeIso: new Date().toISOString(),
    recurringBlocks: snapshot.recurringBlocks.map((block) => ({
      effectiveEndDate: block.effectiveEndDate,
      effectiveStartDate: block.effectiveStartDate,
      endTime: block.endTime.slice(0, 5),
      meetingLink: block.meetingLink,
      nextOccurrenceDate: block.nextOccurrenceDate,
      participants: block.participants.map((participant) => ({
        fullName: participant.fullName,
        id: participant.id,
      })),
      seriesId: block.seriesId,
      startTime: block.startTime.slice(0, 5),
      taskType: block.taskType,
      title: block.title,
      weekdays: block.weekdays,
    })),
    streak: snapshot.streak,
    summary: {
      completedTasks: snapshot.summary.completedTasks,
      completionRate: snapshot.summary.completionRate,
      executionScore: snapshot.summary.executionScore,
      incompleteTasks: snapshot.summary.incompleteTasks,
      successfulDay: snapshot.summary.successfulDay,
      summaryLine: snapshot.summary.summaryLine,
      totalTasks: snapshot.summary.totalTasks,
    },
    tasks: snapshot.tasks.map((task) => ({
      acceptedCopiesCount: task.acceptedCopiesCount,
      endTime: task.end_time.slice(0, 5),
      id: task.id,
      meetingLink: task.meeting_link,
      participants: task.participants.map((participant) => ({
        fullName: participant.fullName,
        id: participant.id,
      })),
      recurringSeriesId: task.recurringSeriesId,
      recurringWeekdays: task.recurringWeekdays,
      startTime: task.start_time.slice(0, 5),
      status: task.status,
      taskDate: task.task_date,
      taskType: task.task_type,
      title: task.title,
    })),
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC",
  };
}

function buildConversationHistory(messages: ChatMessage[]): AssistantConversationMessage[] {
  return messages.slice(-10).map((message) => ({
    content: message.content,
    role: message.role,
  }));
}

function getModeLabel(message: ChatMessage) {
  if (message.action) return "Action ready";
  if (message.mode === "web" || message.sources.length > 0) return "Web";
  if (message.mode === "general") return "General";
  return "Planner";
}

function getModeColor(message: ChatMessage) {
  if (message.action) return "bg-emerald-500/15 text-emerald-600 border-emerald-200";
  if (message.mode === "web" || message.sources.length > 0) return "bg-sky-500/15 text-sky-600 border-sky-200";
  if (message.mode === "general") return "bg-violet-500/15 text-violet-600 border-violet-200";
  return "bg-blue-500/15 text-blue-600 border-blue-200";
}

function getSpeechRecognitionConstructor(): SpeechRecognitionConstructor | null {
  if (typeof window === "undefined") {
    return null;
  }

  const speechWindow = window as Window & {
    SpeechRecognition?: SpeechRecognitionConstructor;
    webkitSpeechRecognition?: SpeechRecognitionConstructor;
  };

  return speechWindow.SpeechRecognition ?? speechWindow.webkitSpeechRecognition ?? null;
}

function canSpeakReplies() {
  return typeof window !== "undefined" && "speechSynthesis" in window && "SpeechSynthesisUtterance" in window;
}

const VOICE_AUTO_SUBMIT_DELAY_MS = 2000;

function selectAssistantVoice(voices: SpeechSynthesisVoice[]) {
  const englishVoices = voices.filter((voice) => voice.lang.toLowerCase().startsWith("en"));

  if (englishVoices.length === 0) {
    return null;
  }

  return englishVoices
    .map((voice) => {
      const name = voice.name.toLowerCase();
      let score = 0;

      if (voice.lang.toLowerCase() === "en-us") score += 12;
      if (/samantha|jenny|aria|serena|karen|moira|tessa|ava|susan/.test(name)) score += 18;
      if (/natural|neural|enhanced|premium/.test(name)) score += 16;
      if (/google|microsoft|apple/.test(name)) score += 8;
      if (/female/.test(name)) score += 5;
      if (/compact|basic|default/.test(name)) score -= 10;

      return { score, voice };
    })
    .sort((left, right) => right.score - left.score)[0]?.voice ?? null;
}

function SourceList({ sources }: { sources: AssistantAnswerSource[] }) {
  if (sources.length === 0) return null;

  return (
    <div className="mt-3 border-t border-border/70 pt-3">
      <p className="mb-2 text-[10px] font-semibold uppercase tracking-widest text-secondary-foreground/60">Sources</p>
      <div className="flex flex-wrap gap-2">
        {sources.map((source) => {
          const host = (() => {
            try {
              return new URL(source.url).hostname.replace(/^www\./, "");
            } catch {
              return source.url;
            }
          })();

          return (
            <a
              key={`${source.url}-${source.title ?? host}`}
              href={source.url}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 rounded-full border border-border/70 bg-muted/70 px-3 py-1 text-xs font-medium text-secondary-foreground transition-all hover:bg-muted hover:text-foreground"
            >
              <span className="truncate max-w-[140px]">{source.title ?? host}</span>
              <ExternalLink className="h-3 w-3 shrink-0 opacity-60" />
            </a>
          );
        })}
      </div>
    </div>
  );
}

function TypingIndicator() {
  return (
    <div className="flex items-center gap-1.5 px-1 py-2">
      <span className="h-2 w-2 rounded-full bg-current animate-bounce [animation-delay:-0.3s]" />
      <span className="h-2 w-2 rounded-full bg-current animate-bounce [animation-delay:-0.15s]" />
      <span className="h-2 w-2 rounded-full bg-current animate-bounce" />
    </div>
  );
}

function MessageBubble({ message }: { message: ChatMessage }) {
  if (message.role === "user") {
    return (
      <div className="flex justify-end">
        <div className="max-w-[min(84%,36rem)] rounded-[22px] rounded-br-md bg-brand-gradient px-4 py-3 text-[15px] leading-6 text-white shadow-[0_14px_28px_rgba(83,78,222,0.22)]">
          <p className="whitespace-pre-wrap">{message.content}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="group flex items-start gap-2.5 sm:gap-3">
      <span className="mt-0.5 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand-gradient shadow-[0_12px_24px_rgba(83,78,222,0.2)] sm:rounded-xl">
        <LogoMark className="h-5 w-5 rounded-lg" />
      </span>
      <div className="min-w-0 flex-1">
        <div className="mb-2 flex items-center gap-2">
          <p className="text-[10px] font-bold uppercase tracking-widest text-secondary-foreground/60">
            Assistant
          </p>
          <span className={cn("rounded-full border px-2 py-0.5 text-[10px] font-semibold", getModeColor(message))}>
            {getModeLabel(message)}
          </span>
        </div>
        <div className="max-w-[min(100%,44rem)] rounded-[22px] rounded-tl-md border border-white/80 bg-white/94 px-4 py-3.5 text-[15px] leading-7 text-foreground shadow-[0_12px_30px_rgba(83,78,222,0.08)] backdrop-blur-xl">
          <p className="whitespace-pre-wrap">{message.content}</p>
          <SourceList sources={message.sources} />
        </div>
      </div>
    </div>
  );
}

function ActionCard({
  action,
  context,
  isPending,
  onCancel,
  onConfirm,
}: {
  action: AssistantMutationAction;
  context: AssistantContext;
  isPending: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const lines = getAssistantActionLines(action, context);
  const isDestructive = action.kind === "delete_task" || action.kind === "delete_recurring_series";

  return (
    <div className="ml-10 sm:ml-11">
      <div className="max-w-[min(100%,44rem)] overflow-hidden rounded-[22px] rounded-tl-md border border-white/80 bg-white/94 shadow-[0_16px_36px_rgba(83,78,222,0.1)] backdrop-blur-xl">
        {/* Header stripe */}
        <div className={cn(
          "px-4 py-3 flex items-center justify-between",
          isDestructive
            ? "bg-gradient-to-r from-red-50 to-orange-50 border-b border-red-100"
            : "bg-[linear-gradient(135deg,rgba(24,190,239,0.12),rgba(109,40,240,0.08))] border-b border-cyan-100"
        )}>
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-secondary-foreground/60">
              Review change
            </p>
            <h3 className="mt-0.5 text-sm font-semibold text-foreground">{getAssistantActionTitle(action)}</h3>
          </div>
          <span className={cn(
            "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold border",
            isDestructive
              ? "bg-red-50 text-red-600 border-red-200"
              : "bg-emerald-50 text-emerald-600 border-emerald-200"
          )}>
            <CheckCircle2 className="h-3 w-3" />
            Confirm required
          </span>
        </div>

        {/* Detail lines */}
        <div className="px-4 py-3 space-y-1.5">
          {lines.map((line) => (
            <p key={line} className="text-sm leading-6 text-secondary-foreground">
              {line}
            </p>
          ))}
        </div>

        {/* Actions */}
        <div className="grid grid-cols-2 gap-2 border-t border-border/50 px-4 py-3">
          <button
            type="button"
            onClick={onConfirm}
            disabled={isPending}
            className={cn(
              "inline-flex min-h-10 items-center justify-center gap-2 rounded-full px-4 py-2 text-sm font-semibold text-white transition-all disabled:opacity-60",
              isDestructive
                ? "bg-gradient-to-r from-red-500 to-orange-500 hover:from-red-600 hover:to-orange-600 shadow-[0_4px_12px_rgba(239,68,68,0.3)]"
                : "bg-gradient-to-r from-blue-600 to-violet-600 hover:from-blue-700 hover:to-violet-700 shadow-[0_4px_12px_rgba(99,102,241,0.3)]"
            )}
          >
            {isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            {isPending ? "Applying..." : isDestructive ? "Confirm delete" : "Confirm change"}
          </button>
          <button
            type="button"
            onClick={onCancel}
            disabled={isPending}
            className="inline-flex min-h-10 items-center justify-center gap-1.5 rounded-full border border-border/80 bg-white px-4 py-2 text-sm font-semibold text-secondary-foreground transition-all hover:bg-muted/60 disabled:opacity-60"
          >
            <X className="h-3.5 w-3.5" />
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

function getFollowUpSuggestions(followUp: AssistantFollowUpContext | null) {
  if (!followUp) {
    return [];
  }

  if (followUp.kind === "task_selection") {
    return followUp.candidates.slice(0, 4).map((candidate, index) => ({
      label: `${index + 1}`,
      value: `${index + 1}`,
      detail: candidate.title,
    }));
  }

  if (followUp.missingField === "title") {
    return [
      { label: "Study", value: "Study session" },
      { label: "Workout", value: "Workout" },
      { label: "Review", value: "Review notes" },
    ];
  }

  if (followUp.missingField === "startTime") {
    return [
      { label: "9 AM", value: "at 9 AM" },
      { label: "2 PM", value: "at 2 PM" },
      { label: "6 PM", value: "at 6 PM" },
    ];
  }

  if (followUp.missingField === "endTime") {
    return [
      { label: "30 min", value: "for 30 min" },
      { label: "1 hour", value: "for 1 hour" },
      { label: "90 min", value: "for 90 min" },
    ];
  }

  if (followUp.missingField === "weekdays") {
    return [
      { label: "Weekdays", value: "weekdays" },
      { label: "MWF", value: "Monday Wednesday Friday" },
      { label: "Every day", value: "every day" },
    ];
  }

  return [];
}

function FollowUpGuide({
  disabled,
  followUp,
  onSelect,
}: {
  disabled: boolean;
  followUp: AssistantFollowUpContext | null;
  onSelect: (value: string) => void;
}) {
  const suggestions = getFollowUpSuggestions(followUp);

  if (suggestions.length === 0) {
    return null;
  }

  return (
    <div className="mb-3 rounded-[18px] border border-primary/10 bg-[linear-gradient(135deg,rgba(24,190,239,0.1),rgba(109,40,240,0.06),rgba(255,255,255,0.94))] p-3 shadow-[0_12px_26px_rgba(83,78,222,0.07)]">
      <div className="mb-2 flex items-center justify-between gap-3">
        <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-secondary-foreground/65">Quick reply</p>
        <span className="rounded-full bg-white/80 px-2.5 py-1 text-[11px] font-semibold text-primary">Guided</span>
      </div>
      <div className="flex gap-2 overflow-x-auto pb-1 soft-scrollbar">
        {suggestions.map((suggestion) => (
          <button
            key={`${suggestion.label}-${suggestion.value}`}
            suppressHydrationWarning
            type="button"
            disabled={disabled}
            onClick={() => onSelect(suggestion.value)}
            className="shrink-0 rounded-full border border-white/80 bg-white/92 px-3.5 py-2 text-left text-sm font-semibold text-foreground shadow-[0_8px_18px_rgba(15,23,42,0.06)] transition-all active:scale-[0.97] disabled:opacity-60"
          >
            <span>{suggestion.label}</span>
            {"detail" in suggestion && suggestion.detail ? (
              <span className="ml-1 text-xs font-medium text-secondary-foreground"> {suggestion.detail}</span>
            ) : null}
          </button>
        ))}
      </div>
    </div>
  );
}

function StarterPromptCard({
  disabled,
  onSelect,
  prompt,
}: {
  disabled: boolean;
  onSelect: (text: string) => void;
  prompt: (typeof STARTER_PROMPTS)[number];
}) {
  const Icon = prompt.icon;
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={() => onSelect(prompt.text)}
      className="group flex items-center gap-3 rounded-[18px] border border-border/70 bg-white/94 px-4 py-3.5 text-left shadow-[0_8px_22px_rgba(15,23,42,0.055)] backdrop-blur-xl transition-all hover:border-primary/25 hover:bg-white hover:shadow-[0_12px_28px_rgba(83,78,222,0.1)] hover:-translate-y-0.5 disabled:opacity-60 disabled:translate-y-0 disabled:hover:border-border/70 disabled:hover:shadow-[0_8px_22px_rgba(15,23,42,0.055)]"
    >
      <span className={cn("mt-0.5 shrink-0 flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-br text-white shadow-[0_10px_20px_rgba(83,78,222,0.16)]", prompt.color)}>
        <Icon className="h-3.5 w-3.5" />
      </span>
      <p className="text-[15px] leading-5 text-foreground">{prompt.text}</p>
    </button>
  );
}

export function AssistantShell({
  onNotice,
  onRefreshContext,
  snapshot,
}: AssistantShellProps) {
  const introMessage = useMemo(
    () =>
      `I'm your DayStack AI. I can see your schedule for ${formatDateLabel(snapshot.taskDate)} and help you create, move, edit, complete, delete, or bulk-update visible tasks. Tell me what you want changed and I will draft it for confirmation.`,
    [snapshot.taskDate],
  );
  const [messages, setMessages] = useState<ChatMessage[]>(() => [
    createMessage("assistant", introMessage, { mode: "planner" }),
  ]);
  const [draft, setDraft] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [pendingFollowUp, setPendingFollowUp] = useState<AssistantFollowUpContext | null>(null);
  const [pendingAction, setPendingAction] = useState<{
    action: AssistantMutationAction;
    messageId: string;
  } | null>(null);
  const [isConfirming, setIsConfirming] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [voiceEnabled, setVoiceEnabled] = useState(false);
  const [voiceStatus, setVoiceStatus] = useState<string | null>(null);
  const [isVoiceSubmitPending, setIsVoiceSubmitPending] = useState(false);
  const chatScrollRef = useRef<HTMLDivElement | null>(null);
  const composerRef = useRef<HTMLTextAreaElement | null>(null);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const finalTranscriptRef = useRef("");
  const latestTranscriptRef = useRef("");
  const voiceEnabledRef = useRef(false);
  const voiceSubmitTimerRef = useRef<number | null>(null);
  const context = useMemo(() => buildAssistantContext(snapshot), [snapshot]);
  const hasConversation = messages.some((message) => message.role === "user");
  const visibleMessages = hasConversation ? messages.slice(1) : [];
  const speechRecognitionSupported = useMemo(() => getSpeechRecognitionConstructor() !== null, []);
  const speechSynthesisSupported = useMemo(() => canSpeakReplies(), []);

  useEffect(() => {
    voiceEnabledRef.current = voiceEnabled;
  }, [voiceEnabled]);

  useEffect(() => {
    const container = chatScrollRef.current;
    if (!container) return;
    container.scrollTo({ top: container.scrollHeight, behavior: "smooth" });
  }, [messages, pendingAction]);

  useEffect(() => {
    setMessages((current) => {
      if (current.length === 1 && current[0]?.role === "assistant") {
        return [createMessage("assistant", introMessage, { mode: "planner" })];
      }
      return current;
    });
    setPendingAction(null);
    setPendingFollowUp(null);
  }, [introMessage]);

  useEffect(() => {
    const composer = composerRef.current;
    if (!composer) return;
    const maxHeight = 160;
    const minHeight = 24;
    composer.style.height = "0px";
    const nextHeight = Math.min(Math.max(composer.scrollHeight, minHeight), maxHeight);
    composer.style.height = `${nextHeight}px`;
    composer.style.overflowY = composer.scrollHeight > maxHeight ? "auto" : "hidden";
  }, [draft]);

  useEffect(() => {
    return () => {
      recognitionRef.current?.stop();
      if (voiceSubmitTimerRef.current !== null) {
        window.clearTimeout(voiceSubmitTimerRef.current);
      }
      window.speechSynthesis?.cancel();
    };
  }, []);

  useEffect(() => {
    if (!speechSynthesisSupported) return;

    const warmVoices = () => {
      window.speechSynthesis.getVoices();
    };

    warmVoices();
    window.speechSynthesis.addEventListener?.("voiceschanged", warmVoices);

    return () => {
      window.speechSynthesis.removeEventListener?.("voiceschanged", warmVoices);
    };
  }, [speechSynthesisSupported]);

  function clearVoiceSubmitTimer() {
    if (voiceSubmitTimerRef.current !== null) {
      window.clearTimeout(voiceSubmitTimerRef.current);
      voiceSubmitTimerRef.current = null;
    }
    setIsVoiceSubmitPending(false);
  }

  function scheduleVoiceSubmit(transcript: string) {
    clearVoiceSubmitTimer();
    setDraft(transcript);
    setIsVoiceSubmitPending(true);
    setVoiceStatus("Got it. Sending in 2 seconds...");

    voiceSubmitTimerRef.current = window.setTimeout(() => {
      voiceSubmitTimerRef.current = null;
      setIsVoiceSubmitPending(false);
      voiceEnabledRef.current = true;
      setVoiceEnabled(true);
      void submitPrompt(transcript);
    }, VOICE_AUTO_SUBMIT_DELAY_MS);
  }

  function speakAssistantReply(text: string) {
    if (!voiceEnabledRef.current || !speechSynthesisSupported) {
      return;
    }

    const cleanText = text
      .replace(/\s+/g, " ")
      .replace(/https?:\/\/\S+/g, "link")
      .trim();

    if (!cleanText) {
      return;
    }

    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(cleanText);
    const preferredVoice = selectAssistantVoice(window.speechSynthesis.getVoices());

    if (preferredVoice) {
      utterance.voice = preferredVoice;
    }

    utterance.rate = 0.92;
    utterance.pitch = 1;
    utterance.volume = 1;
    utterance.onstart = () => setIsSpeaking(true);
    utterance.onend = () => setIsSpeaking(false);
    utterance.onerror = () => setIsSpeaking(false);
    window.speechSynthesis.speak(utterance);
  }

  function toggleVoiceReplies() {
    if (!speechSynthesisSupported) {
      setVoiceStatus("Spoken replies are not supported in this browser.");
      return;
    }

    setVoiceEnabled((current) => {
      const next = !current;
      voiceEnabledRef.current = next;

      if (!next) {
        window.speechSynthesis.cancel();
        setIsSpeaking(false);
        setVoiceStatus("Voice replies muted.");
      } else {
        setVoiceStatus("Voice replies on.");
      }

      return next;
    });
  }

  function startListening() {
    const Recognition = getSpeechRecognitionConstructor();

    if (!Recognition) {
      setVoiceStatus("Voice input is not supported in this browser. Try Chrome on desktop or Android.");
      return;
    }

    if (isListening) {
      recognitionRef.current?.stop();
      setIsListening(false);
      return;
    }

    clearVoiceSubmitTimer();
    window.speechSynthesis?.cancel();
    finalTranscriptRef.current = "";
    latestTranscriptRef.current = "";

    const recognition = new Recognition();
    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.lang = "en-US";
    recognition.onresult = (event) => {
      let interimTranscript = "";

      for (let index = event.resultIndex; index < event.results.length; index += 1) {
        const result = event.results.item(index);
        const transcript = result.item(0).transcript;

        if (result.isFinal) {
          finalTranscriptRef.current = `${finalTranscriptRef.current} ${transcript}`.trim();
        } else {
          interimTranscript = `${interimTranscript} ${transcript}`.trim();
        }
      }

      const latestTranscript = (finalTranscriptRef.current || interimTranscript).trim();
      latestTranscriptRef.current = latestTranscript;
      setDraft(latestTranscript);
    };
    recognition.onerror = () => {
      setIsListening(false);
      clearVoiceSubmitTimer();
      setVoiceStatus("I could not hear that clearly. Try again.");
    };
    recognition.onend = () => {
      setIsListening(false);
      const finalTranscript = (finalTranscriptRef.current || latestTranscriptRef.current).trim();

      if (finalTranscript) {
        scheduleVoiceSubmit(finalTranscript);
      }
    };

    recognitionRef.current = recognition;
    setVoiceStatus("Listening...");
    setIsListening(true);
    recognition.start();
  }

  async function submitPrompt(prompt: string) {
    const nextPrompt = prompt.trim();
    if (!nextPrompt || isSending || isConfirming) return;

    clearVoiceSubmitTimer();
    setIsSending(true);
    setPendingAction(null);

    const userMessage = createMessage("user", nextPrompt, { mode: "general" });
    const nextMessages = [...messages, userMessage];
    setMessages(nextMessages);
    setDraft("");

    try {
      const response = await sendAssistantMessage({
        context,
        message: nextPrompt,
        messages: buildConversationHistory(nextMessages),
        pendingFollowUp,
      });
      const action =
        response.action.kind === "answer_only" || response.action.kind === "ask_followup"
          ? undefined
          : response.action;
      const assistantMessage = createMessage("assistant", response.reply, {
        action,
        mode: response.answerMode,
        sources: response.sources,
      });

      setMessages((current) => [...current, assistantMessage]);
      speakAssistantReply(response.reply);

      if (action) {
        setPendingFollowUp(null);
        setPendingAction({ action, messageId: assistantMessage.id });
      } else {
        setPendingAction(null);
        setPendingFollowUp(response.action.kind === "ask_followup" ? response.action.followUp ?? null : null);
      }
    } catch (error) {
      const message = getErrorMessage(error);
      setMessages((current) => [
        ...current,
        createMessage("assistant", `Something went wrong: ${message}`, { mode: "general" }),
      ]);
      speakAssistantReply(`Something went wrong: ${message}`);
      setPendingAction(null);
      onNotice({ message, type: "error" });
    } finally {
      setIsSending(false);
    }
  }

  async function handleConfirmAction() {
    if (!pendingAction || isConfirming) return;
    setIsConfirming(true);

    try {
      const result = await confirmAssistantAction({ action: pendingAction.action, context });
      setPendingAction(null);
      setPendingFollowUp(null);
      setMessages((current) => [
        ...current,
        createMessage("assistant", result.message, { mode: "planner" }),
      ]);
      speakAssistantReply(result.message);
      await onRefreshContext(result.recommendedDate);
      onNotice({ message: result.message, type: "success" });
    } catch (error) {
      const message = getErrorMessage(error);
      setMessages((current) => [
        ...current,
        createMessage("assistant", `Couldn't apply that change: ${message}`, { mode: "planner" }),
      ]);
      speakAssistantReply(`I couldn't apply that change. ${message}`);
      onNotice({ message, type: "error" });
    } finally {
      setIsConfirming(false);
    }
  }

  function handleCancelAction() {
    setPendingAction(null);
    setPendingFollowUp(null);
    setMessages((current) => [
      ...current,
      createMessage("assistant", "Got it, I won't apply that change.", { mode: "planner" }),
    ]);
    speakAssistantReply("Got it, I won't apply that change.");
  }

  function handleComposerKeyDown(event: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (event.nativeEvent.isComposing) return;
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      void submitPrompt(draft);
    }
  }

  const isBusy = isSending || isConfirming;

  return (
    <section className="mobile-app-shell flex h-full min-h-0 flex-1 flex-col overflow-hidden lg:bg-transparent">
      {/* Main chat area */}
      <div className="flex h-full min-h-0 flex-1 flex-col">
        {/* Scrollable messages */}
        <div ref={chatScrollRef} className="soft-scrollbar flex-1 overflow-y-auto">
          {!hasConversation ? (
            /* ── Welcome / empty state ── */
            <div className="flex min-h-full flex-col px-4 pb-6 pt-6 sm:px-6 lg:px-8">
              <div className="mx-auto flex w-full max-w-2xl flex-1 flex-col justify-center">
                {/* Header */}
                <div className="hidden">
                  <span className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-brand-gradient shadow-[0_14px_28px_rgba(83,78,222,0.2)] sm:rounded-2xl">
                    <Sparkles className="h-5 w-5 text-white" />
                  </span>
                  <div>
                    <h2 className="text-lg font-bold tracking-tight text-foreground">DayStack AI</h2>
                    <p className="text-xs text-secondary-foreground/70">
                      {formatDateLabel(snapshot.taskDate)} · {snapshot.tasks.length} task{snapshot.tasks.length !== 1 ? "s" : ""} in context
                    </p>
                  </div>
                </div>

                <p className="hidden">
                  I can see your full schedule and act on anything — just talk to me naturally.
                </p>

                <p className="hidden">
                  Ask naturally. I can draft changes, plan your day, and run bulk actions after you confirm.
                </p>

                {/* Capability chips */}
                <div className="hidden">
                  {CAPABILITY_CHIPS.map((chip) => (
                    <span
                      key={chip.label}
                      className="inline-flex items-center gap-1.5 rounded-full border border-white/80 bg-white/86 px-3 py-1 text-xs font-semibold text-primary shadow-[0_8px_18px_rgba(83,78,222,0.06)]"
                    >
                      {chip.label}
                    </span>
                  ))}
                </div>

                <div className="mb-4">
                  <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-secondary-foreground/60">
                    Assistant shortcuts
                  </p>
                  <h2 className="mt-1 font-display text-2xl font-semibold tracking-tight text-foreground">
                    What should DayStack do?
                  </h2>
                  <p className="mt-2 text-sm leading-6 text-secondary-foreground">
                    Choose a quick action or type a custom request. You will confirm before anything changes.
                  </p>
                </div>

                <div className="grid gap-2.5">
                  {STARTER_PROMPTS.map((prompt) => (
                    <StarterPromptCard
                      key={prompt.text}
                      disabled={isBusy}
                      onSelect={(text) => void submitPrompt(text)}
                      prompt={prompt}
                    />
                  ))}
                </div>
              </div>
            </div>
          ) : (
            /* ── Conversation ── */
            <div className="mx-auto w-full max-w-3xl space-y-5 px-3 py-4 sm:px-6 lg:px-8">
              {visibleMessages.map((message) => (
                <div key={message.id} className="space-y-3 fade-in-up">
                  <MessageBubble message={message} />
                  {pendingAction?.messageId === message.id ? (
                    <ActionCard
                      action={pendingAction.action}
                      context={context}
                      isPending={isConfirming}
                      onCancel={handleCancelAction}
                      onConfirm={handleConfirmAction}
                    />
                  ) : null}
                </div>
              ))}

              {/* Typing indicator */}
              {isSending && (
                <div className="flex items-start gap-3 fade-in-up">
                  <span className="shrink-0 inline-flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-br from-blue-500 to-violet-600 shadow-[0_4px_12px_rgba(99,102,241,0.35)]">
                    <LogoMark className="h-5 w-5 rounded-lg" />
                  </span>
                  <div className="rounded-[20px] rounded-tl-[6px] border border-border/60 bg-white px-4 py-3 shadow-[0_4px_16px_rgba(15,23,42,0.06)]">
                    <div className="flex items-center gap-1 text-secondary-foreground/60">
                      <TypingIndicator />
                    </div>
                  </div>
                </div>
              )}
              {isConfirming && (
                <div className="flex items-start gap-3 fade-in-up">
                  <span className="shrink-0 inline-flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-br from-blue-500 to-violet-600">
                    <LogoMark className="h-5 w-5 rounded-lg" />
                  </span>
                  <div className="rounded-[20px] rounded-tl-[6px] border border-border/60 bg-white px-4 py-3 text-sm text-secondary-foreground shadow-[0_4px_16px_rgba(15,23,42,0.06)]">
                    <div className="flex items-center gap-2">
                      <Loader2 className="h-4 w-4 animate-spin text-violet-500" />
                      Applying change to your schedule...
                    </div>
                  </div>
                </div>
              )}

              {/* Spacer so last message clears the composer and floating mobile dock. */}
              <div className="h-[calc(var(--mobile-bottom-nav-height)+1.25rem)] lg:h-4" />
            </div>
          )}
        </div>

        {/* ── Composer ── */}
        <div className="border-t border-white/70 bg-white/82 px-3 pb-[calc(var(--mobile-bottom-nav-height)+env(safe-area-inset-bottom)+0.75rem)] pt-3 shadow-[0_-10px_28px_rgba(83,78,222,0.06)] backdrop-blur-xl sm:bg-white/90 sm:px-6 lg:px-8 lg:pb-3">
          <div className="mx-auto w-full max-w-3xl">
            {/* Follow-up hint banner */}
            {pendingFollowUp && (
              <div className="mb-3 flex items-start gap-2.5 rounded-[14px] border border-amber-200 bg-amber-50 px-3.5 py-2.5 text-sm text-amber-800">
                <Search className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />
                <p>I need one more detail to draft the right change.</p>
              </div>
            )}
            <FollowUpGuide
              disabled={isBusy}
              followUp={pendingFollowUp}
              onSelect={(value) => void submitPrompt(value)}
            />

            <div className="mb-2 flex flex-wrap items-center justify-between gap-2 px-1">
              <div className="flex items-center gap-2">
                <span
                  className={cn(
                    "inline-flex h-2 w-2 rounded-full",
                    isListening
                      ? "animate-pulse bg-red-500"
                      : isVoiceSubmitPending
                        ? "animate-pulse bg-amber-500"
                        : isSpeaking
                          ? "animate-pulse bg-emerald-500"
                          : "bg-border",
                  )}
                  aria-hidden
                />
                <p className="text-[11px] font-medium text-secondary-foreground/70">
                  {isListening
                    ? "Listening..."
                    : isVoiceSubmitPending
                      ? "Sending in a moment..."
                      : isSpeaking
                        ? "Speaking..."
                        : voiceStatus ?? "Voice input and spoken replies are free browser features."}
                </p>
              </div>
              <button
                suppressHydrationWarning
                type="button"
                className={cn(
                  "inline-flex h-8 items-center gap-1.5 rounded-full border px-3 text-[11px] font-semibold transition-[transform,background-color,color] active:scale-[0.97]",
                  voiceEnabled
                    ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                    : "border-border/80 bg-white/86 text-secondary-foreground",
                )}
                onClick={toggleVoiceReplies}
              >
                {voiceEnabled ? <Volume2 className="h-3.5 w-3.5" /> : <VolumeX className="h-3.5 w-3.5" />}
                {voiceEnabled ? "Voice on" : "Voice off"}
              </button>
            </div>

            {/* Input box */}
            <div className={cn(
              "flex items-end gap-2.5 rounded-[24px] border bg-white/94 px-3.5 py-2.5 shadow-[0_12px_28px_rgba(83,78,222,0.09)] backdrop-blur-xl transition-all",
              isBusy
                ? "border-border/50 opacity-80"
                : "border-border/70 focus-within:border-violet-300 focus-within:shadow-[0_4px_20px_rgba(99,102,241,0.12)]"
            )}>
              <textarea
                ref={composerRef}
                value={draft}
                onChange={(event) => {
                  clearVoiceSubmitTimer();
                  setDraft(event.target.value);
                }}
                onKeyDown={handleComposerKeyDown}
                rows={1}
                placeholder="Message DayStack AI"
                disabled={isBusy}
                className="max-h-40 min-h-0 flex-1 resize-none border-0 bg-transparent py-1.5 text-[16px] leading-6 text-foreground outline-none placeholder:text-secondary-foreground/50 disabled:opacity-60"
              />
              <button
                suppressHydrationWarning
                type="button"
                aria-label={isListening ? "Stop listening" : "Start voice input"}
                disabled={isBusy || !speechRecognitionSupported}
                onClick={startListening}
                className={cn(
                  "mb-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full transition-all active:scale-95 disabled:cursor-not-allowed disabled:opacity-45",
                  isListening
                    ? "bg-red-500 text-white shadow-[0_12px_24px_rgba(239,68,68,0.22)]"
                    : "border border-border/80 bg-white text-secondary-foreground shadow-[0_8px_18px_rgba(15,23,42,0.06)] hover:text-foreground",
                )}
              >
                {isListening ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
              </button>
              <button
                suppressHydrationWarning
                type="button"
                aria-label="Send message"
                disabled={!draft.trim() || isBusy}
                onClick={() => {
                  clearVoiceSubmitTimer();
                  void submitPrompt(draft);
                }}
                className={cn(
                  "shrink-0 mb-0.5 flex h-9 w-9 items-center justify-center rounded-full transition-all",
                  draft.trim() && !isBusy
                    ? "bg-brand-gradient text-white shadow-[0_12px_24px_rgba(83,78,222,0.22)] hover:scale-105 active:scale-95"
                    : "bg-muted text-secondary-foreground/40 cursor-not-allowed"
                )}
              >
                {isSending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <ArrowUp className="h-4 w-4" />
                )}
              </button>
            </div>

            <p className="hidden">
              Enter to send · Shift+Enter for new line · Changes are always confirmed before applying
            </p>
            <p className="mt-2 text-center text-[11px] text-secondary-foreground/50">
              Changes are always confirmed before applying
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
