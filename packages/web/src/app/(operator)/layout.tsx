import { BottomNav } from "@/components/operator/BottomNav";
import { type ServerCookieStore, serverClient } from "@/lib/supabase";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";

export const runtime = "edge";

export default async function OperatorLayout({ children }: { children: React.ReactNode }) {
  const cookieStore = await cookies();
  const supabase = serverClient(cookieStore as unknown as ServerCookieStore);
  const { data } = await supabase.auth.getUser();
  if (!data.user) redirect("/sign-in");

  // Determine active nav from request URL.
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
