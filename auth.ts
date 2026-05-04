// auth.ts
import { PrismaAdapter } from "@auth/prisma-adapter";
import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import { prisma } from "@/lib/prisma";
import { writeAuditLog } from "@/lib/audit";
import { assertRequiredEnv, requiredEnv } from "@/lib/env";

assertRequiredEnv([
  "DATABASE_URL",
  "AUTH_SECRET",
  "AUTH_GOOGLE_ID",
  "AUTH_GOOGLE_SECRET",
  "NEXTAUTH_URL",
]);

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: PrismaAdapter(prisma as unknown as Parameters<typeof PrismaAdapter>[0]),
  secret: requiredEnv("AUTH_SECRET"),
  trustHost: true,
  session: {
    strategy: "database",
  },
  providers: [
    Google({
      clientId: requiredEnv("AUTH_GOOGLE_ID"),
      clientSecret: requiredEnv("AUTH_GOOGLE_SECRET"),
    }),
  ],
  callbacks: {
    session({ session, user }) {
      if (session.user) {
        session.user.id = user.id;
      }

      return session;
    },
  },
  events: {
    async createUser({ user }) {
      const userId = user.id;

      if (!userId) {
        return;
      }

      await prisma.$transaction(async (tx) => {
        const defaultRole = await tx.role.upsert({
          where: {
            name: "user",
          },
          update: {},
          create: {
            name: "user",
            description: "Default authenticated user",
          },
          select: {
            id: true,
          },
        });

        await tx.userRole.upsert({
          where: {
            userId_roleId: {
              userId,
              roleId: defaultRole.id,
            },
          },
          update: {},
          create: {
            userId,
            roleId: defaultRole.id,
          },
        });

        await writeAuditLog(
          {
            actorUserId: userId,
            action: "auth.user.create",
            resource: "user",
            resourceId: userId,
            detail: {
              email: user.email ?? null,
              provider: "google",
            },
          },
          tx,
        );
      });
    },
    async signIn({ user, account }) {
      const userId = user.id;

      if (!userId) {
        return;
      }

      await writeAuditLog({
        actorUserId: userId,
        action: "auth.sign_in",
        resource: "user",
        resourceId: userId,
        detail: {
          provider: account?.provider ?? null,
        },
      });
    },
    async signOut(message) {
      if (!("session" in message) || !message.session?.userId) {
        return;
      }

      await writeAuditLog({
        actorUserId: message.session.userId,
        action: "auth.sign_out",
        resource: "user",
        resourceId: message.session.userId,
        detail: {
          sessionDeleted: true,
        },
      });
    },
  },
});
