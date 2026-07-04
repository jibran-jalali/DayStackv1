"use client";

import { ArrowRight, LoaderCircle, LockKeyhole } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { Button } from "@/components/shared/button";
import { Input } from "@/components/shared/input";
import { getErrorMessage } from "@/lib/utils";

type FeedbackState =
  | {
      message: string;
      type: "error";
    }
  | null;

export function AdminLoginForm() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [feedback, setFeedback] = useState<FeedbackState>(null);
  const [values, setValues] = useState({
    password: "",
    username: "",
  });

  function updateField(name: "password" | "username", value: string) {
    setValues((current) => ({
      ...current,
      [name]: value,
    }));
    setFeedback(null);
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    startTransition(async () => {
      try {
        const response = await fetch("/admin/api/session", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(values),
        });

        const payload = (await response.json().catch(() => null)) as { message?: string } | null;

        if (!response.ok) {
          throw new Error(payload?.message ?? "Admin login failed.");
        }

        router.replace("/admin");
        router.refresh();
      } catch (error) {
        setFeedback({
          message: getErrorMessage(error),
          type: "error",
        });
      }
    });
  }

  return (
    <form className="space-y-4 sm:space-y-5" onSubmit={handleSubmit}>
      <label className="block space-y-2">
        <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-secondary-foreground/75">
          Username
        </span>
        <Input
          autoCapitalize="none"
          autoComplete="username"
          autoCorrect="off"
          autoFocus
          placeholder="Enter internal username"
          value={values.username}
          onChange={(event) => updateField("username", event.target.value)}
        />
      </label>

      <label className="block space-y-2">
        <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-secondary-foreground/75">
          Password
        </span>
        <Input
          autoComplete="current-password"
          placeholder="Enter admin password"
          type="password"
          value={values.password}
          onChange={(event) => updateField("password", event.target.value)}
        />
      </label>

      {feedback ? (
        <div className="rounded-[22px] border border-red-200 bg-red-50 px-4 py-3 text-sm text-danger">
          {feedback.message}
        </div>
      ) : null}

      <Button type="submit" size="lg" className="w-full" disabled={isPending}>
        {isPending ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <LockKeyhole className="h-4 w-4" />}
        Secure admin sign in
      </Button>

      <p className="flex items-center justify-center gap-2 text-center text-[11px] tracking-[0.12em] text-secondary-foreground/75">
        <ArrowRight className="h-3.5 w-3.5" />
        Server-validated access only
      </p>
    </form>
  );
}
