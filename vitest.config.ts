import { defineConfig } from "vitest/config"
import { fileURLToPath } from "node:url"

// Юніт-тести чистої логіки (lib/*). Без DOM — node-середовища достатньо.
export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.{test,spec}.ts"],
  },
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
})
