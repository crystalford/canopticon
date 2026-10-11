// /site.js — progressive enhancement for the Black Box pages. Every page is
// complete without it (standing rule 7); this adds the conveniences the
// prototypes have (docs/blackbox/README.md §Interactions):
//
//   /            focuses search on every page (or opens /search)
//   progress     the 2px cobalt bar under the header on long pages
//   toc          the rail's "In this …" list follows the reader
//   cite         "Copy" puts the APA line on the clipboard, then says Copied
//   passages     #q=<passage> (or ?q=) is found in the rendered text,
//                whitespace- and quote-insensitively, marked and scrolled to —
//                in every browser, not only those with text fragments
//   hovercards   a link to an article, paper, document, concept or problem
//                shows its kind, title and dek on hover/focus; Esc dismisses
//   useful       "Mark useful" on library rows, kept in this browser only
//
// No backtick and no dollar-brace anywhere below: this is a template literal.

export const SITE_JS = `(function () {
  "use strict";
  var d = document;

  // ---- / focuses search ---------------------------------------------------
  d.addEventListener("keydown", function (e) {
    if (e.key !== "/" || e.metaKey || e.ctrlKey || e.altKey) return;
    var t = e.target;
    if (t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName))) return;
    e.preventDefault();
    var box = d.querySelector("[data-search-input]");
    if (box) { box.focus(); box.select && box.select(); }
    else location.href = "/search";
  });

  // ---- reading progress ---------------------------------------------------
  var bar = d.getElementById("read-progress");
  if (bar) {
    var tick = false;
    var paint = function () {
      tick = false;
      var h = d.documentElement.scrollHeight - innerHeight;
      bar.style.width = (h > 0 ? Math.min(100, Math.max(0, (scrollY / h) * 100)) : 0) + "%";
    };
    addEventListener("scroll", function () { if (!tick) { tick = true; requestAnimationFrame(paint); } }, { passive: true });
    paint();
  }

  // ---- the rail TOC follows the reader --------------------------------------
  d.querySelectorAll("[data-toc]").forEach(function (list) {
    var links = Array.prototype.slice.call(list.querySelectorAll('a[href^="#"]'));
    var targets = links.map(function (a) { return d.getElementById(decodeURIComponent(a.getAttribute("href").slice(1))); });
    var set = function () {
      var cur = -1;
      for (var i = 0; i < targets.length; i++) {
        if (targets[i] && targets[i].getBoundingClientRect().top < 120) cur = i;
      }
      if (cur < 0 && targets[0]) cur = 0;
      links.forEach(function (a, i) { a.parentNode.classList.toggle("on", i === cur); });
    };
    if ("IntersectionObserver" in window) {
      var io = new IntersectionObserver(set, { rootMargin: "-100px 0px -60% 0px" });
      targets.forEach(function (t) { if (t) io.observe(t); });
    }
    addEventListener("scroll", function () { requestAnimationFrame(set); }, { passive: true });
    set();
  });

  // ---- cite this ------------------------------------------------------------
  d.addEventListener("click", function (e) {
    var b = e.target.closest && e.target.closest("[data-copy-cite]");
    if (!b) return;
    var row = b.closest(".cite-row");
    var text = row && row.querySelector("[data-cite-text]");
    if (!text || !navigator.clipboard) return;
    navigator.clipboard.writeText(text.textContent.trim()).then(function () {
      var label = b.querySelector("span");
      if (!label) return;
      label.textContent = "Copied";
      setTimeout(function () { label.textContent = "Copy"; }, 1800);
    });
  });

  // ---- passage links ----------------------------------------------------------
  function landOnPassage() {
    var h = "";
    try { h = decodeURIComponent((location.hash || "").slice(1)); } catch (err) { h = (location.hash || "").slice(1); }
    var q = new URLSearchParams(location.search).get("q") || (h.indexOf("q=") === 0 ? h.slice(2).split(":~:")[0] : "");
    var go = function (el) { if (el) scrollTo({ top: el.getBoundingClientRect().top + scrollY - 110, behavior: "smooth" }); };
    if (!q) { if (/^s-\\d+$/.test(h)) go(d.getElementById(h)); return; }
    var nc = function (c) {
      c = c.toLowerCase();
      return /[\\u201c\\u201d]/.test(c) ? '"' : /[\\u2018\\u2019]/.test(c) ? "'" : /[\\u2013\\u2014]/.test(c) ? "-" : /\\s/.test(c) ? " " : c;
    };
    var nq = function (s) { return s.split("").map(nc).join("").replace(/[*\\x60]/g, "").replace(/\\s+/g, " ").trim(); };
    var find = function (root, needle) {
      if (!root || !needle) return null;
      var w = d.createTreeWalker(root, NodeFilter.SHOW_TEXT), map = [], full = "", n;
      while ((n = w.nextNode())) {
        var t = n.nodeValue;
        for (var i = 0; i < t.length; i++) {
          var c = nc(t[i]);
          if (c === " " && full.charAt(full.length - 1) === " ") continue;
          full += c; map.push([n, i]);
        }
      }
      var at = full.indexOf(needle);
      return at < 0 ? null : { s: map[at], e: map[at + needle.length - 1] };
    };
    var roots = [d.getElementById("doc-summary"), d.getElementById("doc-body"), d.querySelector("main")];
    var fullQ = nq(q), shortQ = fullQ.split(" ").slice(0, 8).join(" ");
    var hit = null;
    [fullQ, shortQ].some(function (nd) { return roots.some(function (r) { hit = find(r, nd); return !!hit; }); });
    if (!hit) return;
    var range = d.createRange();
    range.setStart(hit.s[0], hit.s[1]);
    range.setEnd(hit.e[0], hit.e[1] + 1);
    var anc = range.commonAncestorContainer;
    var w2 = d.createTreeWalker(anc.nodeType === 3 ? anc.parentNode : anc, NodeFilter.SHOW_TEXT), nodes = [], x;
    while ((x = w2.nextNode())) if (range.intersectsNode(x)) nodes.push(x);
    var first = null;
    nodes.forEach(function (t) {
      var a = t === hit.s[0] ? hit.s[1] : 0, b = t === hit.e[0] ? hit.e[1] + 1 : t.nodeValue.length;
      if (b <= a) return;
      var mid = t.splitText(a); mid.splitText(b - a);
      var mk = d.createElement("mark"); mk.className = "hit";
      mid.parentNode.insertBefore(mk, mid); mk.appendChild(mid);
      first = first || mk;
    });
    go(first);
  }
  if (location.hash || location.search) setTimeout(landOnPassage, 60);
  addEventListener("hashchange", landOnPassage);

  // ---- hovercards -------------------------------------------------------------
  var cards = null, loading = null, card = null, hideT = 0;
  var CARDABLE = /^\\/(articles|p|concepts|open)\\/[^/#?]+$/;
  function load() {
    if (cards || loading) return loading;
    loading = fetch("/hovercards.json").then(function (r) { return r.ok ? r.json() : {}; }).then(function (j) { cards = j; return j; }, function () { cards = {}; return cards; });
    return loading;
  }
  function hide() { if (card) { card.remove(); card = null; } }
  function show(a) {
    var path = a.pathname;
    if (a.origin !== location.origin || !CARDABLE.test(path) || path === location.pathname) return;
    (load() || Promise.resolve(cards)).then(function () {
      var c = cards && cards[path];
      if (!c) return;
      hide();
      card = d.createElement("div");
      card.className = "hcard"; card.setAttribute("role", "tooltip");
      var k = d.createElement("span"); k.className = "pill"; k.textContent = c.kind;
      if (c.bg) { k.style.background = c.bg; k.style.color = c.fg; }
      var t = d.createElement("div"); t.className = "hcard-t"; t.textContent = c.title;
      card.appendChild(k); card.appendChild(t);
      if (c.dek) { var p = d.createElement("div"); p.className = "hcard-d"; p.textContent = c.dek; card.appendChild(p); }
      if (c.meta) { var m = d.createElement("div"); m.className = "hcard-m"; m.textContent = c.meta; card.appendChild(m); }
      d.body.appendChild(card);
      var r = a.getBoundingClientRect(), w = card.offsetWidth, hh = card.offsetHeight;
      var left = Math.max(12, Math.min(innerWidth - w - 12, r.left + scrollX));
      var top = r.bottom + scrollY + 8;
      if (r.bottom + hh + 16 > innerHeight && r.top - hh - 8 > 0) top = r.top + scrollY - hh - 8;
      card.style.left = left + "px"; card.style.top = top + "px";
    });
  }
  d.addEventListener("mouseover", function (e) {
    var a = e.target.closest && e.target.closest("a[href]");
    if (!a || a.closest(".hcard")) return;
    clearTimeout(hideT);
    hideT = setTimeout(function () { show(a); }, 220);
  });
  d.addEventListener("mouseout", function (e) {
    var a = e.target.closest && e.target.closest("a[href]");
    if (!a) return;
    clearTimeout(hideT);
    hideT = setTimeout(hide, 120);
  });
  d.addEventListener("focusin", function (e) { var a = e.target.closest && e.target.closest("a[href]"); if (a) show(a); });
  d.addEventListener("focusout", hide);
  d.addEventListener("keydown", function (e) { if (e.key === "Escape") hide(); });
  addEventListener("scroll", hide, { passive: true });

  // ---- mark useful (this browser only) ------------------------------------------
  var KEY = "canopticon.useful";
  var useful = [];
  try { useful = JSON.parse(localStorage.getItem(KEY) || "[]") || []; } catch (err) { useful = []; }
  d.querySelectorAll("[data-useful]").forEach(function (b) {
    var id = b.getAttribute("data-useful");
    var paintU = function () {
      var on = useful.indexOf(id) > -1;
      b.setAttribute("aria-pressed", on ? "true" : "false");
      b.textContent = on ? "\\u2605 Useful" : "\\u2606 Mark useful";
    };
    b.hidden = false;
    paintU();
    b.addEventListener("click", function () {
      useful = useful.indexOf(id) > -1 ? useful.filter(function (x) { return x !== id; }) : useful.concat([id]);
      try { localStorage.setItem(KEY, JSON.stringify(useful)); } catch (err) {}
      paintU();
    });
  });
})();
`;
