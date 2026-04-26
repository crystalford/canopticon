import { notFound } from "next/navigation";

export const runtime = "edge";

export default async function GenealogyDetail({
  params: _params,
}: { params: Promise<{ slug: string }> }) {
  await _params;
  notFound();
}
