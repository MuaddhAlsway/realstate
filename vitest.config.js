import { defineConfig } from "vitest/config"

export default defineConfig({
  test: {
    environment: "node",
    include: ["server/tests/**/*.test.mjs"],
    // All suites share the isolated estate_test database. Run files in
    // sequence (one worker) so stopped/long-running suites can never collide
    // on shared fixtures and we never exceed the test-endpoint connection
    // budget under 9-way parallelism.
    fileParallelism: false,
    testTimeout: 30_000,
    hookTimeout: 60_000,
  },
})
