import { db } from "@/db";
import { investigations } from "@/db/schema";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { desc } from "drizzle-orm";
import Link from "next/link";

export const dynamic = "force-dynamic";

import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";

export default async function AdminInvestigationsPage() {
    const session = await getServerSession(authOptions);
    if (!session) redirect("/login");
    const list = await db.query.investigations.findMany({
        orderBy: [desc(investigations.createdAt)],
    });

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <h1 className="text-3xl font-bold tracking-tight">Investigations</h1>
                <form action={async (formData) => {
                    "use server";
                    const title = formData.get("title") as string;
                    const seed = formData.get("seed") as string;
                    if (!title || !seed) return;

                    const { InvestigationPipeline } = await import('@/lib/pipeline/research');
                    const [inv] = await db.insert(investigations).values({
                        title: title,
                        seedPrompt: seed,
                        triggerSource: "manual"
                    }).returning();

                    // Fire and forget
                    InvestigationPipeline.run(inv.id).catch(console.error);
                }} className="flex gap-2">
                    <input type="text" name="title" placeholder="Topic Title" required className="input h-9 py-1 px-3 w-[200px]" />
                    <input type="text" name="seed" placeholder="Deep dive seed prompt..." required className="input h-9 py-1 px-3 w-[300px]" />
                    <Button type="submit">Start New Research</Button>
                </form>
            </div>

            <div className="grid gap-4">
                {list.map((inv) => (
                    <Card key={inv.id}>
                        <CardHeader className="flex flex-row items-center justify-between pb-2">
                            <CardTitle className="text-xl">
                                {inv.title}
                            </CardTitle>
                            <Badge variant={inv.status === 'completed' ? 'default' : inv.status === 'failed' ? 'destructive' : 'secondary'}>
                                {inv.status}
                            </Badge>
                        </CardHeader>
                        <CardContent>
                            <div className="text-sm text-muted-foreground mb-4">
                                Triggered by: {inv.triggerSource} | Created: {new Date(inv.createdAt).toLocaleString()}
                            </div>
                            <div className="bg-muted p-3 rounded-md text-sm font-mono whitespace-pre-wrap">
                                {inv.seedPrompt}
                            </div>

                            <div className="mt-4 flex gap-2">
                                <Link href={`/admin/investigations/${inv.id}`}>
                                    <Button variant="outline" size="sm">View Details</Button>
                                </Link>
                            </div>
                        </CardContent>
                    </Card>
                ))}

                {list.length === 0 && (
                    <div className="text-center py-12 text-muted-foreground border rounded-lg border-dashed">
                        No investigations found. Start one!
                    </div>
                )}
            </div>
        </div>
    );
}
