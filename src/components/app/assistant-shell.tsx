"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  CheckCircle2,
  ExternalLink,
  LoaderCircle,
  Search,
  Send,
  User2,
} from "lucide-react";

import { Button } from "@/components/shared/button";
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
  "Plan tomorrow around a 90 minute strategy block, a 30 minute email catch-up, and a workout after 6.",
  "What should I focus on first today based on this schedule?",
  "What changed in AI this week?",
] as const;

const CHAT_COLUMN_CLASS = "mx-auto w-full max-w-4xl";

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
  if (message.action) {
    return "Review ready";
  }

  if (message.mode === "web" || message.sources.length > 0) {
    return "Research-backed";
  }

  if (message.mode === "general") {
    return "General answer";
  }

  return "Planner context";
}

function SourceList({ sources }: { sources: AssistantAnswerSource[] }) {
  if (sources.length === 0) {
    return null;
  }

  return (
    <div className="mt-3 border-t border-border/70 pt-3">
      <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-secondary-foreground/70">
        Sources
      </p>
      <div className="mt-2 flex flex-wrap gap-2">
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
              className="inline-flex min-w-0 items-center gap-1.5 rounded-full border border-border/80 bg-white px-3 py-1.5 text-xs font-medium text-secondary-foreground transition-colors hover:border-foreground/20 hover:text-foreground"
            >
              <span className="truncate">{source.title ?? host}</span>
              <ExternalLink className="h-3.5 w-3.5 shrink-0" />
            </a>
          );
        })}
      </div>
    </div>
  );
}

