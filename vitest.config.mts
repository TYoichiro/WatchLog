import { resolve } from "path";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [react()],
  resolve: {
    tsconfigPaths: true,
    alias: {
      "next/link": resolve(import.meta.dirname, "./test-utils/mocks/next-link.tsx"),
      "next/server": resolve(import.meta.dirname, "./node_modules/next/server.js"),
      "hls.js": resolve(import.meta.dirname, "./test-utils/mocks/hls.ts"),
      "@/auth": resolve(import.meta.dirname, "./test-utils/mocks/auth.ts"),
    },
  },
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./vitest.setup.ts"],
    include: ["**/*.test.{ts,tsx}"],
    env: {
      DATABASE_URL: "postgresql://test:test@localhost:5432/test",
    },
  },
});
