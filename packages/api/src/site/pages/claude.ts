// /admin/claude — is Claude connected, and if not, what is missing. Shows
// whether each setting is present (never its value), the two ways to connect,
// and a button that makes one small test call the way the workspace does.

import type { Env } from "../../env";
import { claudeRoute } from "../../write/agent";
import { type TestResult, connectionSettings } from "../../write/connection";
import { esc, shell } from "../layout";

const ROUTE = {
  gateway: "Connected through Cloudflare's AI Gateway — billed to your Cloudflare account.",
  anthropic: "Connected with an Anthropic API key — billed by Anthropic.",
};

export function renderClaude(env: Env, result?: TestResult): string {
  const route = claudeRoute(env);
  const rows = connectionSettings(env)
    .map(
      (s) =>
        `<li class="cl-row"><span class="cl-mark ${s.set ? "on" : ""}" aria-hidden="true">${s.set ? "✓" : "–"}</span><span><code>${esc(s.name)}</code> <span class="cl-state">${s.set ? "set" : "not set"}</span><span class="cl-what">${esc(s.what)}</span></span></li>`,
    )
    .join("");
  const status = route
    ? `<p class="cl-status on">${ROUTE[route]}</p>`
    : '<p class="cl-status">Not connected. Nothing in the workspace — writing, research, Read it — can run until one of the two ways below is set up.</p>';
  const test = result
    ? result.ok
      ? `<div class="cl-result ok"><strong>It works.</strong> ${esc(result.model)} answered “${esc(result.reply)}” in ${(result.ms / 1000).toFixed(1)} s, with the features the workspace uses (fallbacks, reasoning, web search and fetch available).</div>`
      : `<div class="cl-result bad"><strong>The test failed.</strong> ${result.route ? `${result.route === "gateway" ? "Cloudflare's gateway" : "Anthropic"} answered: ` : ""}<code>${esc(result.error)}</code></div>`
    : "";
  const body = `<div class="cl"><div class="d-head"><h1 class="d-h1">Claude</h1><span class="d-links"><a href="/admin" class="ulink">Back to Admin</a></span></div>
${status}${test}
<form method="post" action="/op/admin/claude-test" class="cl-test"><button type="submit" class="btn"${route ? "" : " disabled"}>Test the connection</button><span class="cl-note">One short call, a fraction of a cent. No searches.</span></form>
<h2 class="cl-h">What the site can see</h2>
<ul class="cl-list">${rows}</ul>
<h2 class="cl-h">To connect through Cloudflare (recommended)</h2>
<ol class="cl-steps">
<li>In the Cloudflare dashboard, open <strong>AI → AI Gateway</strong> and create a gateway (any name, e.g. <code>canopticon</code>).</li>
<li>In the gateway's settings, turn on <strong>Authenticated Gateway</strong> and create a token. Add credits under <strong>Unified Billing</strong>.</li>
<li>In GitHub, open the repository's <strong>Settings → Secrets and variables → Actions</strong> and add two secrets: <code>AI_GATEWAY_ID</code> (the gateway's name) and <code>CF_AIG_TOKEN</code> (the token).</li>
<li>Deploy: merge anything, or run the <strong>Deploy to Cloudflare</strong> workflow from the Actions tab. Then come back here and press Test.</li>
</ol>
<h2 class="cl-h">Or with an Anthropic key</h2>
<ol class="cl-steps"><li>Add the secret <code>ANTHROPIC_API_KEY</code> in the same place, and deploy. The gateway is used instead whenever both are set.</li></ol>
</div>`;
  return shell({
    title: "Claude",
    description: "Whether Claude is connected.",
    path: "/admin/claude",
    signedIn: true,
    noindex: true,
    body,
  });
}
