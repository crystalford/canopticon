// Read it (docs/read-it.md): the button, and the author's decisions on what
// the read found. Pressing Read it opens a read in the workspace with what the
// document's own structure gives already laid out (no model), and the first
// message waiting; the page sends it, so Claude reads only while someone
// watches (rule 4). Cards are kept or dismissed here; dismissed is forever.
// Cloudflare Access gates /op at the edge.

import { resolveOperatorId } from "../../public/data";
import { invalidateUploads } from "../../site/uploads";
import { d1Drafts } from "../../write/drafts";
import { cardKey, d1Reads, ignoreKey, locateSpan, pitchBrief, shapeOf } from "../../write/read";
import { sourceText, sourceTitles } from "../../write/sources";
import { operatorApp } from "./app";

const app = operatorApp();

app.post("/read/:docId", async (c) => {
  const docId = c.req.param("docId");
  const userId = await resolveOperatorId(c.env.DB).catch(() => null);
  if (!userId) return c.redirect("/admin", 303);
  const text = await sourceText(c.env, docId);
  // Only what the workspace may read: public research, the author's own
  // published or waiting uploads — never a held or personal document.
  if (text == null) return c.redirect("/admin", 303);
  const reads = d1Reads(c.env, userId);
  const drafts = d1Drafts(c.env, userId);
  // One read per document: pressing again opens the one there is.
  const last = await reads.latest(docId);
  if (last?.draftId && (await drafts.get(last.draftId).catch(() => null))) {
    // A read that never got going (the tab closed, Claude not connected)
    // starts again when pressed; one that ran opens as it is.
    const fresh =
      last.status === "reading" && !(await drafts.messages(last.draftId).catch(() => [])).length;
    return c.redirect(`/admin/write/${last.draftId}${fresh ? "?start=1" : ""}`, 303);
  }

  const title = (await sourceTitles(c.env, [docId])).get(docId) ?? docId;
  const draft = await drafts.create("read");
  const read = await reads.start(docId, draft.id, text.length);
  await drafts.save(draft.id, {
    meta: { title: `Read: ${title}`, based_on: [docId], readId: read.id },
  });

  // What the file's structure already says, taken first and free. The
  // document's own Key Findings and Caveats are the author's, so they start
  // kept; a dismiss still removes one.
  let found = 0;
  for (const s of shapeOf(text).cards) {
    const span = locateSpan(text, s.span);
    if (!span) continue;
    const key = ignoreKey(s.kind, span);
    if (await reads.isIgnored(docId, key)) continue;
    await reads.add({
      readId: read.id,
      docId,
      kind: s.kind,
      origin: "shape",
      role: s.kind === "finding" ? "finding" : undefined,
      span,
      section: s.section,
      data: s.kind === "question_answered" ? { question: s.section, answer: span } : {},
      status: "kept",
    });
    found++;
  }
  if (found) await reads.update(read.id, { verified: found });
  return c.redirect(`/admin/write/${draft.id}?start=1`, 303);
});

app.post("/read/card/:id/:act{keep|dismiss}", async (c) => {
  const userId = await resolveOperatorId(c.env.DB).catch(() => null);
  if (!userId) return c.redirect("/admin/write", 303);
  const reads = d1Reads(c.env, userId);
  const card = await reads.derivation(c.req.param("id"));
  if (!card) return c.redirect("/admin/write", 303);
  const read = await reads.get(card.readId);
  if (c.req.param("act") === "keep") await reads.decide(card.id, "kept");
  else {
    await reads.decide(card.id, "dismissed");
    await reads.ignore(card.docId, card.kind, cardKey(card));
  }
  // A read on the page changes the page: the overlay reloads.
  if (read?.status === "shown") invalidateUploads();
  // The board is the workspace's preview frame; the form posts inside it.
  return c.redirect(
    read?.draftId ? `/admin/write/${read.draftId}/preview#c-${card.id}` : "/admin/write",
    303,
  );
});

app.post("/read/:readId/keep-all", async (c) => {
  const userId = await resolveOperatorId(c.env.DB).catch(() => null);
  if (!userId) return c.redirect("/admin/write", 303);
  const reads = d1Reads(c.env, userId);
  const read = await reads.get(c.req.param("readId"));
  if (!read) return c.redirect("/admin/write", 303);
  for (const d of await reads.derivations(read.id))
    if (d.status === "proposed") await reads.decide(d.id, "kept");
  if (read.status === "shown") invalidateUploads();
  return c.redirect(read.draftId ? `/admin/write/${read.draftId}/preview` : "/admin/write", 303);
});

// "Show on the page" — the one approval per read (docs/read-it.md, decision
// A): what was kept goes on the document's public page. "Take it off" is its
// Undo; the read and its cards stay.
app.post("/read/:readId/:act{show|hide}", async (c) => {
  const userId = await resolveOperatorId(c.env.DB).catch(() => null);
  if (!userId) return c.redirect("/admin/write", 303);
  const reads = d1Reads(c.env, userId);
  const read = await reads.get(c.req.param("readId"));
  if (!read) return c.redirect("/admin/write", 303);
  if (c.req.param("act") === "show")
    await reads.update(read.id, { status: "shown", shownAt: new Date().toISOString() });
  else await reads.update(read.id, { status: "read" });
  invalidateUploads();
  const done =
    c.req.param("act") === "show"
      ? "What you kept is on the document's page."
      : "Taken off the document's page. The read and its cards are kept.";
  return c.redirect(
    read.draftId ? `/admin/write/${read.draftId}?done=${encodeURIComponent(done)}` : "/admin/write",
    303,
  );
});

// "Write this": a possible article starts an article draft, seeded with the
// thesis and the passages that carry it. Pressed again, it opens that draft.
app.post("/read/card/:id/write", async (c) => {
  const userId = await resolveOperatorId(c.env.DB).catch(() => null);
  if (!userId) return c.redirect("/admin/write", 303);
  const reads = d1Reads(c.env, userId);
  const drafts = d1Drafts(c.env, userId);
  const card = await reads.derivation(c.req.param("id"));
  if (!card || card.kind !== "pitch") return c.redirect("/admin/write", 303);
  const started = typeof card.data.draftId === "string" ? card.data.draftId : "";
  if (started && (await drafts.get(started).catch(() => null)))
    return c.redirect(`/admin/write/${started}`, 303);
  const title = (await sourceTitles(c.env, [card.docId])).get(card.docId) ?? card.docId;
  const draft = await drafts.create("article");
  const thesis = String(card.data.thesis ?? "");
  await drafts.save(draft.id, {
    meta: { thesis, based_on: [card.docId], seed: pitchBrief(card, title) },
  });
  if (card.status === "proposed") await reads.decide(card.id, "kept");
  await reads.setData(card.id, { ...card.data, draftId: draft.id });
  return c.redirect(`/admin/write/${draft.id}?start=1`, 303);
});

export default app;
