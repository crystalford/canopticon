import { type ServerCookieStore, serverClient } from "@/lib/supabase";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

export const runtime = "edge";

export default async function HomePage() {
  const cookieStore = await cookies();
  const supabase = serverClient(cookieStore as unknown as ServerCookieStore);
  const { data } = await supabase.auth.getUser();
  redirect(data.user ? "/home" : "/sign-in");
}
