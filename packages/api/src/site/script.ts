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
    // Built pages mark their cite line; the ported papers keep the
    // prototype's markup, where the line is the button's sibling span.
    var row = b.closest(".cite-row") || b.parentElement;
    var text = row && (row.querySelector("[data-cite-text]") || row.querySelector("span"));
    if (!text || !navigator.clipboard) return;
    navigator.clipboard.writeText(text.textContent.trim()).then(function () {
      var label = b.querySelector("span");
      if (!label) return;
      label.textContent = "Copied";
      setTimeout(function () { label.textContent = "Copy"; }, 1800);
    });
  });

  // ---- copy a research prompt ("This thread is still open") -------------------
  d.addEventListener("click", function (e) {
    var b = e.target.closest && e.target.closest("[data-copy-prompt]");
    if (!b || !navigator.clipboard) return;
    var text = b.parentElement && b.parentElement.querySelector("[data-prompt-text]");
    if (!text) return;
    navigator.clipboard.writeText(text.textContent.trim()).then(function () {
      var label = b.querySelector("span");
      if (!label) return;
      label.textContent = "Copied";
      setTimeout(function () { label.textContent = "Copy prompt"; }, 1800);
    });
  });

  // ---- copy link (the hand-built concept pages) -------------------------------
  d.addEventListener("click", function (e) {
    var b = e.target.closest && e.target.closest("[data-copy-link]");
    if (!b || !navigator.clipboard) return;
    navigator.clipboard.writeText(location.href.split("#")[0]).then(function () {
      var was = b.textContent; b.textContent = "Copied";
      setTimeout(function () { b.textContent = was; }, 1800);
    });
  });

  // ---- passage links ----------------------------------------------------------
  function landOnPassage() {
    var h = "";
    try { h = decodeURIComponent((location.hash || "").slice(1)); } catch (err) { h = (location.hash || "").slice(1); }
    // ?q= is a passage only on a document page; everywhere else it is a
    // search or a filter and must not move the reader.
    var fromSearch = d.getElementById("doc-body") ? new URLSearchParams(location.search).get("q") : "";
    var q = fromSearch || (h.indexOf("q=") === 0 ? h.slice(2).split(":~:")[0] : "");
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

  // ---- follow: the consent sentence and the feed address track the boxes --------
  var ff = d.querySelector("[data-follow-form]");
  if (ff) {
    var every = ff.querySelector("[data-everything]");
    var boxes = Array.prototype.slice.call(ff.querySelectorAll("[data-topic]"));
    var consent = ff.querySelector("[data-consent]");
    var feed = d.querySelector("[data-feed-url]");
    var phrase = function (p) {
      if (!p.length) return "anything on the site";
      if (p.length === 1) return p[0];
      return p.length + " topics";
    };
    var sync = function () {
      var picked = boxes.filter(function (b) { return b.checked; });
      if (every) every.checked = picked.length === 0;
      if (consent) consent.textContent = "By subscribing you agree to receive Canopticon's weekly email from Chris Telford, covering " + phrase(picked.map(function (b) { return b.value; })) + ". You'll confirm by email first, and you can unsubscribe at any time with one click. Contact: canopticon.com";
      var slugs = picked.map(function (b) { return b.getAttribute("data-topic"); });
      if (feed) feed.textContent = !slugs.length ? "canopticon.com/feed.xml" : slugs.length === 1 ? "canopticon.com/feeds/" + slugs[0] + ".xml" : "canopticon.com/feed.xml?t=" + slugs.join(",");
    };
    boxes.forEach(function (b) { b.addEventListener("change", sync); });
    if (every) every.addEventListener("change", function () { if (every.checked) boxes.forEach(function (b) { b.checked = false; }); sync(); });
  }

  // ---- admin: a chosen file sends itself; a dropped one goes the same way --
  d.querySelectorAll("[data-autosubmit]").forEach(function (inp) {
    inp.addEventListener("change", function () { if (inp.files && inp.files.length && inp.form) inp.form.submit(); });
  });
  var drop = d.querySelector("[data-drop]");
  var upForm = d.querySelector("[data-upload-form]");
  if (drop && upForm) {
    var fileInput = upForm.querySelector('input[type="file"]');
    ["dragenter", "dragover"].forEach(function (ev) {
      drop.addEventListener(ev, function (e) { e.preventDefault(); drop.classList.add("over"); });
    });
    ["dragleave", "drop"].forEach(function (ev) {
      drop.addEventListener(ev, function () { drop.classList.remove("over"); });
    });
    drop.addEventListener("drop", function (e) {
      e.preventDefault();
      if (!e.dataTransfer || !e.dataTransfer.files.length || !fileInput) return;
      fileInput.files = e.dataTransfer.files;
      upForm.submit();
    });
  }

  // ---- Admin's composer: say which kind it will start, before it starts ------
  // The rules come from the server (write/kind.ts), so the page and the
  // route guess alike. A kind picked with "make it" sticks until the box is
  // cleared; without this script the route guesses.
  var cmp = d.querySelector("[data-cmp]");
  if (cmp) {
    var rules = [];
    try {
      rules = JSON.parse(cmp.getAttribute("data-kinds") || "[]").map(function (r) { return [r[0], new RegExp(r[1], r[2])]; });
    } catch (err) { rules = []; }
    var cText = cmp.querySelector("[data-cmp-text]");
    var cGuess = cmp.querySelector("[data-cmp-guess]");
    var cKind = cmp.querySelector("[data-cmp-kind]");
    var cWhat = cmp.querySelector("[data-cmp-what]");
    var cInput = cmp.querySelector("[data-cmp-kind-input]");
    var cFile = cmp.querySelector("[data-cmp-file]");
    var cFiles = cmp.querySelector("[data-cmp-files]");
    var makes = Array.prototype.slice.call(cmp.querySelectorAll("[data-cmp-make]"));
    var picked = "";
    var guess = function () {
      var t = cText.value;
      for (var i = 0; i < rules.length; i++) if (rules[i][1].test(t)) return rules[i][0];
      if (!t.trim() && cFile && cFile.files && cFile.files.length) return "read";
      return "research";
    };
    var show = function () {
      var hasFiles = cFile && cFile.files && cFile.files.length;
      if (!cText.value.trim() && !hasFiles) { picked = ""; cGuess.hidden = true; cInput.value = ""; return; }
      var k = picked || guess();
      cInput.value = k;
      makes.forEach(function (b) {
        var me = b.getAttribute("data-cmp-make") === k;
        b.hidden = me;
        if (me) { cKind.textContent = b.getAttribute("data-name"); cWhat.textContent = "Claude " + b.getAttribute("data-what"); }
      });
      cGuess.hidden = false;
    };
    makes.forEach(function (b) {
      b.addEventListener("click", function () { picked = b.getAttribute("data-cmp-make"); show(); cText.focus(); });
    });
    cText.addEventListener("input", show);
    if (cFile) cFile.addEventListener("change", function () {
      cFiles.innerHTML = "";
      Array.prototype.forEach.call(cFile.files || [], function (f) {
        var el = d.createElement("span"); el.className = "cmp-file"; el.textContent = f.name; cFiles.appendChild(el);
      });
      cFiles.hidden = !(cFile.files && cFile.files.length);
      show();
    });
  }

  // ---- Admin on a phone: your work and the queue are two tabs ---------------
  var dTabs = d.querySelector("[data-desk-tabs]");
  var desk = d.querySelector("[data-desk]");
  if (dTabs && desk) {
    var dView = function (v) {
      desk.setAttribute("data-view", v);
      [].forEach.call(dTabs.querySelectorAll("[data-desk-tab]"), function (b) {
        b.setAttribute("aria-selected", b.getAttribute("data-desk-tab") === v ? "true" : "false");
      });
    };
    dTabs.hidden = false;
    desk.classList.add("tabbed");
    // Back from an action on the queue (a flash, Show decided): open on it.
    dView(/[?&](uploaded|ingested|dedup|done|error|decided)=/.test(location.search) ? "queue" : "side");
    dTabs.addEventListener("click", function (e) {
      var b = e.target.closest("[data-desk-tab]");
      if (b) dView(b.getAttribute("data-desk-tab"));
    });
  }

  // ---- ⋯ menus close on Escape or a click elsewhere ---------------------------
  d.addEventListener("click", function (e) {
    d.querySelectorAll("details.more[open]").forEach(function (m) { if (!m.contains(e.target)) m.removeAttribute("open"); });
  });
  d.addEventListener("keydown", function (e) {
    if (e.key !== "Escape") return;
    d.querySelectorAll("details.more[open]").forEach(function (m) { m.removeAttribute("open"); var s = m.querySelector("summary"); if (s) s.focus(); });
  });

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
  // "Marked useful": the server sent every row newest-first; lift the marked
  // ones to the top, keeping their order, and renumber.
  var lib = d.querySelector("[data-useful-sort]");
  if (lib) {
    var rows = [].slice.call(lib.querySelectorAll(".lib-row"));
    var marked = function (r) {
      var b = r.querySelector("[data-useful]");
      return b && useful.indexOf(b.getAttribute("data-useful")) > -1;
    };
    var ordered = rows.filter(marked).concat(rows.filter(function (r) { return !marked(r); }));
    var tail = rows.length ? rows[rows.length - 1].nextSibling : null;
    ordered.forEach(function (r, i) {
      lib.insertBefore(r, tail);
      var n = r.querySelector(".lib-rank");
      if (n) n.textContent = String(i + 1).padStart(2, "0");
    });
  }
  // ---- the workspace (/admin/write/<id>): chat beside the page ----------------
  var ws = d.querySelector("[data-ws]");
  if (ws) {
    var wsForm = ws.querySelector("[data-ws-form]");
    var wsLog = ws.querySelector("[data-ws-log]");
    var wsText = wsForm.querySelector("textarea");
    var wsSend = wsForm.querySelector("button[type=submit]");
    var wsFrame = ws.querySelector("[data-ws-preview]");
    var wsFlag = ws.querySelector("[data-ws-flag]");
    var wsFlagText = ws.querySelector("[data-ws-flag-text]");
    var wsCost = ws.querySelector("[data-ws-cost]");
    var wsCheck = ws.querySelector("[data-ws-check]");
    var flagged = "";
    var line = function (cls, text) {
      var el = d.createElement("div"); el.className = cls; el.textContent = text;
      wsLog.appendChild(el); wsLog.scrollTop = wsLog.scrollHeight; return el;
    };
    // On a phone the chat and the page are two tabs; the page tab says when
    // the page changed while the chat was showing.
    var tabs = ws.querySelector("[data-ws-tabs]");
    var view = function (v) {
      ws.setAttribute("data-view", v);
      if (!tabs) return;
      [].forEach.call(tabs.querySelectorAll("[data-ws-tab]"), function (b) {
        var on = b.getAttribute("data-ws-tab") === v;
        b.setAttribute("aria-selected", on ? "true" : "false");
        if (on) b.classList.remove("fresh");
      });
    };
    if (tabs) {
      tabs.hidden = false;
      ws.classList.add("tabbed");
      view("chat");
      tabs.addEventListener("click", function (e) {
        var b = e.target.closest("[data-ws-tab]");
        if (b) view(b.getAttribute("data-ws-tab"));
      });
    }
    var restate = function () {
      return fetch(location.pathname, { headers: { accept: "text/html" } }).then(function (res) {
        return res.ok ? res.text() : null;
      }).then(function (html) {
        if (!html) return;
        var doc = new DOMParser().parseFromString(html, "text/html");
        [["[data-ws-state]"], ["[data-ws-title]"]].forEach(function (k) {
          var now = ws.querySelector(k[0]), fresh = doc.querySelector(k[0]);
          if (now && fresh) now.innerHTML = fresh.innerHTML;
        });
        wsCheck = ws.querySelector("[data-ws-check]");
        if (doc.title) {
          baseTitle = doc.title;
          if (!running) d.title = (/^✓ /.test(d.title) ? "✓ " : "") + baseTitle;
        }
      }).catch(function () {});
    };
    var refresh = function () {
      if (tabs && ws.getAttribute("data-view") === "chat") {
        var pt = tabs.querySelector('[data-ws-tab="page"]');
        if (pt) pt.classList.add("fresh");
      }
      var y = 0;
      try { y = wsFrame.contentWindow.scrollY; } catch (err) {}
      wsFrame.onload = function () { try { wsFrame.contentWindow.scrollTo(0, y); } catch (err) {} };
      wsFrame.src = wsFrame.src.split("#")[0];
    };
    var setFlag = function (t) {
      flagged = t || "";
      wsFlag.hidden = !flagged;
      wsFlagText.textContent = flagged.length > 160 ? flagged.slice(0, 159) + "…" : flagged;
      if (flagged) { if (tabs) view("chat"); wsText.focus(); }
    };
    addEventListener("message", function (e) {
      if (e.origin !== location.origin || !e.data || e.data.type !== "canopticon-flag") return;
      setFlag(e.data.text);
    });
    ws.querySelector("[data-ws-flag-clear]").addEventListener("click", function () { setFlag(""); });
    wsLog.scrollTop = wsLog.scrollHeight;
    // "Ask Claude to fix it" in the not-ready bar goes through the chat, live.
    // The bar is redrawn after each turn, so the listener sits on the page.
    ws.addEventListener("submit", function (e) {
      var f = e.target.closest ? e.target.closest("[data-ws-ask]") : null;
      if (!f || wsSend.disabled) return;
      e.preventDefault();
      var t = f.querySelector('input[name="text"]');
      wsText.value = t ? t.value : "";
      wsForm.requestSubmit();
    });
    // Suggestions: two lines above an empty box; a click fills it.
    var tips = ws.querySelector("[data-ws-tips]");
    var syncTips = function () { if (tips) tips.hidden = !!wsText.value.trim() || wsText.disabled; };
    if (tips) {
      tips.addEventListener("click", function (e) {
        var b = e.target.closest("[data-ws-tip]");
        if (!b) return;
        wsText.value = b.textContent.replace(/^\\s*↳\\s*/, "").trim();
        syncTips(); wsText.focus();
      });
      wsText.addEventListener("input", syncTips);
      syncTips();
    }
    wsText.addEventListener("keydown", function (e) {
      if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) { e.preventDefault(); wsForm.requestSubmit(); }
    });
    // ---- reports added in the chat: stored and held in Admin, named to Claude
    var wsFiles = ws.querySelector("[data-ws-files]");
    var wsFile = ws.querySelector("[data-ws-file]");
    var attached = [];
    var chip = function (text, bad) {
      var el = d.createElement("span"); el.className = "ws-file" + (bad ? " bad" : ""); el.textContent = text;
      wsFiles.appendChild(el); wsFiles.hidden = false; return el;
    };
    var addFiles = function (list) {
      if (!list || !list.length) return;
      var fd = new FormData();
      Array.prototype.forEach.call(list, function (f) { fd.append("file", f); });
      var wait = chip("Adding " + list.length + (list.length === 1 ? " file…" : " files…"));
      fetch(wsForm.action.slice(0, -"/turn".length) + "/attach", { method: "POST", body: fd })
        .then(function (r) { return r.json(); })
        .then(function (j) {
          wait.remove();
          (j.added || []).forEach(function (a) {
            if (a.error || !a.id) { chip(a.title + ": " + (a.error || "could not be read"), true); return; }
            attached.push(a); chip(a.title + (a.duplicate ? " (already in the record)" : ""));
          });
          if (j.error) chip(j.error, true);
        })
        .catch(function () { wait.textContent = "The files could not be added."; wait.className = "ws-file bad"; });
    };
    wsFile.addEventListener("change", function () { addFiles(wsFile.files); wsFile.value = ""; });
    // A read's cards land one by one; the board reloads at most every two seconds.
    var soonTimer = 0;
    var soon = function () {
      if (soonTimer) return;
      soonTimer = setTimeout(function () { soonTimer = 0; refresh(); }, 2000);
    };
    var chat = ws.querySelector(".ws-chat");
    chat.addEventListener("dragover", function (e) { e.preventDefault(); chat.classList.add("drop"); });
    chat.addEventListener("dragleave", function () { chat.classList.remove("drop"); });
    chat.addEventListener("drop", function (e) { e.preventDefault(); chat.classList.remove("drop"); addFiles(e.dataTransfer.files); });

    // ---- steps: runs of activity lines fold into one line with counts ------
    var stepCounts = function (texts) {
      var c = { s: 0, r: 0, n: 0, w: 0 };
      texts.forEach(function (t) {
        t = t.replace(/^§\\d+ /, "");
        if (/^Searched/.test(t)) c.s++;
        else if (/^Read: /.test(t)) c.r++;
        else if (/^Noted/.test(t)) c.n++;
        else if (/^Wrote|^Revised/.test(t)) c.w++;
      });
      var bits = [];
      if (c.s) bits.push("searched " + c.s);
      if (c.r) bits.push("read " + c.r + (c.r === 1 ? " page" : " pages"));
      if (c.n) bits.push("noted " + c.n);
      if (c.w) bits.push("wrote " + c.w);
      var s = texts.length + " steps" + (bits.length ? " · " + bits.join(" · ") : "");
      return s.charAt(0).toUpperCase() + s.slice(1);
    };
    var act = function (text, before) {
      var last = before ? before.previousElementSibling : wsLog.lastElementChild;
      var g = last && last.classList && last.classList.contains("ws-steps") ? last : null;
      if (!g) {
        g = d.createElement("details"); g.className = "ws-steps";
        var sm = d.createElement("summary"); g.appendChild(sm);
        var box = d.createElement("div"); box.className = "ws-steps-l"; g.appendChild(box);
        wsLog.insertBefore(g, before || null);
      }
      var el = d.createElement("div"); el.className = "ws-act"; el.textContent = text;
      g.lastElementChild.appendChild(el);
      var all = [].map.call(g.lastElementChild.children, function (x) { return x.textContent; });
      g.firstElementChild.innerHTML = "";
      g.firstElementChild.appendChild(d.createTextNode(all.length === 1 ? all[0] : stepCounts(all)));
      var pill = d.createElement("span"); pill.className = "ws-steps-p"; pill.textContent = "Steps ▾";
      if (all.length > 1) g.firstElementChild.appendChild(pill);
      wsLog.scrollTop = wsLog.scrollHeight;
    };

    // ---- while Claude works: stages, true counts, time, Stop ---------------------
    var prog = ws.querySelector("[data-ws-prog]");
    var baseTitle = d.title;
    var running = false;
    var guard = function (e) { if (running) { e.preventDefault(); e.returnValue = ""; } };
    addEventListener("beforeunload", guard);
    addEventListener("focus", function () { if (!running && /^✓ /.test(d.title)) d.title = baseTitle; });
    var mmss = function (ms) { var t = Math.floor(ms / 1000); return Math.floor(t / 60) + ":" + ("0" + (t % 60)).slice(-2); };
    var progStart = function () {
      running = true;
      prog.hidden = false;
      prog.querySelector("[data-ws-stages]").hidden = true;
      prog.querySelector("[data-ws-counts]").textContent = "Starting…";
      var stopB = prog.querySelector("[data-ws-stop]");
      stopB.disabled = false; stopB.lastChild.textContent = " Stop";
      var notify = prog.querySelector("[data-ws-notify]");
      notify.hidden = !("Notification" in window) || Notification.permission !== "default";
      var t0 = Date.now(), clock = prog.querySelector("[data-ws-clock]");
      clock.textContent = "0:00";
      prog.timer = setInterval(function () { clock.textContent = mmss(Date.now() - t0); }, 1000);
      prog.t0 = t0;
      d.title = "(working) " + baseTitle;
    };
    var progShow = function (p) {
      var st = prog.querySelector("[data-ws-stages]"); st.hidden = false;
      var order = ["plan", "research", "write", "review", "summary"], at = order.indexOf(p.stage);
      [].forEach.call(st.children, function (li, i) { li.className = i < at ? "done" : i === at ? "now" : ""; });
      var bits = [];
      if (p.sections) bits.push(p.written + " of " + p.sections + " sections written");
      if (p.researchers.working) bits.push(p.researchers.working + (p.researchers.working === 1 ? " researcher" : " researchers") + " working");
      if (p.reviewers.working) bits.push(p.reviewers.working + (p.reviewers.working === 1 ? " reviewer" : " reviewers") + " reading");
      bits.push(p.notes + (p.notes === 1 ? " note" : " notes"));
      bits.push(p.pages + (p.pages === 1 ? " page read" : " pages read"));
      prog.querySelector("[data-ws-counts]").textContent = bits.join(" · ");
      d.title = "(" + (p.sections ? p.written + "/" + p.sections : order[at]) + ") " + baseTitle;
    };
    var progEnd = function () {
      running = false;
      clearInterval(prog.timer);
      prog.hidden = true;
      return Date.now() - (prog.t0 || Date.now());
    };
    if (prog) {
      prog.querySelector("[data-ws-stop]").addEventListener("click", function () {
        var b = this; b.disabled = true; b.lastChild.textContent = " Stopping…";
        fetch(wsForm.action.slice(0, -"/turn".length) + "/stop", { method: "POST", headers: { accept: "application/json" } })
          .catch(function () { b.disabled = false; b.lastChild.textContent = " Stop"; });
      });
      prog.querySelector("[data-ws-notify]").addEventListener("click", function () {
        var b = this;
        Notification.requestPermission().then(function () { b.hidden = true; });
      });
    }
    // The card at the end: what the turn ended with, and what to do next.
    var lastCheck = null;
    var finishCard = function (sum, ms, usage) {
      if (!sum) return null;
      var head = sum.stopped ? "Stopped after " + mmss(ms) : sum.cut ? "Ran out of steps after " + mmss(ms) : "Finished in " + mmss(ms);
      var bits = [sum.words.toLocaleString() + " words"];
      if (sum.sections) bits.push(sum.sections + " sections");
      if (lastCheck && lastCheck.total) bits.push(lastCheck.total + " quotations" + (lastCheck.failed.length ? ", " + lastCheck.failed.length + " not word for word" : ", all found"));
      if (sum.cited) bits.push(sum.cited + " sources" + (sum.independent != null ? ", about " + sum.independent + " independent" : ""));
      if (sum.flags != null && sum.cited) bits.push(sum.flags + (sum.flags === 1 ? " reviewer flag" : " reviewer flags"));
      if (usage) bits.push("$" + (usage.cents / 100).toFixed(2) + " in all");
      var c = d.createElement("div"); c.className = "ws-done" + (sum.stopped || sum.cut ? " partial" : "");
      var h = d.createElement("div"); h.className = "ws-done-h"; h.textContent = (sum.stopped || sum.cut ? "" : "✓ ") + head; c.appendChild(h);
      var n = d.createElement("div"); n.className = "ws-done-n"; n.textContent = bits.join(" · "); c.appendChild(n);
      var a = d.createElement("div"); a.className = "ws-done-a"; c.appendChild(a);
      wsLog.appendChild(c); wsLog.scrollTop = wsLog.scrollHeight;
      return a;
    };
    var fillActions = function (row) {
      if (!row) return;
      // The same buttons as the top bar, with the same gates (drawn by the server).
      [].forEach.call(ws.querySelectorAll(".ws-top .ws-pub form"), function (f) {
        var b = f.querySelector("button");
        if (b && !b.disabled) row.appendChild(f.cloneNode(true));
      });
    };

    wsForm.addEventListener("submit", function (e) {
      if (!window.fetch || !window.TextDecoder) return;
      e.preventDefault();
      var note = wsText.value.trim();
      if (!note && !flagged && !attached.length) return;
      var files = attached.length
        ? "I've added these to the record (waiting in Admin):\\n" + attached.map(function (a) { return "- " + a.title + " (id: " + a.id + ")"; }).join("\\n") + "\\n\\n"
        : "";
      if (attached.length && !note) note = "Read them.";
      attached = []; wsFiles.innerHTML = ""; wsFiles.hidden = true;
      var text = files + (flagged ? flagged.split("\\n").map(function (l) { return "> " + l; }).join("\\n") + "\\n\\n" : "") + note;
      var hello = wsLog.querySelector(".ws-hello");
      if (hello) hello.remove();
      line("ws-msg you", text);
      wsText.value = ""; setFlag(""); wsSend.disabled = true; wsText.disabled = true;
      var reply = null, finished = false, wrote = false;
      var status = line("ws-act live", "Working… keep this tab open until Claude finishes.");
      var ended = null, endUsage = null;
      if (prog) progStart();
      var handle = function (ev) {
        if (ev.type === "text") {
          if (!reply) { reply = line("ws-msg claude", ""); wsLog.insertBefore(status, null); }
          reply.textContent += ev.text;
          wsLog.scrollTop = wsLog.scrollHeight;
        } else if (ev.type === "activity") {
          act(ev.text, status); reply = null;
        } else if (ev.type === "progress") {
          if (prog) progShow(ev.p);
        } else if (ev.type === "draft") {
          var c = ev.check, n = c.failed.length;
          lastCheck = c;
          wsCheck.innerHTML = !c.total ? '<span class="ws-check">No quotations yet</span>'
            : n ? '<span class="ws-check bad">' + c.total + " quotations · " + n + " not word for word</span>"
            : '<span class="ws-check ok">' + c.total + " quotations · all word for word</span>";
          wrote = true; soon();
        } else if (ev.type === "update") {
          line("ws-upd", ev.text); reply = null; wsLog.insertBefore(status, null);
        } else if (ev.type === "card") {
          act(ev.label, status); reply = null;
          soon();
        } else if (ev.type === "proposal" && ev.html) {
          var box = d.createElement("div"); box.innerHTML = ev.html;
          if (box.firstElementChild) wsLog.appendChild(box.firstElementChild);
          reply = null; wsLog.insertBefore(status, null); wsLog.scrollTop = wsLog.scrollHeight;
        } else if (ev.type === "error") {
          line("ws-act bad", ev.message);
        } else if (ev.type === "done") {
          if (ev.usage && wsCost) wsCost.textContent = "$" + (ev.usage.cents / 100).toFixed(2) + " so far";
          ended = ev.summary || null; endUsage = ev.usage || null;
          if (ws.getAttribute("data-ws-kind") === "read") finished = true;
        }
      };
      fetch(wsForm.action, {
        method: "POST",
        headers: { accept: "text/event-stream", "content-type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({ text: text }),
      }).then(function (res) {
        if (!res.ok || (res.headers.get("content-type") || "").indexOf("text/event-stream") !== 0) {
          line("ws-act bad", "The server refused the message (" + res.status + "). Nothing was sent to Claude.");
          return;
        }
        var reader = res.body.getReader(), dec = new TextDecoder(), buf = "";
        var pump = function () {
          return reader.read().then(function (r) {
            if (r.done) return;
            buf += dec.decode(r.value, { stream: true });
            var parts = buf.split("\\n\\n"); buf = parts.pop();
            parts.forEach(function (p) {
              if (p.indexOf("data: ") !== 0) return;
              try { handle(JSON.parse(p.slice(6))); } catch (err) {}
            });
            return pump();
          });
        };
        return pump();
      }).catch(function () {
        line("ws-act bad", "The connection dropped. What was done is saved; reload to see it.");
      }).then(function () {
        status.remove(); wsSend.disabled = false; wsText.disabled = false; wsText.focus();
        if (tips) syncTips();
        var ms = prog ? progEnd() : 0;
        d.title = (ended && !ended.stopped && !ended.cut ? "✓ " : "") + baseTitle;
        var row = finishCard(ended, ms, endUsage);
        if (ended && ms > 120000 && "Notification" in window && Notification.permission === "granted" && d.hidden) {
          try { new Notification(ended.stopped ? "Stopped" : "Claude has finished", { body: baseTitle }); } catch (err) {}
        }
        // A read's receipt and its Show button live outside the frame: reload all.
        if (finished) location.reload();
        // The bar (title, pages read, what keeps it from Publish or Admin,
        // the buttons) was drawn when the page opened: redraw it from the server.
        else if (wrote) restate().then(function () { fillActions(row); });
      });
    });
    // Read it lands here with the first message waiting: send it once.
    var start = ws.getAttribute("data-ws-autostart");
    if (start && window.fetch && window.TextDecoder) {
      try { history.replaceState(null, "", location.pathname); } catch (err) {}
      wsText.value = start;
      wsForm.requestSubmit();
    }
  }
})();
`;
