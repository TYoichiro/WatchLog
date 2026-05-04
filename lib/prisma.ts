// lib/prisma.ts
import { POSTGRES_TIME_ZONE_OPTION } from "@/lib/server-timezone";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/app/generated/prisma/client";
import { requiredEnv } from "@/lib/env";

const globalForPrisma = globalThis as unknown as {
  prisma?: PrismaClient;
};

const adapter = new PrismaPg({
  connectionString: requiredEnv("DATABASE_URL"),
  options: POSTGRES_TIME_ZONE_OPTION,
});

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    adapter,
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
