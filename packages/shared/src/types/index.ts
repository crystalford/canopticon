export * from "./events.ts";

// `database.ts` and `api.ts` are generated:
//   - database.ts ← `supabase gen types typescript`
//   - api.ts      ← `openapi-typescript` against api-v1.0.md
// They are gitignored. Run `pnpm --filter @canopticon/shared gen:types` once
// the Supabase project and OpenAPI spec are in place.
