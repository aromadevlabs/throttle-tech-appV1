import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      // forwards API calls to the Express server during `npm run dev`
      "/api": {
        target: "http://localhost:3001",
        changeOrigin: true,
      },
    },
  },
});
