"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  ArrowRight,
  CalendarClock,
  CheckCircle2,
  Flame,
  Focus,
  Layers3,
  Menu,
  Sparkles,
  X,
} from "lucide-react";

import { LeaderboardView } from "@/components/app/leaderboard-view";
import { Reveal } from "@/components/marketing/reveal";
import { Button, buttonVariants } from "@/components/shared/button";
import { Logo } from "@/components/shared/logo";
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

function HeroRhythm() {
  return (
    <div className="relative mx-auto aspect-square w-full max-w-[23rem] sm:max-w-[34rem]">
      <div className="absolute inset-5 rounded-full border border-white/65 bg-[conic-gradient(from_180deg_at_50%_50%,rgba(24,190,239,0.05),rgba(255,255,255,0.5),rgba(109,40,240,0.08),rgba(255,255,255,0.5),rgba(24,190,239,0.05))] shadow-[0_32px_90px_rgba(15,23,42,0.08)] orbit-slow" />
      <div className="absolute inset-8 rounded-full border border-white/70 bg-[radial-gradient(circle,rgba(255,255,255,0.7),rgba(255,255,255,0.18)_72%)] shadow-[0_32px_90px_rgba(15,23,42,0.08)]" />
      <div className="absolute inset-16 rounded-full border border-border/70 bg-white/45 backdrop-blur-xl" />
      <div className="absolute inset-[4.75rem] rounded-full border border-dashed border-primary/18 orbit-reverse" />
      <div className="absolute inset-0 rounded-full bg-[radial-gradient(circle_at_50%_48%,rgba(24,190,239,0.16),transparent_34%),radial-gradient(circle_at_72%_32%,rgba(109,40,240,0.14),transparent_22%)]" />

      <div className="absolute left-0 top-[16%] hidden rounded-full border border-white/75 bg-white/86 px-4 py-2 text-sm font-medium text-foreground shadow-[0_18px_42px_rgba(15,23,42,0.06)] sm:block sm:float-slow">
        08:00 Deep work
      </div>
      <div className="absolute right-2 top-[22%] hidden rounded-full border border-white/75 bg-white/84 px-4 py-2 text-sm font-medium text-foreground shadow-[0_18px_42px_rgba(15,23,42,0.06)] sm:block sm:drift-slow">
        11:20 Reset
      </div>
      <div className="absolute bottom-[18%] left-[6%] hidden rounded-full border border-white/75 bg-white/84 px-4 py-2 text-sm font-medium text-foreground shadow-[0_18px_42px_rgba(15,23,42,0.06)] sm:block sm:drift-slow-delayed">
        15:00 Finish clean
      </div>
      <div className="absolute bottom-[12%] right-[4%] rounded-full border border-cyan-100 bg-cyan-50/92 px-3 py-2 text-xs font-semibold text-sky-700 shadow-[0_18px_42px_rgba(24,190,239,0.1)] sm:px-4 sm:text-sm sm:float-slow">
        Now matters
      </div>

      <div className="absolute inset-[3.5rem] rounded-[30px] border border-white/75 bg-[linear-gradient(180deg,rgba(255,255,255,0.95),rgba(246,249,255,0.86))] p-5 shadow-[0_28px_80px_rgba(15,23,42,0.08)] sm:inset-[5.25rem] sm:rounded-[34px] sm:p-8">
        <div className="flex items-center gap-2 text-sm font-medium text-secondary-foreground">
          <span className="inline-flex h-2.5 w-2.5 rounded-full bg-primary pulse-ring" />
          A calmer day
        </div>

        <h2 className="mt-4 font-display text-[1.6rem] font-semibold leading-[1.02] tracking-[-0.05em] text-foreground sm:mt-5 sm:text-[2.5rem]">
          Your time should feel visible.
        </h2>

        <div className="mt-5 space-y-2.5 sm:mt-7 sm:space-y-3">
          {[
            "The next move stays clear.",
            "Open time stops disappearing.",
            "Momentum stops relying on memory.",
          ].map((line, index) => (
            <div
              key={line}
              className={cn(
                "rounded-full border border-border/70 bg-white/84 px-3.5 py-2.5 text-xs font-medium text-secondary-foreground shadow-[0_12px_28px_rgba(15,23,42,0.05)] sm:px-4 sm:py-3 sm:text-sm",
                index === 0 && "drift-slow",
                index === 1 && "drift-slow-delayed",
              )}
            >
              {line}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function SectionIntro({
  eyebrow,
  title,
  copy,
  className,
}: {
  className?: string;
  copy: string;
  eyebrow: string;
  title: string;
}) {
  return (
    <div className={cn("max-w-3xl space-y-3 sm:space-y-4", className)}>
      <p className="section-label">{eyebrow}</p>
      <h2 className="font-display text-[2.1rem] font-semibold tracking-[-0.05em] text-foreground sm:text-4xl lg:text-[3.25rem]">
        {title}
      </h2>
      <p className="max-w-2xl text-base leading-7 text-secondary-foreground sm:text-lg sm:leading-8">{copy}</p>
    </div>
  );
}

function StatementBand({
  align = "center",
  eyebrow,
  statement,
  supporting,
}: {
  align?: "center" | "left";
  eyebrow: string;
  statement: string;
  supporting?: string;
}) {
  return (
    <div className="rounded-[32px] border border-white/70 bg-[linear-gradient(180deg,rgba(255,255,255,0.9),rgba(242,247,253,0.82))] px-5 py-9 shadow-[0_24px_70px_rgba(15,23,42,0.06)] sm:rounded-[36px] sm:px-8 sm:py-12">
      <p className={cn("section-label", align === "center" && "text-center")}>{eyebrow}</p>
      <p
        className={cn(
          "mt-4 font-display text-[2.1rem] font-semibold leading-[1.06] tracking-[-0.05em] text-foreground sm:text-4xl lg:text-[3.4rem]",
          align === "center" ? "mx-auto max-w-4xl text-center" : "max-w-4xl",
        )}
      >
        {statement}
      </p>
      {supporting ? (
        <p
          className={cn(
            "mt-4 text-base leading-7 text-secondary-foreground sm:text-lg sm:leading-8",
            align === "center" ? "mx-auto max-w-2xl text-center" : "max-w-2xl",
          )}
        >
          {supporting}
        </p>
      ) : null}
    </div>
  );
}

interface LandingPageProps {
  leaderboard: LeaderboardEntry[];
}

export function LandingPage({ leaderboard }: LandingPageProps) {
  const [scrollProgress, setScrollProgress] = useState(0);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    function handleScroll() {
      const root = document.documentElement;
      const scrollRange = root.scrollHeight - window.innerHeight;
      const nextProgress = scrollRange <= 0 ? 0 : (window.scrollY / scrollRange) * 100;
      setScrollProgress(Math.max(0, Math.min(100, nextProgress)));
    }

    handleScroll();
    window.addEventListener("scroll", handleScroll, { passive: true });

    return () => {
      window.removeEventListener("scroll", handleScroll);
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
      <div className="pointer-events-none fixed inset-x-0 top-0 z-50 h-px bg-white/40">
        <div
          className="h-full bg-[linear-gradient(90deg,#18beef_0%,#1496e8_45%,#6d28f0_100%)] transition-[width] duration-150 ease-linear"
          style={{ width: `${scrollProgress}%` }}
        />
      </div>

      <div className="pointer-events-none absolute inset-x-0 top-0 h-[30rem] bg-[radial-gradient(circle_at_16%_10%,rgba(24,190,239,0.17),transparent_32%),radial-gradient(circle_at_84%_14%,rgba(109,40,240,0.16),transparent_24%)] sm:h-[34rem] sm:drift-slow" />
      <div className="pointer-events-none absolute inset-x-0 top-[48rem] hidden h-[24rem] bg-[radial-gradient(circle_at_50%_50%,rgba(24,190,239,0.08),transparent_30%)] sm:block sm:drift-slow-delayed lg:top-[54rem] lg:h-[26rem]" />

      <header className="relative z-40 border-b border-white/50 bg-[rgba(246,248,252,0.88)] backdrop-blur-xl md:sticky md:top-0">
        <div className="container-shell flex items-center justify-between gap-3 py-3 sm:py-4">
          <div className="flex min-w-0 items-center gap-5">
            <Logo priority />
            <nav className="hidden items-center gap-5 text-sm text-secondary-foreground md:flex">
              {navItems.map((item) => (
                <a key={item.href} href={item.href} className="transition hover:text-foreground">
                  {item.label}
                </a>
              ))}
            </nav>
          </div>

          <div className="hidden items-center gap-2 md:flex">
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
            "container-shell overflow-hidden transition-[max-height,opacity,transform,padding] duration-200 ease-[cubic-bezier(0.22,1,0.36,1)] md:hidden",
            mobileMenuOpen ? "max-h-72 opacity-100 pb-4" : "pointer-events-none max-h-0 -translate-y-2 opacity-0",
          )}
        >
          <div className="rounded-[24px] border border-white/70 bg-white/92 p-3 shadow-[0_18px_40px_rgba(15,23,42,0.08)]">
            <nav className="flex flex-col gap-1">
              {navItems.map((item) => (
                <a
                  key={item.href}
                  href={item.href}
                  className="rounded-2xl px-3 py-2.5 text-sm font-medium text-secondary-foreground transition hover:bg-muted/70 hover:text-foreground"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  {item.label}
                </a>
              ))}
              <Link
                href="/login"
                className="rounded-2xl px-3 py-2.5 text-sm font-medium text-secondary-foreground transition hover:bg-muted/70 hover:text-foreground"
                onClick={() => setMobileMenuOpen(false)}
              >
                Log in
              </Link>
            </nav>
          </div>
        </div>
      </header>

      <section className="container-shell relative pt-10 sm:pt-14 lg:pt-18">
        <div className="grid gap-10 lg:grid-cols-[0.98fr_1.02fr] lg:items-center lg:gap-14">
          <Reveal className="space-y-6 sm:space-y-8">
            <div className="data-chip w-fit border-cyan-200 bg-cyan-50 text-sky-700">
              <Sparkles className="h-4 w-4" />
              Built for students, builders, freelancers
            </div>

            <div className="space-y-4 sm:space-y-5">
              <h1 className="max-w-4xl font-display text-[2.7rem] font-semibold leading-[0.96] tracking-[-0.07em] text-foreground sm:text-[4rem] lg:text-[5.4rem]">
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

            <div className="grid max-w-2xl gap-4 border-t border-border/80 pt-5 sm:grid-cols-3 sm:pt-6">
              {quickStatements.map((item, index) => (
                <div key={item} className="space-y-2">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-secondary-foreground/70">
                    0{index + 1}
                  </p>
                  <p className="text-sm font-medium text-foreground">{item}</p>
                </div>
              ))}
            </div>
          </Reveal>

          <Reveal delay={120}>
            <HeroRhythm />
          </Reveal>
        </div>

        <Reveal delay={180} className="mt-8 sm:mt-10">
          <LeaderboardView entries={leaderboard} mode="website" />
        </Reveal>
      </section>

      <section id="problem" className="container-shell py-18 sm:py-24 lg:py-28">
        <Reveal>
          <SectionIntro
            eyebrow="Why it breaks"
            title="Most days do not fail from lack of ambition."
            copy="They fail because the plan is too easy to ignore, too hard to revisit, or too messy to trust once the day starts moving."
          />
        </Reveal>

        <div className="mt-8 grid gap-6 lg:mt-10 lg:grid-cols-3 lg:gap-8">
          {problemPoints.map((item, index) => (
            <Reveal key={item.title} delay={index * 90}>
              <div className="border-t border-border/80 pt-5">
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-secondary-foreground/70">
                  0{index + 1}
                </p>
                <h3 className="mt-3 font-display text-[1.7rem] font-semibold text-foreground sm:text-2xl">
                  {item.title}
                </h3>
                <p className="mt-2.5 text-base leading-7 text-secondary-foreground sm:leading-8">{item.copy}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      <section className="container-shell pb-18 sm:pb-24 lg:pb-28">
        <Reveal>
          <StatementBand
            eyebrow="Brand statement"
            statement='"A plan only matters if you can follow it."'
            supporting="DayStack is not built to collect tasks. It is built to make the day feel visible, manageable, and honest."
          />
        </Reveal>
      </section>

      <section id="why-daystack" className="container-shell pb-18 sm:pb-24 lg:pb-28">
        <div className="grid gap-10 lg:grid-cols-[0.92fr_1.08fr] lg:items-start lg:gap-12">
          <Reveal className="lg:sticky lg:top-24">
            <SectionIntro
              eyebrow="Why DayStack"
              title="Less system. More control."
              copy="Plan clearly, see what matters, follow through, and let consistency build from the shape of the day instead of from guilt."
            />
          </Reveal>

          <div className="space-y-0">
            {whyRows.map((row, index) => (
              <Reveal key={row.title} delay={index * 90}>
                <div
                  className={cn(
                    "flex gap-4 py-4 sm:py-5",
                    index < whyRows.length - 1 && "border-b border-border/80",
                  )}
                >
                  <span className="inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-[linear-gradient(135deg,rgba(24,190,239,0.12),rgba(109,40,240,0.12))] text-primary">
                    <row.icon className="h-5 w-5" />
                  </span>
                  <div>
                    <h3 className="font-display text-[1.7rem] font-semibold text-foreground sm:text-2xl">
                      {row.title}
                    </h3>
                    <p className="mt-2 max-w-xl text-base leading-7 text-secondary-foreground sm:leading-8">
                      {row.copy}
                    </p>
                  </div>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      <section className="container-shell pb-18 sm:pb-24 lg:pb-28">
        <Reveal>
          <StatementBand
            align="left"
            eyebrow="Clarity changes the mood of the day"
            statement="Your time should feel visible."
            supporting="That is the shift. Less mental drag. Less hidden urgency. More calm momentum from the first block to the last."
          />
        </Reveal>

        <Reveal delay={120} className="mt-5 sm:mt-6">
          <div className="flex flex-wrap gap-3">
            {[
              "For people tired of chaotic systems",
              "For days that need structure",
              "For momentum that feels earned",
            ].map((item, index) => (
              <div
                key={item}
                className={cn(
                  "rounded-full border border-border/75 bg-white/84 px-4 py-2.5 text-sm font-medium text-secondary-foreground shadow-[0_12px_28px_rgba(15,23,42,0.05)]",
                  index === 0 && "float-slow",
                  index === 1 && "drift-slow",
                  index === 2 && "drift-slow-delayed",
                )}
              >
                {item}
              </div>
            ))}
          </div>
        </Reveal>
      </section>

      <section id="start" className="container-shell pb-14 sm:pb-16">
        <Reveal>
          <div className="relative overflow-hidden rounded-[34px] bg-[linear-gradient(135deg,#18beef_0%,#1496e8_38%,#6d28f0_100%)] px-5 py-8 text-white shadow-[0_28px_80px_rgba(49,86,212,0.24)] sm:rounded-[38px] sm:px-10 sm:py-12">
            <div className="absolute inset-y-0 right-0 hidden w-[30rem] bg-[radial-gradient(circle_at_center,rgba(255,255,255,0.18),transparent_60%)] lg:block" />
            <div className="relative flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between lg:gap-8">
              <div className="max-w-2xl">
                <p className="section-label text-white/72">Ready to start</p>
                <h2 className="mt-3 font-display text-[2.5rem] font-semibold tracking-[-0.05em] sm:mt-4 sm:text-5xl">
                  Structure your day. Follow through.
                </h2>
                <p className="mt-3 max-w-2xl text-base leading-7 text-white/84 sm:mt-4 sm:text-lg sm:leading-8">
                  Create an account, plan the day clearly, and let DayStack keep the shape of it honest.
                </p>
              </div>

              <div className="flex flex-col gap-3 sm:flex-row">
                <Link
                  href="/signup"
                  className={buttonVariants({
                    className:
                      "w-full sm:w-auto !border-white/80 !bg-white !text-foreground hover:!bg-white/92 [&_svg]:!text-foreground",
                  })}
                >
                  Create account
                  <ArrowRight className="h-4 w-4" />
                </Link>
                <Link
                  href="/login"
                  className={buttonVariants({
                    variant: "ghost",
                    className: "w-full border border-white/22 text-white hover:bg-white/12 hover:text-white sm:w-auto",
                  })}
                >
                  Log in
                </Link>
              </div>
            </div>
          </div>
        </Reveal>
      </section>

      <footer className="container-shell">
        <div className="flex flex-col gap-5 border-t border-border/80 py-7 text-sm text-secondary-foreground lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
            <Logo />
            <div className="hidden h-5 w-px bg-border sm:block" />
            <p>A calmer way to take control of your day.</p>
          </div>

          <div className="flex flex-wrap items-center gap-5">
            {navItems.map((item) => (
              <a key={item.href} href={item.href} className="transition hover:text-foreground">
                {item.label}
              </a>
            ))}
            <Link href="/login" className="transition hover:text-foreground">
              Login
            </Link>
            <Link href="/signup" className="transition hover:text-foreground">
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
