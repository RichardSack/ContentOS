import path from "path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./test/setup.ts"],
    include: ["lib/**/*.test.ts", "app/**/*.test.ts", "test/**/*.test.ts"],
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "."),
      "@/lib": path.resolve(__dirname, "./lib"),
      "@/app": path.resolve(__dirname, "./app"),
    },
  },
});
