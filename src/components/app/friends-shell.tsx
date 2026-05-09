"use client";

import type { ReactNode } from "react";
import { useDeferredValue, useEffect, useMemo, useState, useTransition } from "react";
import { Check, Clock3, Search, UserMinus, UserPlus, Users, X } from "lucide-react";

import { PlannerHeader } from "@/components/app/planner-header";
import { Button, buttonVariants } from "@/components/shared/button";
import { EmptyState } from "@/components/shared/empty-state";
import { Input } from "@/components/shared/input";
import { formatDateLabel } from "@/lib/daystack";
import { cn, getErrorMessage } from "@/lib/utils";
import type { FriendConnectionSummary, FriendSearchResult, FriendsSnapshot } from "@/types/daystack";

interface FriendsShellProps {
  displayName: string;
  email?: string;
  initialSnapshot: FriendsSnapshot;
  returnDate?: string;
}

type NoticeState =
  | {
      message: string;
      type: "error" | "success";
    }
  | null;

function getPlannerHref(returnDate?: string) {
  return returnDate ? `/app?date=${returnDate}` : "/app";
}

function getAssistantHref(returnDate?: string) {
  return returnDate ? `/app?tab=assistant&date=${returnDate}` : "/app?tab=assistant";
}

function getNotificationsHref(returnDate?: string) {
  return returnDate ? `/app/notifications?date=${returnDate}` : "/app/notifications";
}

function getSettingsHref(returnDate?: string) {
  return returnDate ? `/app/settings?date=${returnDate}` : "/app/settings";
}

function getFriendsHref(returnDate?: string) {
  return returnDate ? `/app/friends?date=${returnDate}` : "/app/friends";
}

async function readJsonResponse<T>(response: Response): Promise<T> {
  const payload = (await response.json().catch(() => null)) as (T & { message?: string }) | null;

  if (!response.ok) {
    throw new Error(payload?.message ?? "Request failed.");
  }

  return payload as T;
}

function ConnectionRow({
  action,
  connection,
}: {
  action?: ReactNode;
  connection: FriendConnectionSummary;
}) {
  return (
    <div className="flex flex-col gap-3 border-b border-border/70 px-4 py-3 last:border-b-0 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0">
        <p className="truncate text-sm font-semibold text-foreground">{connection.otherUser.fullName}</p>
        <p className="truncate text-xs text-secondary-foreground">{connection.otherUser.email ?? "DayStack user"}</p>
      </div>
      {action ? <div className="flex shrink-0 flex-wrap gap-2">{action}</div> : null}
    </div>
  );
}

function SectionShell({
  children,
  count,
  title,
}: {
  children: ReactNode;
  count: number;
  title: string;
}) {
  return (
    <section className="overflow-hidden rounded-[22px] border border-border/75 bg-white/82 shadow-[0_12px_28px_rgba(15,23,42,0.04)]">
      <div className="flex items-center justify-between border-b border-border/70 px-4 py-3">
        <h2 className="text-sm font-semibold text-foreground">{title}</h2>
        <span className="rounded-full bg-muted px-2.5 py-1 text-xs font-semibold text-secondary-foreground">{count}</span>
      </div>
      {children}
    </section>
  );
}

