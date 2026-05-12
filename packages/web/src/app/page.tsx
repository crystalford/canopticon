import { redirect } from "next/navigation";

export const runtime = "edge";

export default function HomePage() {
  // Cloudflare Access gates the operator screens. After sign-in we land
  // on /chat — the daily entry point that doubles as universal intake.
  redirect("/chat");
}
