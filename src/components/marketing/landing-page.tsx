"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import {
  ArrowRight,
  CalendarClock,
  CheckCircle2,
  Flame,
  Focus,
  Layers3,
  Menu,
  Sparkles,
  Target,
  X,
} from "lucide-react";

import { LeaderboardView } from "@/components/app/leaderboard-view";
import { Reveal } from "@/components/marketing/reveal";
import { Button, buttonVariants } from "@/components/shared/button";
import { Logo, LogoMark } from "@/components/shared/logo";
import { cn } from "@/lib/utils";
import type { LeaderboardEntry } from "@/types/daystack";

const problemPoints = [
  {
    title: "The day gets noisy fast",
    copy: "Tasks pile up, priorities blur, and by noon you are reacting instead of executing.",
  },
  {
    title: "Most tools create clutter",
    copy: "Lists keep growing. Calendars stay passive. The plan never feels alive enough to follow.",
  },
  {
    title: "You finish without clarity",
    copy: "Busy does not tell you whether the day held together. Most systems never close that loop.",
  },
];

const whyRows = [
  {
    icon: CalendarClock,
    title: "Plan clearly",
    copy: "Turn the day into visible blocks instead of holding it together in your head.",
  },
  {
    icon: Focus,
    title: "See what matters now",
    copy: "Keep the current block and the next one obvious enough that momentum can survive interruption.",
  },
  {
    icon: CheckCircle2,
    title: "Follow through",
    copy: "Complete the work from the same surface where you planned it, without switching into dashboard mode.",
  },
  {
    icon: Flame,
    title: "Build consistency",
    copy: "Score and streak stay in the background until they matter, then tell the truth about the day.",
  },
];

const quickStatements = [
  "A plan only matters if you can follow it.",
  "Your time should feel visible.",
  "Less chaos. More follow-through.",
];

const navItems = [
  { href: "#problem", label: "Why it breaks" },
  { href: "#why-daystack", label: "Why DayStack" },
  { href: "#start", label: "Start" },
];

const heroTimeline = [
  {
    time: "08:00",
    title: "Deep work",
    copy: "Protected focus time for the task that matters most.",
    tone: "done" as const,
  },
  {
    time: "11:20",
    title: "Reset",
    copy: "A visible handoff point so the day does not blur together.",
    tone: "current" as const,
  },
  {
    time: "15:00",
    title: "Finish clean",
    copy: "Wrap the day with clarity instead of loose ends.",
    tone: "upcoming" as const,
  },
];

function SectionIntro({
  eyebrow,
  title,
  copy,
  align = "left",
}: {
  align?: "center" | "left";
  copy: string;
  eyebrow: string;
  title: string;
}) {
  return (
    <div className={cn("space-y-4", align === "center" ? "mx-auto max-w-3xl text-center" : "max-w-3xl")}>
      <p className={cn("section-label", align === "center" && "text-center")}>{eyebrow}</p>
      <h2 className="font-display text-[2.2rem] font-semibold tracking-[-0.055em] text-foreground sm:text-[2.9rem] lg:text-[3.4rem]">
        {title}
      </h2>
      <p className="max-w-2xl text-base leading-7 text-secondary-foreground sm:text-lg sm:leading-8">
        {copy}
      </p>
    </div>
  );
}

function StatementBand({
  eyebrow,
  statement,
  supporting,
}: {
  eyebrow: string;
  statement: string;
  supporting: string;
}) {
  return (
    <div className="overflow-hidden rounded-[30px] border border-white/80 bg-[linear-gradient(180deg,rgba(255,255,255,0.96),rgba(245,248,252,0.94))] px-6 py-10 shadow-[0_28px_80px_rgba(15,23,42,0.08)] sm:px-10 sm:py-14">
      <p className="section-label text-center">{eyebrow}</p>
      <p className="mx-auto mt-5 max-w-4xl text-center font-display text-[2.2rem] font-semibold leading-[1.05] tracking-[-0.06em] text-foreground sm:text-[3.2rem] lg:text-[3.9rem]">
        {statement}
      </p>
      <p className="mx-auto mt-5 max-w-2xl text-center text-base leading-7 text-secondary-foreground sm:text-lg sm:leading-8">
        {supporting}
      </p>
    </div>
  );
}