export function FriendsShell({ displayName, email, initialSnapshot, returnDate }: FriendsShellProps) {
  const [snapshot, setSnapshot] = useState(initialSnapshot);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<FriendSearchResult[]>([]);
  const [notice, setNotice] = useState<NoticeState>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const deferredQuery = useDeferredValue(query);
  const plannerHref = useMemo(() => getPlannerHref(returnDate), [returnDate]);
  const assistantHref = useMemo(() => getAssistantHref(returnDate), [returnDate]);
  const notificationsHref = useMemo(() => getNotificationsHref(returnDate), [returnDate]);
  const settingsHref = useMemo(() => getSettingsHref(returnDate), [returnDate]);
  const friendsHref = useMemo(() => getFriendsHref(returnDate), [returnDate]);

  useEffect(() => {
    const controller = new AbortController();
    const searchParams = new URLSearchParams({
      limit: "8",
    });

    if (deferredQuery.trim()) {
      searchParams.set("q", deferredQuery.trim());
    }

    setIsSearching(true);
    fetch(`/api/friends/search?${searchParams.toString()}`, {
      credentials: "same-origin",
      signal: controller.signal,
    })
      .then((response) => readJsonResponse<{ results: FriendSearchResult[] }>(response))
      .then((payload) => {
        setResults(payload.results);
        setNotice(null);
      })
      .catch((error) => {
        if (controller.signal.aborted) {
          return;
        }

        setResults([]);
        setNotice({
          message: getErrorMessage(error),
          type: "error",
        });
      })
      .finally(() => {
        if (!controller.signal.aborted) {
          setIsSearching(false);
        }
      });

    return () => controller.abort();
  }, [deferredQuery]);

  useEffect(() => {
    if (notice?.type !== "success") {
      return;
    }

    const timer = window.setTimeout(() => setNotice(null), 2400);
    return () => window.clearTimeout(timer);
  }, [notice]);

  function runFriendAction(actionId: string, action: () => Promise<{ snapshot?: FriendsSnapshot }>, successMessage: string) {
    setBusyId(actionId);
    startTransition(async () => {
      try {
        const payload = await action();

        if (payload.snapshot) {
          setSnapshot(payload.snapshot);
        }

        setNotice({
          message: successMessage,
          type: "success",
        });
      } catch (error) {
        setNotice({
          message: getErrorMessage(error),
          type: "error",
        });
      } finally {
        setBusyId(null);
      }
    });
  }

  function sendRequest(addresseeId: string) {
    runFriendAction(
      `send-${addresseeId}`,
      async () => {
        const response = await fetch("/api/friends", {
          body: JSON.stringify({ addresseeId }),
          credentials: "same-origin",
          headers: {
            "Content-Type": "application/json",
          },
          method: "POST",
        });
        const payload = await readJsonResponse<{ snapshot: FriendsSnapshot }>(response);

        setResults((current) =>
          current.map((result) =>
            result.id === addresseeId
              ? {
                  ...result,
                  friendshipStatus: "outgoing",
                }
              : result,
          ),
        );

        return payload;
      },
      "Friend request sent.",
    );
  }

  function acceptRequest(connectionId: string) {
    runFriendAction(
      `accept-${connectionId}`,
      async () => {
        const response = await fetch(`/api/friends/requests/${connectionId}/accept`, {
          credentials: "same-origin",
          method: "POST",
        });
        return readJsonResponse<{ snapshot: FriendsSnapshot }>(response);
      },
      "Friend request accepted.",
    );
  }

  function declineRequest(connectionId: string) {
    runFriendAction(
      `decline-${connectionId}`,
      async () => {
        const response = await fetch(`/api/friends/requests/${connectionId}/decline`, {
          credentials: "same-origin",
          method: "POST",
        });
        return readJsonResponse<{ snapshot: FriendsSnapshot }>(response);
      },
      "Friend request declined.",
    );
  }

  function removeFriend(friendUserId: string) {
    runFriendAction(
      `remove-${friendUserId}`,
      async () => {
        const response = await fetch(`/api/friends/${friendUserId}`, {
          credentials: "same-origin",
          method: "DELETE",
        });
        return readJsonResponse<{ snapshot: FriendsSnapshot }>(response);
      },
      "Friend removed.",
    );
  }

  return (
    <main className="container-shell min-h-screen py-4 sm:py-6">
      <div className="space-y-4 sm:space-y-5">
        <PlannerHeader
          activePage="friends"
          assistantHref={assistantHref}
          dateLabel="Friend requests"
          displayName={displayName}
          email={email}
          friendsHref={friendsHref}
          metricIcon={Users}
          metricLabel={`${snapshot.friends.length} friend${snapshot.friends.length === 1 ? "" : "s"}`}
          metricTone={snapshot.incoming.length > 0 ? "warning" : "brand"}
          notificationsHref={notificationsHref}
          plannerHref={plannerHref}
          settingsHref={settingsHref}
          subtitle="Only accepted friends can be mentioned in meeting blocks."
          onSignOutError={(message) =>
            setNotice({
              message,
              type: "error",
            })
          }
        />

        {notice ? (
          <div className="pointer-events-none fixed inset-x-0 top-20 z-40 flex justify-center px-4">
            <div
              aria-live="polite"
              className={cn(
                "pointer-events-auto min-w-[16rem] rounded-full border px-4 py-2.5 text-sm shadow-[0_18px_40px_rgba(15,23,42,0.12)] backdrop-blur-xl",
                notice.type === "success"
                  ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                  : "border-red-200 bg-red-50 text-danger",
              )}
            >
              {notice.message}
            </div>
          </div>
        ) : null}

        <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_22rem]">
          <section className="glass-panel p-4 sm:p-5">
            <div className="border-b border-border/70 pb-4">
              <p className="section-label">Find people</p>
              <h1 className="mt-1 font-display text-2xl font-semibold text-foreground sm:text-[2rem]">
                Friends
              </h1>
              <p className="mt-1.5 text-sm text-secondary-foreground">
                Send a request first. Once they accept, both of you can mention each other in meeting blocks.
              </p>
            </div>

            <div className="mt-4 space-y-4">
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-secondary-foreground/70" />
                <Input
                  className="h-11 rounded-[16px] border-border/80 bg-white/96 py-2.5 pl-10 pr-3.5 text-[15px] shadow-none"
                  placeholder="Search active users by name or email"
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                />
              </div>

              <div className="overflow-hidden rounded-[20px] border border-border/70 bg-white/75">
                {isSearching ? (
                  <p className="px-4 py-4 text-sm text-secondary-foreground">Searching...</p>
                ) : results.length > 0 ? (
                  <div className="divide-y divide-border/70">
                    {results.map((result) => {
                      const actionId = `send-${result.id}`;
                      const isBusy = busyId === actionId || isPending;

                      return (
                        <div
                          key={result.id}
                          className="flex flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
                        >
                          <div className="min-w-0">
                            <p className="truncate text-sm font-semibold text-foreground">{result.fullName}</p>
                            <p className="truncate text-xs text-secondary-foreground">{result.email ?? "DayStack user"}</p>
                          </div>
                          {result.friendshipStatus === "none" ? (
                            <Button
                              size="sm"
                              className="shrink-0"
                              onClick={() => sendRequest(result.id)}
                              disabled={isBusy}
                            >
                              <UserPlus className="h-4 w-4" />
                              Add friend
                            </Button>
                          ) : (
                            <span
                              className={cn(
                                buttonVariants({ variant: "secondary", size: "sm" }),
                                "pointer-events-none shrink-0",
                              )}
                            >
                              {result.friendshipStatus === "accepted"
                                ? "Friends"
                                : result.friendshipStatus === "incoming"
                                  ? "Incoming request"
                                  : "Request sent"}
                            </span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <p className="px-4 py-4 text-sm text-secondary-foreground">
                    No active users found. Try searching by name or email.
                  </p>
                )}
              </div>
            </div>
          </section>

          <aside className="space-y-4 xl:sticky xl:top-24 xl:self-start">
            <SectionShell count={snapshot.incoming.length} title="Incoming requests">
              {snapshot.incoming.length > 0 ? (
                snapshot.incoming.map((connection) => (
                  <ConnectionRow
                    key={connection.id}
                    connection={connection}
                    action={
                      <>
                        <Button
                          size="sm"
                          onClick={() => acceptRequest(connection.id)}
                          disabled={busyId === `accept-${connection.id}` || isPending}
                        >
                          <Check className="h-4 w-4" />
                          Accept
                        </Button>
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={() => declineRequest(connection.id)}
                          disabled={busyId === `decline-${connection.id}` || isPending}
                        >
                          <X className="h-4 w-4" />
                          Decline
                        </Button>
                      </>
                    }
                  />
                ))
              ) : (
                <p className="px-4 py-4 text-sm text-secondary-foreground">No incoming requests.</p>
              )}
            </SectionShell>

            <SectionShell count={snapshot.outgoing.length} title="Outgoing requests">
              {snapshot.outgoing.length > 0 ? (
                snapshot.outgoing.map((connection) => (
                  <ConnectionRow
                    key={connection.id}
                    connection={connection}
                    action={
                      <span className="inline-flex h-10 items-center gap-2 rounded-full border border-border/80 bg-white/92 px-3 text-sm font-semibold text-secondary-foreground">
                        <Clock3 className="h-4 w-4" />
                        Pending
                      </span>
                    }
                  />
                ))
              ) : (
                <p className="px-4 py-4 text-sm text-secondary-foreground">No sent requests waiting.</p>
              )}
            </SectionShell>
          </aside>
        </div>

        <section>
          {snapshot.friends.length > 0 ? (
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {snapshot.friends.map((connection) => (
                <div
                  key={connection.id}
                  className="rounded-[22px] border border-border/75 bg-white/84 p-4 shadow-[0_12px_28px_rgba(15,23,42,0.04)]"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-foreground">{connection.otherUser.fullName}</p>
                      <p className="truncate text-xs text-secondary-foreground">
                        {connection.otherUser.email ?? "DayStack user"}
                      </p>
                    </div>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-9 px-3 text-danger"
                      onClick={() => removeFriend(connection.otherUser.id)}
                      disabled={busyId === `remove-${connection.otherUser.id}` || isPending}
                    >
                      <UserMinus className="h-4 w-4" />
                      Unfriend
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <EmptyState
              icon={<Users className="h-5 w-5" />}
              title="No friends yet"
              description="Search for active DayStack users and send a request. Accepted friends are the only people you can mention in meeting blocks."
              action={
                returnDate ? (
                  <div className="rounded-full border border-border/80 bg-white/90 px-3 py-1.5 text-sm text-secondary-foreground">
                    Returning from {formatDateLabel(returnDate)}
                  </div>
                ) : null
              }
            />
          )}
        </section>
      </div>
    </main>
  );
}
