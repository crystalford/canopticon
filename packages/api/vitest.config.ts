import { defineConfig } from "vitest/config";

// The first test in a file that imports the app pays for loading the content
// store (src/site/content/store.gen.json, ~5MB). That is well under a second
// locally and has run past vitest's 5s default on a cold CI runner.
export default defineConfig({
  test: { testTimeout: 20_000 },
});
