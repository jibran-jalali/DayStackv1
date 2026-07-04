import { AuthShell } from "@/components/auth/auth-shell";

export const metadata = {
  title: "Log In",
};

interface LoginPageProps {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const resolvedSearchParams = (await searchParams) ?? {};
  const disabledParam = Array.isArray(resolvedSearchParams.disabled)
    ? resolvedSearchParams.disabled[0]
    : resolvedSearchParams.disabled;

  return (
    <AuthShell
      mode="login"
      notice={
        disabledParam === "1"
          ? {
              description: "An admin has disabled this account. Contact support before trying again.",
              title: "This account is currently disabled.",
            }
          : undefined
      }
    />
  );
}
