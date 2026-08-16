import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "path";

const root = import.meta.dirname;

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  root: "src/renderer",
  // Serve project-level /public assets (logos, icons) in dev and copy them on build
  publicDir: path.resolve(root, "public"),
  // Relative base so the built app loads correctly via file:// inside Electron
  base: "./",
  build: {
    outDir: "../../dist",
    emptyOutDir: true,
    target: "chrome130",
    sourcemap: false,
  },
  resolve: {
    alias: {
      "@": path.resolve(root, "./src/renderer"),
      // The composition engine and the main/renderer contract live outside
      // the Vite root, so they need explicit aliases. Both are also consumed
      // by the Electron main process and the Remotion render bundle, which
      // is exactly why they are not under src/renderer.
      "@motion": path.resolve(root, "./src/motion"),
      "@shared": path.resolve(root, "./src/shared"),
    },
  },
  server: {
    port: 5173,
    strictPort: true,
    fs: {
      // Vite's root is src/renderer; without this it refuses to serve the
      // sibling source directories the aliases above point at.
      allow: [root],
    },
  },
  clearScreen: false,
});
