"use client";

import { HardDrive, LoaderCircle, LogOut, ShieldCheck, ShieldX, Trash2, UserRoundX, Users } from "lucide-react";
import { useMemo, useState, useTransition } from "react";

import { EmptyState } from "@/components/shared/empty-state";
import { Button } from "@/components/shared/button";
import { StatusChip } from "@/components/shared/status-chip";
import { getErrorMessage } from "@/lib/utils";
import type { AdminAccount, AdminDashboardSnapshot } from "@/types/admin";

interface AdminDashboardProps {
  initialSnapshot: AdminDashboardSnapshot;
}

type NoticeState =
  | {
      message: string;
      type: "error" | "success";
    }
  | null;

function formatAccountDate(value: string) {
  try {
    return new Intl.DateTimeFormat(undefined, {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(new Date(value));
  } catch {
    return value;
  }
}

function formatUsageLabel(estimatedOwnedRecords: number | null) {
  if (estimatedOwnedRecords === null) {
    return "Not available";
  }

  return `Estimated from ${estimatedOwnedRecords} owned record${estimatedOwnedRecords === 1 ? "" : "s"}`;
}

function createSnapshot(accounts: AdminAccount[]): AdminDashboardSnapshot {
  const activeAccounts = accounts.filter((account) => account.status === "active").length;
  const disabledAccounts = accounts.length - activeAccounts;

  return {
    accounts,
    activeAccounts,
    disabledAccounts,
    totalAccounts: accounts.length,
  };
}

export function AdminDashboard({ initialSnapshot }: AdminDashboardProps) {
  const [snapshot, setSnapshot] = useState(initialSnapshot);
  const [notice, setNotice] = useState<NoticeState>(null);
  const [pendingKey, setPendingKey] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const hasAccounts = snapshot.accounts.length > 0;
  const pendingAccountId = useMemo(() => pendingKey?.split(":")[1] ?? null, [pendingKey]);

  function replaceAccount(nextAccount: AdminAccount) {
    setSnapshot((current) =>
      createSnapshot(
        current.accounts.map((account) => (account.id === nextAccount.id ? nextAccount : account)),
      ),
    );
  }

  function removeAccount(accountId: string) {
    setSnapshot((current) => createSnapshot(current.accounts.filter((account) => account.id !== accountId)));
  }

  async function handleAccountAction(accountId: string, action: "activate" | "delete" | "disable") {
    if (action === "delete") {
      const confirmed = window.confirm("Delete this account and all of its DayStack data?");

      if (!confirmed) {
        return;
      }
    }

    setPendingKey(`${action}:${accountId}`);
    setNotice(null);

    startTransition(async () => {
      try {
        const response = await fetch(`/admin/api/accounts/${accountId}`, {
          method: action === "delete" ? "DELETE" : "PATCH",
          headers: {
            "Content-Type": "application/json",
          },
          body: action === "delete" ? undefined : JSON.stringify({ action }),
        });

        const payload = (await response.json().catch(() => null)) as
          | {
              account?: AdminAccount;
              message?: string;
            }
          | null;

        if (!response.ok) {
          throw new Error(payload?.message ?? "Admin action failed.");
        }

        if (action === "delete") {
          removeAccount(accountId);
          setNotice({
            message: "Account deleted.",
            type: "success",
          });
        } else if (payload?.account) {
          replaceAccount(payload.account);
          setNotice({
            message: action === "disable" ? "Account disabled." : "Account reactivated.",
            type: "success",
          });
        }
      } catch (error) {
        setNotice({
          message: getErrorMessage(error),
          type: "error",
        });
      } finally {
        setPendingKey(null);
      }
    });
  }

  async function handleLogout() {
    setPendingKey("logout");
    setNotice(null);

    startTransition(async () => {
      try {
        const response = await fetch("/admin/api/session", {
          method: "DELETE",
        });

        const payload = (await response.json().catch(() => null)) as { message?: string; redirectTo?: string } | null;

        if (!response.ok) {
          throw new Error(payload?.message ?? "Could not sign out.");
        }

        window.location.href = payload?.redirectTo ?? "/admin/login";
      } catch (error) {
        setNotice({
          message: getErrorMessage(error),
          type: "error",
        });
        setPendingKey(null);
      }
    });
  }

  return (
    <main className="container-shell min-h-screen py-4 sm:py-6">
      <div className="space-y-4 sm:space-y-5">
        <section className="glass-panel overflow-hidden p-5 sm:p-6">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div className="space-y-3">
              <div className="data-chip w-fit border-cyan-200 bg-cyan-50 text-sky-700">
                <ShieldCheck className="h-4 w-4" />
                Internal admin
              </div>
              <div className="space-y-2">
                <h1 className="font-display text-[2rem] font-semibold tracking-tight text-foreground sm:text-[2.5rem]">
                  Account control surface
                </h1>
                <p className="max-w-2xl text-sm leading-7 text-secondary-foreground sm:text-base">
                  Review registered DayStack accounts, inspect their current status, and take server-authorized action
                  without exposing admin credentials or service-role logic to the browser.
                </p>
              </div>
            </div>

            <Button
              variant="secondary"
              className="w-full sm:w-auto"
              disabled={isPending && pendingKey === "logout"}
              onClick={handleLogout}
            >
              {isPending && pendingKey === "logout" ? (
                <LoaderCircle className="h-4 w-4 animate-spin" />
              ) : (
                <LogOut className="h-4 w-4" />
              )}
              Sign out
            </Button>
          </div>
        </section>

        {notice ? (
          <div
            className={`rounded-[24px] border px-4 py-3 text-sm shadow-[0_18px_40px_rgba(15,23,42,0.08)] ${
              notice.type === "success"
                ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                : "border-red-200 bg-red-50 text-danger"
            }`}
          >
            {notice.message}
          </div>
        ) : null}

        <section className="grid gap-4 md:grid-cols-3">
          <div className="elevated-card rounded-[28px] bg-white/90 p-5">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="section-label">Registered accounts</p>
                <p className="mt-3 font-display text-4xl font-semibold text-foreground">{snapshot.totalAccounts}</p>
              </div>
              <span className="rounded-2xl bg-cyan-50 p-3 text-primary">
                <Users className="h-5 w-5" />
              </span>
            </div>
          </div>

          <div className="elevated-card rounded-[28px] bg-white/90 p-5">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="section-label">Active</p>
                <p className="mt-3 font-display text-4xl font-semibold text-foreground">{snapshot.activeAccounts}</p>
              </div>
              <span className="rounded-2xl bg-emerald-50 p-3 text-emerald-600">
                <ShieldCheck className="h-5 w-5" />
              </span>
            </div>
          </div>

          <div className="elevated-card rounded-[28px] bg-white/90 p-5">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="section-label">Disabled</p>
                <p className="mt-3 font-display text-4xl font-semibold text-foreground">{snapshot.disabledAccounts}</p>
              </div>
              <span className="rounded-2xl bg-amber-50 p-3 text-amber-600">
                <UserRoundX className="h-5 w-5" />
              </span>
            </div>
          </div>
        </section>

        {!hasAccounts ? (
          <EmptyState
            icon={<Users className="h-5 w-5" />}
            title="No accounts found"
            description="No registered DayStack users were returned from the application database."
          />
        ) : (
          <>
            <section className="space-y-3 md:hidden">
              {snapshot.accounts.map((account) => {
                const rowPending = isPending && pendingAccountId === account.id;

                return (
                  <article key={account.id} className="elevated-card rounded-[28px] bg-white/92 p-5">
                    <div className="flex items-start justify-between gap-4">
                      <div className="min-w-0">
                        <h2 className="truncate text-base font-semibold text-foreground">{account.name}</h2>
                        <p className="mt-1 break-all text-sm text-secondary-foreground">{account.email}</p>
                      </div>
                      <StatusChip
                        label={account.status === "active" ? "Active" : "Disabled"}
                        tone={account.status === "active" ? "success" : "warning"}
                      />
                    </div>

                    <dl className="mt-4 space-y-3 text-sm">
                      <div>
                        <dt className="section-label text-[10px]">Created</dt>
                        <dd className="mt-1 text-secondary-foreground">{formatAccountDate(account.createdAt)}</dd>
                      </div>
                      <div>
                        <dt className="section-label text-[10px]">Usage</dt>
                        <dd className="mt-1 text-secondary-foreground">{formatUsageLabel(account.estimatedOwnedRecords)}</dd>
                      </div>
                    </dl>

                    <div className="mt-4 flex flex-wrap gap-2">
                      {account.status === "active" ? (
                        <Button
                          size="sm"
                          variant="secondary"
                          disabled={rowPending}
                          onClick={() => handleAccountAction(account.id, "disable")}
                        >
                          {rowPending && pendingKey?.startsWith("disable:") ? (
                            <LoaderCircle className="h-4 w-4 animate-spin" />
                          ) : (
                            <ShieldX className="h-4 w-4" />
                          )}
                          Disable
                        </Button>
                      ) : (
                        <Button
                          size="sm"
                          variant="secondary"
                          disabled={rowPending}
                          onClick={() => handleAccountAction(account.id, "activate")}
                        >
                          {rowPending && pendingKey?.startsWith("activate:") ? (
                            <LoaderCircle className="h-4 w-4 animate-spin" />
                          ) : (
                            <ShieldCheck className="h-4 w-4" />
                          )}
                          Activate
                        </Button>
                      )}

                      <Button
                        size="sm"
                        variant="danger"
                        disabled={rowPending}
                        onClick={() => handleAccountAction(account.id, "delete")}
                      >
                        {rowPending && pendingKey?.startsWith("delete:") ? (
                          <LoaderCircle className="h-4 w-4 animate-spin" />
                        ) : (
                          <Trash2 className="h-4 w-4" />
                        )}
                        Delete
                      </Button>
                    </div>
                  </article>
                );
              })}
            </section>

            <section className="glass-panel hidden overflow-hidden md:block">
              <div className="overflow-x-auto">
                <table className="min-w-full border-separate border-spacing-0">
                  <thead>
                    <tr className="text-left">
                      <th className="px-6 py-4 text-[11px] font-semibold uppercase tracking-[0.18em] text-secondary-foreground/70">
                        Account
                      </th>
                      <th className="px-6 py-4 text-[11px] font-semibold uppercase tracking-[0.18em] text-secondary-foreground/70">
                        Created
                      </th>
                      <th className="px-6 py-4 text-[11px] font-semibold uppercase tracking-[0.18em] text-secondary-foreground/70">
                        Usage
                      </th>
                      <th className="px-6 py-4 text-[11px] font-semibold uppercase tracking-[0.18em] text-secondary-foreground/70">
                        Status
                      </th>
                      <th className="px-6 py-4 text-[11px] font-semibold uppercase tracking-[0.18em] text-secondary-foreground/70">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {snapshot.accounts.map((account) => {
                      const rowPending = isPending && pendingAccountId === account.id;

                      return (
                        <tr key={account.id} className="border-t border-border/70">
                          <td className="px-6 py-5 align-top">
                            <div className="min-w-0">
                              <p className="text-sm font-semibold text-foreground">{account.name}</p>
                              <p className="mt-1 break-all text-sm text-secondary-foreground">{account.email}</p>
                            </div>
                          </td>
                          <td className="px-6 py-5 align-top text-sm text-secondary-foreground">
                            {formatAccountDate(account.createdAt)}
                          </td>
                          <td className="px-6 py-5 align-top text-sm text-secondary-foreground">
                            <div className="flex items-start gap-2">
                              <HardDrive className="mt-0.5 h-4 w-4 shrink-0 text-secondary-foreground/60" />
                              <span>{formatUsageLabel(account.estimatedOwnedRecords)}</span>
                            </div>
                          </td>
                          <td className="px-6 py-5 align-top">
                            <StatusChip
                              label={account.status === "active" ? "Active" : "Disabled"}
                              tone={account.status === "active" ? "success" : "warning"}
                            />
                          </td>
                          <td className="px-6 py-5 align-top">
                            <div className="flex flex-wrap gap-2">
                              {account.status === "active" ? (
                                <Button
                                  size="sm"
                                  variant="secondary"
                                  disabled={rowPending}
                                  onClick={() => handleAccountAction(account.id, "disable")}
                                >
                                  {rowPending && pendingKey?.startsWith("disable:") ? (
                                    <LoaderCircle className="h-4 w-4 animate-spin" />
                                  ) : (
                                    <ShieldX className="h-4 w-4" />
                                  )}
                                  Disable
                                </Button>
                              ) : (
                                <Button
                                  size="sm"
                                  variant="secondary"
                                  disabled={rowPending}
                                  onClick={() => handleAccountAction(account.id, "activate")}
                                >
                                  {rowPending && pendingKey?.startsWith("activate:") ? (
                                    <LoaderCircle className="h-4 w-4 animate-spin" />
                                  ) : (
                                    <ShieldCheck className="h-4 w-4" />
                                  )}
                                  Activate
                                </Button>
                              )}

                              <Button
                                size="sm"
                                variant="danger"
                                disabled={rowPending}
                                onClick={() => handleAccountAction(account.id, "delete")}
                              >
                                {rowPending && pendingKey?.startsWith("delete:") ? (
                                  <LoaderCircle className="h-4 w-4 animate-spin" />
                                ) : (
                                  <Trash2 className="h-4 w-4" />
                                )}
                                Delete
                              </Button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </section>
          </>
        )}
      </div>
    </main>
  );
}
