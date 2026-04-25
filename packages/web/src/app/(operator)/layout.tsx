import { type ServerCookieStore, serverClient } from "@/lib/supabase";
import { cookies } from "next/headers";
import Link from "next/link";
import { redirect } from "next/navigation";

export default async function OperatorLayout({ children }: { children: React.ReactNode }) {
  const cookieStore = await cookies();
  const supabase = serverClient(cookieStore as unknown as ServerCookieStore);
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) {
    redirect("/sign-in");
  }
  const email = data.user.email ?? "operator";

  return (
    <div className="min-h-screen flex flex-col">
      <header className="border-b border-ink-dim px-6 py-3 flex items-center justify-between">
        <div className="flex items-baseline gap-6">
          <Link href="/research" className="font-serif text-xl text-amber hover:text-cream">
            CANOPTICON
          </Link>
          <nav className="flex gap-4 text-cream-dim font-mono text-xs uppercase tracking-widest">
            <Link href="/research" className="hover:text-amber">
              research
            </Link>
            <Link href="/sources" className="hover:text-amber">
              sources
            </Link>
            <Link href="/system" className="hover:text-amber">
              system
            </Link>
          </nav>
        </div>
        <div className="text-cream-faint font-mono text-xs">{email}</div>
      </header>
      <main className="flex-1">{children}</main>
    </div>
  );
}
