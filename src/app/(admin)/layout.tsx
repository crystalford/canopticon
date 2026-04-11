import { getServerSession } from "next-auth/next";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import Link from "next/link";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
    const session = await getServerSession(authOptions);

    if (!session) {
        redirect("/login");
    }

    return (
        <div className="flex min-h-screen">
            <div className="w-64 border-r bg-muted/30">
                <div className="p-6">
                    <h2 className="text-xl font-black tracking-tighter">CANOPTICON CMS</h2>
                </div>
                <nav className="space-y-1 p-4">
                    <Link href="/admin/investigations" className="block px-3 py-2 text-sm font-medium rounded-md hover:bg-muted">
                        Investigations
                    </Link>
                    <Link href="/admin/videos" className="block px-3 py-2 text-sm font-medium rounded-md hover:bg-muted">
                        Videos & Apify
                    </Link>
                </nav>
            </div>
            <div className="flex-1 p-8">
                {children}
            </div>
        </div>
    )
}
