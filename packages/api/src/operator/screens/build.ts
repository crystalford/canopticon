import { icon, opHeader, renderOpPage } from "../layout";

export function renderBuild(): string {
  const prompts = [
    "Mark Carney",
    "the B-20 stress test",
    "Brookfield contract concentration 2020–2025",
    "the housing supply frame",
  ];

  const chips = prompts
    .map(
      (p) =>
        `<a class="thread" href="/op/chat?q=${encodeURIComponent(`Build a node for: ${p}. Pull bounded retrieval, propose claims with sources, mark drafts.`)}" style="text-decoration:none">${p}</a>`,
    )
    .join("");

  const body = `
${opHeader("Build", "door one · seed → proposed node")}
<div class="op-content">
  <p class="muted" style="margin-bottom:22px;font-family:var(--serif);font-size:16px;line-height:1.55;max-width:680px">
    Type a seed — a person, a topic, a question — and the builder proposes a structured node from bounded retrieval. It proposes; it doesn't publish. It stops when sources stop being new.
  </p>

  <form action="/op/chat" method="GET" class="cmdbar" style="padding:8px 12px 8px 16px;margin-bottom:24px;max-width:720px">
    <span class="prompt">›</span>
    <input name="q" placeholder='Build a node for…  e.g. "Lena Maddox", "the B-20 stress test"' autocomplete="off" required />
    <button class="btn accent" type="submit">${icon("plus", 13)} Build</button>
  </form>

  <div class="label" style="margin-bottom:10px">Try one of these</div>
  <div class="row wrap" style="gap:7px;margin-bottom:32px">${chips}</div>

  <div class="card soft" style="padding:24px;max-width:720px">
    <div class="label" style="margin-bottom:8px">How it works</div>
    <p style="font-family:var(--serif);font-size:14.5px;line-height:1.6;color:var(--ink-2);margin:0">
      Build opens a chat conversation pre-seeded with your prompt. The assistant uses web_search, web_fetch_rendered, and seed_character_from_wikipedia to gather material, then proposes claims with their sources. Every claim enters as <em>draft</em> until you confirm it from the Workbench.
    </p>
  </div>
</div>`;

  return renderOpPage({ title: "Build", body, activeNav: "/op/build", fullBleed: true });
}
