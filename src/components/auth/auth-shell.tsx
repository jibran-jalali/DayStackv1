import Link from "next/link";
import { AlertTriangle, ArrowUpRight } from "lucide-react";

import { AuthForm } from "@/components/auth/auth-form";
import { buttonVariants } from "@/components/shared/button";
import { Logo } from "@/components/shared/logo";
import { SetupNotice } from "@/components/shared/setup-notice";
import { isAuthConfigured, isDatabaseConfigured } from "@/lib/env";

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
    <main className="relative flex min-h-screen items-center justify-center bg-white">
      <div className="pointer-events-none absolute left-[-150px] top-[-180px] h-[520px] w-[640px] rounded-full bg-[#60B1FF]/28 blur-[120px]" />
      <div className="pointer-events-none absolute right-[-170px] top-[12%] h-[420px] w-[520px] rounded-full bg-[#319AFF]/16 blur-[120px]" />

      <div className="relative z-10 w-full max-w-[420px] px-4">
        <div className="mb-8 flex items-center justify-between">
          <Logo priority />
          <Link href="/" className={buttonVariants({ variant: "ghost", size: "sm", className: "bg-white/35 backdrop-blur-[18px]" })}>
            Back home
          </Link>
        </div>

        <div className="overflow-hidden rounded-[28px] border border-white/70 bg-white/82 p-6 shadow-[inset_0px_4px_4px_0px_rgba(255,255,255,0.32),0_30px_90px_rgba(15,23,42,0.12)] backdrop-blur-[34px] sm:p-8">
          <div className="absolute inset-x-10 top-0 h-px bg-[linear-gradient(90deg,rgba(24,190,239,0),rgba(24,190,239,0.7),rgba(109,40,240,0.62),rgba(109,40,240,0))]" />

          <div className="relative space-y-6">
            <div className="grid grid-cols-2 rounded-[18px] border border-black/10 bg-white/48 p-1 text-sm font-semibold backdrop-blur-[18px]">
              <Link
                href="/signin"
                className={`rounded-[14px] px-4 py-2.5 text-center transition ${!isSignup ? "bg-[linear-gradient(135deg,#28b4ea,#6c31ef)] text-white shadow-[0_12px_28px_rgba(79,89,239,0.24)]" : "text-secondary-foreground hover:text-foreground"}`}
              >
                Sign in
              </Link>
              <Link
                href="/signup"
                className={`rounded-[14px] px-4 py-2.5 text-center transition ${isSignup ? "bg-[linear-gradient(135deg,#28b4ea,#6c31ef)] text-white shadow-[0_12px_28px_rgba(79,89,239,0.24)]" : "text-secondary-foreground hover:text-foreground"}`}
              >
                Sign up
              </Link>
            </div>

            <div className="space-y-2 text-center">
              <h1 className="font-display text-[1.8rem] font-bold tracking-[-0.055em] text-[#07111f]">
                {isSignup ? "Create your account" : "Welcome back"}
              </h1>
              <p className="text-sm leading-6 text-secondary-foreground">
                {isSignup
                  ? "Start free and get straight into planning."
                  : "Continue your DayStack."}
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

            <div className="text-center">
              <Link
                href="/"
                className="inline-flex items-center gap-2 text-sm font-medium text-secondary-foreground transition hover:text-foreground"
              >
                Explore DayStack first
                <ArrowUpRight className="h-4 w-4" />
              </Link>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
