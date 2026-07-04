import Link from "next/link";
import { AlertTriangle, ArrowUpRight, Shield, Clock, Sparkles } from "lucide-react";

import { AuthForm } from "@/components/auth/auth-form";
import { buttonVariants } from "@/components/shared/button";
import { LogoMark } from "@/components/shared/logo";
import { SetupNotice } from "@/components/shared/setup-notice";
import { isAuthConfigured, isDatabaseConfigured } from "@/lib/env";

const features = [
  { icon: Clock, text: "Plan your day in minutes" },
  { icon: Sparkles, text: "AI-powered scheduling" },
  { icon: Shield, text: "Your data, encrypted" },
];

const plannerAvatars = [
  { color: "#28b4ea", initial: "A", name: "Ayesha" },
  { color: "#6c31ef", initial: "J", name: "Jibran" },
  { color: "#10b981", initial: "H", name: "Hamza" },
];

function avatarImage({ color, initial }: { color: string; initial: string }) {
  return `data:image/svg+xml;utf8,${encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="80" height="80" viewBox="0 0 80 80"><defs><linearGradient id="g" x1="0" x2="1" y1="0" y2="1"><stop stop-color="${color}"/><stop offset="1" stop-color="#07111f"/></linearGradient></defs><rect width="80" height="80" rx="40" fill="url(#g)"/><circle cx="58" cy="20" r="16" fill="rgba(255,255,255,0.22)"/><text x="50%" y="55%" text-anchor="middle" dominant-baseline="middle" font-family="Arial, sans-serif" font-size="34" font-weight="700" fill="white">${initial}</text></svg>`,
  )}`;
}

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
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[#f8faff]">
      <div className="pointer-events-none absolute left-[-120px] top-[-160px] h-[480px] w-[560px] animate-auth-float rounded-full bg-[#60B1FF]/20 blur-[120px]" />
      <div className="pointer-events-none absolute right-[-140px] top-[8%] h-[380px] w-[460px] animate-auth-float-delayed rounded-full bg-[#319AFF]/12 blur-[120px]" />
      <div className="pointer-events-none absolute bottom-[10%] left-[5%] h-[280px] w-[320px] animate-auth-float-slow rounded-full bg-[#6d28f0]/8 blur-[100px]" />
      <div className="pointer-events-none absolute right-[15%] top-[55%] h-[200px] w-[240px] animate-auth-float-slow rounded-full bg-[#28b4ea]/8 blur-[80px]" />

      <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.5)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.5)_1px,transparent_1px)] bg-[length:44px_44px] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_50%,black,transparent)]" />

      <div className="relative z-10 grid w-full max-w-[1060px] items-center gap-10 px-4 lg:grid-cols-[1fr_420px] lg:gap-16">
        <div className="hidden flex-col gap-8 lg:flex">
          <div className="animate-auth-fade-up space-y-5">
            <LogoMark className="h-14 w-14 rounded-[16px] shadow-[0_12px_32px_rgba(83,78,222,0.18)]" />
            <h1 className="font-display text-[3.2rem] font-bold leading-[1.05] tracking-[-0.06em] text-[#07111f]">
              {isSignup ? "Start planning with clarity." : "Welcome back to your timeline."}
            </h1>
            <p className="max-w-[440px] text-base leading-7 text-secondary-foreground">
              {isSignup
                ? "Freelancers, students, and busy professionals use DayStack to turn scattered tasks into a timeline they can follow."
                : "Open your timeline, see what's next, and keep moving without rebuilding your plan from scratch."}
            </p>
          </div>

          <div className="animate-auth-fade-up space-y-4" style={{ animationDelay: "0.15s" }}>
            {features.map((f) => (
              <div key={f.text} className="flex items-center gap-3 text-sm font-medium text-secondary-foreground">
                <span className="grid h-8 w-8 place-items-center rounded-[10px] bg-[linear-gradient(135deg,rgba(24,190,239,0.1),rgba(109,40,240,0.1))] text-primary">
                  <f.icon className="h-4 w-4" />
                </span>
                {f.text}
              </div>
            ))}
          </div>

          <div className="animate-auth-fade-up flex items-center gap-3 rounded-[16px] border border-white/60 bg-white/55 px-5 py-4 shadow-[0_12px_34px_rgba(15,23,42,0.06)] backdrop-blur-[24px]" style={{ animationDelay: "0.3s" }}>
            <div className="flex -space-x-2">
              {plannerAvatars.map((avatar) => (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  key={avatar.name}
                  src={avatarImage(avatar)}
                  alt={`${avatar.name} avatar`}
                  className="h-8 w-8 rounded-full border-2 border-white object-cover shadow-[0_8px_18px_rgba(15,23,42,0.12)]"
                />
              ))}
            </div>
            <p className="text-sm text-secondary-foreground">
              <span className="font-semibold text-foreground">2,700+</span> planners shipped yesterday
            </p>
          </div>
        </div>

        <div className="animate-auth-fade-up w-full max-w-[420px] justify-self-center">
          <div className="mb-5 flex justify-end">
            <Link href="/" className={buttonVariants({ variant: "ghost", size: "sm", className: "bg-white/55 backdrop-blur-[18px]" })}>
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
                <h2 className="font-display text-[1.8rem] font-bold tracking-[-0.055em] text-[#07111f]">
                  {isSignup ? "Create your account" : "Welcome back"}
                </h2>
                <p className="text-sm leading-6 text-secondary-foreground">
                  {isSignup ? "Start free and get straight into planning." : "Continue your DayStack."}
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
      </div>
    </main>
  );
}
