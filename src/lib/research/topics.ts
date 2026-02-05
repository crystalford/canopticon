import { generateText } from 'ai'
import { openai } from '@ai-sdk/openai'

export interface Topic {
  id: string
  title: string
  description: string
  angle: string
  keywords: string[]
  urgency: 'high' | 'medium' | 'low'
  createdAt: Date
}

/**
 * AI researches current political topics worth writing about
 */
export async function findCurrentTopics(): Promise<Topic[]> {
  console.log('[v0] AI researching current political topics...')
  
  const { text } = await generateText({
    model: openai('gpt-4o'),
    prompt: `You are a political news researcher. Find 5-8 current, newsworthy political topics that would make compelling articles.

Focus on:
- Breaking political developments
- Policy changes and their impacts
- Political conflicts or contradictions
- Important but underreported stories

For each topic, provide:
- A clear, compelling title
- 2-3 sentence description of why it matters
- A unique angle or perspective to take
- 3-5 relevant keywords
- Urgency level (high/medium/low)

Return as JSON array with this structure:
[
  {
    "title": "Topic title here",
    "description": "Why this matters...",
    "angle": "The unique perspective to take...",
    "keywords": ["keyword1", "keyword2", "keyword3"],
    "urgency": "high"
  }
]

Current date: ${new Date().toISOString().split('T')[0]}`,
  })

  console.log('[v0] AI response received, parsing topics...')
  
  // Extract JSON from response
  const jsonMatch = text.match(/\[[\s\S]*\]/)
  if (!jsonMatch) {
    throw new Error('AI did not return valid JSON')
  }

  const topics = JSON.parse(jsonMatch[0]) as Omit<Topic, 'id' | 'createdAt'>[]
  
  // Add IDs and timestamps
  return topics.map(topic => ({
    ...topic,
    id: crypto.randomUUID(),
    createdAt: new Date()
  }))
}

/**
 * AI generates a full, in-depth article about a topic
 */
export async function generateArticle(topic: Topic): Promise<{
  title: string
  summary: string
  content: string
  slug: string
}> {
  console.log(`[v0] Generating article for: ${topic.title}`)
  
  const { text } = await generateText({
    model: openai('gpt-4o'),
    prompt: `You are an expert political journalist. Write a comprehensive, in-depth article about this topic:

TOPIC: ${topic.title}
DESCRIPTION: ${topic.description}
ANGLE: ${topic.angle}
KEYWORDS: ${topic.keywords.join(', ')}

Write a high-quality article that:
- Is 1500-2000 words long
- Has a compelling headline
- Opens with a strong lede (first paragraph)
- Provides deep analysis and context
- Includes multiple perspectives
- Explains implications and what it means for readers
- Is well-structured with clear sections
- Uses clear, engaging language (not academic)
- Avoids bias while presenting facts

Format as JSON:
{
  "title": "Compelling headline",
  "summary": "2-3 sentence summary of the article",
  "content": "Full article in HTML with <h2>, <p>, <ul>, etc tags for structure"
}`,
  })

  console.log('[v0] Article generated, parsing content...')
  
  // Extract JSON from response
  const jsonMatch = text.match(/\{[\s\S]*\}/)
  if (!jsonMatch) {
    throw new Error('AI did not return valid article JSON')
  }

  const article = JSON.parse(jsonMatch[0])
  
  // Generate slug from title
  const slug = article.title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
  
  return {
    ...article,
    slug
  }
}
