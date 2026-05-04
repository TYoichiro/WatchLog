import { writeAuditLog } from "@/lib/audit";
import { TOP_ADMIN_ROLE_NAME, authzErrorResponse, requirePermission } from "@/lib/authz";
import { prisma } from "@/lib/prisma";
import type { AssignRoleResult, RouteContext } from "@/types/api/admin-users-roles";

export const dynamic = "force-dynamic";

export async function POST(request: Request, context: RouteContext) {
  try {
    const actor = await requirePermission("role.assign");
    const { userId } = await context.params;
    const roleId = await readRoleId(request);

    if (!roleId) {
      return Response.json({ error: "Invalid request body" }, { status: 400 });
    }

    const result = await prisma.$transaction(async (tx): Promise<AssignRoleResult> => {
      const targetUser = await tx.user.findUnique({
        where: {
          id: userId,
        },
        select: {
          id: true,
        },
      });

      if (!targetUser) {
        return {
          status: "target_user_not_found",
        };
      }

      const role = await tx.role.findUnique({
        where: {
          id: roleId,
        },
        select: {
          id: true,
          name: true,
        },
      });

      if (!role) {
        return {
          status: "role_not_found",
        };
      }

      if (role.name === TOP_ADMIN_ROLE_NAME) {
        return {
          status: "admin_role_not_assignable",
        };
      }

      const userRole = await tx.userRole.upsert({
        where: {
          userId_roleId: {
            userId,
            roleId,
          },
        },
        update: {
          assignedByUserId: actor.id,
        },
        create: {
          userId,
          roleId,
          assignedByUserId: actor.id,
        },
        select: {
          id: true,
        },
      });

      await writeAuditLog(
        {
          actorUserId: actor.id,
          action: "role.assign",
          resource: "user",
          resourceId: userId,
          detail: {
            roleId: role.id,
            roleName: role.name,
          },
        },
        tx,
      );

      return {
        status: "assigned",
        userRoleId: userRole.id,
        role,
      };
    });

    if (result.status === "target_user_not_found") {
      return Response.json({ error: "User not found" }, { status: 404 });
    }

    if (result.status === "role_not_found") {
      return Response.json({ error: "Role not found" }, { status: 404 });
    }

    if (result.status === "admin_role_not_assignable") {
      return Response.json(
        { error: "Admin role must be assigned directly in the database" },
        { status: 403 },
      );
    }

    return Response.json({
      userRole: {
        id: result.userRoleId,
        role: result.role,
      },
    });
  } catch (error) {
    const authzResponse = authzErrorResponse(error);
    if (authzResponse) {
      return authzResponse;
    }

    console.error(error);
    return Response.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

async function readRoleId(request: Request): Promise<string | null> {
  try {
    const body: unknown = await request.json();

    if (!isRecord(body)) {
      return null;
    }

    const roleId = body.roleId;
    if (typeof roleId !== "string" || roleId.trim().length === 0) {
      return null;
    }

    return roleId;
  } catch {
    return null;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
