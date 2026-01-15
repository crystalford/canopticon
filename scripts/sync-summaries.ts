
import { db, articles } from '@/db'
import { eq } from 'drizzle-orm'

// Helper to extract text from TipTap JSON
const getPlainText = (contentJson: any): string => {
    if (!contentJson) return ''
    try {
        const parsed = typeof contentJson === 'string' ? JSON.parse(contentJson) : contentJson
        const extract = (node: any): string => {
            if (node.text) return node.text
            if (node.content) return node.content.map(extract).join(' ')
            return ''
        }
        return extract(parsed)
    } catch {
        return ''
    }
}

async function main() {
    console.log('Syncing article summaries...')
    const allArticles = await db.select().from(articles)

    for (const article of allArticles) {
        if (!article.content) continue

        const plainText = getPlainText(article.content)
        const newSummary = plainText.slice(0, 800) || article.headline

        if (newSummary !== article.summary) {
            console.log(`Updating summary for: ${article.headline}`)
            await db.update(articles)
                .set({ summary: newSummary })
                .where(eq(articles.id, article.id))
        }
    }
    console.log('Done.')
}

main().catch(console.error)
