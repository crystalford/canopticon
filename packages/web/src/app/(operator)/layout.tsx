import { CostApprovalModal } from "@/components/operator/cost-approval-modal";
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
      <header className="border-b border-border-soft px-6 py-3 flex items-center justify-between">
        <div className="flex items-baseline gap-6">
          <Link href="/home" className="font-serif text-xl text-amber hover:text-cream-bright">
            CANOPTICON
          </Link>
          <nav className="flex gap-4 text-text-dim font-mono text-xs uppercase tracking-widest">
            <NavLink href="/home" label="home" />
            <NavLink href="/research" label="research" />
            <NavLink href="/sources" label="sources" />
            <NavLink href="/claims" label="claims" />
            <NavLink href="/studio" label="studio" />
            <NavLink href="/studio/articles" label="articles" />
            <NavLink href="/studio/books" label="books" />
            <NavLink href="/findings" label="findings" />
            <NavLink href="/predictions" label="predictions" />
            <NavLink href="/indicators" label="indicators" />
            <NavLink href="/entities" label="entities" />
            <NavLink href="/graph" label="graph" />
            <NavLink href="/system" label="system" />
          </nav>
        </div>
        <div className="text-text-faint font-mono text-xs">{email}</div>
      </header>
      <main className="flex-1">{children}</main>
      <CostApprovalModal />
    </div>
  );
}

function NavLink({ href, label }: { href: string; label: string }) {
  return (
    <Link href={href} className="hover:text-amber">
      {label}
    </Link>
  );
}
