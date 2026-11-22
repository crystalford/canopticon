// Types for the helpers tests import from build-content.mjs.
export function parseFrontMatter(text: string): { meta: Record<string, unknown>; body: string };
export function verbatimNormal(s: string): string;
export function parseSpoken(body: string): Array<{
  title: string;
  from: string;
  caveat: string;
  paras: string[];
  body: string;
  words: number;
  seconds: number;
}>;
