import { redirect } from "next/navigation";

export const runtime = "edge";

export default function HomePage() {
  // Cloudflare Access gates /live (and the other operator screens). If the
  // user isn't authenticated, Access shows its sign-in page before they
  // ever hit this redirect. So we just send everyone to /live.
  redirect("/live");
}
