import { notFound } from "next/navigation";

export const runtime = "edge";

interface PageProps {
  params: Promise<{ slug: string }>;
}

export default async function ArgumentMapDetail({ params: _params }: PageProps) {
  // Argument-map detail page reads from API once the cache is populated;
  // for first launch it 404s gracefully on missing maps.
  const { slug: _slug } = await _params;
  notFound();
}
