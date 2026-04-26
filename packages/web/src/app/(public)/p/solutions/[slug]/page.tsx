import { notFound } from "next/navigation";

export const runtime = "edge";

export default async function SolutionInventoryDetail({
  params: _params,
}: { params: Promise<{ slug: string }> }) {
  await _params;
  notFound();
}
