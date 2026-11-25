import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// In development the client runs on :5173 and forwards API and WebSocket
// traffic to the Express server on :3000. In production Express serves the
// built client itself, so there is only one origin.
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      "/api": "http://localhost:3000",
      "/ws": { target: "ws://localhost:3000", ws: true },
    },
  },
  build: { outDir: "dist" },
});
