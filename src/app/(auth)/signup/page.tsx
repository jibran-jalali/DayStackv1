import { AuthShell } from "@/components/auth/auth-shell";

export const metadata = {
  title: "Sign Up",
};

export default function SignupPage() {
  return <AuthShell mode="signup" />;
}
