// Operator app layout — responsive web-admin shell.
//
// All routes under (operator)/* are gated by Cloudflare Access.

import { OperatorShell } from "@/components/operator/OperatorShell";
import { currentUser } from "@/lib/access";

export const runtime = "edge";

export default async function OperatorLayout({ children }: { children: React.ReactNode }) {
  const user = await currentUser();
  return <OperatorShell email={user?.email ?? null}>{children}</OperatorShell>;
}
