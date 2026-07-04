import Link from "next/link";
import { LockKeyhole, Shield } from "lucide-react";
import { redirect } from "next/navigation";

import { AdminLoginForm } from "@/components/admin/admin-login-form";
import { buttonVariants } from "@/components/shared/button";
import { Logo } from "@/components/shared/logo";
import { SetupNotice } from "@/components/shared/setup-notice";
import { isAdminAuthenticated, isAdminConfigured } from "@/lib/admin/auth";

export const metadata = {
  title: "Admin Login",
};

export const dynamic = "force-dynamic";

export default async function AdminLoginPage() {
  if (await isAdminAuthenticated()) {
    redirect("/admin");
  }

  return (
    <main className="relative min-h-screen overflow-hidden">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-[28rem] bg-[radial-gradient(circle_at_18%_18%,rgba(24,190,239,0.16),transparent_32%),radial-gradient(circle_at_82%_12%,rgba(109,40,240,0.14),transparent_26%)]" />
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-[24rem] bg-[radial-gradient(circle_at_64%_74%,rgba(24,190,239,0.1),transparent_28%),radial-gradient(circle_at_14%_88%,rgba(109,40,240,0.1),transparent_24%)]" />

      <div className="container-shell relative py-4 sm:py-6">
        <div className="flex items-center justify-between gap-4">
          <Logo priority />
          <Link href="/" className={buttonVariants({ variant: "ghost", size: "sm" })}>
            Back home
          </Link>
        </div>

        <div className="mt-8 grid gap-6 lg:mt-12 lg:grid-cols-[1.05fr_0.95fr] lg:items-center">
          <section>
            <div className="glass-panel noise-overlay relative overflow-hidden rounded-[32px] p-6 sm:p-8 lg:p-10">
              <div className="absolute -left-8 top-10 h-36 w-36 rounded-full bg-[radial-gradient(circle,_rgba(24,190,239,0.18),_transparent_72%)] blur-3xl" />
              <div className="absolute -right-8 bottom-10 h-36 w-36 rounded-full bg-[radial-gradient(circle,_rgba(109,40,240,0.18),_transparent_72%)] blur-3xl" />

              <div className="relative max-w-xl space-y-6">
                <div className="data-chip w-fit border-cyan-200 bg-cyan-50 text-sky-700">
                  <Shield className="h-4 w-4" />
                  Hidden internal route
                </div>

                <div className="space-y-3">
                  <h1 className="font-display text-[2.4rem] font-semibold leading-[0.98] tracking-[-0.05em] text-foreground sm:text-[3.4rem]">
                    Secure admin access for DayStack.
                  </h1>
                  <p className="max-w-xl text-base leading-7 text-secondary-foreground sm:text-lg sm:leading-8">
                    This console is isolated from the normal planner flow. Credentials are validated on the server
                    only, and account actions run directly against the DayStack database after an admin session is
                    established.
                  </p>
                </div>

                <div className="rounded-[24px] border border-white/70 bg-white/82 p-5 shadow-[0_18px_46px_rgba(15,23,42,0.05)]">
                  <div className="flex items-start gap-3">
                    <span className="rounded-2xl bg-slate-100 p-3 text-slate-700">
                      <LockKeyhole className="h-5 w-5" />
                    </span>
                    <div>
                      <p className="text-sm font-semibold text-foreground">Server-only validation</p>
                      <p className="mt-1 text-sm leading-7 text-secondary-foreground">
                        Admin credentials never enter the browser bundle. The session is stored in an HttpOnly cookie
                        scoped to <code>/admin</code>.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </section>

          <section>
            <div className="glass-panel relative overflow-hidden rounded-[30px] bg-white/94 p-6 shadow-[0_30px_90px_rgba(15,23,42,0.12)] sm:p-8">
              <div className="absolute inset-x-10 top-0 h-px bg-[linear-gradient(90deg,rgba(24,190,239,0),rgba(24,190,239,0.7),rgba(109,40,240,0.62),rgba(109,40,240,0))]" />
              <div className="relative space-y-5">
                <div className="space-y-2.5">
                  <p className="section-label">Admin login</p>
                  <h2 className="font-display text-[2rem] font-semibold tracking-tight text-foreground">
                    Enter the internal dashboard.
                  </h2>
                  <p className="text-sm leading-7 text-secondary-foreground">
                    Use the configured admin credentials to review and manage registered DayStack accounts.
                  </p>
                </div>

                {!isAdminConfigured() ? (
                  <SetupNotice
                    compact
                    showAction={false}
                    eyebrow="Admin environment required"
                    title="Set ADMIN_USERNAME and ADMIN_PASSWORD before using /admin."
                    description={
                      <>
                        Add <code>ADMIN_USERNAME</code>, <code>ADMIN_PASSWORD</code>, and optionally{" "}
                        <code>ADMIN_SESSION_SECRET</code> to your environment. Keep them server-side only.
                      </>
                    }
                  />
                ) : (
                  <AdminLoginForm />
                )}
              </div>
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}
