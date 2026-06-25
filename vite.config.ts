import path from "path"
import react from "@vitejs/plugin-react"
import { defineConfig } from "vite"
// kimi-plugin-inspect-react removed (not available on npm)

// https://vite.dev/config/
export default defineConfig({
  base: './',
  plugins: [inspectAttr(), react()],
  server: {
    port: 3000,
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
