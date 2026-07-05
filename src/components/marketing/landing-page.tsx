import Link from "next/link";
import { ArrowRight, Bot, CalendarCheck, MessageSquareText, RefreshCw, Star, UsersRound, Zap } from "lucide-react";

import { Logo, LogoMark } from "@/components/shared/logo";
import type { LeaderboardEntry } from "@/types/daystack";

function BrowserPreview() {
  const timeSlots = ["1 PM", "1:30", "2 PM", "2:30", "3 PM", "3:30", "4 PM"];

  return (
    <div className="w-[580px] max-w-[calc(100vw-34px)] scale-[0.7] overflow-hidden rounded-[14px] border border-[#9aa3ad]/60 bg-white shadow-[0_28px_80px_rgba(15,23,42,0.18)] backdrop-blur-sm sm:scale-80 md:scale-90 lg:scale-95">
      <div className="flex h-10 items-center gap-4 border-b border-[#6d7480]/45 bg-white px-5 sm:h-[46px]">
        <div className="flex gap-1.5">
          <span className="h-3 w-3 rounded-full bg-[#ed6258]" />
          <span className="h-3 w-3 rounded-full bg-[#f4bd4f]" />
          <span className="h-3 w-3 rounded-full bg-[#61c554]" />
        </div>
        <div className="ml-auto h-6 w-[48%] rounded-md bg-[#f0f0f0]" />
      </div>

      <div className="relative h-[260px] overflow-hidden bg-white sm:h-[300px]">
        <div className="absolute inset-x-0 top-0 z-10 rounded-b-[20px] border-b border-[#e3eaf3] bg-white/92 px-5 py-3 shadow-[0_18px_50px_rgba(15,23,42,0.08)] backdrop-blur-[18px] sm:px-7 sm:py-4">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <LogoMark className="h-7 w-7 rounded-[9px] sm:h-8 sm:w-8" />
              <span className="font-display text-lg font-bold tracking-[-0.05em] text-[#141923] sm:text-xl">DayStack</span>
            </div>
            <div className="hidden sm:block">
              <p className="text-[10px] font-bold uppercase tracking-[0.32em] text-[#9aa3b2]">Past Day</p>
              <p className="text-sm font-semibold tracking-[-0.03em] text-[#667084]">Friday, May 29, 2026</p>
            </div>
          </div>

          <div className="mt-3 flex min-w-max gap-2">
            {[
              ["Grid", true],
              ["List", false],
              ["Recurring", false],
              ["Leaderboard", false],
              ["Assistant", false],
            ].map(([label, active]) => (
              <div
                key={String(label)}
                className={
                  active
                    ? "rounded-[12px] bg-[linear-gradient(135deg,#28b4ea,#6c31ef)] px-5 py-2 text-xs font-semibold text-white shadow-[0_12px_24px_rgba(79,89,239,0.24)] sm:text-sm sm:px-6 sm:py-2.5"
                    : "rounded-[12px] border border-[#dfe7f2] bg-white px-5 py-2 text-xs font-semibold text-[#667084] shadow-[0_10px_24px_rgba(15,23,42,0.05)] sm:text-sm sm:px-6 sm:py-2.5"
                }
              >
                {String(label)}
              </div>
            ))}
          </div>

          <div className="mt-2 flex items-center gap-2">
            <div className="daystack-btn-glow relative rounded-[12px] bg-[linear-gradient(135deg,#28b4ea,#6c31ef)] px-4 py-2 text-xs font-semibold text-white shadow-[0_10px_20px_rgba(79,89,239,0.22)] sm:text-sm sm:px-5 sm:py-2.5">
              + Add Block
              <span className="daystack-click-ripple absolute inset-0 rounded-[12px]" />
            </div>
          </div>
        </div>

        <div className="daystack-cursor absolute z-20 h-6 w-6 sm:h-7 sm:w-7">
          <svg viewBox="0 0 24 24" fill="white" className="drop-shadow-md">
            <path d="M4 3l15 11.9-6.4.6 2.8 6.1-2.5 1-2.8-6.1L4 21V3z" fill="black" stroke="white" strokeWidth="1.2" />
          </svg>
        </div>

        <div className="absolute inset-x-0 bottom-0 top-[118px] grid grid-cols-[56px_1fr] bg-[#fbfdff] sm:top-[130px] sm:grid-cols-[64px_1fr] sm:bottom-0">
          <div className="border-r border-[#dce5ef] bg-white/80 pt-2 text-right">
            {timeSlots.map((time) => (
              <div key={time} className="h-[28px] pr-4 text-[10px] font-semibold tracking-[-0.02em] text-[#6c7585] sm:h-[32px] sm:pr-5 sm:text-xs">
                {time}
              </div>
            ))}
          </div>
          <div className="relative overflow-hidden">
            <div className="daystack-preview-scan absolute left-0 right-0 top-0 z-10 h-px bg-[#0084ff]/50 shadow-[0_0_12px_rgba(0,132,255,0.5)]" />
            {timeSlots.map((time) => (
              <div key={time} className="h-[28px] border-b border-dashed border-[#dce5ef] sm:h-[32px]" />
            ))}
            <div className="daystack-preview-float-1 absolute left-3 top-[38px] h-[44px] w-[38%] rounded-[14px] border border-[#f5cbd5] bg-[#fff2f5] p-2 shadow-[0_8px_20px_rgba(244,92,128,0.08)] sm:left-4 sm:top-[44px] sm:h-[52px] sm:w-[40%] sm:p-3">
              <div className="daystack-preview-pulse absolute bottom-2 left-2 top-2 w-1 rounded-full bg-[#ff4f7a] sm:bottom-2.5 sm:left-2.5 sm:top-2.5" />
              <p className="pl-4 text-[10px] font-bold text-[#d6255b] sm:pl-5 sm:text-xs">can u block</p>
            </div>
            <div className="daystack-preview-float-2 absolute left-[48%] top-[40px] h-[78px] w-[40%] rounded-[14px] border border-[#f5cbd5] bg-[#fff2f5] p-2 shadow-[0_8px_20px_rgba(244,92,128,0.08)] sm:left-[48%] sm:top-[46px] sm:h-[90px] sm:w-[42%] sm:p-3">
              <div className="daystack-preview-pulse absolute bottom-2 left-2 top-2 w-1 rounded-full bg-[#ff4f7a] sm:bottom-2.5 sm:left-2.5 sm:top-2.5" />
              <p className="pl-4 text-[10px] font-bold text-[#d6255b] sm:pl-5 sm:text-xs">task</p>
            </div>
            <div className="daystack-preview-float-3 absolute left-3 top-[106px] h-[48px] w-[38%] rounded-[14px] border border-[#f5cbd5] bg-[#fff2f5] p-2 shadow-[0_8px_20px_rgba(244,92,128,0.08)] sm:left-4 sm:top-[122px] sm:h-[56px] sm:w-[40%] sm:p-3">
              <div className="daystack-preview-pulse absolute bottom-2 left-2 top-2 w-1 rounded-full bg-[#ff4f7a] sm:bottom-2.5 sm:left-2.5 sm:top-2.5" />
              <p className="pl-4 text-[10px] font-bold text-[#d6255b] sm:pl-5 sm:text-xs">test</p>
            </div>
            <div className="daystack-new-block absolute left-[3%] top-[66px] z-10 h-[44px] w-[44%] rounded-[14px] border border-[#bdeedc] bg-[#effdf6] p-2 shadow-[0_8px_20px_rgba(28,184,125,0.08)] sm:left-[3%] sm:top-[76px] sm:h-[52px] sm:w-[46%] sm:p-3">
              <div className="absolute bottom-2 left-2 top-2 w-1 rounded-full bg-[#45e0a2] sm:bottom-2.5 sm:left-2.5 sm:top-2.5" />
              <p className="pl-4 text-[10px] font-bold text-[#2e8a68] sm:pl-5 sm:text-xs">workflow task</p>
              <p className="pl-4 text-[9px] font-medium text-[#667084] sm:pl-5 sm:text-[10px]">12:30 PM — 1:30 PM</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function MotionDayPreview() {
  const timelineRows = ["7:30", "8 AM", "8:30", "9 AM", "9:30", "10 AM", "10:30", "11 AM", "11:30", "12 PM"];
  const blocks = [
    { title: "review notes", time: "8:00 AM — 9:00 AM", top: "13%", left: "3%", width: "92%", height: "15%", tone: "done" as const, delay: "0s" },
    { title: "study", time: "9:15 AM — 10:45 AM", top: "35%", left: "3%", width: "92%", height: "23%", tone: "done" as const, delay: ".35s" },
    { title: "gym", time: "11:00 AM", top: "66%", left: "3%", width: "45%", height: "22%", tone: "focus" as const, delay: ".7s" },
    { title: "lunch", time: "11:30 AM", top: "74%", left: "50%", width: "45%", height: "16%", tone: "focus" as const, delay: "1.05s" },
  ];

  return (
    <section className="relative mx-auto mt-20 w-full max-w-[1500px] px-4 pb-10 sm:px-8 lg:px-14">
      <div className="relative overflow-hidden rounded-[24px] border border-black/[0.06] bg-[#fff4f4] px-3 py-10 shadow-[inset_0px_4px_4px_0px_rgba(255,255,255,0.5),0_30px_100px_rgba(15,23,42,0.08)] sm:rounded-[34px] sm:px-6 sm:py-12 lg:px-12">
        <div className="pointer-events-none absolute left-1/2 top-10 h-[320px] w-[560px] -translate-x-1/2 rounded-full bg-[#60B1FF]/16 blur-[120px] sm:h-[420px] sm:w-[760px]" />

        <div className="relative z-10 mx-auto mb-6 max-w-3xl text-center sm:mb-8">
          <p className="text-xs font-bold uppercase tracking-[0.28em] text-[#0084ff]/70 sm:text-sm">DayStack in motion</p>
          <h2 className="mt-3 font-display text-[28px] font-bold leading-[1.02] tracking-[-1.5px] text-[#07111f] sm:text-[38px] sm:mt-4 lg:text-[48px]">
            See your day become a clear execution map
          </h2>
          <p className="mx-auto mt-4 max-w-2xl text-sm leading-6 tracking-[-0.04em] text-[#344155]/72 sm:text-base sm:leading-7 sm:mt-5">
            Drop tasks into time blocks, track what is done, and keep the next move visible from morning to night.
          </p>
        </div>

        {/* Mobile: horizontally scrollable card view */}
        <div className="relative z-10 block sm:hidden">
          <div className="flex gap-3 overflow-x-auto pb-4 snap-x snap-mandatory scrollbar-none" style={{ scrollbarWidth: "none" }}>
            {blocks.map((block, i) => (
              <div
                key={block.title}
                className={`snap-center shrink-0 w-[260px] rounded-[20px] border p-5 ${
                  block.tone === "done"
                    ? "border-[#bdeedc] bg-[#effdf6]"
                    : "border-[#f5cbd5] bg-[#fff2f5]"
                } ${i === 0 ? "daystack-motion-float" : i === 1 ? "daystack-motion-float-delayed" : "daystack-motion-float"}`}
                style={{ animationDelay: block.delay }}
              >
                <div className="flex items-start gap-4">
                  <div className={`mt-1 h-3 w-3 shrink-0 rounded-full ${block.tone === "done" ? "bg-[#45e0a2]" : "bg-[#ff4f7a]"} daystack-glow-pulse`} />
                  <div>
                    <p className={`text-base font-bold ${block.tone === "done" ? "text-[#2e8a68]" : "text-[#d6255b]"}`}>
                      {block.title}
                    </p>
                    <p className="mt-1 text-sm font-medium text-[#667084]">{block.time}</p>
                    <div className="mt-3 h-2 w-full rounded-full bg-black/5 overflow-hidden">
                      <div className={`h-full rounded-full ${block.tone === "done" ? "bg-[#45e0a2]" : "bg-[#ff4f7a]"} daystack-progress-fill`} style={{ width: block.tone === "done" ? "85%" : "40%" }} />
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
          <div className="flex justify-center gap-2 mt-3">
            {blocks.map((_, i) => (
              <span key={i} className={`h-2 w-2 rounded-full ${i === 0 ? "bg-[#0084ff]" : "bg-black/10"}`} />
            ))}
          </div>
        </div>

        {/* Desktop: full timeline preview */}
        <div className="relative z-10 mx-auto hidden max-w-[1200px] overflow-hidden rounded-[8px] border border-black/30 bg-white shadow-[0_34px_80px_rgba(0,0,0,0.22)] sm:block">
          <div className="flex h-10 items-center gap-4 bg-[#151a1f] px-4 text-[#8f98a5]">
            <div className="flex gap-2">
              <span className="h-2.5 w-2.5 rounded-full bg-[#ff6b5f]" />
              <span className="h-2.5 w-2.5 rounded-full bg-[#f7c84f]" />
              <span className="h-2.5 w-2.5 rounded-full bg-[#65d064]" />
            </div>
            <div className="hidden gap-3 text-lg leading-none sm:flex">
              <span>‹</span>
              <span>›</span>
            </div>
            <div className="mx-auto h-6 w-[34%] rounded bg-[#0c1116]" />
            <div className="hidden gap-4 text-lg sm:flex">
              <span>↓</span>
              <span>↥</span>
              <span>+</span>
            </div>
          </div>

          <div className="relative h-[480px] overflow-hidden bg-[linear-gradient(90deg,#eefbff_0,#fff_12%,#fff_88%,#f5f0ff_100%)] sm:h-[560px]">
            <div className="absolute left-[9%] right-[7%] top-2 z-20 rounded-b-[28px] rounded-t-[22px] border border-[#dfe7f2] bg-white/92 px-5 py-4 shadow-[0_24px_70px_rgba(15,23,42,0.09)] backdrop-blur-[18px] sm:px-7 sm:py-5">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="flex items-center gap-4">
                  <LogoMark className="h-10 w-10 rounded-[13px] sm:h-11 sm:w-11" />
                  <div>
                    <p className="font-display text-xl font-bold tracking-[-0.05em] text-[#141923] sm:text-2xl">DayStack</p>
                    <p className="mt-1 text-xs font-bold uppercase tracking-[0.28em] text-[#9aa3b2]">Today</p>
                    <p className="text-sm font-semibold tracking-[-0.03em] text-[#667084]">Sunday, June 7, 2026</p>
                  </div>
                </div>
                <div className="flex gap-2 text-xs font-bold">
                  <span className="rounded-full bg-[#fff8dd] px-3 py-1.5 text-[#c86b09] sm:px-4 sm:py-2">68% score</span>
                  <span className="rounded-full border border-[#dfe7f2] px-3 py-1.5 text-[#667084] sm:px-4 sm:py-2">3 days</span>
                </div>
              </div>
            </div>

            <div className="absolute bottom-0 left-[13%] right-[9%] top-[155px] grid grid-cols-[64px_1fr] sm:top-[185px] sm:grid-cols-[74px_1fr]">
              <div className="border-r border-[#dce5ef] bg-white/64 pt-2 text-right">
                {timelineRows.map((row) => (
                  <div key={row} className="h-[42px] pr-4 text-xs font-bold text-[#6c7585] sm:h-[48px] sm:pr-5 sm:text-sm">
                    {row}
                  </div>
                ))}
              </div>
              <div className="relative overflow-hidden bg-white/55">
                {timelineRows.map((row) => (
                  <div key={row} className="h-[42px] border-b border-dashed border-[#dce5ef] sm:h-[48px]" />
                ))}
                <div className="daystack-scan-line-fast absolute left-0 right-0 top-0 h-px bg-[#0084ff]/55 shadow-[0_0_18px_rgba(0,132,255,0.65)]" />
                {blocks.map((block) => (
                  <div
                    key={block.title}
                    className={`daystack-card-enter absolute rounded-[18px] border p-3 shadow-[0_12px_30px_rgba(0,0,0,0.08)] sm:p-4 ${
                      block.tone === "done"
                        ? "border-[#bdeedc] bg-[#effdf6]"
                        : "border-[#f5cbd5] bg-[#fff2f5]"
                    } ${block.tone === "done" ? "daystack-motion-float" : "daystack-motion-float-delayed"}`}
                    style={{
                      top: block.top,
                      left: block.left,
                      width: block.width,
                      height: block.height,
                      animationDelay: block.delay,
                    }}
                  >
                    <div className={`absolute bottom-2 left-2 top-2 w-1.5 rounded-full sm:bottom-3 sm:left-3 sm:top-3 ${
                      block.tone === "done" ? "bg-[#45e0a2]" : "bg-[#ff4f7a]"
                    } daystack-glow-pulse`} />
                    <p className={`pl-4 text-xs font-bold sm:pl-5 sm:text-sm ${
                      block.tone === "done" ? "text-[#2e8a68]" : "text-[#d6255b]"
                    }`}>
                      {block.title}
                    </p>
                    <p className="pl-4 text-[10px] font-medium text-[#667084] sm:pl-5 sm:text-xs">{block.time}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="absolute inset-x-0 bottom-0 z-30 bg-[linear-gradient(180deg,transparent,rgba(255,244,244,0.92))] px-6 pb-6 pt-24 text-center sm:pb-7 sm:pt-28">
              <div className="mx-auto max-w-2xl rounded-[24px] border border-white/70 bg-white/45 px-5 py-4 shadow-[inset_0px_4px_4px_0px_rgba(255,255,255,0.3),0_24px_70px_rgba(15,23,42,0.1)] backdrop-blur-[28px] sm:px-6 sm:py-5">
                <p className="font-display text-xl font-bold tracking-[-0.06em] text-[#07111f] sm:text-2xl lg:text-3xl">
                  One surface for every commitment.
                </p>
                <p className="mt-1 text-sm leading-6 tracking-[-0.03em] text-[#344155]/74 sm:mt-2 sm:text-base">
                  DayStack helps you see when work happens, not just what needs doing.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function FeatureShowcase() {
  const features = [
    {
      icon: Bot,
      eyebrow: "DayStack AI",
      title: "Plans your tasks at the right time.",
      description: "Add tasks with durations and DayStack AI turns them into a productivity-aware timeline before you confirm.",
      preview: (
        <div className="space-y-2">
          {["Calculus", "Gym", "Lunch", "Review"].map((task, index) => (
            <div key={task} className="flex items-center justify-between rounded-[14px] border border-white/70 bg-white/82 px-3 py-2 shadow-[0_8px_22px_rgba(15,23,42,0.05)]">
              <span className="flex items-center gap-2 text-sm font-semibold text-[#172033]">
                <span className={`h-2.5 w-2.5 rounded-full ${index === 0 ? "bg-[#7c3cff]" : index === 1 ? "bg-[#16a5f5]" : index === 2 ? "bg-[#10b981]" : "bg-[#ff8a00]"}`} />
                {task}
              </span>
              <span className="text-xs font-bold text-[#667084]">{["09:00", "15:30", "13:00", "16:45"][index]}</span>
            </div>
          ))}
        </div>
      ),
    },
    {
      icon: UsersRound,
      eyebrow: "Friends",
      title: "Only trusted people can be tagged.",
      description: "Send requests, accept connections, and keep meeting mentions limited to people you actually know.",
      preview: (
        <div className="grid gap-2">
          {["Jibran", "Ayesha", "Hamza"].map((name, index) => (
            <div key={name} className="flex items-center gap-3 rounded-[16px] border border-white/70 bg-white/82 px-3 py-2.5 shadow-[0_8px_22px_rgba(15,23,42,0.05)]">
              <span className="grid h-9 w-9 place-items-center rounded-full bg-[linear-gradient(135deg,#28b4ea,#6c31ef)] text-xs font-bold text-white">{name.charAt(0)}</span>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-[#172033]">{name}</p>
                <p className="text-xs text-[#667084]">{index === 0 ? "Accepted" : "Ready for meetings"}</p>
              </div>
              <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-[10px] font-bold text-emerald-700">Friend</span>
            </div>
          ))}
        </div>
      ),
    },
    {
      icon: MessageSquareText,
      eyebrow: "Meeting mentions",
      title: "Approvals become blocks instantly.",
      description: "When a friend tags you in a meeting, accept it once and DayStack places it directly on your timeline.",
      preview: (
        <div className="rounded-[18px] border border-[#dbeafe] bg-[#eff8ff] p-4 shadow-[0_10px_26px_rgba(37,99,235,0.08)]">
          <div className="flex items-start gap-3">
            <span className="grid h-10 w-10 place-items-center rounded-full bg-white text-[#168fea] shadow-[0_8px_20px_rgba(15,23,42,0.06)]">
              <CalendarCheck className="h-5 w-5" />
            </span>
            <div>
              <p className="text-sm font-bold text-[#172033]">Design sync</p>
              <p className="mt-1 text-xs leading-5 text-[#667084]">Mention from Ayesha · 2:30 PM</p>
              <div className="mt-3 flex gap-2">
                <span className="rounded-full bg-[linear-gradient(135deg,#28b4ea,#6c31ef)] px-3 py-1.5 text-xs font-bold text-white">Accept</span>
                <span className="rounded-full border border-[#cfe3f8] bg-white px-3 py-1.5 text-xs font-bold text-[#667084]">Review</span>
              </div>
            </div>
          </div>
        </div>
      ),
    },
  ];

  return (
    <section className="relative mx-auto w-full max-w-[1500px] px-4 pb-24 pt-4 sm:px-8 lg:px-14">
      <div className="relative overflow-hidden rounded-[28px] border border-black/[0.06] bg-[linear-gradient(135deg,#f8fbff,#f7f1ff)] px-4 py-10 shadow-[0_30px_100px_rgba(15,23,42,0.08)] sm:rounded-[36px] sm:px-7 sm:py-14 lg:px-12">
        <div className="pointer-events-none absolute -left-20 top-10 h-72 w-72 rounded-full bg-[#28b4ea]/16 blur-[90px]" />
        <div className="pointer-events-none absolute -right-20 bottom-0 h-80 w-80 rounded-full bg-[#6c31ef]/14 blur-[100px]" />

        <div className="relative z-10 mx-auto max-w-3xl text-center">
          <p className="text-xs font-bold uppercase tracking-[0.28em] text-[#0084ff]/70 sm:text-sm">Built for real planning</p>
          <h2 className="mt-3 font-display text-[30px] font-bold leading-[1.04] tracking-[-1.6px] text-[#07111f] sm:text-[42px] lg:text-[52px]">
            AI, friends, and meetings in one workflow
          </h2>
          <p className="mx-auto mt-4 max-w-2xl text-sm leading-6 tracking-[-0.03em] text-[#344155]/72 sm:text-base sm:leading-7">
            DayStack keeps scheduling, collaboration, and execution connected without sending you across different tools.
          </p>
        </div>

        <div className="relative z-10 mt-9 grid gap-4 lg:grid-cols-3">
          {features.map((feature, index) => {
            const Icon = feature.icon;

            return (
              <article
                key={feature.eyebrow}
                className="daystack-card-enter daystack-motion-float rounded-[24px] border border-white/72 bg-white/70 p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.7),0_22px_70px_rgba(15,23,42,0.08)] backdrop-blur-[28px]"
                style={{ animationDelay: `${index * 0.18}s` }}
              >
                <div className="mb-5 flex items-center justify-between">
                  <span className="grid h-11 w-11 place-items-center rounded-[14px] bg-[linear-gradient(135deg,#28b4ea,#6c31ef)] text-white shadow-[0_12px_28px_rgba(79,89,239,0.22)]">
                    <Icon className="h-5 w-5" />
                  </span>
                  <span className="rounded-full border border-[#dfe7f2] bg-white/80 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.16em] text-[#667084]">
                    {feature.eyebrow}
                  </span>
                </div>
                <h3 className="font-display text-xl font-bold leading-tight tracking-[-0.05em] text-[#07111f]">
                  {feature.title}
                </h3>
                <p className="mt-2 text-sm leading-6 text-[#344155]/72">{feature.description}</p>
                <div className="mt-5">{feature.preview}</div>
              </article>
            );
          })}
        </div>
      </div>
    </section>
  );
}

function GoogleCalendarSyncSection() {
  const googleEvents = [
    { color: "#4285F4", time: "10:00", title: "Product sync" },
    { color: "#34A853", time: "13:00", title: "Lunch with team" },
    { color: "#FBBC05", time: "16:30", title: "Client review" },
  ];
  const dayStackBlocks = [
    { color: "#28b4ea", time: "10:00 AM", title: "Product sync" },
    { color: "#10b981", time: "1:00 PM", title: "Lunch with team" },
    { color: "#6c31ef", time: "4:30 PM", title: "Client review" },
  ];

  return (
    <section className="relative mx-auto w-full max-w-[1500px] px-4 pb-24 sm:px-8 lg:px-14">
      <div className="relative overflow-hidden rounded-[30px] border border-black/[0.06] bg-[#07111f] px-4 py-10 shadow-[0_34px_110px_rgba(7,17,31,0.18)] sm:rounded-[40px] sm:px-8 sm:py-14 lg:px-12">
        <div className="pointer-events-none absolute left-[-10%] top-[-20%] h-[28rem] w-[28rem] rounded-full bg-[#4285F4]/20 blur-[110px]" />
        <div className="pointer-events-none absolute bottom-[-20%] right-[-10%] h-[30rem] w-[30rem] rounded-full bg-[#34A853]/14 blur-[120px]" />

        <div className="relative z-10 grid items-center gap-10 lg:grid-cols-[0.9fr_1.1fr]">
          <div>
            <span className="inline-flex items-center gap-2 rounded-full border border-white/12 bg-white/8 px-3 py-1.5 text-xs font-bold uppercase tracking-[0.18em] text-white/70">
              <RefreshCw className="h-3.5 w-3.5" />
              Live sync
            </span>
            <h2 className="mt-5 font-display text-[32px] font-bold leading-[1.03] tracking-[-0.06em] text-white sm:text-[44px] lg:text-[56px]">
              Google Calendar events, synced into your day plan.
            </h2>
            <p className="mt-4 max-w-xl text-sm leading-7 text-white/68 sm:text-base">
              Connect Google Calendar once. DayStack imports visible events into your timeline so meetings, calls, and commitments sit beside your planned work.
            </p>
            <div className="mt-6 grid gap-3 sm:grid-cols-3">
              {["Import events", "Keep context", "Plan around meetings"].map((label) => (
                <div key={label} className="rounded-[16px] border border-white/10 bg-white/[0.06] px-3 py-3 text-sm font-semibold text-white/82 backdrop-blur-xl">
                  <Zap className="mb-2 h-4 w-4 text-[#8bd8ff]" />
                  {label}
                </div>
              ))}
            </div>
          </div>

          <div className="relative mx-auto w-full max-w-[680px]">
            <div className="absolute left-1/2 top-1/2 h-32 w-32 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white/10 blur-3xl" />
            <div className="grid gap-4 md:grid-cols-[1fr_4rem_1fr] md:items-center">
              <div className="daystack-motion-float rounded-[24px] border border-white/12 bg-white/[0.08] p-4 shadow-[0_24px_70px_rgba(0,0,0,0.22)] backdrop-blur-2xl">
                <div className="mb-4 flex items-center gap-3">
                  <span className="grid h-10 w-10 place-items-center rounded-[13px] bg-white text-lg font-black">
                    <span className="bg-[linear-gradient(135deg,#4285F4,#34A853,#FBBC05,#EA4335)] bg-clip-text text-transparent">G</span>
                  </span>
                  <div>
                    <p className="text-sm font-bold text-white">Google Calendar</p>
                    <p className="text-xs text-white/50">Today</p>
                  </div>
                </div>
                <div className="space-y-2">
                  {googleEvents.map((event, index) => (
                    <div key={event.title} className="daystack-sync-item rounded-[16px] border border-white/10 bg-white/[0.07] px-3 py-2.5" style={{ animationDelay: `${index * 0.18}s` }}>
                      <div className="flex items-center gap-2">
                        <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: event.color }} />
                        <p className="text-sm font-bold text-white">{event.title}</p>
                      </div>
                      <p className="mt-1 pl-4 text-xs text-white/50">{event.time}</p>
                    </div>
                  ))}
                </div>
              </div>

              <div className="relative hidden h-24 justify-center md:flex">
                <span className="daystack-sync-beam absolute left-[-1.5rem] right-[-1.5rem] top-1/2 h-px bg-[linear-gradient(90deg,transparent,rgba(139,216,255,0.88),transparent)]" />
                <span className="daystack-sync-dot absolute top-1/2 h-2.5 w-2.5 -translate-y-1/2 rounded-full bg-[#8bd8ff] shadow-[0_0_18px_rgba(139,216,255,0.9)]" />
                <div className="relative z-10 grid h-16 w-16 place-items-center self-center rounded-full border border-white/12 bg-white/[0.08] text-white shadow-[0_20px_60px_rgba(40,180,234,0.18)] backdrop-blur-xl">
                  <RefreshCw className="h-6 w-6 animate-spin [animation-duration:2.8s]" />
                </div>
              </div>

              <div className="daystack-motion-float-delayed rounded-[24px] border border-white/14 bg-white/[0.11] p-4 shadow-[0_24px_70px_rgba(0,0,0,0.22)] backdrop-blur-2xl">
                <div className="mb-4 flex items-center gap-3">
                  <LogoMark className="h-10 w-10 rounded-[13px]" />
                  <div>
                    <p className="text-sm font-bold text-white">DayStack timeline</p>
                    <p className="text-xs text-white/50">Synced blocks</p>
                  </div>
                </div>
                <div className="space-y-2">
                  {dayStackBlocks.map((block, index) => (
                    <div key={block.title} className="daystack-sync-item relative rounded-[16px] border border-white/12 bg-white/[0.08] px-3 py-2.5 pl-4" style={{ animationDelay: `${0.28 + index * 0.18}s` }}>
                      <span className="absolute bottom-2 left-2 top-2 w-1 rounded-full" style={{ backgroundColor: block.color }} />
                      <p className="text-sm font-bold text-white">{block.title}</p>
                      <p className="mt-1 text-xs text-white/50">{block.time}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="mt-4 rounded-[18px] border border-emerald-300/20 bg-emerald-300/10 px-4 py-3 text-sm font-semibold text-emerald-100 backdrop-blur-xl">
              <CalendarCheck className="mr-2 inline h-4 w-4" />
              Live calendar context stays visible while you build the rest of your day.
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

const companies = [
  { name: "Basecamp", color: "#1DED83", svg: "M7 17l5-8 5 8" },
  { name: "Mailchimp", color: "#FFE01B", svg: "M4 6h16v12H4V6zm2 2l6 5 6-5" },
  { name: "Sketch", color: "#F7B500", svg: "M12 4l8 6-4 10H8L4 10l8-6z" },
  { name: "Notion", color: "#000000", svg: "M5 5h14v14H5V5zm2 2v10h10V7H7z" },
  { name: "Figma", color: "#F24E1E", svg: "M12 12a4 4 0 110-8 4 4 0 010 8zm0 0v8" },
  { name: "Linear", color: "#5E6AD2", svg: "M4 20L20 4M4 4h16v16" },
  { name: "Vercel", color: "#000000", svg: "M12 2L2 22h20L12 2z" },
  { name: "Raycast", color: "#FF6363", svg: "M12 2l3 7h7l-5.5 4 2 7L12 16l-5.5 4 2-7L3 9h7l3-7z" },
  { name: "Supabase", color: "#3ECF8E", svg: "M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" },
  { name: "Cal.com", color: "#292929", svg: "M8 4v16M16 4v16M4 8h16M4 16h16" },
];

export function LandingPage({ leaderboard }: { leaderboard: LeaderboardEntry[] }) {
  const ratedCustomerCount = Math.max(2700, leaderboard.length);

  return (
    <main className="relative min-h-screen overflow-hidden bg-white text-[#0b1220]">
      <div className="daystack-ambient-orb pointer-events-none absolute left-[-150px] top-[-180px] h-[520px] w-[640px] rounded-full bg-[#60B1FF]/35 blur-[120px]" />
      <div className="daystack-ambient-orb-delayed pointer-events-none absolute left-[90px] top-[-110px] h-[380px] w-[460px] rounded-full bg-[#319AFF]/24 blur-[105px]" />
      <div className="daystack-ambient-orb-slow pointer-events-none absolute left-[280px] top-[85px] h-[220px] w-[320px] rounded-full bg-[#60B1FF]/16 blur-[95px]" />

      <nav className="sticky top-[18px] z-30 mx-auto flex w-[calc(100vw-24px)] max-w-[calc(100vw-24px)] items-center justify-between gap-2 rounded-[16px] border border-[rgba(0,0,0,0.1)] bg-[rgba(255,255,255,0.34)] px-3 py-2 shadow-[inset_0px_4px_4px_0px_rgba(255,255,255,0.25),0_22px_60px_rgba(15,23,42,0.08)] backdrop-blur-[50px] sm:top-[30px] sm:w-fit sm:justify-center sm:gap-4 sm:px-4">
        <Logo className="px-0" priority />
        <Link
          href="/signin"
          className="hidden rounded-full px-3 py-2 text-sm font-medium tracking-[-0.02em] text-[#253041]/75 transition hover:text-[#0b1220] sm:inline-flex"
        >
          Sign in
        </Link>
        <Link
          href="/signup"
          className="flex items-center gap-2 rounded-[14px] border border-white/65 bg-white/35 py-1.5 pl-4 pr-1.5 text-sm font-medium tracking-[-0.02em] text-[#0b1220] shadow-[inset_0px_4px_4px_0px_rgba(255,255,255,0.35),0_14px_34px_rgba(15,23,42,0.08)] backdrop-blur-[18px] transition hover:scale-[1.02]"
        >
          Sign up
          <span className="grid h-8 w-8 place-items-center rounded-full bg-[#101827] text-white">
            <ArrowRight className="h-4 w-4" strokeWidth={2.4} />
          </span>
        </Link>
      </nav>

      <section className="relative z-10 mx-auto flex min-h-screen max-w-[1400px] flex-col items-center justify-center px-5 pb-8 pt-8 sm:px-8 lg:pt-12">
        <div className="grid w-full flex-1 items-center gap-8 lg:grid-cols-[1fr_1.1fr] lg:gap-12">
          <div className="flex flex-col items-center text-center lg:items-start lg:text-left">
            <div className="inline-flex items-center gap-2 rounded-full border border-black/10 bg-white/55 px-3 py-1.5 shadow-[0_18px_50px_rgba(15,23,42,0.06)] backdrop-blur-[22px] sm:px-4 sm:py-2">
              <span className="flex items-center gap-0.5 text-[#FF801E]">
                {Array.from({ length: 5 }).map((_, index) => (
                  <Star key={index} className="h-3.5 w-3.5 fill-current sm:h-4 sm:w-4" strokeWidth={1.8} />
                ))}
              </span>
              <span className="text-xs font-medium tracking-[-0.03em] text-[#253041]/80 sm:text-sm">
                Rated 4.9/5 by {ratedCustomerCount}+ focused planners
              </span>
            </div>

            <h1 className="mt-4 font-display text-[36px] font-bold leading-[1.05] tracking-[-2px] text-[#07111f] sm:text-[52px] lg:text-[64px]">
              Plan your day,<br />execute with <span className="daystack-gradient-text">clarity</span>
            </h1>

            <p className="mt-3 max-w-[520px] text-[15px] leading-7 tracking-[-1px] text-[#344155]/78 sm:text-[17px] sm:leading-8">
              DayStack turns tasks, meetings, and routines into a simple timeline so you can manage your day without the mental clutter.
            </p>

            <div className="mt-5 flex flex-col items-center gap-3 sm:flex-row sm:mt-6 lg:justify-start">
              <Link
                href="/signup"
                className="group flex items-center gap-3 rounded-[14px] bg-[rgba(0,132,255,0.8)] py-2.5 pl-5 pr-1.5 text-sm font-medium tracking-[-0.03em] text-white shadow-[inset_0px_4px_4px_0px_rgba(255,255,255,0.35),0_24px_50px_rgba(0,132,255,0.28)] backdrop-blur-[2px] transition duration-300 hover:scale-[1.02] sm:text-base sm:py-3 sm:pl-6 sm:pr-2"
              >
                Get Started Now
                <span className="grid h-7 w-7 place-items-center rounded-full bg-white text-[#0084ff] sm:h-8 sm:w-8">
                  <ArrowRight className="h-3.5 w-3.5 sm:h-4 sm:w-4" strokeWidth={2.4} />
                </span>
              </Link>
              <Link
                href="/signin"
                className="rounded-[14px] border border-black/10 bg-white/45 px-5 py-2.5 text-sm font-medium tracking-[-0.03em] text-[#0b1220] backdrop-blur-[18px] transition hover:bg-white/70 sm:text-base sm:px-6 sm:py-3"
              >
                Sign in
              </Link>
            </div>

            <div className="mt-5 flex flex-wrap justify-center gap-2 lg:justify-start">
              {[
                { text: "AI time blocking", icon: null },
                { text: "Live calendar sync", icon: <span className="mr-1 inline-flex h-4 w-4 items-center justify-center rounded-full bg-white text-[9px] font-black shadow-sm"><span className="bg-[linear-gradient(135deg,#4285F4,#34A853,#FBBC05,#EA4335)] bg-clip-text text-transparent">G</span></span> },
                { text: "Friend approvals", icon: null },
              ].map((pill, index) => (
                <span key={pill.text} className="daystack-micro-pill inline-flex items-center rounded-full border border-black/10 bg-white/55 px-3 py-1.5 text-xs font-bold text-[#344155]/74 shadow-[0_14px_34px_rgba(15,23,42,0.05)] backdrop-blur-[18px]" style={{ animationDelay: `${index * 0.2}s` }}>
                  {pill.icon}{pill.text}
                </span>
              ))}
            </div>
          </div>

          <div className="relative flex min-h-[280px] w-full items-center justify-center overflow-visible sm:min-h-[360px] lg:min-h-[460px]">
            <div className="absolute inset-0 rounded-full bg-[radial-gradient(circle,rgba(0,132,255,0.18),transparent_58%)] blur-3xl" />
            <video
              className="absolute z-0 h-[410px] w-[410px] scale-125 object-contain opacity-80 mix-blend-screen sm:h-[560px] sm:w-[560px] lg:h-[680px] lg:w-[680px]"
              src="https://future.co/images/homepage/glassy-orb/orb-purple.webm"
              autoPlay
              loop
              muted
              playsInline
              aria-hidden="true"
              style={{ filter: "hue-rotate(-55deg) saturate(250%) brightness(1.2) contrast(1.1)" }}
            />
            <BrowserPreview />
          </div>
        </div>
      </section>

      <section className="relative w-full bg-[#0b1220] py-10 sm:py-12">
        <div className="mx-auto max-w-[1400px] px-5 sm:px-8">
          <p className="mb-6 text-center text-xs font-bold uppercase tracking-[0.2em] text-white/40">Trusted by workers at</p>
          <div className="flex overflow-hidden">
            <div className="flex animate-marquee items-center gap-14 whitespace-nowrap">
              {[...companies, ...companies, ...companies, ...companies].map((c, i) => (
                <span key={`${c.name}-${i}`} className="inline-flex items-center gap-3 text-sm font-semibold text-white/80 sm:text-base">
                  <svg className="h-6 w-6 shrink-0 sm:h-7 sm:w-7" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                    <rect width="24" height="24" rx="5" fill={c.color} />
                    <path d={c.svg} stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                  {c.name}
                </span>
              ))}
            </div>
          </div>
        </div>
      </section>

      <MotionDayPreview />
      <FeatureShowcase />
      <GoogleCalendarSyncSection />
    </main>
  );
}
