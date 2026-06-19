import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// GitHub Pages serves this project under /Little-Grid-Company/, so assets
// must be referenced relative to that base path.
export default defineConfig({
  base: "/Little-Grid-Company/",
  plugins: [react()],
});
