// "Note this" — the operator's reading affordance on a /p/ page
// (docs/the-record.md §5c). Served at /op/notes.js, behind Cloudflare Access,
// and included by piece-template.ts only when the page was rendered for the
// operator. The reader page needs none of this: the readings themselves are
// server-rendered, and the form this script fills is an ordinary POST.
//
// Select text inside the article → a small floating pair of buttons:
// "Note this" → the note form, passage prefilled read-only, one textarea for
// the note; "Research this" → the action bar's free question box, prefilled
// with the selection and focused (docs/the-record.md §6). No new route:
// both are ordinary forms the server already rendered. Vanilla, no
// framework, and nothing here talks to a model.

export const NOTES_LIVE_JS = `(function () {
  var article = document.querySelector("article.reading");
  var form = document.getElementById("note-form");
  if (!article || !form) return;
  var passage = form.querySelector("[name=passage]");
  var note = form.querySelector("[name=note]");
  var status = form.querySelector(".note-status");
  var ask = document.querySelector("#op-ask [name=seed]");
  var btn = document.createElement("div");
  btn.className = "note-this";
  btn.hidden = true;
  var noteBtn = document.createElement("button");
  noteBtn.type = "button";
  noteBtn.textContent = "Note this";
  btn.appendChild(noteBtn);
  var askBtn = document.createElement("button");
  askBtn.type = "button";
  askBtn.textContent = "Research this";
  if (ask) btn.appendChild(askBtn);
  document.body.appendChild(btn);

  function selectedText() {
    var sel = window.getSelection();
    if (!sel || sel.isCollapsed || sel.rangeCount === 0) return "";
    var range = sel.getRangeAt(0);
    if (!article.contains(range.commonAncestorContainer)) return "";
    // A note in the margin is the operator's text, not the document's: a
    // selection inside one could never be verbatim, so it offers nothing.
    var node = range.commonAncestorContainer;
    var el = node.nodeType === 1 ? node : node.parentElement;
    if (el && el.closest && el.closest("aside.reading")) return "";
    return sel.toString().replace(/\\s+/g, " ").trim();
  }
  function place() {
    var text = selectedText();
    if (text.length < 40) { btn.hidden = true; return; }
    var rect = window.getSelection().getRangeAt(0).getBoundingClientRect();
    btn.style.top = (window.scrollY + rect.top - 36) + "px";
    btn.style.left = (window.scrollX + rect.left) + "px";
    btn.hidden = false;
  }
  document.addEventListener("mouseup", function () { setTimeout(place, 0); });
  document.addEventListener("keyup", function (e) { if (e.shiftKey) place(); });
  btn.addEventListener("mousedown", function (e) { e.preventDefault(); });
  noteBtn.addEventListener("click", function () {
    var text = selectedText();
    if (text.length < 40) return;
    passage.value = text;
    form.hidden = false;
    btn.hidden = true;
    form.scrollIntoView({ behavior: "smooth", block: "center" });
    note.focus();
  });
  askBtn.addEventListener("click", function () {
    var text = selectedText();
    if (!ask || !text) return;
    ask.value = text;
    btn.hidden = true;
    ask.scrollIntoView({ behavior: "smooth", block: "center" });
    ask.focus();
  });
  form.querySelector(".note-cancel").addEventListener("click", function () {
    form.hidden = true;
    passage.value = "";
    note.value = "";
  });
  // POST /op/readings redirects back here with ?error= when the passage was
  // not verbatim in the document; the page itself never reads the query.
  var err = new URLSearchParams(location.search).get("error");
  if (err && status) {
    status.textContent = "Not saved: " + err;
    form.hidden = false;
  }
})();
`;
