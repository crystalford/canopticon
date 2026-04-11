import { db } from "@/db";
import { articles, videoClips } from "@/db/schema";
import { desc, eq } from "drizzle-orm";
import Link from "next/link";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";

export const dynamic = "force-dynamic";

export default async function HomePage() {
    const latestArticles = await db.query.articles.findMany({
        where: eq(articles.status, 'published'),
        orderBy: [desc(articles.publishedAt)],
        limit: 5,
    });

    const latestClips = await db.query.videoClips.findMany({
        where: eq(videoClips.status, 'completed'),
        orderBy: [desc(videoClips.updatedAt)],
        limit: 4,
        with: { source: true }
    });

    return (
        <div className="space-y-12">
            <section className="space-y-6">
                <div className="border-b pb-4 mb-8">
                    <h1 className="text-4xl font-black tracking-tighter uppercase mb-2">The Raw Feed</h1>
                    <p className="text-xl text-muted-foreground">Unvarnished, algorithmic investigations into the modern world.</p>
                </div>

                <h2 className="text-2xl font-bold border-l-4 border-primary pl-4">Latest Investigations</h2>
                <div className="grid gap-6">
                    {latestArticles.length === 0 ? (
                        <div className="text-muted-foreground italic">No published articles yet. Check back soon.</div>
                    ) : (
                        latestArticles.map(article => (
                            <Link href={`/articles/${article.slug}`} key={article.id} className="block group">
                                <Card className="hover:border-primary transition-colors">
                                    <CardHeader>
                                        <CardTitle className="text-2xl group-hover:text-primary transition-colors">{article.title}</CardTitle>
                                    </CardHeader>
                                    <CardContent>
                                        <p className="text-muted-foreground">{article.summary}</p>
                                        <div className="mt-4 text-xs font-mono text-muted-foreground">
                                            {article.publishedAt && new Date(article.publishedAt).toLocaleDateString()}
                                        </div>
                                    </CardContent>
                                </Card>
                            </Link>
                        ))
                    )}
                </div>
            </section>

            <section className="space-y-6">
                <h2 className="text-2xl font-bold border-l-4 border-primary pl-4">Extracted Clips</h2>
                <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
                    {latestClips.length === 0 ? (
                        <div className="text-muted-foreground italic col-span-full">No video clips extracted yet.</div>
                    ) : (
                        latestClips.map(clip => (
                            <Card key={clip.id} className="overflow-hidden flex flex-col">
                                {clip.clipUrl ? (
                                    <video src={clip.clipUrl} controls className="w-full aspect-video bg-black object-cover" />
                                ) : (
                                    <div className="w-full aspect-video bg-muted flex items-center justify-center font-mono text-xs text-muted-foreground">
                                        No MP4 available
                                    </div>
                                )}
                                <CardContent className="p-4 flex-1 flex flex-col">
                                    <p className="font-medium italic mb-2">&quot;{clip.keyQuote}&quot;</p>
                                    <div className="mt-auto text-xs text-muted-foreground pt-4 border-t">
                                        Source: {clip.source.title || clip.source.channelName || 'Unknown'}
                                    </div>
                                </CardContent>
                            </Card>
                        ))
                    )}
                </div>
            </section>
        </div>
    );
}