import type { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface Session {
    user: DefaultSession["user"] & {
      id: string;
      status: "active" | "disabled";
    };
  }

  interface User {
    id: string;
    status: "active" | "disabled";
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    status?: "active" | "disabled";
  }
}
