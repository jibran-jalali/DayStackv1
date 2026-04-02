"use client";

import { Copy, KeyRound, LoaderCircle, RefreshCcw, Trash2 } from "lucide-react";
import { useEffect, useState, useTransition } from "react";

import { Button } from "@/components/shared/button";
import { Input } from "@/components/shared/input";
import { cn, getErrorMessage } from "@/lib/utils";
import type { AutomationApiKeySummary } from "@/types/daystack";

interface AutomationKeysPanelProps {
  compact?: boolean;
  onNotice?: (notice: { message: string; type: "error" | "success" }) => void;
}

function formatTimestamp(value: string | null) {
  if (!value) {
    return "Never";
  }

  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

export function AutomationKeysPanel({ compact = false, onNotice }: AutomationKeysPanelProps) {
  const [apiKeys, setApiKeys] = useState<AutomationApiKeySummary[]>([]);
  const [createLabel, setCreateLabel] = useState("Zapier");
  const [createdToken, setCreatedToken] = useState<string | null>(null);
  const [createdTokenLabel, setCreatedTokenLabel] = useState<string>("");
  const [isLoading, setIsLoading] = useState(true);
  const [activeKeyId, setActiveKeyId] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    let isMounted = true;

    async function loadApiKeys() {
      try {
        const response = await fetch("/api/developer/keys", {
          cache: "no-store",
        });
        const payload = (await response.json().catch(() => null)) as
          | { apiKeys?: AutomationApiKeySummary[]; message?: string }
          | null;

        if (!response.ok) {
          throw new Error(payload?.message ?? "Automation keys could not be loaded.");
        }

        if (isMounted) {
          setApiKeys(payload?.apiKeys ?? []);
        }
      } catch (error) {
        if (isMounted) {
          onNotice?.({
            type: "error",
            message: getErrorMessage(error),
          });
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    void loadApiKeys();

    return () => {
      isMounted = false;
    };
  }, [onNotice]);

  function handleRefresh() {
    setIsLoading(true);
    setCreatedToken(null);

    startTransition(async () => {
      try {
        const response = await fetch("/api/developer/keys", {
          cache: "no-store",
        });
        const payload = (await response.json().catch(() => null)) as
          | { apiKeys?: AutomationApiKeySummary[]; message?: string }
          | null;

        if (!response.ok) {
          throw new Error(payload?.message ?? "Automation keys could not be loaded.");
        }

        setApiKeys(payload?.apiKeys ?? []);
      } catch (error) {
        onNotice?.({
          type: "error",
          message: getErrorMessage(error),
        });
      } finally {
        setIsLoading(false);
      }
    });
  }

  function handleCreateKey() {
    const label = createLabel.trim();

    if (!label) {
      onNotice?.({
        type: "error",
        message: "Add a label before creating an API key.",
      });
      return;
    }

    startTransition(async () => {
      try {
        const response = await fetch("/api/developer/keys", {
          body: JSON.stringify({
            label,
          }),
          headers: {
            "Content-Type": "application/json",
          },
          method: "POST",
        });
        const payload = (await response.json().catch(() => null)) as
          | {
              apiKey?: AutomationApiKeySummary;
              message?: string;
              token?: string;
            }
          | null;

        if (!response.ok || !payload?.apiKey || !payload?.token) {
          throw new Error(payload?.message ?? "The API key could not be created.");
        }

        setApiKeys((current) => [payload.apiKey!, ...current]);
        setCreatedToken(payload.token);
        setCreatedTokenLabel(payload.apiKey.label);
        setCreateLabel("Zapier");
        onNotice?.({
          type: "success",
          message: "API key created. Copy it now because it will not be shown again.",
        });
      } catch (error) {
        onNotice?.({
          type: "error",
          message: getErrorMessage(error),
        });
      }
    });
  }

  function handleRevokeKey(keyId: string) {
    setActiveKeyId(keyId);

    startTransition(async () => {
      try {
        const response = await fetch(`/api/developer/keys/${keyId}`, {
          method: "DELETE",
        });
        const payload = (await response.json().catch(() => null)) as { message?: string } | null;

        if (!response.ok) {
          throw new Error(payload?.message ?? "The API key could not be revoked.");
        }

        setApiKeys((current) => current.filter((apiKey) => apiKey.id !== keyId));
        onNotice?.({
          type: "success",
          message: "API key revoked.",
        });
      } catch (error) {
        onNotice?.({
          type: "error",
          message: getErrorMessage(error),
        });
      } finally {
        setActiveKeyId(null);
      }
    });
  }

  async function handleCopyToken() {
    if (!createdToken) {
      return;
    }

    try {
      await navigator.clipboard.writeText(createdToken);
      onNotice?.({
        type: "success",
        message: "API key copied to clipboard.",
      });
    } catch {
      onNotice?.({
        type: "error",
        message: "Clipboard access is blocked. Copy the key manually.",
      });
    }
  }

  return (
    <section
      className={cn(
        compact
          ? "mobile-card p-4"
          : "rounded-[18px] border border-border/70 bg-white/78 p-4 shadow-[0_10px_24px_rgba(15,23,42,0.04)]",
      )}
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-secondary-foreground/70">
            Automation API
          </p>
          <p className="mt-2 text-sm text-secondary-foreground">
            Create per-user API keys for Zapier, Make, n8n, or custom scripts. These keys call DayStack&apos;s
            external <span className="font-medium text-foreground">/api/v1</span> routes without using your web session.
          </p>
        </div>
        <Button size="sm" variant="secondary" disabled={isPending} onClick={handleRefresh}>
          {isLoading ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <RefreshCcw className="h-4 w-4" />}
          Refresh
        </Button>
      </div>

      <div className="mt-4 rounded-[18px] border border-border/70 bg-muted/35 p-3.5">
        <div className="flex items-start gap-3">
          <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white text-primary shadow-[0_8px_18px_rgba(15,23,42,0.06)]">
            <KeyRound className="h-5 w-5" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-foreground">Create a new API key</p>
            <p className="mt-1 text-sm text-secondary-foreground">
              Label keys by use case so you can revoke a single integration without touching the rest.
            </p>

            <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center">
              <Input
                maxLength={80}
                value={createLabel}
                className="h-11 w-full sm:max-w-[15rem]"
                onChange={(event) => setCreateLabel(event.target.value)}
                placeholder="Zapier"
              />
              <Button size="sm" disabled={isPending} onClick={handleCreateKey}>
                {isPending ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <KeyRound className="h-4 w-4" />}
                Create key
              </Button>
            </div>
          </div>
        </div>
      </div>

      {createdToken ? (
        <div className="mt-4 rounded-[18px] border border-emerald-200 bg-emerald-50/90 p-3.5">
          <p className="text-sm font-semibold text-emerald-900">Copy this API key now</p>
          <p className="mt-1 text-sm text-emerald-800">
            <span className="font-medium">{createdTokenLabel}</span> was created successfully. DayStack will not show the full token again.
          </p>
          <div className="mt-3 rounded-[16px] border border-emerald-200/90 bg-white/90 px-3 py-2 text-xs font-medium text-foreground break-all">
            {createdToken}
          </div>
          <div className="mt-3">
            <Button size="sm" onClick={handleCopyToken}>
              <Copy className="h-4 w-4" />
              Copy key
            </Button>
          </div>
        </div>
      ) : null}

      <div className="mt-4 space-y-2.5">
        {isLoading ? (
          <div className="rounded-[16px] border border-border/70 bg-white/72 px-3 py-3 text-sm text-secondary-foreground">
            Loading API keys...
          </div>
        ) : apiKeys.length === 0 ? (
          <div className="rounded-[16px] border border-dashed border-border/80 bg-white/62 px-3 py-3 text-sm text-secondary-foreground">
            No API keys yet. Create one to connect Zapier-style automations to DayStack.
          </div>
        ) : (
          apiKeys.map((apiKey) => {
            const isRevoking = activeKeyId === apiKey.id;

            return (
              <div
                key={apiKey.id}
                className="rounded-[16px] border border-border/70 bg-white/72 px-3 py-3"
              >
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-foreground">{apiKey.label}</p>
                    <p className="mt-1 text-xs font-medium uppercase tracking-[0.16em] text-secondary-foreground/72">
                      {apiKey.keyPrefix}
                    </p>
                    <div className="mt-2 space-y-1 text-xs text-secondary-foreground">
                      <p>Created: {formatTimestamp(apiKey.createdAt)}</p>
                      <p>Last used: {formatTimestamp(apiKey.lastUsedAt)}</p>
                    </div>
                  </div>

                  <Button
                    size="sm"
                    variant="ghost"
                    className="w-full sm:w-auto"
                    disabled={isPending}
                    onClick={() => handleRevokeKey(apiKey.id)}
                  >
                    {isRevoking ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                    Revoke
                  </Button>
                </div>
              </div>
            );
          })
        )}
      </div>
    </section>
  );
}
