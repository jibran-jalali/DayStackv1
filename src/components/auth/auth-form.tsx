"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, LoaderCircle } from "lucide-react";
import { useState, useTransition } from "react";

import { Button } from "@/components/shared/button";
import { Input } from "@/components/shared/input";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import { getErrorMessage } from "@/lib/utils";
import { loginSchema, signupSchema, type LoginValues, type SignupValues } from "@/types/daystack";

interface AuthFormProps {
  mode: "login" | "signup";
}

type FeedbackState =
  | {
      type: "success" | "error";
      message: string;
    }
  | null;

export function AuthForm({ mode }: AuthFormProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [feedback, setFeedback] = useState<FeedbackState>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [values, setValues] = useState<SignupValues>({
    fullName: "",
    email: "",
    password: "",
  });

  const isSignup = mode === "signup";

  function updateField(name: keyof SignupValues, value: string) {
    setValues((current) => ({
      ...current,
      [name]: value,
    }));
    setFieldErrors((current) => ({
      ...current,
      [name]: "",
    }));
    setFeedback(null);
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const parsed =
      mode === "signup"
        ? signupSchema.safeParse(values)
        : loginSchema.safeParse({
            email: values.email,
            password: values.password,
          } satisfies LoginValues);

    if (!parsed.success) {
      const flattened = parsed.error.flatten().fieldErrors as Partial<Record<keyof SignupValues, string[]>>;
      setFieldErrors({
        fullName: flattened.fullName?.[0] ?? "",
        email: flattened.email?.[0] ?? "",
        password: flattened.password?.[0] ?? "",
      });
      return;
    }

    startTransition(async () => {
      const supabase = createSupabaseBrowserClient();

      if (!supabase) {
        setFeedback({
          type: "error",
          message: "Add your Supabase environment variables to enable authentication.",
        });
        return;
      }

      try {
        if (mode === "signup") {
          const { data, error } = await supabase.auth.signUp({
            email: values.email,
            password: values.password,
            options: {
              data: {
                full_name: values.fullName?.trim() || null,
              },
            },
          });

          if (error) {
            throw error;
          }

          if (data.session) {
            router.replace("/app");
            router.refresh();
            return;
          }

          setFeedback({
            type: "success",
            message:
              "Account created. If email confirmation is enabled in Supabase, verify your inbox before logging in.",
          });
          return;
        }

        const { error } = await supabase.auth.signInWithPassword({
          email: values.email,
          password: values.password,
        });

        if (error) {
          throw error;
        }

        router.replace("/app");
        router.refresh();
      } catch (error) {
        setFeedback({
          type: "error",
          message: getErrorMessage(error),
        });
      }
    });
  }

  return (
    <form className="space-y-4 sm:space-y-5" onSubmit={handleSubmit}>
      {isSignup ? (
        <label className="block space-y-2">
          <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-secondary-foreground/75">
            Full name
          </span>
          <Input
            autoComplete="name"
            autoFocus
            placeholder="What should DayStack call you?"
            value={values.fullName ?? ""}
            error={fieldErrors.fullName}
            onChange={(event) => updateField("fullName", event.target.value)}
          />
          {fieldErrors.fullName ? <p className="text-sm text-danger">{fieldErrors.fullName}</p> : null}
        </label>
      ) : null}

      <label className="block space-y-2">
        <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-secondary-foreground/75">
          Email
        </span>
        <Input
          autoComplete="email"
          autoFocus={!isSignup}
          inputMode="email"
          placeholder="you@example.com"
          value={values.email}
          error={fieldErrors.email}
          onChange={(event) => updateField("email", event.target.value)}
        />
        {fieldErrors.email ? <p className="text-sm text-danger">{fieldErrors.email}</p> : null}
      </label>

      <label className="block space-y-2">
        <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-secondary-foreground/75">
          Password
        </span>
        <Input
          autoComplete={isSignup ? "new-password" : "current-password"}
          type="password"
          placeholder={isSignup ? "Create a secure password" : "Enter your password"}
          value={values.password}
          error={fieldErrors.password}
          onChange={(event) => updateField("password", event.target.value)}
        />
        {fieldErrors.password ? <p className="text-sm text-danger">{fieldErrors.password}</p> : null}
      </label>

      {feedback ? (
        <div
          className={`rounded-[22px] border px-4 py-3 text-sm leading-7 ${
            feedback.type === "success"
              ? "border-emerald-200 bg-emerald-50 text-emerald-700"
              : "border-red-200 bg-red-50 text-danger"
          }`}
        >
          {feedback.message}
        </div>
      ) : null}

      <Button type="submit" size="lg" className="w-full" disabled={isPending}>
        {isPending ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <ArrowRight className="h-4 w-4" />}
        {isSignup ? "Create account" : "Log in"}
      </Button>

      <p className="pt-1 text-center text-sm text-secondary-foreground">
        {isSignup ? "Already have an account?" : "Need an account?"}{" "}
        <Link
          href={isSignup ? "/login" : "/signup"}
          className="font-semibold text-primary transition hover:text-[var(--primary-strong)]"
        >
          {isSignup ? "Log in" : "Create one"}
        </Link>
      </p>

      <p className="text-center text-[11px] tracking-[0.1em] text-secondary-foreground/75">
        {isSignup ? "Start free. Plan clearly. Follow through." : "Welcome back to a calmer day."}
      </p>
    </form>
  );
}
