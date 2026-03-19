"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, LoaderCircle } from "lucide-react";
import { signIn } from "next-auth/react";
import { useState, useTransition } from "react";

import { Button } from "@/components/shared/button";
import { Input } from "@/components/shared/input";
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
      try {
        if (mode === "signup") {
          const signupResponse = await fetch("/api/auth/signup", {
            method: "POST",
            headers: {
              "content-type": "application/json",
            },
            body: JSON.stringify({
              email: values.email,
              fullName: values.fullName,
              password: values.password,
            }),
          });

          const signupPayload = (await signupResponse.json().catch(() => null)) as
            | {
                message?: string;
              }
            | null;

          if (!signupResponse.ok) {
            throw new Error(signupPayload?.message ?? "Account creation failed.");
          }

          const result = await signIn("credentials", {
            email: values.email,
            password: values.password,
            redirect: false,
          });

          if (result?.error) {
            throw new Error("Account created, but automatic sign-in failed. Please log in.");
          }

          router.replace("/app");
          router.refresh();
          return;
        }

        const result = await signIn("credentials", {
          email: values.email,
          password: values.password,
          redirect: false,
        });

        if (result?.error) {
          throw new Error("Invalid email or password.");
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
