import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import { fileURLToPath } from "node:url";

export default defineConfig({
  plugins: [react()],
  server: {
    fs: { allow: [fileURLToPath(new URL(".", import.meta.url)), fileURLToPath(new URL("../server/services/loginRules.mjs", import.meta.url))] },
    proxy: { "/api": "http://localhost:5000" },
  },
});
