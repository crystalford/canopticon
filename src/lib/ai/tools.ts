import { tool } from 'ai'
import { z } from 'zod'
import { db, articles, automations } from '@/db'
import { eq } from 'drizzle-orm'
import slugify from 'slugify'
import { put } from '@vercel/blob'
import { TwitterApi } from 'twitter-api-v2'

export async function searchPerplexity(query: string): Promise<string> {
    const apiKey = process.env.PERPLEXITY_API_KEY
    if (!apiKey) throw new Error('PERPLEXITY_API_KEY not set')

    console.log('[search_web] Calling Perplexity API for:', query)

    const response = await fetch('https://api.perplexity.ai/chat/completions', {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            model: 'sonar-pro',
            messages: [{ role: 'user', content: query }],
        }),
    })

    console.log('[search_web] Perplexity status:', response.status)

    if (!response.ok) {
        const errorText = await response.text()
        console.error('[search_web] Perplexity error body:', errorText)
        throw new Error(`Perplexity API error ${response.status}: ${errorText}`)
    }

    const data = await response.json()
    return data.choices?.[0]?.message?.content || 'No results found'
}

function makeSlug(title: string): string {
    return slugify(title, { lower: true, strict: true, trim: true })
}

async function resolveYouTubeChannelId(config: Record<string, unknown>): Promise<string | null> {
    // If a URL is provided, try to extract/resolve from it
    const url = (config.channelUrl as string) || ''
    const handle = (config.channelHandle as string) || ''

    // Direct channel ID from URL: youtube.com/channel/UC...
    const channelMatch = url.match(/youtube\.com\/channel\/(UC[\w-]+)/)
    if (channelMatch) return channelMatch[1]

    // Handle from URL or config: youtube.com/@handle or just @handle
    const handleFromUrl = url.match(/youtube\.com\/@([\w.-]+)/)
    const resolveHandle = handleFromUrl?.[1] || handle.replace(/^@/, '') || null

    if (resolveHandle) {
        try {
            // Fetch the channel page and extract the channel ID from meta tags
            const res = await fetch(`https://www.youtube.com/@${resolveHandle}`, {
                headers: { 'User-Agent': 'Mozilla/5.0 (compatible; Canopticon/1.0)' },
            })
            if (res.ok) {
                const html = await res.text()
                // Look for channel ID in various meta tags / embedded data
                const idMatch = html.match(/(?:"channelId"|"externalId"|channel_id=|"channelUrl":"https:\/\/www\.youtube\.com\/channel\/)(UC[\w-]+)/)
                if (idMatch) return idMatch[1]
            }
        } catch (error) {
            console.error('[resolveYouTubeChannelId] Failed to fetch channel page:', error)
        }
    }

    // Last resort: try searching with Perplexity
    const channelName = (config.channelName as string) || ''
    if (channelName || resolveHandle) {
        try {
            const query = `What is the YouTube channel ID (starts with UC) for the channel "${channelName || resolveHandle}"? Just give me the channel ID.`
            const result = await searchPerplexity(query)
            const ucMatch = result.match(/(UC[\w-]{20,})/)
            if (ucMatch) return ucMatch[1]
        } catch (error) {
            console.error('[resolveYouTubeChannelId] Perplexity lookup failed:', error)
        }
    }

    return null
}

export function createTools(conversationId?: string, options?: { saveDraft?: boolean }) {
    return {
        search_web: tool({
            description: 'Search the web for current information on any topic. Use this for news, events, facts, research. Returns detailed search results.',
            inputSchema: z.object({
                query: z.string().describe('The search query - be specific for better results'),
            }),
            execute: async ({ query }) => {
                try {
                    const results = await searchPerplexity(query)
                    console.log('[search_web] Success, length:', results.length)
                    return { success: true, results }
                } catch (error: any) {
                    console.error('[search_web] Error:', error?.message)
                    return { success: false, error: `Search failed: ${error?.message || String(error)}` }
                }
            },
        }),

        add_image: tool({
            description: 'Find or generate an image to embed in articles. Use "unsplash" for free stock photos or "dalle" for AI-generated custom images. All images are permanently hosted via Vercel Blob. Returns markdown to embed in article content.',
            inputSchema: z.object({
                query: z.string().describe('What the image should show - be descriptive'),
                source: z.enum(['unsplash', 'dalle']).describe('Image source: "unsplash" for stock photos, "dalle" for AI-generated'),
            }),
            execute: async ({ query, source }) => {
                try {
                    let imageBuffer: ArrayBuffer
                    let filename: string
                    let contentType: string
                    let attribution: string | undefined

                    if (source === 'unsplash') {
                        const accessKey = process.env.UNSPLASH_ACCESS_KEY
                        if (!accessKey) return { success: false, error: 'UNSPLASH_ACCESS_KEY not configured. Add it to environment variables.' }

                        const searchRes = await fetch(
                            `https://api.unsplash.com/search/photos?query=${encodeURIComponent(query)}&per_page=3&orientation=landscape`,
                            { headers: { 'Authorization': `Client-ID ${accessKey}` } }
                        )
                        if (!searchRes.ok) return { success: false, error: `Unsplash API error: ${searchRes.status}` }

                        const searchData = await searchRes.json()
                        if (!searchData.results?.length) return { success: false, error: 'No images found for that query' }

                        const photo = searchData.results[0]
                        attribution = `Photo by [${photo.user.name}](${photo.user.links.html}) on [Unsplash](https://unsplash.com)`

                        // Download the image
                        const imgRes = await fetch(photo.urls.regular)
                        imageBuffer = await imgRes.arrayBuffer()
                        contentType = imgRes.headers.get('content-type') || 'image/jpeg'
                        filename = `unsplash-${photo.id}.jpg`
                    } else {
                        const apiKey = process.env.OPENAI_API_KEY
                        if (!apiKey) return { success: false, error: 'OPENAI_API_KEY not configured.' }

                        const genRes = await fetch('https://api.openai.com/v1/images/generations', {
                            method: 'POST',
                            headers: {
                                'Authorization': `Bearer ${apiKey}`,
                                'Content-Type': 'application/json',
                            },
                            body: JSON.stringify({
                                model: 'dall-e-3',
                                prompt: query,
                                n: 1,
                                size: '1792x1024',
                            }),
                        })

                        const genData = await genRes.json()
                        if (!genData.data?.length) return { success: false, error: genData.error?.message || 'Image generation failed' }

                        // Download the temporary DALL-E image
                        const imgRes = await fetch(genData.data[0].url)
                        imageBuffer = await imgRes.arrayBuffer()
                        contentType = 'image/png'
                        filename = `dalle-${Date.now()}.png`
                    }

                    // Upload to Vercel Blob for permanent hosting
                    const blob = await put(`images/${filename}`, imageBuffer, {
                        access: 'public',
                        contentType,
                    })

                    const result: Record<string, unknown> = {
                        success: true,
                        markdown: `![${query}](${blob.url})`,
                        url: blob.url,
                    }
                    if (attribution) {
                        result.attribution = attribution
                        result.note = 'Include the attribution at the bottom of the article.'
                    }

                    return result
                } catch (error) {
                    const message = error instanceof Error ? error.message : String(error)
                    return { success: false, error: `Image failed: ${message}` }
                }
            },
        }),

        publish_article: tool({
            description: 'Publish an article to the website. It goes live immediately. Use this when the user says "publish" or "publish it". Auto-generates tags for SEO and topic linking.',
            inputSchema: z.object({
                title: z.string().describe('The article headline'),
                content: z.string().describe('The full article content in markdown. Do NOT include the title as an H1 heading - it is displayed separately.'),
                summary: z.string().describe('A 1-2 sentence summary for SEO and previews'),
                tags: z.array(z.string()).describe('3-8 relevant topic tags for SEO and categorization. Use lowercase, e.g. ["pierre poilievre", "security clearance", "conservative party", "national security"]'),
            }),
            execute: async ({ title, content, summary, tags }) => {
                try {
                    const slug = makeSlug(title)
                    const now = new Date()
                    const isDraft = options?.saveDraft ?? false

                    const [article] = await db.insert(articles).values({
                        title,
                        slug,
                        content,
                        summary,
                        tags,
                        status: isDraft ? 'draft' : 'published',
                        conversationId: conversationId || null,
                        publishedAt: isDraft ? null : now,
                    }).returning()

                    return {
                        success: true,
                        article: {
                            id: article.id,
                            title: article.title,
                            slug: article.slug,
                            status: article.status,
                            url: isDraft ? null : `/articles/${article.slug}`,
                            tags: article.tags,
                        },
                    }
                } catch (error) {
                    const message = error instanceof Error ? error.message : String(error)
                    return { success: false, error: `Failed to publish: ${message}` }
                }
            },
        }),

        list_articles: tool({
            description: 'List published articles on the site. Use this when the user wants to see what has been published. Does not include full content - use get_article for that.',
            inputSchema: z.object({
                limit: z.number().optional().describe('How many articles to return (default 20)'),
            }),
            execute: async ({ limit }) => {
                const results = await db.query.articles.findMany({
                    columns: {
                        id: true,
                        title: true,
                        slug: true,
                        summary: true,
                        status: true,
                        tags: true,
                        publishedAt: true,
                    },
                    orderBy: (articles, { desc }) => [desc(articles.createdAt)],
                    limit,
                })

                return { articles: results, count: results.length }
            },
        }),

        get_article: tool({
            description: 'Get a single article with its full content. Use this when you need to read an article to create an X thread, edit it, or reference its content.',
            inputSchema: z.object({
                id: z.string().describe('The article ID'),
            }),
            execute: async ({ id }) => {
                const article = await db.query.articles.findFirst({
                    where: eq(articles.id, id),
                })

                if (!article) return { success: false, error: 'Article not found' }

                return {
                    success: true,
                    article: {
                        id: article.id,
                        title: article.title,
                        slug: article.slug,
                        content: article.content,
                        summary: article.summary,
                        tags: article.tags,
                        status: article.status,
                        url: `/articles/${article.slug}`,
                        publishedAt: article.publishedAt,
                    },
                }
            },
        }),

        edit_article: tool({
            description: 'Edit an existing article. Can update title, content, summary, tags, or status.',
            inputSchema: z.object({
                id: z.string().describe('The article ID to edit'),
                title: z.string().optional().describe('New title'),
                content: z.string().optional().describe('New content in markdown'),
                summary: z.string().optional().describe('New summary'),
                tags: z.array(z.string()).optional().describe('New tags array'),
            }),
            execute: async ({ id, title, content, summary, tags }) => {
                try {
                    const updates: Record<string, unknown> = { updatedAt: new Date() }
                    if (title) {
                        updates.title = title
                        updates.slug = makeSlug(title)
                    }
                    if (content) updates.content = content
                    if (summary) updates.summary = summary
                    if (tags) updates.tags = tags

                    const [article] = await db.update(articles)
                        .set(updates)
                        .where(eq(articles.id, id))
                        .returning()

                    if (!article) {
                        return { success: false, error: 'Article not found' }
                    }

                    return {
                        success: true,
                        article: {
                            id: article.id,
                            title: article.title,
                            slug: article.slug,
                            url: `/articles/${article.slug}`,
                            tags: article.tags,
                        },
                    }
                } catch (error) {
                    const message = error instanceof Error ? error.message : String(error)
                    return { success: false, error: `Failed to edit: ${message}` }
                }
            },
        }),

        unpublish_article: tool({
            description: 'Unpublish an article (set to draft). Use when the user wants to take an article offline.',
            inputSchema: z.object({
                id: z.string().describe('The article ID to unpublish'),
            }),
            execute: async ({ id }) => {
                try {
                    const [article] = await db.update(articles)
                        .set({ status: 'draft', updatedAt: new Date() })
                        .where(eq(articles.id, id))
                        .returning()

                    if (!article) {
                        return { success: false, error: 'Article not found' }
                    }

                    return { success: true, message: `"${article.title}" has been unpublished.` }
                } catch (error) {
                    const message = error instanceof Error ? error.message : String(error)
                    return { success: false, error: `Failed to unpublish: ${message}` }
                }
            },
        }),

        post_to_x: tool({
            description: 'Post a thread to X (Twitter). Provide an array of tweet texts. Each tweet must be under 280 characters. Use this when the user asks to share or post an article to X/Twitter. Craft an engaging thread that summarizes the article with key takeaways.',
            inputSchema: z.object({
                tweets: z.array(z.string()).describe('Array of tweet texts for the thread. Each must be under 280 characters. First tweet should hook the reader, last should link to the article.'),
            }),
            execute: async ({ tweets }) => {
                // ... same execution logic ...
                // Re-using logic or keeping as is for backward compatibility
                // Ideally, we move logic to shared lib, but for now copying or keeping as is fine.
                // The tool execute is what the LLM calls.
                // I will keep the original implementation but I need to make sure I don't break it.
                // Since I replaced the *entire* block in my thought process, I need to put it back.
                try {
                    const apiKey = process.env.TWITTER_API_KEY
                    const apiSecret = process.env.TWITTER_API_SECRET
                    const accessToken = process.env.TWITTER_ACCESS_TOKEN
                    const accessSecret = process.env.TWITTER_ACCESS_SECRET

                    if (!apiKey || !apiSecret || !accessToken || !accessSecret) {
                        return {
                            success: false,
                            error: 'X/Twitter API credentials not configured. Need: TWITTER_API_KEY, TWITTER_API_SECRET, TWITTER_ACCESS_TOKEN, TWITTER_ACCESS_SECRET',
                        }
                    }

                    // Validate tweet lengths
                    const tooLong = tweets.findIndex(t => t.length > 280)
                    if (tooLong >= 0) {
                        return {
                            success: false,
                            error: `Tweet ${tooLong + 1} is ${tweets[tooLong].length} characters (max 280): "${tweets[tooLong].substring(0, 50)}..."`,
                        }
                    }

                    const client = new TwitterApi({
                        appKey: apiKey,
                        appSecret: apiSecret,
                        accessToken,
                        accessSecret,
                    })

                    // Post thread
                    let lastTweetId: string | undefined
                    const postedTweets: { id: string; text: string }[] = []

                    for (const text of tweets) {
                        const params: any = { text }
                        if (lastTweetId) {
                            params.reply = { in_reply_to_tweet_id: lastTweetId }
                        }

                        const result = await client.v2.tweet(params)
                        lastTweetId = result.data.id
                        postedTweets.push({ id: result.data.id, text })
                    }

                    return {
                        success: true,
                        threadUrl: `https://x.com/i/status/${postedTweets[0].id}`,
                        tweetCount: postedTweets.length,
                        message: `Thread posted successfully! ${postedTweets.length} tweets.`,
                    }
                } catch (error) {
                    const message = error instanceof Error ? error.message : String(error)
                    return { success: false, error: `Failed to post to X: ${message}` }
                }
            },
        }),

        draft_twitter_thread: tool({
            description: 'Generate a draft Twitter thread for the user to review and edit before posting. Returns a preview UI.',
            inputSchema: z.object({
                tweets: z.array(z.string()).describe('The proposed tweets for the thread. 280 char limit per tweet.'),
                topic: z.string().optional().describe('The topic or article title being shared'),
            }),
            execute: async ({ tweets, topic }) => {
                return {
                    success: true,
                    draft: {
                        tweets,
                        topic
                    },
                    message: "Draft created. Please review below."
                }
            }
        }),

        create_monitor: tool({
            description: 'Create a new content monitor/automation. Types: "youtube" (watch a channel — you can provide a channel name, handle like @cpac, or URL and the system will resolve the channel ID automatically), "rss" (watch a feed), "keyword" (search for topics). The monitor runs automatically, can generate articles, and optionally auto-post threads to X/Twitter.',
            inputSchema: z.object({
                name: z.string().describe('A short name for this monitor'),
                type: z.enum(['youtube', 'rss', 'keyword']).describe('Monitor type'),
                config: z.object({
                    channelId: z.string().optional().describe('YouTube channel ID like UC... (for youtube type). If not known, provide channelUrl or channelHandle instead and it will be resolved automatically.'),
                    channelUrl: z.string().optional().describe('YouTube channel URL like https://www.youtube.com/@cpac or https://www.youtube.com/channel/UC... (for youtube type)'),
                    channelHandle: z.string().optional().describe('YouTube channel handle like @cpac (for youtube type)'),
                    channelName: z.string().optional().describe('YouTube channel display name (for youtube type)'),
                    feedUrl: z.string().optional().describe('RSS feed URL (for rss type)'),
                    feedName: z.string().optional().describe('Feed name (for rss type)'),
                    keywords: z.array(z.string()).optional().describe('Keywords to monitor (for keyword type)'),
                    autoPostToX: z.boolean().optional().describe('Auto-post generated articles to X/Twitter as a thread (default: false)'),
                }).describe('Type-specific configuration'),
                prompt: z.string().describe('Instructions for the AI when new content is found.'),
                autoPublish: z.boolean().optional().describe('Auto-publish generated articles (default: false, creates drafts for review)'),
            }),
            execute: async ({ name, type, config, prompt, autoPublish }) => {
                try {
                    // For YouTube monitors, resolve channel ID if not provided
                    if (type === 'youtube' && !config.channelId) {
                        const resolved = await resolveYouTubeChannelId(config)
                        if (resolved) {
                            config.channelId = resolved
                        } else {
                            return { success: false, error: 'Could not resolve YouTube channel ID. Please provide the channel URL (e.g. https://www.youtube.com/@cpac) or the channel ID directly (starts with UC...).' }
                        }
                    }

                    // Idempotency: check if a pipeline already exists with the same type + key config
                    const existing = await db.query.automations.findMany()
                    const duplicate = existing.find(a => {
                        if (a.type !== type) return false
                        const c = a.config as Record<string, unknown>
                        if (type === 'youtube') return c.channelId === config.channelId
                        if (type === 'rss') return c.feedUrl === config.feedUrl
                        if (type === 'keyword') return JSON.stringify(c.keywords) === JSON.stringify(config.keywords)
                        return false
                    })
                    if (duplicate) {
                        return {
                            success: true,
                            monitor: { id: duplicate.id, name: duplicate.name, type: duplicate.type, config: duplicate.config, enabled: duplicate.enabled },
                            message: `A pipeline for this ${type} source already exists: "${duplicate.name}". No duplicate was created.`,
                        }
                    }

                    // Build absolute URL — needed for server-side fetch in Vercel edge/serverless
                    const baseUrl = process.env.NEXT_PUBLIC_APP_URL
                        || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000')

                    const res = await fetch(`${baseUrl}/api/automations`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ name, type, config, prompt, autoPublish: autoPublish ?? false }),
                    })
                    const data = await res.json()

                    if (!res.ok) {
                        return { success: false, error: `Failed to create pipeline: ${data.error || res.status}` }
                    }

                    return {
                        success: true,
                        monitor: {
                            id: data.id,
                            name: data.name,
                            type: data.type,
                            config: data.config,
                            enabled: data.enabled,
                        },
                        message: `Pipeline "${data.name}" created successfully! You can see it on the Pipelines page. Click "⚡ Activate Webhook" on the card to start receiving new video notifications, or use "Test Run" to process the most recent video right now.`,
                    }
                } catch (error) {
                    const message = error instanceof Error ? error.message : String(error)
                    return { success: false, error: `Failed to create pipeline: ${message}` }
                }
            },
        }),

        list_monitors: tool({
            description: 'List all content monitors/automations.',
            inputSchema: z.object({}),
            execute: async () => {
                const results = await db.query.automations.findMany({
                    orderBy: (automations, { desc }) => [desc(automations.createdAt)],
                })

                return {
                    monitors: results.map(m => ({
                        id: m.id,
                        name: m.name,
                        type: m.type,
                        enabled: m.enabled,
                        autoPublish: m.autoPublish,
                        prompt: m.prompt,
                        lastRunAt: m.lastRunAt,
                        lastResult: m.lastResult,
                    })),
                    count: results.length,
                }
            },
        }),

        toggle_monitor: tool({
            description: 'Enable or disable a content monitor.',
            inputSchema: z.object({
                id: z.string().describe('The monitor ID'),
                enabled: z.boolean().describe('Whether to enable (true) or disable (false)'),
            }),
            execute: async ({ id, enabled }) => {
                try {
                    const [monitor] = await db.update(automations)
                        .set({ enabled, updatedAt: new Date() })
                        .where(eq(automations.id, id))
                        .returning()

                    if (!monitor) return { success: false, error: 'Monitor not found' }

                    return {
                        success: true,
                        message: `"${monitor.name}" is now ${enabled ? 'enabled' : 'disabled'}.`,
                    }
                } catch (error) {
                    const message = error instanceof Error ? error.message : String(error)
                    return { success: false, error: `Failed to toggle monitor: ${message}` }
                }
            },
        }),

        edit_monitor: tool({
            description: 'Edit an existing content monitor. You can update its name, prompt, config, autoPublish setting, or autoPostToX setting. Use list_monitors first to get the monitor ID.',
            inputSchema: z.object({
                id: z.string().describe('The monitor ID to edit'),
                name: z.string().optional().describe('New name for the monitor'),
                prompt: z.string().optional().describe('New AI instructions for when content is found'),
                autoPublish: z.boolean().optional().describe('Whether to auto-publish or save as draft'),
                config: z.object({
                    channelId: z.string().optional().describe('YouTube channel ID'),
                    channelUrl: z.string().optional().describe('YouTube channel URL'),
                    channelHandle: z.string().optional().describe('YouTube channel handle like @cpac'),
                    channelName: z.string().optional().describe('YouTube channel display name'),
                    feedUrl: z.string().optional().describe('RSS feed URL'),
                    feedName: z.string().optional().describe('Feed name'),
                    keywords: z.array(z.string()).optional().describe('Keywords to monitor'),
                    autoPostToX: z.boolean().optional().describe('Auto-post generated articles to X/Twitter as a thread'),
                }).optional().describe('Updated config (merged with existing)'),
            }),
            execute: async ({ id, name, prompt, autoPublish, config }) => {
                try {
                    const existing = await db.query.automations.findFirst({
                        where: eq(automations.id, id),
                    })
                    if (!existing) return { success: false, error: 'Monitor not found' }

                    const updates: Record<string, unknown> = { updatedAt: new Date() }
                    if (name !== undefined) updates.name = name
                    if (prompt !== undefined) updates.prompt = prompt
                    if (autoPublish !== undefined) updates.autoPublish = autoPublish
                    if (config) {
                        const existingConfig = (existing.config as Record<string, unknown>) || {}
                        const mergedConfig = { ...existingConfig, ...config }
                        // Resolve YouTube channel ID if needed
                        if (existing.type === 'youtube' && !mergedConfig.channelId && (config.channelUrl || config.channelHandle)) {
                            const resolved = await resolveYouTubeChannelId(mergedConfig)
                            if (resolved) mergedConfig.channelId = resolved
                        }
                        updates.config = mergedConfig
                    }

                    const [monitor] = await db.update(automations)
                        .set(updates)
                        .where(eq(automations.id, id))
                        .returning()

                    return {
                        success: true,
                        monitor: {
                            id: monitor.id,
                            name: monitor.name,
                            type: monitor.type,
                            config: monitor.config,
                            prompt: monitor.prompt,
                            autoPublish: monitor.autoPublish,
                            enabled: monitor.enabled,
                        },
                    }
                } catch (error) {
                    const message = error instanceof Error ? error.message : String(error)
                    return { success: false, error: `Failed to edit monitor: ${message}` }
                }
            },
        }),

        delete_monitor: tool({
            description: 'Permanently delete a content monitor. Use list_monitors first to get the monitor ID.',
            inputSchema: z.object({
                id: z.string().describe('The monitor ID to delete'),
            }),
            execute: async ({ id }) => {
                try {
                    const [monitor] = await db.delete(automations)
                        .where(eq(automations.id, id))
                        .returning()

                    if (!monitor) return { success: false, error: 'Monitor not found' }

                    return { success: true, message: `"${monitor.name}" has been deleted.` }
                } catch (error) {
                    const message = error instanceof Error ? error.message : String(error)
                    return { success: false, error: `Failed to delete monitor: ${message}` }
                }
            },
        }),
    }
}
