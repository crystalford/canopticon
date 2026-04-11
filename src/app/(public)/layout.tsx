import Link from "next/link";

export default function PublicLayout({ children }: { children: React.ReactNode }) {
    return (
        <div className="min-h-screen bg-background text-foreground flex flex-col">
            <header className="border-b">
                <div className="container mx-auto px-4 h-16 flex items-center justify-between">
                    <Link href="/" className="text-xl font-black tracking-tighter">CANOPTICON</Link>
                    <nav className="space-x-6 text-sm font-medium">
                        <Link href="/articles" className="hover:text-primary transition-colors">Investigations</Link>
                        <Link href="/videos" className="hover:text-primary transition-colors">Video Clips</Link>
                        <Link href="/admin/investigations" className="text-muted-foreground hover:text-foreground ml-4 border-l pl-6 transition-colors">Admin</Link>
                    </nav>
                </div>
            </header>
            <main className="flex-1 container mx-auto px-4 py-8">
                {children}
            </main>
            <footer className="border-t py-8 mt-12 text-center text-sm text-muted-foreground">
                CANOPTICON &copy; {new Date().getFullYear()} - Autonomous Investigative Journalism
            </footer>
        </div>
    );
}
