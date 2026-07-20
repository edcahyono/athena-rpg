import { defineConfig } from "vite";

export default defineConfig({
  server: {
    port: 5175,
    proxy: {
      "/api": "http://localhost:3002",
    },
  },
  build: { outDir: "dist" },
});
