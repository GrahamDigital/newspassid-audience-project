import tsconfigPaths from "vite-tsconfig-paths";
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["src/**/*.{test,spec}.{js,ts,jsx,tsx}"],
    environment: "happy-dom",
    globals: true,
    setupFiles: ["./src/tests/setup.ts"],
  },
  plugins: [tsconfigPaths()],
});
