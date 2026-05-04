// lib/audit.ts
import type { Prisma, PrismaClient } from "@/app/generated/prisma/client";
import { prisma } from "@/lib/prisma";

type AuditLogClient = Pick<PrismaClient, "auditLog"> | Pick<Prisma.TransactionClient, "auditLog">;

export type WriteAuditLogInput = {
  actorUserId: string | null;
  action: string;
  resource: string;
  resourceId?: string | null;
  detail: Prisma.InputJsonValue;
};

export async function writeAuditLog(
  input: WriteAuditLogInput,
  client: AuditLogClient = prisma,
) {
  return client.auditLog.create({
    data: {
      actorUserId: input.actorUserId,
      action: input.action,
      resource: input.resource,
      resourceId: input.resourceId ?? null,
      detail: input.detail,
    },
    select: {
      id: true,
      createdAt: true,
    },
  });
}
