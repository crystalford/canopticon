import { notFound } from "next/navigation";

export const runtime = "edge";

export default async function FindingDetail({
  params: _params,
}: { params: Promise<{ slug: string }> }) {
  // Findings page is wired post-launch when novelty_surfacer outputs are
  // promoted to the public cache.
  await _params;
  notFound();
}
