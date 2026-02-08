import { anthropic } from '@ai-sdk/anthropic'
import { createOpenAI } from '@ai-sdk/openai'

/**
 * Perplexity - for web research
 * Uses OpenAI-compatible API with custom baseURL
 */
export const perplexity = createOpenAI({
    apiKey: process.env.PERPLEXITY_API_KEY || '',
    baseURL: 'https://api.perplexity.ai',
})

/**
 * Default models
 */
export const chatModel = anthropic('claude-sonnet-4-20250514')
export const researchModel = perplexity('sonar-pro')
