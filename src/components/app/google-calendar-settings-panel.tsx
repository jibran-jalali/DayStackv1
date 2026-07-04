"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { CalendarCheck, ExternalLink, Loader2 } from "lucide-react";

import { buttonVariants } from "@/components/shared/button";
import { requestJson } from "@/lib/client/request";

interface GoogleCalendarStatus {
  configured: boolean;
  connected: boolean;
  connectedAt: string | null;
  googleEmail: string | null;
}

interface GoogleCalendarSettingsPanelProps {
  compact?: boolean;
}

export function GoogleCalendarSettingsPanel({ compact = false }: GoogleCalendarSettingsPanelProps) {
  const searchParams = useSearchParams();
  const [status, setStatus] = useState<GoogleCalendarStatus | null>(null);
  const [isBusy, setIsBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    let ignore = false;

    async function loadStatus() {
      try {
        const nextStatus = await requestJson<GoogleCalendarStatus>(
          "/api/calendar/google/status",
          { credentials: "same-origin" },
          "Google Calendar status could not be loaded.",
        );

        if (!ignore) {
          setStatus(nextStatus);
        }
      } catch (error) {
        if (!ignore) {
          setMessage(error instanceof Error ? error.message : "Google Calendar status could not be loaded.");
        }
      }
    }

    void loadStatus();

    return () => {
      ignore = true;
    };
  }, []);

  useEffect(() => {
    const calendarResult = searchParams.get("calendar");
    const callbackMessage = searchParams.get("message");

    if (calendarResult === "connected") {
      setMessage("Google Calendar connected.");
      return;
    }

    if (calendarResult === "error") {
      setMessage(callbackMessage ?? "Google Calendar connection failed.");
    }
  }, [searchParams]);

  async function handleDisconnect() {
    setIsBusy(true);
    setMessage(null);

    try {
      await requestJson<{ ok: boolean }>(
        "/api/calendar/google/disconnect",
        {
          credentials: "same-origin",
          method: "POST",
        },
        "Google Calendar could not be disconnected.",
      );
      setStatus((current) =>
        current
          ? {
              ...current,
              connected: false,
              connectedAt: null,
              googleEmail: null,
            }
          : current,
      );
      setMessage("Google Calendar disconnected.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Google Calendar could not be disconnected.");
    } finally {
      setIsBusy(false);
    }
  }

  const isLoading = !status && !message;

  return (
    <section className={compact ? "mobile-card p-3" : "rounded-[18px] border border-border/70 bg-white/78 p-4 shadow-[0_10px_24px_rgba(15,23,42,0.04)]"}>
      <div className="flex items-start gap-3">
        <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-cyan-50 text-sky-700">
          <CalendarCheck className="h-5 w-5" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-foreground">Google Calendar</p>
              <p className="mt-1 text-sm leading-6 text-secondary-foreground">
                Import visible calendar events into DayStack.
              </p>
            </div>
            {isLoading ? <Loader2 className="mt-1 h-4 w-4 animate-spin text-secondary-foreground" /> : null}
          </div>

          {status?.connected ? (
            <div className="mt-3 rounded-[14px] border border-emerald-200 bg-emerald-50/80 px-3 py-2 text-xs text-emerald-800">
              Connected{status.googleEmail ? ` as ${status.googleEmail}` : ""}.
            </div>
          ) : null}

          {status && !status.configured ? (
            <div className="mt-3 rounded-[14px] border border-amber-200 bg-amber-50/85 px-3 py-2 text-xs leading-5 text-amber-900">
              Google OAuth env values are missing.
            </div>
          ) : null}

          {message ? (
            <div className="mt-3 rounded-[14px] border border-border/70 bg-muted/40 px-3 py-2 text-xs leading-5 text-secondary-foreground">
              {message}
            </div>
          ) : null}

          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            {status?.connected ? (
              <button
                type="button"
                className={buttonVariants({ variant: "secondary", size: "sm", className: "w-full" })}
                disabled={isBusy}
                onClick={handleDisconnect}
              >
                Disconnect
              </button>
            ) : (
              <a
                className={buttonVariants({
                  size: "sm",
                  className: "w-full",
                })}
                aria-disabled={!status?.configured}
                href={status?.configured ? "/api/calendar/google/connect" : "#"}
                onClick={(event) => {
                  if (!status?.configured) {
                    event.preventDefault();
                  }
                }}
              >
                Connect Google
                <ExternalLink className="h-4 w-4" />
              </a>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
