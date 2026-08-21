import path from "node:path";
import { defineConfig } from "vitest/config";

/**
 * Config Vitest minimale pour les services métier (environnement Node).
 * Alias @/* aligné sur tsconfig — sans modifier tsconfig.json.
 */
export default defineConfig({
  test: {
    environment: "node",
    include: [
      "lib/**/*.test.ts",
      "lib/**/*.spec.ts",
      "app/api/v1/**/*.test.ts",
      "app/api/admin/**/*.test.ts",
    ],
    exclude: ["node_modules", ".next", "templates"],
    passWithNoTests: false,
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "."),
    },
  },
});
