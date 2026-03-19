import "server-only";

import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import { getServerSession, type NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";

import { getDb } from "@/db/client";
import { users } from "@/db/schema";
import { isUserDisabled } from "@/lib/auth-status";
import { loginSchema } from "@/types/daystack";

export const authOptions: NextAuthOptions = {
  secret: process.env.AUTH_SECRET?.trim() || process.env.NEXTAUTH_SECRET?.trim(),
  session: {
    strategy: "jwt",
  },
  pages: {
    signIn: "/login",
  },
  providers: [
    CredentialsProvider({
      credentials: {
        email: {
          label: "Email",
          type: "email",
        },
        password: {
          label: "Password",
          type: "password",
        },
      },
      async authorize(credentials) {
        const parsed = loginSchema.safeParse({
          email: credentials?.email,
          password: credentials?.password,
        });

        if (!parsed.success) {
          return null;
        }

        const db = getDb();

        if (!db) {
          return null;
        }

        const [user] = await db
          .select()
          .from(users)
          .where(eq(users.email, parsed.data.email.toLowerCase()))
          .limit(1);

        if (!user || isUserDisabled(user)) {
          return null;
        }

        const isPasswordValid = await bcrypt.compare(parsed.data.password, user.password_hash);

        if (!isPasswordValid) {
          return null;
        }

        await db
          .update(users)
          .set({
            last_sign_in_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })
          .where(eq(users.id, user.id));

        return {
          id: user.id,
          email: user.email,
          name: user.full_name,
          status: user.status,
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.sub = user.id;
        token.email = user.email;
        token.name = user.name;
        token.status = user.status;
      }

      return token;
    },
    async session({ session, token }) {
      if (session.user && token.sub) {
        session.user.id = token.sub;
        session.user.status = token.status === "disabled" ? "disabled" : "active";
      }

      return session;
    },
  },
};

export async function auth() {
  return getServerSession(authOptions);
}

export async function getSessionUser() {
  const session = await auth();

  if (!session?.user?.id) {
    return null;
  }

  const db = getDb();

  if (!db) {
    return null;
  }

  const [user] = await db.select().from(users).where(eq(users.id, session.user.id)).limit(1);

  if (!user || isUserDisabled(user)) {
    return null;
  }

  return user;
}
