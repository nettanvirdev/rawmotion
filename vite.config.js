import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "path";

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  root: "src/renderer",
  // Serve project-level /public assets (logos, icons) in dev and copy them on build
  publicDir: path.resolve(__dirname, "public"),
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
      "@": path.resolve(__dirname, "./src/renderer"),
    },
  },
  server: {
    port: 5173,
    strictPort: true,
  },
  clearScreen: false,
});
