import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["test/**/*.test.ts", "test/**/*.test.tsx"],
    server: {
      deps: {
        inline: ["ink", "ink-testing-library", "react"],
      },
    },
  },
});
