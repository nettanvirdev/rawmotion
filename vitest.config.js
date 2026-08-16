import { defineConfig } from "vitest/config";
import path from "node:path";

const root = import.meta.dirname;

/**
 * Vitest needs the same aliases as the Vite renderer build - tests import
 * `@shared/project.js` and `@/state/...` exactly as application code does.
 * The renderer's vite.config.js cannot be reused because its `root` is
 * src/renderer, which would put main-process and shared tests out of scope.
 */
export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(root, "./src/renderer"),
      "@motion": path.resolve(root, "./src/motion"),
      "@shared": path.resolve(root, "./src/shared"),
    },
  },
  test: {
    include: ["src/**/*.test.{js,ts,tsx}"],
    environment: "node",
  },
});
