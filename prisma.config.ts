// prisma.config.ts
import "dotenv/config";
import { defineConfig, env } from "prisma/config";

process.env.TZ = "Asia/Tokyo";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "tsx prisma/seed.ts",
  },
  datasource: {
    url: env("DATABASE_URL"),
  },
});
