import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    host: "0.0.0.0",
    port: 5173,
    // Phase-1 dev proxy: forward /api to the backend container in compose.
    // When running fully containerized, Traefik handles this; the proxy
    // only matters for `bun run dev` against a running backend.
    proxy: {
      "/api": {
        target: "http://lokyy-os-be",
        changeOrigin: true,
      },
    },
  },
  build: {
    outDir: "dist",
    sourcemap: false,
  },
});
