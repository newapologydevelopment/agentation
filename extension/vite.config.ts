import { crx } from "@crxjs/vite-plugin";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import { fileURLToPath } from "node:url";
import manifest from "./manifest.config";
import packageJson from "../package/package.json";

export default defineConfig({
  plugins: [react(), crx({ manifest })],
  resolve: {
    alias: {
      "agentation-src": fileURLToPath(new URL("../package/dist/index.mjs", import.meta.url)),
    },
  },
  define: {
    __VERSION__: JSON.stringify(packageJson.version),
  },
  build: {
    outDir: "dist",
    emptyOutDir: true,
    sourcemap: false,
    chunkSizeWarningLimit: 600,
  },
});
