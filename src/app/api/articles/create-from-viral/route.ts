import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/db'
import { articles } from '@/db/schema'
import { ViralPost } from '@/lib/ingestion/viral-fetcher'

export async function POST(req: NextRequest) {
    try {
        const { post } = (await req.json()) as { post: ViralPost }

        if (!post || !post.uri) {
            return NextResponse.json({ error: 'Invalid post data' }, { status: 400 })
        }

        // 1. Generate Headline
        // Truncate content to 50 chars for headline
        const topic = post.content.slice(0, 50) + (post.content.length > 50 ? '...' : '')
        const headline = `Viral on ${post.platform === 'bluesky' ? 'Bluesky' : 'Mastodon'}: ${post.author.displayName} on "${topic}"`

        // 2. Generate Content (The "Embed")
        let htmlContent = ''

        if (post.platform === 'mastodon') {
            // Mastodon supports standard iframe embeds if we append /embed to the URL
            // Example URI: https://mastodon.social/@user/123456
            // Embed URI: https://mastodon.social/@user/123456/embed
            const embedUrl = `${post.uri}/embed`
            htmlContent = `
                <p>This discussion is trending on Mastodon:</p>
                <div class="my-6">
                    <iframe src="${embedUrl}" class="w-full border-0 rounded-lg shadow-lg bg-white/5" style="min-height: 250px;" allowfullscreen="true"></iframe>
                </div>
                <p><strong>Context:</strong> Add your analysis here...</p>
            `
        } else {
            // Bluesky: Create a styled "Quote Card" that mimics the post
            // We link to the post for the "real" experience
            const bskyLink = `https://bsky.app/profile/${post.author.handle}/post/${post.uri.split('/').pop()}`

            htmlContent = `
                <p>This discussion is trending on Bluesky:</p>
                <blockquote class="p-6 my-6 border-l-4 border-blue-500 bg-white/5 rounded-r-lg not-italic">
                    <div class="flex items-center gap-3 mb-4">
                        ${post.author.avatar ? `<img src="${post.author.avatar}" class="w-10 h-10 rounded-full bg-slate-800" alt="${post.author.handle}">` : '<div class="w-10 h-10 rounded-full bg-slate-800"></div>'}
                        <div>
                            <div class="font-bold text-white">${post.author.displayName}</div>
                            <div class="text-sm text-slate-400">@${post.author.handle}</div>
                        </div>
                    </div>
                    <p class="text-lg text-slate-200 mb-4 whitespace-pre-wrap">${post.content}</p>
                    <div class="text-xs text-slate-500 flex gap-4 font-mono">
                        <span>❤️ ${post.metrics.likes} Likes</span>
                        <span>Cw ${post.metrics.reposts} Reposts</span>
                    </div>
                    <div class="mt-4 pt-4 border-t border-white/10">
                         <a href="${bskyLink}" target="_blank" class="text-blue-400 hover:text-blue-300 text-sm flex items-center gap-1">
                            View on Bluesky &rarr;
                        </a>
                    </div>
                </blockquote>
                <p><strong>Context:</strong> Add your analysis here...</p>
            `
        }

        // 3. Save to DB
        // Determine category (likely 'discourse' or 'news')
        const categoryId = 1 // Assuming 1 is 'News' or 'General'. MVP: Default to 1.

        // We insert as 'draft'
        const [newArticle] = await db.insert(articles).values({
            headline,
            content: JSON.stringify(htmlContent) as any,
            isDraft: true,
            slug: `viral-${Date.now()}`,
            summary: `Viral post analysis: ${topic}`,
            author: 'Viral Monitor'
        }).returning()


        return NextResponse.json({ success: true, articleId: newArticle.id })

    } catch (e: any) {
        console.error('Failed to convert viral post to story', e)
        return NextResponse.json({ error: e.message }, { status: 500 })
    }
}
