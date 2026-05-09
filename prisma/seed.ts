// prisma/seed.ts
import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../app/generated/prisma/client";
import { createJstWallTimeDate } from "../lib/jst";

function requiredEnv(name: string): string {
  const value = process.env[name];

  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }

  return value;
}

const permissionDefinitions = [
  {
    action: "profile.read",
    description: "Read own profile",
  },
  {
    action: "user.read",
    description: "Read users",
  },
  {
    action: "user.update",
    description: "Update users",
  },
  {
    action: "role.assign",
    description: "Assign non-admin roles to users",
  },
  {
    action: "audit.read",
    description: "Read audit logs",
  },
] as const;

type PermissionAction = (typeof permissionDefinitions)[number]["action"];

const adminPermissionActions: readonly PermissionAction[] = permissionDefinitions.map(
  (permission) => permission.action,
);
const userPermissionActions = ["profile.read"] satisfies readonly PermissionAction[];
const premiumUserPermissionActions = ["profile.read"] satisfies readonly PermissionAction[];

const dashboardNotices = [
  {
    title: "β番公開のお知らせ",
    content:
      "新バージョンのβ版を公開しました。新しいUIや機能をぜひお試しください。フィードバックもお待ちしています！",
    publishedAt: createJstWallTimeDate("2026-05-04T12:00:00.000"),
    expiresAt: null,
    linkUrl: null,
    displayTarget: "AUTHENTICATED",
  },
  {
    title: "設定の招待コードについて",
    content:
      "最大3名まで招待コードを発行できるようになりました。仲の良い配信者を招待してみてください。",
    publishedAt: createJstWallTimeDate("2026-05-04T12:00:00.000"),
    expiresAt: null,
    linkUrl: null,
    displayTarget: "AUTHENTICATED",
  },
  {
    title: "ログイン方法について",
    content:
      "Googleアカウントでログインできます。Xログインは準備が整い次第ご利用いただけます。",
    publishedAt: createJstWallTimeDate("2026-05-04T09:00:00.000"),
    expiresAt: null,
    linkUrl: null,
    displayTarget: "LOGIN",
  },
  {
    title: "WatchLogについて",
    content:
      "招待制になりました",
    publishedAt: createJstWallTimeDate("2026-05-04T09:00:00.000"),
    expiresAt: null,
    linkUrl: null,
    displayTarget: "LOGIN",
  },
] as const;

const adapter = new PrismaPg({
  connectionString: requiredEnv("DATABASE_URL"),
});
const prisma = new PrismaClient({
  adapter,
});

async function main() {
  const [adminRole, userRole, premiumUserRole] = await Promise.all([
    prisma.role.upsert({
      where: {
        name: "admin",
      },
      update: {
        description: "System administrator",
      },
      create: {
        name: "admin",
        description: "System administrator",
      },
      select: {
        id: true,
      },
    }),
    prisma.role.upsert({
      where: {
        name: "user",
      },
      update: {
        description: "Default authenticated user",
      },
      create: {
        name: "user",
        description: "Default authenticated user",
      },
      select: {
        id: true,
      },
    }),
    prisma.role.upsert({
      where: {
        name: "premiumuser",
      },
      update: {
        description: "Premium authenticated user",
      },
      create: {
        name: "premiumuser",
        description: "Premium authenticated user",
      },
      select: {
        id: true,
      },
    }),
  ]);

  await Promise.all(
    permissionDefinitions.map((permission) =>
      prisma.permission.upsert({
        where: {
          action: permission.action,
        },
        update: {
          description: permission.description,
        },
        create: permission,
      }),
    ),
  );

  await Promise.all([
    assignPermissions(adminRole.id, adminPermissionActions),
    assignPermissions(userRole.id, userPermissionActions),
    assignPermissions(premiumUserRole.id, premiumUserPermissionActions),
  ]);

  await prisma.dashboardNotice.deleteMany({
    where: {
      title: {
        in: dashboardNotices.map((notice) => notice.title),
      },
    },
  });

  await prisma.dashboardNotice.createMany({
    data: [...dashboardNotices],
  });
}

async function assignPermissions(roleId: string, actions: readonly PermissionAction[]) {
  const permissions = await prisma.permission.findMany({
    where: {
      action: {
        in: [...actions],
      },
    },
    select: {
      id: true,
      action: true,
    },
  });

  const permissionIdByAction = new Map(
    permissions.map((permission) => [permission.action, permission.id]),
  );

  await Promise.all(
    actions.map((action) => {
      const permissionId = permissionIdByAction.get(action);
      if (!permissionId) {
        throw new Error(`Seed permission not found: ${action}`);
      }

      return prisma.rolePermission.upsert({
        where: {
          roleId_permissionId: {
            roleId,
            permissionId,
          },
        },
        update: {},
        create: {
          roleId,
          permissionId,
        },
      });
    }),
  );
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error: unknown) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