function HeroPlannerPreview() {
  return (
    <div className="relative mx-auto w-full max-w-[35rem]">
      <div className="absolute inset-x-12 inset-y-8 rounded-[36px] bg-[radial-gradient(circle_at_top,rgba(24,190,239,0.16),transparent_56%)] blur-3xl" />

      <div className="relative overflow-hidden rounded-[30px] border border-white/80 bg-[linear-gradient(180deg,rgba(255,255,255,0.98),rgba(244,248,252,0.94))] p-4 shadow-[0_30px_90px_rgba(15,23,42,0.12)] sm:rounded-[34px] sm:p-6">
        <div className="absolute inset-x-0 top-0 h-px bg-[linear-gradient(90deg,rgba(24,190,239,0),rgba(24,190,239,0.5),rgba(109,40,240,0))]" />

        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <LogoMark className="h-11 w-11 shrink-0" />
            <div className="space-y-1">
              <p className="section-label">A calmer day</p>
              <h3 className="font-display text-[1.55rem] font-semibold tracking-[-0.05em] text-foreground sm:text-[1.8rem]">
                Tuesday rhythm
              </h3>
              <p className="text-sm text-secondary-foreground">
                The next move stays clear. Open time stops disappearing.
              </p>
            </div>
          </div>

          <div className="hidden rounded-full border border-slate-200/90 bg-white/90 px-3 py-1.5 text-xs font-semibold text-secondary-foreground shadow-[0_10px_24px_rgba(15,23,42,0.05)] sm:inline-flex">
            Now matters
          </div>
        </div>

        <div className="mt-5 grid gap-3 sm:grid-cols-3">
          {[
            { label: "4 blocks", copy: "planned with intent" },
            { label: "78% score", copy: "visible, not hidden" },
            { label: "3 day streak", copy: "earned through follow-through" },
          ].map((item) => (
            <div
              key={item.label}
              className="rounded-[22px] border border-slate-200/80 bg-white/86 px-4 py-3.5 shadow-[0_12px_28px_rgba(15,23,42,0.05)]"
            >
              <p className="text-sm font-semibold text-foreground">{item.label}</p>
              <p className="mt-1 text-sm leading-6 text-secondary-foreground">{item.copy}</p>
            </div>
          ))}
        </div>

        <div className="mt-5 rounded-[24px] border border-slate-200/80 bg-[linear-gradient(180deg,rgba(255,255,255,0.98),rgba(248,250,252,0.92))] p-3 shadow-[0_16px_34px_rgba(15,23,42,0.06)] sm:p-4">
          <div className="flex items-center justify-between gap-4 border-b border-slate-200/75 px-2 pb-3">
            <div>
              <p className="section-label">The day in view</p>
              <p className="mt-1 text-sm font-medium text-secondary-foreground">
                Visible blocks. Clear rhythm. Less mental drag.
              </p>
            </div>
            <div className="rounded-full border border-slate-200/90 bg-slate-50 px-3 py-1.5 text-xs font-semibold text-secondary-foreground">
              Focused
            </div>
          </div>

          <div className="mt-3 space-y-3">
            {heroTimeline.map((item) => (
              <div
                key={item.time}
                className={cn(
                  "flex gap-3 rounded-[20px] border px-3 py-3.5 transition-colors duration-200",
                  item.tone === "current"
                    ? "border-[rgba(24,190,239,0.22)] bg-[rgba(24,190,239,0.07)]"
                    : "border-slate-200/80 bg-white/92",
                )}
              >
                <div className="min-w-[4.1rem] pt-0.5 text-sm font-semibold text-foreground">{item.time}</div>
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-sm font-semibold text-foreground">{item.title}</p>
                    <span
                      className={cn(
                        "inline-flex rounded-full px-2.5 py-1 text-[11px] font-semibold",
                        item.tone === "done"
                          ? "bg-emerald-50 text-emerald-700"
                          : item.tone === "current"
                            ? "bg-white text-[#1496e8]"
                            : "bg-slate-100 text-secondary-foreground",
                      )}
                    >
                      {item.tone === "done" ? "Locked" : item.tone === "current" ? "Current" : "Next"}
                    </span>
                  </div>
                  <p className="mt-1 text-sm leading-6 text-secondary-foreground">{item.copy}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

interface LandingPageProps {
  leaderboard: LeaderboardEntry[];
}

export function LandingPage({ leaderboard }: LandingPageProps) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const scrollProgressRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    let animationFrame = 0;

    function updateScrollProgress() {
      animationFrame = 0;
      const root = document.documentElement;
      const scrollRange = root.scrollHeight - window.innerHeight;
      const nextProgress = scrollRange <= 0 ? 0 : window.scrollY / scrollRange;
      const clampedProgress = Math.max(0, Math.min(1, nextProgress));

      if (scrollProgressRef.current) {
        scrollProgressRef.current.style.transform = `scaleX(${clampedProgress})`;
      }
    }

    function handleScroll() {
      if (animationFrame !== 0) {
        return;
      }

      animationFrame = window.requestAnimationFrame(updateScrollProgress);
    }

    updateScrollProgress();
    window.addEventListener("scroll", handleScroll, { passive: true });
    window.addEventListener("resize", handleScroll);

    return () => {
      if (animationFrame !== 0) {
        window.cancelAnimationFrame(animationFrame);
      }

      window.removeEventListener("scroll", handleScroll);
      window.removeEventListener("resize", handleScroll);
    };
  }, []);

  useEffect(() => {
    function handleResize() {
      if (window.innerWidth >= 768) {
        setMobileMenuOpen(false);
      }
    }

    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  return (
    <main className="relative overflow-x-clip pb-16 sm:pb-20">
      <div className="pointer-events-none fixed inset-x-0 top-0 z-50 h-px bg-black/5">
        <div
          ref={scrollProgressRef}
          className="render-smooth h-full origin-left bg-[linear-gradient(90deg,#18beef_0%,#1496e8_45%,#6d28f0_100%)] will-change-transform"
          style={{ transform: "scaleX(0)" }}
        />
      </div>

      <div className="pointer-events-none absolute inset-x-0 top-0 h-[34rem] bg-[radial-gradient(circle_at_top_left,rgba(24,190,239,0.14),transparent_34%),radial-gradient(circle_at_top_right,rgba(109,40,240,0.12),transparent_28%)]" />
      <div className="pointer-events-none absolute inset-x-0 top-[40rem] h-[24rem] bg-[radial-gradient(circle_at_center,rgba(15,23,42,0.03),transparent_60%)]" />

      <header className="sticky top-0 z-40 border-b border-black/5 bg-[rgba(248,250,252,0.86)] backdrop-blur-xl">
        <div className="container-shell">
          <div className="mx-auto flex max-w-[1180px] items-center justify-between gap-4 py-4">
            <Logo priority />

            <nav className="hidden items-center gap-7 text-sm font-medium text-secondary-foreground md:flex">
              {navItems.map((item) => (
                <a key={item.href} href={item.href} className="transition-colors duration-200 hover:text-foreground">
                  {item.label}
                </a>
              ))}
            </nav>

            <div className="hidden items-center gap-2.5 md:flex">
              <Link href="/login" className={buttonVariants({ variant: "ghost", size: "sm" })}>
                Log in
              </Link>
              <Link href="/signup" className={buttonVariants({ size: "sm" })}>
                Create account
              </Link>
            </div>

            <div className="flex items-center gap-2 md:hidden">
              <Link href="/signup" className={buttonVariants({ size: "sm", className: "h-10 px-4 text-sm" })}>
                Start free
              </Link>
              <Button
                size="sm"
                variant="secondary"
                className="h-10 w-10 rounded-full px-0"
                aria-expanded={mobileMenuOpen}
                aria-label={mobileMenuOpen ? "Close navigation menu" : "Open navigation menu"}
                onClick={() => setMobileMenuOpen((open) => !open)}
              >
                {mobileMenuOpen ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
              </Button>
            </div>
          </div>

          <div
            className={cn(
              "overflow-hidden transition-[max-height,opacity,transform,padding] duration-200 ease-[cubic-bezier(0.22,1,0.36,1)] md:hidden",
              mobileMenuOpen ? "max-h-80 opacity-100 pb-4" : "pointer-events-none max-h-0 -translate-y-2 opacity-0",
            )}
          >
            <div className="mx-auto max-w-[1180px] rounded-[24px] border border-white/85 bg-white/94 p-3 shadow-[0_22px_48px_rgba(15,23,42,0.08)]">
              <nav className="flex flex-col gap-1.5">
                {navItems.map((item) => (
                  <a
                    key={item.href}
                    href={item.href}
                    className="rounded-2xl px-3 py-3 text-sm font-medium text-secondary-foreground transition-colors duration-200 hover:bg-muted/75 hover:text-foreground"
                    onClick={() => setMobileMenuOpen(false)}
                  >
                    {item.label}
                  </a>
                ))}
                <Link
                  href="/login"
                  className="rounded-2xl px-3 py-3 text-sm font-medium text-secondary-foreground transition-colors duration-200 hover:bg-muted/75 hover:text-foreground"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  Log in
                </Link>
              </nav>
            </div>
          </div>
        </div>
      </header>

      <section className="container-shell pt-10 sm:pt-14 lg:pt-18">
        <div className="mx-auto grid max-w-[1180px] gap-12 lg:grid-cols-[1.02fr_0.98fr] lg:items-center lg:gap-16">
          <Reveal className="space-y-8">
            <div className="inline-flex w-fit items-center gap-2 rounded-full border border-[rgba(24,190,239,0.14)] bg-white/88 px-3.5 py-1.5 text-xs font-semibold text-sky-700 shadow-[0_10px_22px_rgba(15,23,42,0.04)]">
              <Sparkles className="h-3.5 w-3.5" />
              Built for students, builders, freelancers
            </div>

            <div className="space-y-5">
              <h1 className="max-w-4xl font-display text-[3rem] font-semibold leading-[0.94] tracking-[-0.075em] text-foreground sm:text-[4.3rem] lg:text-[5.6rem]">
                Plan your day before it disappears.
              </h1>
              <p className="max-w-2xl text-[1.02rem] leading-7 text-secondary-foreground sm:text-xl sm:leading-8">
                DayStack helps you give the day structure, stay with what matters now, and follow through without the
                chaos of generic productivity tools.
              </p>
            </div>

            <div className="flex flex-col gap-3 sm:flex-row">
              <Link href="/signup" className={buttonVariants({ size: "lg", className: "w-full sm:w-auto" })}>
                Start free
                <ArrowRight className="h-4 w-4" />
              </Link>
              <Link
                href="/login"
                className={buttonVariants({ variant: "secondary", size: "lg", className: "w-full sm:w-auto" })}
              >
                Log in
              </Link>
            </div>

            <div className="grid gap-3 border-t border-black/6 pt-6 sm:grid-cols-3">
              {quickStatements.map((item, index) => (
                <div
                  key={item}
                  className="rounded-[20px] border border-white/82 bg-white/88 px-4 py-4 shadow-[0_14px_34px_rgba(15,23,42,0.05)]"
                >
                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-secondary-foreground/65">
                    0{index + 1}
                  </p>
                  <p className="mt-2 text-sm font-medium leading-6 text-foreground">{item}</p>
                </div>
              ))}
            </div>
          </Reveal>

          <Reveal delay={100}>
            <HeroPlannerPreview />
          </Reveal>
        </div>

        <Reveal delay={160} className="mx-auto mt-10 max-w-[1180px] sm:mt-14">
          <LeaderboardView entries={leaderboard} mode="website" />
        </Reveal>
      </section>

      <section id="problem" className="container-shell content-auto py-20 sm:py-24 lg:py-28">
        <div className="mx-auto max-w-[1180px] space-y-10">
          <Reveal>
            <SectionIntro
              eyebrow="Why it breaks"
              title="Most days do not fail from lack of ambition."
              copy="They fail because the plan is too easy to ignore, too hard to revisit, or too messy to trust once the day starts moving."
            />
          </Reveal>

          <div className="grid gap-5 lg:grid-cols-3">
            {problemPoints.map((item, index) => (
              <Reveal key={item.title} delay={index * 80}>
                <article className="flex h-full flex-col rounded-[28px] border border-white/82 bg-white/90 p-6 shadow-[0_18px_44px_rgba(15,23,42,0.06)]">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-secondary-foreground/65">
                    0{index + 1}
                  </p>
                  <h3 className="mt-4 font-display text-[1.8rem] font-semibold tracking-[-0.04em] text-foreground">
                    {item.title}
                  </h3>
                  <p className="mt-3 text-base leading-7 text-secondary-foreground">{item.copy}</p>
                </article>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      <section className="container-shell content-auto pb-20 sm:pb-24 lg:pb-28">
        <div className="mx-auto max-w-[1180px]">
          <Reveal>
            <StatementBand
              eyebrow="Brand statement"
              statement='"A plan only matters if you can follow it."'
              supporting="DayStack is not built to collect tasks. It is built to make the day feel visible, manageable, and honest."
            />
          </Reveal>
        </div>
      </section>

      <section id="why-daystack" className="container-shell content-auto pb-20 sm:pb-24 lg:pb-28">
        <div className="mx-auto max-w-[1180px] space-y-10">
          <Reveal>
            <SectionIntro
              eyebrow="Why DayStack"
              title="Less system. More control."
              copy="Plan clearly, see what matters, follow through, and let consistency build from the shape of the day instead of from guilt."
            />
          </Reveal>

          <div className="grid gap-5 md:grid-cols-2">
            {whyRows.map((row, index) => (
              <Reveal key={row.title} delay={index * 70}>
                <article className="h-full rounded-[28px] border border-white/82 bg-white/90 p-6 shadow-[0_18px_44px_rgba(15,23,42,0.06)]">
                  <div className="flex items-start gap-4">
                    <span className="inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-[linear-gradient(180deg,rgba(24,190,239,0.12),rgba(109,40,240,0.12))] text-primary">
                      <row.icon className="h-5 w-5" />
                    </span>
                    <div className="min-w-0">
                      <h3 className="font-display text-[1.65rem] font-semibold tracking-[-0.04em] text-foreground sm:text-[1.9rem]">
                        {row.title}
                      </h3>
                      <p className="mt-3 text-base leading-7 text-secondary-foreground">{row.copy}</p>
                    </div>
                  </div>
                </article>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      <section className="container-shell content-auto pb-20 sm:pb-24 lg:pb-28">
        <div className="mx-auto grid max-w-[1180px] gap-5 lg:grid-cols-[1.04fr_0.96fr]">
          <Reveal>
            <div className="flex h-full flex-col justify-between rounded-[30px] border border-white/82 bg-[linear-gradient(180deg,rgba(255,255,255,0.96),rgba(245,248,252,0.94))] p-6 shadow-[0_24px_70px_rgba(15,23,42,0.08)] sm:p-8">
              <div>
                <p className="section-label">Clarity changes the mood of the day</p>
                <h2 className="mt-4 font-display text-[2.2rem] font-semibold leading-[1.05] tracking-[-0.055em] text-foreground sm:text-[3rem]">
                  Your time should feel visible.
                </h2>
                <p className="mt-4 max-w-2xl text-base leading-7 text-secondary-foreground sm:text-lg sm:leading-8">
                  That is the shift. Less mental drag. Less hidden urgency. More calm momentum from the first block to
                  the last.
                </p>
              </div>

              <div className="mt-8 flex flex-wrap gap-3">
                {[
                  "For people tired of chaotic systems",
                  "For days that need structure",
                  "For momentum that feels earned",
                ].map((item) => (
                  <span
                    key={item}
                    className="inline-flex rounded-full border border-slate-200/80 bg-white/92 px-4 py-2 text-sm font-medium text-secondary-foreground shadow-[0_10px_22px_rgba(15,23,42,0.04)]"
                  >
                    {item}
                  </span>
                ))}
              </div>
            </div>
          </Reveal>

          <Reveal delay={100}>
            <div className="grid h-full gap-5">
              <div className="rounded-[30px] border border-white/82 bg-white/92 p-6 shadow-[0_18px_44px_rgba(15,23,42,0.06)] sm:p-7">
                <div className="flex items-center gap-3">
                  <span className="inline-flex h-10 w-10 items-center justify-center rounded-2xl bg-[rgba(24,190,239,0.08)] text-primary">
                    <Target className="h-4 w-4" />
                  </span>
                  <div>
                    <p className="section-label">What changes</p>
                    <p className="mt-1 text-base font-semibold text-foreground">The day stops feeling abstract.</p>
                  </div>
                </div>
                <div className="mt-5 space-y-3">
                  {[
                    "The next move stays obvious enough to act on.",
                    "Open time becomes visible before it disappears.",
                    "Momentum survives interruption more easily.",
                  ].map((item) => (
                    <div
                      key={item}
                      className="rounded-[20px] border border-slate-200/80 bg-slate-50/82 px-4 py-3 text-sm leading-6 text-secondary-foreground"
                    >
                      {item}
                    </div>
                  ))}
                </div>
              </div>

              <div className="rounded-[30px] border border-white/82 bg-[linear-gradient(135deg,rgba(24,190,239,0.07),rgba(109,40,240,0.08))] p-6 shadow-[0_18px_44px_rgba(15,23,42,0.06)] sm:p-7">
                <p className="section-label">The point</p>
                <p className="mt-3 font-display text-[1.8rem] font-semibold leading-[1.08] tracking-[-0.04em] text-foreground sm:text-[2.15rem]">
                  Less chaos. More follow-through.
                </p>
                <p className="mt-4 text-base leading-7 text-secondary-foreground">
                  DayStack is designed to feel lightweight while still making the day sharper, calmer, and easier to
                  trust.
                </p>
              </div>
            </div>
          </Reveal>
        </div>
      </section>

      <section id="start" className="container-shell content-auto pb-14 sm:pb-16">
        <div className="mx-auto max-w-[1180px]">
          <Reveal>
            <div className="relative overflow-hidden rounded-[34px] border border-[rgba(17,24,39,0.05)] bg-[linear-gradient(135deg,#101725_0%,#172133_55%,#1c2840_100%)] px-6 py-9 text-white shadow-[0_32px_90px_rgba(15,23,42,0.24)] sm:px-10 sm:py-12">
              <div className="absolute inset-y-0 right-0 w-[26rem] bg-[radial-gradient(circle_at_center,rgba(24,190,239,0.26),transparent_65%)]" />
              <div className="absolute inset-x-0 top-0 h-px bg-[linear-gradient(90deg,rgba(255,255,255,0),rgba(255,255,255,0.5),rgba(255,255,255,0))]" />

              <div className="relative flex flex-col gap-8 lg:flex-row lg:items-end lg:justify-between">
                <div className="max-w-2xl">
                  <p className="section-label text-white/64">Ready to start</p>
                  <h2 className="mt-4 font-display text-[2.5rem] font-semibold leading-[1.02] tracking-[-0.055em] sm:text-[3.4rem]">
                    Structure your day. Follow through.
                  </h2>
                  <p className="mt-4 max-w-2xl text-base leading-7 text-white/78 sm:text-lg sm:leading-8">
                    Create an account, plan the day clearly, and let DayStack keep the shape of it honest.
                  </p>
                </div>

                <div className="flex flex-col gap-3 sm:flex-row">
                  <Link
                    href="/signup"
                    className={buttonVariants({
                      className:
                        "w-full sm:w-auto !border-white/80 !bg-white !text-foreground hover:!bg-white/94 [&_svg]:!text-foreground",
                    })}
                  >
                    Create account
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                  <Link
                    href="/login"
                    className={buttonVariants({
                      variant: "ghost",
                      className: "w-full border border-white/18 text-white hover:bg-white/10 hover:text-white sm:w-auto",
                    })}
                  >
                    Log in
                  </Link>
                </div>
              </div>
            </div>
          </Reveal>
        </div>
      </section>

      <footer className="container-shell">
        <div className="mx-auto flex max-w-[1180px] flex-col gap-6 border-t border-black/6 py-8 text-sm text-secondary-foreground lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
            <Logo />
            <div className="hidden h-5 w-px bg-border sm:block" />
            <p>A calmer way to take control of your day.</p>
          </div>

          <div className="flex flex-wrap items-center gap-5">
            {navItems.map((item) => (
              <a key={item.href} href={item.href} className="transition-colors duration-200 hover:text-foreground">
                {item.label}
              </a>
            ))}
            <Link href="/login" className="transition-colors duration-200 hover:text-foreground">
              Log in
            </Link>
            <Link href="/signup" className="transition-colors duration-200 hover:text-foreground">
              Create account
            </Link>
            <span className="inline-flex items-center gap-2">
              <Layers3 className="h-4 w-4" />
              DayStack v1
            </span>
          </div>
        </div>
      </footer>
    </main>
  );
}
