// lib/authz.ts
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export type AuthenticatedUser = {
  id: string;
  name: string | null;
  email: string | null;
  image: string | null;
};

export class UnauthorizedError extends Error {
  readonly status = 401;

  constructor(message = "Unauthorized") {
    super(message);
    this.name = "UnauthorizedError";
  }
}

export class ForbiddenError extends Error {
  readonly status = 403;

  constructor(message = "Forbidden") {
    super(message);
    this.name = "ForbiddenError";
  }
}

export const TOP_ADMIN_ROLE_NAME = "admin";
export const PREMIUM_ROLE_NAME = "premiumuser";

export async function requireUser(): Promise<AuthenticatedUser> {
  const session = await auth();
  const user = session?.user;

  if (!user?.id) {
    throw new UnauthorizedError();
  }

  const dbUser = await prisma.user.findUnique({
    where: { id: user.id },
    select: { isBanned: true },
  });

  if (dbUser?.isBanned) {
    throw new ForbiddenError("Banned");
  }

  return {
    id: user.id,
    name: user.name ?? null,
    email: user.email ?? null,
    image: user.image ?? null,
  };
}

export async function hasPermission(userId: string, action: string): Promise<boolean> {
  const permission = await prisma.permission.findFirst({
    where: {
      action,
      rolePermissions: {
        some: {
          role: {
            userRoles: {
              some: {
                userId,
              },
            },
          },
        },
      },
    },
    select: {
      id: true,
    },
  });

  return permission !== null;
}

export async function hasRole(userId: string, roleName: string): Promise<boolean> {
  const role = await prisma.userRole.findFirst({
    where: {
      userId,
      role: {
        name: roleName,
      },
    },
    select: {
      id: true,
    },
  });

  return role !== null;
}

export async function hasTopAdminRole(userId: string): Promise<boolean> {
  return hasRole(userId, TOP_ADMIN_ROLE_NAME);
}

export async function hasPremiumRole(userId: string): Promise<boolean> {
  return hasRole(userId, PREMIUM_ROLE_NAME);
}

export async function requireTopAdminRole(): Promise<AuthenticatedUser> {
  const user = await requireUser();
  const allowed = await hasTopAdminRole(user.id);

  if (!allowed) {
    throw new ForbiddenError();
  }

  return user;
}

export async function requirePermission(action: string): Promise<AuthenticatedUser> {
  const user = await requireUser();
  const allowed = await hasPermission(user.id, action);

  if (!allowed) {
    throw new ForbiddenError();
  }

  return user;
}

export function authzErrorResponse(error: unknown): Response | null {
  if (error instanceof UnauthorizedError) {
    return Response.json({ error: "Unauthorized" }, { status: error.status });
  }

  if (error instanceof ForbiddenError) {
    return Response.json({ error: "Forbidden" }, { status: error.status });
  }

  return null;
}
