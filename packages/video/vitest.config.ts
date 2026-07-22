// Plain-Node vitest config for packages/video. The `cloudflare:workers`
// virtual module only exists inside the real Workers runtime; alias it
// to a minimal local stub so @cloudflare/containers (imported
// transitively via src/render/container.ts's RenderContainer export)
// doesn't fail to resolve during test collection. See
// tests/stubs/cloudflare-workers.ts for what the stub covers and why.
import path from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "cloudflare:workers": path.resolve(__dirname, "tests/stubs/cloudflare-workers.ts"),
    },
  },
});
