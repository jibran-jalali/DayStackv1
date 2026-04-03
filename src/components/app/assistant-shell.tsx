"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowUpRight, CalendarDays, LoaderCircle, Send, Sparkles, User2 } from "lucide-react";

import { Button } from "@/components/shared/button";
import { LogoMark } from "@/components/shared/logo";
import { getAssistantActionLines, getAssistantActionTitle } from "@/lib/assistant/actions";
import { confirmAssistantAction, sendAssistantMessage } from "@/lib/client/assistant";
import { formatDateLabel, formatShortDateLabel } from "@/lib/daystack";
import { cn, getErrorMessage } from "@/lib/utils";
import type {
  AssistantContext,
  AssistantConversationMessage,
  AssistantFollowUpContext,
  AssistantMutationAction,
} from "@/types/assistant";
import type { DashboardSnapshot } from "@/types/daystack";

interface AssistantShellProps {
  displayName: string;
  onNotice: (notice: { message: string; type: "error" | "success" }) => void;
  onRefreshContext: (taskDate: string) => Promise<void>;
  snapshot: DashboardSnapshot;
}

interface ChatMessage {
  action?: AssistantMutationAction;
  content: string;
  id: string;
  role: "assistant" | "user";
}

const STARTER_PROMPTS = [
  "Create a focused work block tomorrow from 9:00 to 10:30 for quarterly planning.",
  "Give me a summary for today.",
  "Plan my day from this dump: finish the report 90 min, reply to client emails 30 min, prep slides 60 min, gym 60 min.",
] as const;

const CHAT_COLUMN_CLASS = "mx-auto w-full max-w-3xl xl:max-w-[54rem]";

