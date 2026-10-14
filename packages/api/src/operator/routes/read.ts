// Read it (docs/read-it.md): the button, and the author's decisions on what
// the read found. Pressing Read it opens a read in the workspace with what the
// document's own structure gives already laid out (no model), and the first
// message waiting; the page sends it, so Claude reads only while someone
// watches (rule 4). Cards are kept or dismissed here; dismissed is forever.
// Cloudflare Access gates /op at the edge.

import { resolveOperatorId } from "../../public/data";
import { d1Drafts } from "../../write/drafts";
import { d1Reads, ignoreKey, locateSpan, shapeOf } from "../../write/read";
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
  if (last?.draftId && (await drafts.get(last.draftId).catch(() => null)))
    return c.redirect(`/admin/write/${last.draftId}`, 303);

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
    await reads.ignore(card.docId, card.kind, ignoreKey(card.kind, card.span));
  }
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
  return c.redirect(read.draftId ? `/admin/write/${read.draftId}/preview` : "/admin/write", 303);
});

export default app;
