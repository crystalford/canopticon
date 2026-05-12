#!/usr/bin/env node
// scripts/smoke.ts
//
// Verifies a freshly-deployed Worker has D1, R2, and Vectorize wired up.
// This script doesn't need raw D1 access — it hits the deployed API's
// /health endpoint plus a few public + protected endpoints.
//
// Usage:
//   API_BASE_URL=https://api.canopticon.com pnpm smoke

interface Check {
  name: string;
  run: () => Promise<string | null>;
}

function readEnv(name: string): string {
  const v = process.env[name];
  if (!v) {
    console.error(`error: ${name} is required`);
    process.exit(2);
  }
  return v;
}

async function main() {
  const baseUrl = readEnv("API_BASE_URL").replace(/\/$/, "");

  const checks: Check[] = [
    {
      name: "API health endpoint reachable",
      run: async () => {
        const res = await fetch(`${baseUrl}/health`);
        if (!res.ok) return `health check returned ${res.status}`;
        const body = (await res.json()) as { ok?: boolean };
        if (body.ok !== true) return "health body missing ok=true";
        return null;
      },
    },
    {
      name: "Public articles endpoint reachable",
      run: async () => {
        const res = await fetch(`${baseUrl}/v1/public/articles`);
        if (!res.ok) return `articles endpoint returned ${res.status}`;
        const body = (await res.json()) as { articles?: unknown[] };
        if (!Array.isArray(body.articles)) return "response missing articles array";
        return null;
      },
    },
    {
      name: "Public theses endpoint reachable",
      run: async () => {
        const res = await fetch(`${baseUrl}/v1/public/theses`);
        if (!res.ok) return `theses endpoint returned ${res.status}`;
        return null;
      },
    },
    {
      name: "Public predictions endpoint reachable",
      run: async () => {
        const res = await fetch(`${baseUrl}/v1/public/predictions`);
        if (!res.ok) return `predictions endpoint returned ${res.status}`;
        return null;
      },
    },
    {
      name: "Operator routes require Cloudflare Access (401 without auth)",
      run: async () => {
        const res = await fetch(`${baseUrl}/v1/system/`);
        if (res.status === 401 || res.status === 403) return null;
        if (res.status === 200)
          return "operator route returned 200 without auth — Access not gating!";
        return `unexpected status: ${res.status}`;
      },
    },
  ];

  let passed = 0;
  let failed = 0;
  for (const check of checks) {
    process.stdout.write(`· ${check.name} ... `);
    try {
      const failure = await check.run();
      if (failure) {
        console.log("FAIL");
        console.log(`    ${failure}`);
        failed++;
      } else {
        console.log("ok");
        passed++;
      }
    } catch (err) {
      console.log("ERROR");
      console.log(`    ${(err as Error).message}`);
      failed++;
    }
  }

  console.log("");
  console.log(`${passed} passed, ${failed} failed`);
  if (failed > 0) {
    console.log("");
    console.log("smoke test found problems. fix them before using the system in earnest.");
    process.exit(1);
  }
  console.log("");
  console.log("API looks healthy. ready to use.");
}

main().catch((err) => {
  console.error("smoke runner crashed:", err);
  process.exit(1);
});
