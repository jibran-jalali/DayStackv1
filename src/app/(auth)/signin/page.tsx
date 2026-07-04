import { AuthShell } from "@/components/auth/auth-shell";

export const metadata = {
  title: "Sign In",
};

export default function SignInPage() {
  return <AuthShell mode="login" />;
}
