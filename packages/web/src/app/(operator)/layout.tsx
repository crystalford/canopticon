// Operator app layout — responsive web-admin shell.
//
// All routes under (operator)/* are gated by Cloudflare Access. Access
// injects the verified email in the cf-access-authenticated-user-email
// header; we read it server-side and pass it to the shell so the
// sidebar can show "signed in as <email>".

import { OperatorShell } from "@/components/operator/OperatorShell";
import { headers } from "next/headers";

export const runtime = "edge";

export default async function OperatorLayout({ children }: { children: React.ReactNode }) {
  const h = await headers();
  const email = h.get("cf-access-authenticated-user-email");
  return <OperatorShell email={email}>{children}</OperatorShell>;
}