function createMessage(role: ChatMessage["role"], content: string, action?: AssistantMutationAction): ChatMessage {
  return {
    action,
    content,
    id: crypto.randomUUID(),
    role,
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

function MessageBubble({ message }: { message: ChatMessage }) {
  if (message.role === "user") {
    return (
      <div className="flex justify-end">
        <div className="max-w-[85%] rounded-[22px] bg-slate-950 px-3.5 py-3 text-[14px] leading-6 text-white shadow-[0_18px_36px_rgba(15,23,42,0.16)] sm:max-w-[min(100%,42rem)] sm:rounded-[26px] sm:px-4 sm:shadow-[0_18px_36px_rgba(15,23,42,0.18)]">
          <div className="mb-1 flex items-center justify-end gap-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-white/55 sm:text-[11px]">
            <span>You</span>
            <User2 className="h-3.5 w-3.5" />
          </div>
          <p className="whitespace-pre-wrap">{message.content}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-[auto_minmax(0,1fr)] items-start gap-2.5 sm:gap-3">
      <span className="mt-0.5 inline-flex h-[2.125rem] w-[2.125rem] items-center justify-center rounded-full border border-border/70 bg-white/90 shadow-[0_10px_24px_rgba(15,23,42,0.05)] sm:mt-1 sm:h-10 sm:w-10 sm:rounded-2xl sm:border-border/80 sm:bg-white sm:shadow-[0_12px_28px_rgba(15,23,42,0.07)]">
        <LogoMark className="h-5.5 w-5.5 rounded-[10px] sm:h-7 sm:w-7 sm:rounded-[12px]" />
      </span>
      <div className="min-w-0">
        <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-secondary-foreground/60 sm:text-[11px] sm:tracking-[0.2em] sm:text-secondary-foreground/72">
          DayStack Assistant
        </p>
        <div className="mt-2 rounded-[18px] bg-transparent px-0 py-0 text-[15px] leading-7 text-foreground sm:rounded-[26px] sm:border sm:border-border/70 sm:bg-white/96 sm:px-4 sm:py-3 sm:text-sm sm:leading-6 sm:shadow-[0_12px_28px_rgba(15,23,42,0.05)]">
          <p className="whitespace-pre-wrap">{message.content}</p>
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
      <div className="max-w-[min(100%,42rem)] rounded-[24px] border border-border/75 bg-[linear-gradient(180deg,rgba(255,255,255,0.98),rgba(246,250,255,0.98))] p-3.5 shadow-[0_18px_40px_rgba(15,23,42,0.08)] sm:rounded-[26px] sm:p-4 lg:max-w-[48rem] lg:rounded-[24px] lg:border-border/70 lg:bg-white lg:p-5 lg:shadow-[0_14px_32px_rgba(15,23,42,0.06)]">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-primary/78 sm:text-[11px] sm:tracking-[0.2em]">
              Draft change
            </p>
            <h3 className="mt-1 text-base font-semibold text-foreground">{getAssistantActionTitle(action)}</h3>
          </div>
          <span className="inline-flex items-center gap-1.5 rounded-full border border-primary/15 bg-white px-3 py-1 text-xs font-semibold text-primary">
            <Sparkles className="h-3.5 w-3.5" />
            Confirm to apply
          </span>
        </div>

        <div className="mt-3 space-y-2 rounded-[20px] border border-border/70 bg-white/94 p-3.5">
          {lines.map((line) => (
            <p key={line} className="text-sm leading-6 text-secondary-foreground">
              {line}
            </p>
          ))}
        </div>

        <div className="mt-4 flex flex-col gap-2.5 sm:flex-row">
          <Button className="sm:min-w-[8rem]" onClick={onConfirm} disabled={isPending}>
            {isPending ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
            Confirm
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
      className="ui-pressable min-w-full snap-start rounded-[20px] border border-border/70 bg-white/92 p-4 text-left shadow-[0_10px_24px_rgba(15,23,42,0.04)] transition-colors duration-200 hover:border-primary/20 hover:bg-white disabled:translate-y-0 disabled:opacity-60 sm:min-w-0 sm:rounded-[24px] sm:shadow-[0_12px_28px_rgba(15,23,42,0.05)]"
      onClick={() => onSelect(prompt)}
      disabled={disabled}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-secondary-foreground/58">
            Try asking
          </p>
          <p className="mt-1 text-sm font-medium leading-6 text-foreground">{prompt}</p>
        </div>
        <ArrowUpRight className="mt-0.5 h-4 w-4 shrink-0 text-secondary-foreground/55" />
      </div>
    </button>
  );
}

export function AssistantShell({
  displayName,
  onNotice,
  onRefreshContext,
  snapshot,
}: AssistantShellProps) {
  const introMessage = useMemo(
    () =>
      `I'm DayStack Assistant. Ask me to plan blocks, reschedule what is already visible on ${formatDateLabel(snapshot.taskDate)}, delete or complete tasks, summarize the day, or turn a task dump into a balanced schedule.`,
    [snapshot.taskDate],
  );
  const [messages, setMessages] = useState<ChatMessage[]>(() => [createMessage("assistant", introMessage)]);
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
        return [createMessage("assistant", introMessage)];
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
    const minHeight = 24;
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

    const userMessage = createMessage("user", nextPrompt);
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
      const assistantMessage = createMessage("assistant", response.reply, action);

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
      setMessages((current) => [...current, createMessage("assistant", `I hit a problem: ${message}`)]);
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
      setMessages((current) => [...current, createMessage("assistant", result.message)]);
      await onRefreshContext(result.recommendedDate);
      onNotice({
        message: result.message,
        type: "success",
      });
    } catch (error) {
      const message = getErrorMessage(error);
      setMessages((current) => [...current, createMessage("assistant", `I couldn't apply that change: ${message}`)]);
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
    setMessages((current) => [...current, createMessage("assistant", "Okay, I won't make that change.")]);
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
    <section className="relative flex h-full min-h-0 flex-1 flex-col pb-2 sm:pb-0">
      <div className="glass-panel relative flex h-full min-h-0 flex-1 flex-col overflow-hidden rounded-[28px] border border-black/5 bg-[#f8f8f8] shadow-[0_14px_34px_rgba(15,23,42,0.08)] backdrop-blur-none sm:rounded-[30px] sm:border-white/70 sm:bg-[linear-gradient(180deg,rgba(255,255,255,0.985),rgba(247,250,255,0.96))] sm:shadow-[0_24px_54px_rgba(15,23,42,0.12)] sm:backdrop-blur-md lg:rounded-[32px] lg:border-border/70 lg:bg-white/95 lg:shadow-[0_20px_46px_rgba(15,23,42,0.08)] lg:backdrop-blur-sm">
        <div className="pointer-events-none absolute inset-x-0 top-0 h-16 bg-[linear-gradient(180deg,rgba(255,255,255,0.82),transparent)] sm:h-28 sm:bg-[radial-gradient(circle_at_top,rgba(24,150,232,0.12),transparent_72%)] sm:opacity-90 lg:h-20 lg:bg-[linear-gradient(180deg,rgba(255,255,255,0.84),transparent)] lg:opacity-45" />

        <div className="shrink-0 border-b border-black/6 px-4 py-3 sm:border-border/65 sm:px-6 sm:py-4 lg:px-8 lg:py-5">
          <div className={cn(CHAT_COLUMN_CLASS, "flex flex-col gap-3 lg:gap-4")}>
            <div className="flex items-center justify-between gap-3">
              <div className="flex min-w-0 items-center gap-3">
                <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-[18px] border border-border/75 bg-white shadow-[0_12px_28px_rgba(15,23,42,0.06)] sm:h-11 sm:w-11">
                  <LogoMark className="h-7 w-7 rounded-[12px] sm:h-8 sm:w-8 sm:rounded-[14px]" />
                </span>

                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-secondary-foreground/72 sm:text-[11px]">
                      DayStack Assistant
                    </p>
                    <span className="hidden sm:inline-flex rounded-full border border-emerald-200/80 bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-700">
                      Live
                    </span>
                  </div>

                  <h2 className="mt-0.5 truncate text-[15px] font-semibold text-foreground sm:mt-1 sm:text-lg lg:text-[1.18rem]">
                    Chat-based planning for {displayName}
                  </h2>
                  <p className="mt-1 hidden text-sm leading-6 text-secondary-foreground/90 lg:block">
                    Create blocks, clean up your day, and work through planning changes without leaving the dashboard.
                  </p>
                </div>
              </div>

              <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-border/80 bg-white px-3 py-1.5 text-[11px] font-semibold text-secondary-foreground shadow-[0_10px_20px_rgba(15,23,42,0.04)]">
                <CalendarDays className="h-3.5 w-3.5" />
                {formatShortDateLabel(snapshot.taskDate)}
              </span>
            </div>

            <div className="sm:hidden">
              <p className="text-xs leading-5 text-secondary-foreground">
                {snapshot.tasks.length} visible blocks, {snapshot.summary.completedTasks} done, {snapshot.summary.executionScore}% execution score.
              </p>
            </div>

            <div className="hidden items-center gap-2 overflow-x-auto px-1 pb-1 soft-scrollbar sm:flex lg:pb-0">
              <span className="data-chip shrink-0">{snapshot.tasks.length} visible</span>
              <span className="data-chip shrink-0">{snapshot.summary.executionScore}% score</span>
              <span className="data-chip shrink-0">{snapshot.summary.completedTasks} done</span>
              <span className="data-chip shrink-0">{snapshot.recurringBlocks.length} recurring</span>
            </div>
          </div>
        </div>

        <div className="relative min-h-0 flex-1 overflow-hidden">
          <div
            ref={chatScrollRef}
            className="soft-scrollbar h-full overflow-y-auto overscroll-contain px-4 py-4 pb-8 sm:px-6 sm:py-6 sm:pb-12 lg:px-8 lg:py-5 lg:pb-6"
          >
            <div className={cn(CHAT_COLUMN_CLASS, "flex min-h-full flex-col")}>
              {!hasConversation ? (
                <div className="flex flex-1 flex-col items-center justify-center py-3 text-center sm:py-8 lg:py-6">
                  <span className="inline-flex h-[3.25rem] w-[3.25rem] items-center justify-center rounded-[20px] border border-border/75 bg-white shadow-[0_14px_28px_rgba(15,23,42,0.06)] sm:h-16 sm:w-16 sm:rounded-[24px] sm:shadow-[0_18px_40px_rgba(15,23,42,0.08)]">
                    <LogoMark className="h-10 w-10 rounded-[16px] sm:h-11 sm:w-11 sm:rounded-[18px]" />
                  </span>

                  <h3 className="mt-5 max-w-[16rem] font-display text-[2rem] font-semibold tracking-[-0.05em] text-foreground sm:max-w-3xl sm:text-[2.35rem] lg:max-w-[32rem] lg:text-[2rem]">
                    How can I help with {formatDateLabel(snapshot.taskDate)}?
                  </h3>
                  <p className="mt-3 max-w-[19rem] text-sm leading-6 text-secondary-foreground sm:max-w-2xl lg:max-w-[38rem]">
                    Ask naturally. I can add blocks, clean up the day, summarize progress, or turn a brain dump into a balanced plan.
                  </p>

                  <div className="mt-7 grid w-full gap-2.5 sm:mt-8 sm:grid-cols-3 sm:gap-3 lg:mt-6">
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
                <div className="space-y-5 pb-3 sm:space-y-7 sm:pb-4 lg:space-y-6 lg:pb-2">
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
                    <div className="grid grid-cols-[auto_minmax(0,1fr)] items-center gap-2.5 sm:gap-3">
                      <span className="inline-flex h-9 w-9 items-center justify-center rounded-[18px] border border-border/80 bg-white shadow-[0_12px_28px_rgba(15,23,42,0.07)] sm:h-10 sm:w-10 sm:rounded-2xl">
                        <LogoMark className="h-6 w-6 rounded-[10px] sm:h-7 sm:w-7 sm:rounded-[12px]" />
                      </span>
                      <div className="flex items-center gap-2 rounded-[20px] border border-border/70 bg-white/94 px-3.5 py-3 text-sm text-secondary-foreground shadow-[0_12px_28px_rgba(15,23,42,0.05)] sm:rounded-[22px] sm:px-4">
                        <LoaderCircle className="h-4 w-4 animate-spin" />
                        {isConfirming ? "Applying the assistant change..." : "Thinking through the request..."}
                      </div>
                    </div>
                  ) : null}
                </div>
              )}
            </div>
          </div>

          <div className="pointer-events-none absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-[rgba(250,252,255,0.98)] via-[rgba(250,252,255,0.84)] to-transparent sm:h-24 lg:h-14 lg:from-white/96 lg:via-white/70" />
        </div>

        <div className="shrink-0 border-t border-black/6 bg-[rgba(248,248,248,0.96)] px-3 pb-[calc(0.85rem+env(safe-area-inset-bottom))] pt-3 sm:border-border/65 sm:bg-[linear-gradient(180deg,rgba(250,252,255,0.82),rgba(250,252,255,0.98))] sm:px-6 sm:py-4 lg:sticky lg:bottom-0 lg:z-10 lg:border-border/70 lg:bg-white/95 lg:px-8 lg:py-5">
          <div className={CHAT_COLUMN_CLASS}>
            {pendingFollowUp ? (
              <p className="mb-2 px-1 text-[11px] text-secondary-foreground sm:text-xs">
                Continue with the missing detail for the current draft.
              </p>
            ) : null}

            <div className="rounded-[22px] border border-border/80 bg-white p-2 shadow-[0_10px_24px_rgba(15,23,42,0.07)] sm:rounded-[28px] sm:bg-[linear-gradient(180deg,rgba(255,255,255,0.98),rgba(248,250,255,0.96))] sm:p-2.5 sm:shadow-[0_20px_44px_rgba(15,23,42,0.12)] sm:backdrop-blur-xl lg:rounded-[24px] lg:border-border/70 lg:bg-white lg:p-3 lg:shadow-[0_14px_32px_rgba(15,23,42,0.08)] lg:backdrop-blur-none">
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
                  placeholder="Type a message..."
                  className="max-h-44 min-h-0 flex-1 resize-none border-0 bg-transparent px-2 py-2.5 text-[15px] leading-6 text-foreground outline-none placeholder:text-secondary-foreground/72"
                  disabled={isSending || isConfirming}
                />
                <Button
                  type="submit"
                  aria-label="Send message"
                  disabled={!draft.trim() || isSending || isConfirming}
                  className={cn(
                    "h-10 w-10 shrink-0 rounded-full px-0 shadow-[0_14px_30px_rgba(24,150,232,0.24)] sm:h-11 sm:w-11",
                    !draft.trim() && "shadow-none",
                  )}
                >
                  {isSending ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                </Button>
              </form>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
