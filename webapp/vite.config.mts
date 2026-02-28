import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import projectConfig from "forestconfig";

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  base: "./",
  server: {
    port: projectConfig.devServerPort,
    host: true,
  },
  build: {
    outDir: "dist",
  },
});
