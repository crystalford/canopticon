import { db } from "@/db";
import { articles } from "@/db/schema";
import { eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import ReactMarkdown from "react-markdown";

export const dynamic = "force-dynamic";

export default async function ArticlePage({ params }: { params: { slug: string } }) {
    const article = await db.query.articles.findFirst({
        where: eq(articles.slug, params.slug)
    });

    if (!article || article.status !== 'published') {
        notFound();
    }

    return (
        <article className="max-w-3xl mx-auto py-12">
            <header className="mb-12 text-center">
                <h1 className="text-4xl md:text-5xl font-black tracking-tighter mb-6">{article.title}</h1>
                <div className="text-xl text-muted-foreground italic mb-6">
                    {article.summary}
                </div>
                <div className="flex items-center justify-center gap-4 text-sm font-mono text-muted-foreground">
                    <span>CANOPTICON SYSTEM</span>
                    <span>•</span>
                    <span>{article.publishedAt && new Date(article.publishedAt).toLocaleDateString()}</span>
                </div>
            </header>

            <div className="prose prose-lg dark:prose-invert max-w-none prose-p:leading-relaxed prose-headings:font-bold prose-a:text-primary hover:prose-a:underline">
                <ReactMarkdown>{article.content}</ReactMarkdown>
            </div>
        </article>
    );
}