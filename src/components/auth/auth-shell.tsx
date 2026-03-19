import Link from "next/link";
import { AlertTriangle, ArrowUpRight, CheckCircle2, Clock3, Sparkles, Target } from "lucide-react";

import { AuthForm } from "@/components/auth/auth-form";
import { buttonVariants } from "@/components/shared/button";
import { Logo } from "@/components/shared/logo";
import { SetupNotice } from "@/components/shared/setup-notice";
import { isAuthConfigured, isDatabaseConfigured } from "@/lib/env";

const authRows = [
  {
    icon: Clock3,
    title: "Give the day a shape",
    copy: "Build a plan you can read at a glance instead of carrying it in your head.",
  },
  {
    icon: Target,
    title: "Stay with what matters now",
    copy: "Keep the next block visible so the day stops slipping into reaction mode.",
  },
  {
    icon: CheckCircle2,
    title: "Finish with proof",
    copy: "Score and streak stay honest because they come from what actually got done.",
  },
];

export function AuthShell({
  mode,
  notice,
}: {
  mode: "login" | "signup";
  notice?: {
    description: string;
    title: string;
  };
}) {
  const isSignup = mode === "signup";

  return (
    <main className="relative min-h-screen overflow-hidden">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-[30rem] bg-[radial-gradient(circle_at_18%_18%,rgba(24,190,239,0.18),transparent_32%),radial-gradient(circle_at_82%_12%,rgba(109,40,240,0.16),transparent_26%)]" />
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-[24rem] bg-[radial-gradient(circle_at_65%_70%,rgba(24,190,239,0.1),transparent_28%),radial-gradient(circle_at_20%_85%,rgba(109,40,240,0.1),transparent_24%)]" />

      <div className="container-shell relative py-4 sm:py-6">
        <div className="flex items-center justify-between gap-4">
          <Logo priority />
          <Link href="/" className={buttonVariants({ variant: "ghost", size: "sm" })}>
            Back home
          </Link>
        </div>

        <div className="mt-6 grid gap-5 sm:mt-8 sm:gap-6 lg:min-h-[calc(100vh-7rem)] lg:grid-cols-[1.05fr_0.95fr] lg:items-center">
          <section className="order-2 lg:order-1">
            <div className="glass-panel noise-overlay relative overflow-hidden rounded-[30px] border-white/65 p-5 sm:rounded-[36px] sm:p-8 lg:p-10">
              <div className="absolute -left-10 top-10 h-40 w-40 rounded-full bg-[radial-gradient(circle,_rgba(24,190,239,0.2),_transparent_72%)] blur-3xl" />
              <div className="absolute -right-8 bottom-12 h-36 w-36 rounded-full bg-[radial-gradient(circle,_rgba(109,40,240,0.18),_transparent_72%)] blur-3xl" />

              <div className="relative max-w-xl space-y-6 sm:space-y-8">
                <div className="data-chip w-fit border-cyan-200 bg-cyan-50 text-sky-700">
                  <Sparkles className="h-4 w-4" />
                  {isSignup ? "Start with a calmer plan" : "Back to a clearer day"}
                </div>

                <div className="space-y-3 sm:space-y-4">
                  <h1 className="font-display text-[2.25rem] font-semibold leading-[0.98] tracking-[-0.05em] text-foreground sm:text-[3.4rem] lg:text-[4.5rem]">
                    {isSignup ? "Start planning with clarity." : "Step back into the day with control."}
                  </h1>
                  <p className="max-w-xl text-base leading-7 text-secondary-foreground sm:text-lg sm:leading-8">
                    {isSignup
                      ? "DayStack helps you turn a loose plan into visible blocks, cleaner focus, and follow-through you can actually measure."
                      : "Open your plan, see what matters now, and keep the day moving without rebuilding it from scratch."}
                  </p>
                </div>

                <div className="rounded-[24px] border border-white/70 bg-white/76 px-4 py-4 shadow-[0_18px_46px_rgba(15,23,42,0.05)] sm:rounded-[28px] sm:px-5 sm:py-5">
                  <p className="text-sm font-medium text-foreground">{'"A plan only matters if you can follow it."'}</p>
                  <p className="mt-2 text-sm leading-7 text-secondary-foreground">
                    DayStack is built for the moment a good morning plan meets a messy afternoon.
                  </p>
                </div>

                <div className="space-y-0">
                  {authRows.map((row, index) => (
                    <div
                      key={row.title}
                      className={`flex items-start gap-4 py-4 ${
                        index < authRows.length - 1 ? "border-b border-border/75" : ""
                      }`}
                    >
                      <span className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[linear-gradient(135deg,rgba(24,190,239,0.12),rgba(109,40,240,0.12))] text-primary">
                        <row.icon className="h-5 w-5" />
                      </span>
                      <div>
                        <h2 className="text-base font-semibold text-foreground">{row.title}</h2>
                        <p className="mt-1 text-sm leading-6 text-secondary-foreground sm:leading-7">{row.copy}</p>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="hidden flex-wrap gap-2 text-sm text-secondary-foreground sm:flex">
                  <span className="data-chip">Less chaos</span>
                  <span className="data-chip">Visible time</span>
                  <span className="data-chip">Follow-through</span>
                </div>
              </div>
            </div>
          </section>

          <section className="order-1 lg:order-2">
            <div className="glass-panel fade-in-up relative overflow-hidden rounded-[28px] border-white/70 bg-white/94 p-5 shadow-[0_30px_90px_rgba(15,23,42,0.12)] sm:rounded-[34px] sm:p-8 lg:p-10">
              <div className="absolute inset-x-10 top-0 h-px bg-[linear-gradient(90deg,rgba(24,190,239,0),rgba(24,190,239,0.7),rgba(109,40,240,0.62),rgba(109,40,240,0))]" />
              <div className="relative mx-auto max-w-md space-y-5 sm:space-y-6">
                <div className="space-y-2.5 sm:space-y-3">
                  <p className="section-label">{isSignup ? "Create account" : "Log in"}</p>
                  <h2 className="font-display text-[2rem] font-semibold tracking-tight text-foreground sm:text-[2.2rem]">
                    {isSignup ? "Build a day you can actually follow." : "Pick the day back up cleanly."}
                  </h2>
                  <p className="text-sm leading-6 text-secondary-foreground sm:leading-7">
                    {isSignup
                      ? "Email and password only. Start free and get straight into planning."
                      : "Use your DayStack account to continue today's plan and keep the streak moving."}
                  </p>
                </div>

                {!isDatabaseConfigured() || !isAuthConfigured() ? (
                  <SetupNotice compact showAction={false} />
                ) : null}

                {notice ? (
                  <div className="rounded-[24px] border border-amber-200 bg-amber-50/90 px-4 py-3 text-sm text-amber-900">
                    <div className="flex items-start gap-3">
                      <span className="mt-0.5 rounded-full bg-amber-100 p-1.5 text-amber-700">
                        <AlertTriangle className="h-4 w-4" />
                      </span>
                      <div>
                        <p className="font-semibold text-foreground">{notice.title}</p>
                        <p className="mt-1 leading-6 text-secondary-foreground">{notice.description}</p>
                      </div>
                    </div>
                  </div>
                ) : null}

                <AuthForm mode={mode} />

                <Link
                  href="/"
                  className="inline-flex items-center gap-2 text-sm font-medium text-secondary-foreground transition hover:text-foreground"
                >
                  Explore DayStack first
                  <ArrowUpRight className="h-4 w-4" />
                </Link>
              </div>
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}
