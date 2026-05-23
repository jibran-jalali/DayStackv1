"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowUp,
  Bot,
  Calendar,
  CheckCircle2,
  Clock,
  ExternalLink,
  ListTodo,
  Loader2,
  RefreshCw,
  Search,
  Sparkles,
  Star,
  Trash2,
  X,
  Zap,
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

const STARTER_PROMPTS = [
  { icon: Calendar, text: "Plan my day around a 90-min deep work block", color: "from-blue-500 to-cyan-500" },
  { icon: Zap, text: "What should I focus on first today?", color: "from-violet-500 to-purple-600" },
  { icon: ListTodo, text: "Move all my pending tasks to tomorrow", color: "from-emerald-500 to-teal-500" },
  { icon: Star, text: "What changed in AI this week?", color: "from-amber-500 to-orange-500" },
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

function SourceList({ sources }: { sources: AssistantAnswerSource[] }) {
  if (sources.length === 0) return null;

  return (
    <div className="mt-3 border-t border-white/20 pt-3">
      <p className="text-[10px] font-semibold uppercase tracking-widest text-white/50 mb-2">Sources</p>
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
              className="inline-flex items-center gap-1.5 rounded-full border border-white/20 bg-white/10 px-3 py-1 text-xs font-medium text-white/80 hover:bg-white/20 hover:text-white transition-all"
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
        <div className="max-w-[min(85%,36rem)] rounded-[20px] rounded-br-[6px] bg-gradient-to-br from-blue-600 to-violet-600 px-4 py-3 text-sm leading-6 text-white shadow-[0_8px_24px_rgba(99,102,241,0.3)]">
          <p className="whitespace-pre-wrap">{message.content}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-start gap-3 group">
      <span className="mt-0.5 shrink-0 inline-flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-br from-blue-500 to-violet-600 shadow-[0_4px_12px_rgba(99,102,241,0.35)]">
        <LogoMark className="h-5 w-5 rounded-lg" />
      </span>
      <div className="min-w-0 flex-1">
        <div className="mb-2 flex items-center gap-2">
          <p className="text-[10px] font-bold uppercase tracking-widest text-secondary-foreground/60">
            DayStack AI
          </p>
          <span className={cn("rounded-full border px-2 py-0.5 text-[10px] font-semibold", getModeColor(message))}>
            {getModeLabel(message)}
          </span>
        </div>
        <div className="max-w-[min(100%,44rem)] rounded-[20px] rounded-tl-[6px] border border-border/60 bg-white px-4 py-3.5 text-sm leading-7 text-foreground shadow-[0_4px_16px_rgba(15,23,42,0.06)]">
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
    <div className="ml-11">
      <div className="max-w-[min(100%,44rem)] overflow-hidden rounded-[20px] rounded-tl-[6px] border border-border/60 bg-white shadow-[0_4px_16px_rgba(15,23,42,0.06)]">
        {/* Header stripe */}
        <div className={cn(
          "px-4 py-3 flex items-center justify-between",
          isDestructive
            ? "bg-gradient-to-r from-red-50 to-orange-50 border-b border-red-100"
            : "bg-gradient-to-r from-blue-50 to-violet-50 border-b border-indigo-100"
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
        <div className="flex gap-2 border-t border-border/50 px-4 py-3">
          <button
            type="button"
            onClick={onConfirm}
            disabled={isPending}
            className={cn(
              "inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold text-white transition-all disabled:opacity-60",
              isDestructive
                ? "bg-gradient-to-r from-red-500 to-orange-500 hover:from-red-600 hover:to-orange-600 shadow-[0_4px_12px_rgba(239,68,68,0.3)]"
                : "bg-gradient-to-r from-blue-600 to-violet-600 hover:from-blue-700 hover:to-violet-700 shadow-[0_4px_12px_rgba(99,102,241,0.3)]"
            )}
          >
            {isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            {isPending ? "Applying…" : isDestructive ? "Confirm delete" : "Confirm change"}
          </button>
          <button
            type="button"
            onClick={onCancel}
            disabled={isPending}
            className="inline-flex items-center gap-1.5 rounded-full border border-border/80 bg-white px-4 py-2 text-sm font-semibold text-secondary-foreground hover:bg-muted/60 transition-all disabled:opacity-60"
          >
            <X className="h-3.5 w-3.5" />
            Cancel
          </button>
        </div>
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
      className="group flex items-start gap-3 rounded-[18px] border border-border/60 bg-white px-4 py-3.5 text-left transition-all hover:border-violet-200 hover:shadow-[0_4px_16px_rgba(99,102,241,0.12)] hover:-translate-y-0.5 disabled:opacity-60 disabled:translate-y-0 disabled:hover:border-border/60 disabled:hover:shadow-none"
    >
      <span className={cn("mt-0.5 shrink-0 flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-br text-white", prompt.color)}>
        <Icon className="h-3.5 w-3.5" />
      </span>
      <p className="text-sm leading-5 text-foreground">{prompt.text}</p>
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
      `I'm your DayStack AI — I can see your full schedule for ${formatDateLabel(snapshot.taskDate)} and I'm ready to help. I can create, move, edit, complete, or delete any task, plan your whole day from a brain dump, or answer any question. Just tell me what you need.`,
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
  const chatScrollRef = useRef<HTMLDivElement | null>(null);
  const composerRef = useRef<HTMLTextAreaElement | null>(null);
  const context = useMemo(() => buildAssistantContext(snapshot), [snapshot]);
  const hasConversation = messages.some((message) => message.role === "user");
  const visibleMessages = hasConversation ? messages.slice(1) : [];

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

  async function submitPrompt(prompt: string) {
    const nextPrompt = prompt.trim();
    if (!nextPrompt || isSending || isConfirming) return;

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
      await onRefreshContext(result.recommendedDate);
      onNotice({ message: result.message, type: "success" });
    } catch (error) {
      const message = getErrorMessage(error);
      setMessages((current) => [
        ...current,
        createMessage("assistant", `Couldn't apply that change: ${message}`, { mode: "planner" }),
      ]);
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
    <section className="flex h-full min-h-0 flex-1 flex-col overflow-hidden">
      {/* Main chat area */}
      <div className="flex h-full min-h-0 flex-1 flex-col">
        {/* Scrollable messages */}
        <div ref={chatScrollRef} className="soft-scrollbar flex-1 overflow-y-auto">
          {!hasConversation ? (
            /* ── Welcome / empty state ── */
            <div className="flex min-h-full flex-col px-4 pb-6 pt-6 sm:px-6 lg:px-8">
              <div className="mx-auto w-full max-w-2xl flex flex-col flex-1 justify-center">
                {/* Header */}
                <div className="flex items-center gap-3 mb-6">
                  <span className="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-500 to-violet-600 shadow-[0_8px_24px_rgba(99,102,241,0.35)]">
                    <Sparkles className="h-5 w-5 text-white" />
                  </span>
                  <div>
                    <h2 className="text-lg font-bold tracking-tight text-foreground">DayStack AI</h2>
                    <p className="text-xs text-secondary-foreground/70">
                      {formatDateLabel(snapshot.taskDate)} · {snapshot.tasks.length} task{snapshot.tasks.length !== 1 ? "s" : ""} in context
                    </p>
                  </div>
                </div>

                <p className="text-[15px] leading-7 text-secondary-foreground mb-6">
                  I can see your full schedule and act on anything — just talk to me naturally.
                </p>

                {/* Capability chips */}
                <div className="flex flex-wrap gap-2 mb-8">
                  {CAPABILITY_CHIPS.map((chip) => (
                    <span
                      key={chip.label}
                      className="inline-flex items-center gap-1.5 rounded-full border border-violet-200/80 bg-violet-50 px-3 py-1 text-xs font-semibold text-violet-700"
                    >
                      <span className="text-[9px] text-violet-400">{chip.icon}</span>
                      {chip.label}
                    </span>
                  ))}
                </div>

                {/* Starter prompts */}
                <div className="grid gap-2.5 sm:grid-cols-2">
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
            <div className="mx-auto w-full max-w-3xl space-y-5 px-4 py-5 sm:px-6 lg:px-8">
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
                      Applying change to your schedule…
                    </div>
                  </div>
                </div>
              )}

              {/* Spacer so last message clears the composer */}
              <div className="h-4" />
            </div>
          )}
        </div>

        {/* ── Composer ── */}
        <div className="border-t border-border/50 bg-white/90 backdrop-blur-sm px-4 py-3 sm:px-6 lg:px-8">
          <div className="mx-auto w-full max-w-3xl">
            {/* Follow-up hint banner */}
            {pendingFollowUp && (
              <div className="mb-3 flex items-start gap-2.5 rounded-[14px] border border-amber-200 bg-amber-50 px-3.5 py-2.5 text-sm text-amber-800">
                <Search className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />
                <p>I need one more detail to draft the right change.</p>
              </div>
            )}

            {/* Input box */}
            <div className={cn(
              "flex items-end gap-2.5 rounded-[20px] border bg-white px-3.5 py-2.5 shadow-[0_2px_16px_rgba(15,23,42,0.07)] transition-all",
              isBusy
                ? "border-border/50 opacity-80"
                : "border-border/70 focus-within:border-violet-300 focus-within:shadow-[0_4px_20px_rgba(99,102,241,0.12)]"
            )}>
              <textarea
                ref={composerRef}
                value={draft}
                onChange={(event) => setDraft(event.target.value)}
                onKeyDown={handleComposerKeyDown}
                rows={1}
                placeholder="Ask anything or describe a change…"
                disabled={isBusy}
                className="max-h-40 min-h-0 flex-1 resize-none border-0 bg-transparent py-1 text-[15px] leading-6 text-foreground outline-none placeholder:text-secondary-foreground/50 disabled:opacity-60"
              />
              <button
                type="button"
                aria-label="Send message"
                disabled={!draft.trim() || isBusy}
                onClick={() => void submitPrompt(draft)}
                className={cn(
                  "shrink-0 mb-0.5 flex h-9 w-9 items-center justify-center rounded-full transition-all",
                  draft.trim() && !isBusy
                    ? "bg-gradient-to-br from-blue-600 to-violet-600 text-white shadow-[0_4px_12px_rgba(99,102,241,0.35)] hover:shadow-[0_6px_16px_rgba(99,102,241,0.45)] hover:scale-105 active:scale-95"
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

            <p className="mt-2 text-center text-[11px] text-secondary-foreground/50">
              Enter to send · Shift+Enter for new line · Changes are always confirmed before applying
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
