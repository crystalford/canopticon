// Command palette (⌘K / Ctrl+K). Vanilla JS, no framework, attached to
// every operator surface via layout.ts. Opens a centered overlay with
// a sectioned filterable list:
//   Go to — the real, live destinations (Library / Investigations /
//           Citations / the public site)
//   Do    — re-surface synthesis
//
// This used to list six separate console surfaces (Feed / Chat / Synthesis
// / Library / Briefs / Studio); most of those now just redirect back to one
// of the entries below (see operator/layout.ts's header comment for why) —
// trimmed to what a click here actually still does something distinct.
//
// Arrow keys navigate; Enter runs; Esc closes. The trigger lives on
// the rail's "Command" button (#rail-kbd) and the global keyboard
// shortcut.

export const CMDK_CLIENT_JS = String.raw`
(function(){
  const ITEMS = [
    { sec: "Go to", label: "Library",        href: "/library" },
    { sec: "Go to", label: "Investigations", href: "/investigations" },
    { sec: "Go to", label: "Citations",      href: "/citations" },
    { sec: "Do",    label: "Re-surface synthesis", action: "post", href: "/op/synthesis/surface", hint: "POST" },
    { sec: "Do",    label: "Public site",          href: "/", hint: "↗" },
  ];

  let open = false;
  let selIdx = 0;
  let filtered = ITEMS.slice();
  let scrim = null;
  let inputEl = null;
  let listEl = null;

  function esc(s){ const d=document.createElement("div"); d.textContent=s==null?"":String(s); return d.innerHTML; }

  function build(){
    scrim = document.createElement("div");
    scrim.className = "cmdk-scrim";
    scrim.innerHTML = [
      '<div class="cmdk">',
      '  <div class="cmdk-input">',
      '    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.4"><circle cx="7" cy="7" r="4.5"/><path d="M10.5 10.5L14 14" stroke-linecap="round"/></svg>',
      '    <input id="cmdk-q" autocomplete="off" placeholder="Go to a surface or run an action…" />',
      '  </div>',
      '  <div class="cmdk-list" id="cmdk-list"></div>',
      '</div>'
    ].join("");
    document.body.appendChild(scrim);
    inputEl = scrim.querySelector("#cmdk-q");
    listEl = scrim.querySelector("#cmdk-list");

    scrim.addEventListener("click", (e) => { if (e.target === scrim) close(); });
    inputEl.addEventListener("input", () => { selIdx = 0; render(); });
    inputEl.addEventListener("keydown", onKey);
  }

  function render(){
    const q = inputEl.value.trim().toLowerCase();
    filtered = q
      ? ITEMS.filter((i) => i.label.toLowerCase().includes(q) || (i.sec || "").toLowerCase().includes(q))
      : ITEMS.slice();
    if (selIdx >= filtered.length) selIdx = Math.max(0, filtered.length - 1);

    let html = "";
    let lastSec = "";
    filtered.forEach((it, i) => {
      if (it.sec !== lastSec) {
        html += '<div class="cmdk-sec">' + esc(it.sec) + '</div>';
        lastSec = it.sec;
      }
      const selCls = i === selIdx ? " sel" : "";
      const hint = it.hint ? '<span class="cr-hint">' + esc(it.hint) + '</span>' : '';
      html += '<button class="cmdk-row' + selCls + '" data-i="' + i + '">' +
              '<svg class="cr-ico" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.4"><path d="M3 8h9M8.5 4.5L12 8l-3.5 3.5" stroke-linecap="round" stroke-linejoin="round"/></svg>' +
              '<span class="cr-label">' + esc(it.label) + '</span>' + hint + '</button>';
    });
    listEl.innerHTML = html;
    listEl.querySelectorAll(".cmdk-row").forEach((b) => {
      b.addEventListener("click", () => { selIdx = parseInt(b.dataset.i || "0", 10); run(); });
      b.addEventListener("mouseenter", () => { selIdx = parseInt(b.dataset.i || "0", 10); render(); });
    });
  }

  function onKey(e){
    if (e.key === "ArrowDown") { e.preventDefault(); selIdx = Math.min(filtered.length - 1, selIdx + 1); render(); }
    else if (e.key === "ArrowUp") { e.preventDefault(); selIdx = Math.max(0, selIdx - 1); render(); }
    else if (e.key === "Enter") { e.preventDefault(); run(); }
    else if (e.key === "Escape") { e.preventDefault(); close(); }
  }

  function run(){
    const it = filtered[selIdx];
    if (!it) return;
    close();
    if (it.action === "post") {
      const f = document.createElement("form");
      f.method = "POST";
      f.action = it.href;
      document.body.appendChild(f);
      f.submit();
    } else {
      window.location.href = it.href;
    }
  }

  function openPalette(){
    if (open) return;
    if (!scrim) build();
    scrim.style.display = "flex";
    inputEl.value = "";
    selIdx = 0;
    render();
    setTimeout(() => inputEl.focus(), 0);
    open = true;
  }

  function close(){
    if (!open || !scrim) return;
    scrim.style.display = "none";
    open = false;
  }

  // Global keyboard: ⌘K / Ctrl+K toggles.
  document.addEventListener("keydown", (e) => {
    if ((e.metaKey || e.ctrlKey) && (e.key === "k" || e.key === "K")) {
      e.preventDefault();
      if (open) close(); else openPalette();
    }
    if (e.key === "Escape" && open) { e.preventDefault(); close(); }
  });

  // Rail button trigger.
  document.querySelectorAll(".rail-kbd").forEach((b) => {
    b.addEventListener("click", openPalette);
  });
})();
`;
