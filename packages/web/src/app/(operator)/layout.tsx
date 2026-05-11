// Operator app layout.
//
// All routes under (operator)/* are gated by Cloudflare Access. The
// Access policy in the Zero Trust dashboard is configured to require
// the operator's email; unauthenticated visitors see Access's
// sign-in page before they reach this layout.

import { BottomNav } from "@/components/operator/BottomNav";
import { headers } from "next/headers";

export const runtime = "edge";

export default async function OperatorLayout({ children }: { children: React.ReactNode }) {
  const h = await headers();
  const pathname = h.get("x-pathname") ?? h.get("x-invoke-path") ?? "";
  const active = `/${pathname.split("/")[1] ?? ""}`;

  return (
    <div className="mx-auto min-h-screen max-w-[440px] bg-bg pb-16">
      {children}
      <BottomNav active={active} />
    </div>
  );
}
