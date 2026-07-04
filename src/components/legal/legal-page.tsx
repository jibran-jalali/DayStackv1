import Link from "next/link";

import { Logo } from "@/components/shared/logo";

interface LegalSection {
  body: string[];
  title: string;
}

interface LegalPageProps {
  description: string;
  effectiveDate: string;
  sections: LegalSection[];
  title: string;
}

export function LegalPage({ description, effectiveDate, sections, title }: LegalPageProps) {
  return (
    <main className="min-h-screen bg-[linear-gradient(180deg,#f8fafc_0%,#eef3f8_100%)]">
      <header className="border-b border-white/80 bg-white/82 backdrop-blur-xl">
        <div className="container-shell flex items-center justify-between py-4">
          <Logo priority />
          <Link
            href="/"
            className="rounded-full border border-border/80 bg-white px-4 py-2 text-sm font-semibold text-foreground shadow-[0_10px_24px_rgba(15,23,42,0.05)]"
          >
            Home
          </Link>
        </div>
      </header>

      <section className="container-shell py-10 sm:py-14">
        <article className="mx-auto max-w-4xl rounded-[30px] border border-white/85 bg-white/94 p-6 shadow-[0_24px_70px_rgba(15,23,42,0.08)] sm:p-9">
          <p className="section-label">DayStack legal</p>
          <h1 className="mt-3 font-display text-[2.35rem] font-semibold leading-tight tracking-[-0.055em] text-foreground sm:text-[3.2rem]">
            {title}
          </h1>
          <p className="mt-4 text-base leading-7 text-secondary-foreground">{description}</p>
          <p className="mt-4 text-sm font-medium text-secondary-foreground">Effective date: {effectiveDate}</p>

          <div className="mt-8 space-y-7">
            {sections.map((section) => (
              <section key={section.title} className="border-t border-border/70 pt-6">
                <h2 className="font-display text-xl font-semibold tracking-[-0.035em] text-foreground">
                  {section.title}
                </h2>
                <div className="mt-3 space-y-3 text-sm leading-7 text-secondary-foreground sm:text-base">
                  {section.body.map((paragraph) => (
                    <p key={paragraph}>{paragraph}</p>
                  ))}
                </div>
              </section>
            ))}
          </div>
        </article>
      </section>
    </main>
  );
}
