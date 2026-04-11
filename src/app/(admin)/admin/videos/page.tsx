import { db } from "@/db";
import { videoSources, videoClips } from "@/db/schema";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { desc, eq } from "drizzle-orm";
import { VideoPipeline } from "@/lib/pipeline/video";

export const dynamic = "force-dynamic";

import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";

export default async function AdminVideosPage() {
    const session = await getServerSession(authOptions);
    if (!session) redirect("/login");
    const sources = await db.query.videoSources.findMany({
        orderBy: [desc(videoSources.createdAt)],
        with: {
            clips: true
        }
    });

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <h1 className="text-3xl font-bold tracking-tight">Video Sources & Clips</h1>
                <form action={async (formData) => {
                    "use server";
                    const url = formData.get("url") as string;
                    if (!url) return;
                    // Fire and forget
                    VideoPipeline.ingestAndAnalyze(url).catch(console.error);
                }} className="flex gap-2">
                    <input type="url" name="url" placeholder="https://youtube.com/watch?v=..." className="flex h-9 w-[300px] rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50" required />
                    <Button type="submit">Analyze Video</Button>
                </form>
            </div>

            <div className="grid gap-6">
                {sources.map((source) => (
                    <Card key={source.id}>
                        <CardHeader className="flex flex-row items-center justify-between pb-2">
                            <CardTitle className="text-xl">
                                <a href={source.url} target="_blank" rel="noreferrer" className="hover:underline">
                                    {source.title || source.url}
                                </a>
                            </CardTitle>
                            <Badge variant={source.status === 'completed' ? 'default' : 'secondary'}>
                                {source.status}
                            </Badge>
                        </CardHeader>
                        <CardContent>
                            <h3 className="font-semibold mb-2 mt-4">Proposed Clips</h3>
                            <div className="space-y-3">
                                {source.clips.length === 0 ? (
                                    <div className="text-sm text-muted-foreground">No clips proposed.</div>
                                ) : (
                                    source.clips.map(clip => (
                                        <div key={clip.id} className="border p-4 rounded-md flex justify-between items-start gap-4">
                                            <div>
                                                <div className="flex items-center gap-2 mb-2">
                                                    <span className="font-mono text-sm">{clip.startSeconds}s - {clip.endSeconds}s</span>
                                                    <Badge variant="outline">{clip.status}</Badge>
                                                </div>
                                                <div className="text-sm font-medium mb-1">&quot;{clip.keyQuote}&quot;</div>
                                                <div className="text-sm text-muted-foreground">{clip.rationale}</div>
                                            </div>

                                            {clip.status === 'proposed' && (
                                                <form action={async () => {
                                                    "use server";
                                                    await db.update(videoClips).set({ status: 'approved' }).where(eq(videoClips.id, clip.id));
                                                    VideoPipeline.processApprovedClip(clip.id).catch(console.error);
                                                }}>
                                                    <Button type="submit" size="sm">Approve & Send to Apify</Button>
                                                </form>
                                            )}
                                        </div>
                                    ))
                                )}
                            </div>
                        </CardContent>
                    </Card>
                ))}
            </div>
        </div>
    );
}