function MessageBubble({ message }: { message: ChatMessage }) {
  if (message.role === "user") {
    return (
      <div className="flex justify-end">
        <div className="max-w-[min(100%,44rem)] rounded-[24px] bg-slate-950 px-4 py-3 text-sm leading-6 text-white shadow-[0_16px_32px_rgba(15,23,42,0.18)]">
          <div className="mb-2 flex items-center justify-end gap-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-white/60">
            <span>You</span>
            <User2 className="h-3.5 w-3.5" />
          </div>
          <p className="whitespace-pre-wrap">{message.content}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-[auto_minmax(0,1fr)] items-start gap-3">
      <span className="mt-1 inline-flex h-10 w-10 items-center justify-center rounded-2xl border border-border/80 bg-white">
        <LogoMark className="h-7 w-7 rounded-xl" />
      </span>
      <div className="min-w-0">
        <div className="mb-2 flex flex-wrap items-center gap-2">
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-secondary-foreground/72">
            DayStack Assistant
          </p>
          <span className="rounded-full border border-border/80 bg-muted/70 px-2.5 py-1 text-[11px] font-medium text-secondary-foreground">
            {getModeLabel(message)}
          </span>
        </div>
        <div className="max-w-[min(100%,48rem)] rounded-[24px] border border-border/80 bg-white px-4 py-3 text-sm leading-7 text-foreground shadow-[0_8px_24px_rgba(15,23,42,0.04)]">
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

  return (
    <div className="sm:ml-[3.25rem]">
      <div className="max-w-[min(100%,48rem)] rounded-[24px] border border-border/80 bg-[#fbfcfd] p-4">
        <div className="flex flex-col gap-3 border-b border-border/70 pb-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-secondary-foreground/72">
              Review change
            </p>
            <h3 className="mt-1 text-base font-semibold text-foreground">{getAssistantActionTitle(action)}</h3>
          </div>
          <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-700">
            <CheckCircle2 className="h-3.5 w-3.5" />
            Confirmation required
          </span>
        </div>

        <div className="mt-4 space-y-2">
          {lines.map((line) => (
            <p key={line} className="text-sm leading-6 text-secondary-foreground">
              {line}
            </p>
          ))}
        </div>

        <div className="mt-5 flex flex-col gap-2.5 sm:flex-row">
          <Button className="sm:min-w-[9rem]" onClick={onConfirm} disabled={isPending}>
            {isPending ? <LoaderCircle className="h-4 w-4 animate-spin" /> : null}
            {isPending ? "Applying" : "Confirm change"}
          </Button>
          <Button variant="secondary" className="sm:min-w-[8rem]" onClick={onCancel} disabled={isPending}>
            Cancel
          </Button>
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
  onSelect: (prompt: string) => void;
  prompt: string;
}) {
  return (
    <button
      type="button"
      className="ui-pressable rounded-[22px] border border-border/80 bg-white px-4 py-4 text-left transition-colors hover:border-foreground/15 hover:bg-[#fdfefe] disabled:translate-y-0 disabled:opacity-60"
      onClick={() => onSelect(prompt)}
      disabled={disabled}
    >
      <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-secondary-foreground/70">
        Try this
      </p>
      <p className="mt-2 text-sm leading-6 text-foreground">{prompt}</p>
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
      `Ask anything. I can answer general questions, explain DayStack, summarize ${formatDateLabel(snapshot.taskDate)}, and draft task changes for review before anything is applied.`,
    [snapshot.taskDate],
  );
  const [messages, setMessages] = useState<ChatMessage[]>(() => [
    createMessage("assistant", introMessage, {
      mode: "planner",
    }),
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

    if (!container) {
      return;
    }

    container.scrollTo({
      top: container.scrollHeight,
      behavior: "smooth",
    });
  }, [messages, pendingAction]);

  useEffect(() => {
    setMessages((current) => {
      if (current.length === 1 && current[0]?.role === "assistant") {
        return [
          createMessage("assistant", introMessage, {
            mode: "planner",
          }),
        ];
      }

      return current;
    });
    setPendingAction(null);
    setPendingFollowUp(null);
  }, [introMessage]);

  useEffect(() => {
    const composer = composerRef.current;

    if (!composer) {
      return;
    }

    const maxHeight = 176;
    const minHeight = 28;
    composer.style.height = "0px";

    const nextHeight = Math.min(Math.max(composer.scrollHeight, minHeight), maxHeight);
    composer.style.height = `${nextHeight}px`;
    composer.style.overflowY = composer.scrollHeight > maxHeight ? "auto" : "hidden";
  }, [draft]);

  async function submitPrompt(prompt: string) {
    const nextPrompt = prompt.trim();

    if (!nextPrompt || isSending || isConfirming) {
      return;
    }

    setIsSending(true);
    setPendingAction(null);

    const userMessage = createMessage("user", nextPrompt, {
      mode: "general",
    });
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
        setPendingAction({
          action,
          messageId: assistantMessage.id,
        });
      } else {
        setPendingAction(null);
        setPendingFollowUp(response.action.kind === "ask_followup" ? response.action.followUp ?? null : null);
      }
    } catch (error) {
      const message = getErrorMessage(error);
      setMessages((current) =>
        [
          ...current,
          createMessage("assistant", `I hit a problem: ${message}`, {
            mode: "general",
          }),
        ]);
      setPendingAction(null);
      onNotice({
        message,
        type: "error",
      });
    } finally {
      setIsSending(false);
    }
  }

  async function handleConfirmAction() {
    if (!pendingAction || isConfirming) {
      return;
    }

    setIsConfirming(true);

    try {
      const result = await confirmAssistantAction({
        action: pendingAction.action,
        context,
      });
      setPendingAction(null);
      setPendingFollowUp(null);
      setMessages((current) =>
        [
          ...current,
          createMessage("assistant", result.message, {
            mode: "planner",
          }),
        ]);
      await onRefreshContext(result.recommendedDate);
      onNotice({
        message: result.message,
        type: "success",
      });
    } catch (error) {
      const message = getErrorMessage(error);
      setMessages((current) =>
        [
          ...current,
          createMessage("assistant", `I couldn't apply that change: ${message}`, {
            mode: "planner",
          }),
        ]);
      onNotice({
        message,
        type: "error",
      });
    } finally {
      setIsConfirming(false);
    }
  }

  function handleCancelAction() {
    setPendingAction(null);
    setPendingFollowUp(null);
    setMessages((current) =>
      [
        ...current,
        createMessage("assistant", "Okay, I won't apply that change.", {
          mode: "planner",
        }),
      ]);
  }

  function handleComposerKeyDown(event: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (event.nativeEvent.isComposing) {
      return;
    }

    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      void submitPrompt(draft);
    }
  }

  return (
    <section className="flex h-full min-h-0 flex-1 flex-col">
      <div className="flex h-full min-h-0 flex-1 flex-col overflow-hidden rounded-[28px] border border-border/80 bg-[#f7f8fa] shadow-[0_12px_32px_rgba(15,23,42,0.06)]">
        <div className="min-h-0 flex-1 overflow-hidden">
          <div
            ref={chatScrollRef}
            className="soft-scrollbar h-full overflow-y-auto px-4 py-4 sm:px-6 sm:py-5 lg:px-8"
          >
            <div className={cn(CHAT_COLUMN_CLASS, "flex min-h-full flex-col")}>
              {!hasConversation ? (
                <div className="flex flex-1 flex-col justify-center py-6 sm:py-10">
                  <div className="max-w-2xl">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-secondary-foreground/72">
                      Starting point
                    </p>
                    <h3 className="mt-3 text-3xl font-semibold tracking-[-0.03em] text-foreground sm:text-[2.6rem]">
                      What do you want help with on {formatDateLabel(snapshot.taskDate)}?
                    </h3>
                    <p className="mt-4 text-base leading-7 text-secondary-foreground">
                      You can dump a rough plan, ask for a cleaner schedule, request a task change, or ask a broader
                      question without switching tools.
                    </p>
                  </div>

                  <div className="mt-8 grid gap-3 sm:grid-cols-3">
                    {STARTER_PROMPTS.map((prompt) => (
                      <StarterPromptCard
                        key={prompt}
                        disabled={isSending || isConfirming}
                        onSelect={(nextPrompt) => void submitPrompt(nextPrompt)}
                        prompt={prompt}
                      />
                    ))}
                  </div>
                </div>
              ) : (
                <div className="space-y-6 pb-4">
                  {visibleMessages.map((message) => (
                    <div key={message.id} className="space-y-3">
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

                  {isSending || isConfirming ? (
                    <div className="grid grid-cols-[auto_minmax(0,1fr)] items-center gap-3">
                      <span className="inline-flex h-10 w-10 items-center justify-center rounded-2xl border border-border/80 bg-white">
                        <LogoMark className="h-7 w-7 rounded-xl" />
                      </span>
                      <div className="rounded-[22px] border border-border/80 bg-white px-4 py-3 text-sm text-secondary-foreground">
                        <div className="flex items-center gap-2">
                          <LoaderCircle className="h-4 w-4 animate-spin" />
                          {isConfirming ? "Applying that change..." : "Thinking through the request..."}
                        </div>
                      </div>
                    </div>
                  ) : null}
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="border-t border-border/70 bg-white/96 px-4 py-4 sm:px-6 lg:px-8">
          <div className={CHAT_COLUMN_CLASS}>
            {pendingFollowUp ? (
              <div className="mb-3 flex items-start gap-2 rounded-[18px] border border-amber-200 bg-amber-50 px-3.5 py-3 text-sm text-amber-800">
                <Search className="mt-0.5 h-4 w-4 shrink-0" />
                <p>I need one more detail before I can draft the right change.</p>
              </div>
            ) : null}

            <div className="rounded-[24px] border border-border/80 bg-[#fbfcfd] p-2.5">
              <form
                className="flex items-end gap-2"
                onSubmit={(event) => {
                  event.preventDefault();
                  void submitPrompt(draft);
                }}
              >
                <textarea
                  ref={composerRef}
                  value={draft}
                  onChange={(event) => setDraft(event.target.value)}
                  onKeyDown={handleComposerKeyDown}
                  rows={1}
                  placeholder="Ask a question, plan the day, or describe the change you want..."
                  className="max-h-44 min-h-0 flex-1 resize-none border-0 bg-transparent px-2.5 py-2.5 text-[15px] leading-6 text-foreground outline-none placeholder:text-secondary-foreground/70"
                  disabled={isSending || isConfirming}
                />
                <Button
                  type="submit"
                  aria-label="Send message"
                  disabled={!draft.trim() || isSending || isConfirming}
                  className={cn("h-11 w-11 shrink-0 rounded-full px-0", !draft.trim() && "shadow-none")}
                >
                  {isSending ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                </Button>
              </form>
            </div>

            <p className="mt-3 text-xs text-secondary-foreground">
              Press Enter to send. Use Shift+Enter for a new line. Task-changing actions are always reviewed before
              they are applied.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
