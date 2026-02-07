/**
 * AI Client - Universal interface for different AI providers
 *
 * Supports: Perplexity, ChatGPT, Claude, Gemini
 *
 * Purpose: Provide a consistent API for calling different AI services
 * The same chat() method works regardless of which provider is configured
 *
 * Data Flow:
 * 1. Receive messages array (system, user, assistant roles)
 * 2. Transform to provider-specific format
 * 3. Call provider API with configured credentials
 * 4. Parse response and return standardized format
 * 5. Include token usage for cost tracking
 */

export interface AIMessage {
    role: 'system' | 'user' | 'assistant'
    content: string
}

export interface AIResponse {
    content: string
    tokensUsed?: number
    model: string
}

export interface AIClientConfig {
    provider: 'perplexity' | 'openai' | 'anthropic' | 'google'
    apiKey: string
    model: string
    baseUrl?: string
}

// Timeout for API calls (30 seconds)
const API_TIMEOUT = 30000

export interface ChatOptions {
    maxTokens?: number
}

/**
 * Universal AI client
 *
 * Usage:
 * const client = new AIClient({ provider: 'perplexity', apiKey: '...', model: 'sonar-pro' })
 * const response = await client.chat([{ role: 'user', content: 'Hello' }], { maxTokens: 4000 })
 */
export class AIClient {
    constructor(private config: AIClientConfig) {
        console.log(`[ai-client] Created client for ${config.provider} (model: ${config.model})`)
    }

    /**
     * Send messages to AI and get response
     * Automatically routes to the correct provider
     * @param messages - Array of messages (system, user, assistant roles)
     * @param options - Optional settings (maxTokens, etc.)
     */
    async chat(messages: AIMessage[], options?: ChatOptions): Promise<AIResponse> {
        const startTime = Date.now()
        console.log(`[ai-client] Calling ${this.config.provider}...`)
        console.log(`[ai-client]    Messages: ${messages.length}, Model: ${this.config.model}`)

        try {
            let response: AIResponse

            switch (this.config.provider) {
                case 'perplexity':
                    response = await this.perplexityChat(messages, options?.maxTokens)
                    break
                case 'openai':
                    response = await this.openaiChat(messages, options?.maxTokens)
                    break
                case 'anthropic':
                    response = await this.anthropicChat(messages, options?.maxTokens)
                    break
                case 'google':
                    response = await this.googleChat(messages, options?.maxTokens)
                    break
                default:
                    throw new Error(`Unsupported provider: ${this.config.provider}`)
            }

            const elapsed = Date.now() - startTime
            console.log(`[ai-client] Response received in ${elapsed}ms`)
            console.log(`[ai-client]    Content: ${response.content.length} chars, Tokens: ${response.tokensUsed || 'N/A'}`)

            return response
        } catch (error) {
            const elapsed = Date.now() - startTime
            console.error(`[ai-client] API call failed after ${elapsed}ms:`, error)
            throw error
        }
    }

    /**
     * Perplexity API - Great for web search + AI
     */
    private async perplexityChat(messages: AIMessage[], maxTokens: number = 2048): Promise<AIResponse> {
        const controller = new AbortController()
        const timeoutId = setTimeout(() => controller.abort(), API_TIMEOUT)

        try {
            const response = await fetch('https://api.perplexity.ai/chat/completions', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.config.apiKey}`,
                },
                body: JSON.stringify({
                    model: this.config.model,
                    max_tokens: maxTokens,
                    messages: messages.map(m => ({ role: m.role, content: m.content })),
                }),
                signal: controller.signal,
            })

            clearTimeout(timeoutId)

            if (!response.ok) {
                const errorText = await response.text()
                const status = response.status

                // Parse common error codes
                if (status === 401) {
                    throw new Error(`Perplexity API: Invalid API key. Check your Perplexity API key in AI Services.`)
                } else if (status === 429) {
                    throw new Error(`Perplexity API: Rate limit exceeded. Try again in a few seconds.`)
                } else if (status === 400) {
                    throw new Error(`Perplexity API: Bad request - ${errorText}`)
                } else {
                    throw new Error(`Perplexity API error (${status}): ${errorText}`)
                }
            }

            const data = await response.json()

            if (!data.choices?.[0]?.message?.content) {
                throw new Error('Perplexity API: Empty response received')
            }

            return {
                content: data.choices[0].message.content,
                tokensUsed: data.usage?.total_tokens,
                model: data.model,
            }
        } catch (error) {
            clearTimeout(timeoutId)

            if (error instanceof Error && error.name === 'AbortError') {
                throw new Error(`Perplexity API: Request timed out after ${API_TIMEOUT / 1000}s`)
            }
            throw error
        }
    }

    /**
     * OpenAI API - GPT models
     */
    private async openaiChat(messages: AIMessage[], maxTokens: number = 2048): Promise<AIResponse> {
        const controller = new AbortController()
        const timeoutId = setTimeout(() => controller.abort(), API_TIMEOUT)

        try {
            const response = await fetch('https://api.openai.com/v1/chat/completions', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.config.apiKey}`,
                },
                body: JSON.stringify({
                    model: this.config.model,
                    max_tokens: maxTokens,
                    messages: messages.map(m => ({ role: m.role, content: m.content })),
                }),
                signal: controller.signal,
            })

            clearTimeout(timeoutId)

            if (!response.ok) {
                const errorText = await response.text()
                const status = response.status

                if (status === 401) {
                    throw new Error(`OpenAI API: Invalid API key. Check your OpenAI API key in AI Services.`)
                } else if (status === 429) {
                    throw new Error(`OpenAI API: Rate limit exceeded or quota exhausted.`)
                } else if (status === 400) {
                    throw new Error(`OpenAI API: Bad request - ${errorText}`)
                } else {
                    throw new Error(`OpenAI API error (${status}): ${errorText}`)
                }
            }

            const data = await response.json()

            if (!data.choices?.[0]?.message?.content) {
                throw new Error('OpenAI API: Empty response received')
            }

            return {
                content: data.choices[0].message.content,
                tokensUsed: data.usage?.total_tokens,
                model: data.model,
            }
        } catch (error) {
            clearTimeout(timeoutId)

            if (error instanceof Error && error.name === 'AbortError') {
                throw new Error(`OpenAI API: Request timed out after ${API_TIMEOUT / 1000}s`)
            }
            throw error
        }
    }

    /**
     * Anthropic API - Claude models
     */
    private async anthropicChat(messages: AIMessage[], maxTokens: number = 2048): Promise<AIResponse> {
        const controller = new AbortController()
        const timeoutId = setTimeout(() => controller.abort(), API_TIMEOUT)

        try {
            // Extract system message if present (Anthropic handles it separately)
            const systemMessage = messages.find(m => m.role === 'system')
            const userMessages = messages.filter(m => m.role !== 'system')

            const response = await fetch('https://api.anthropic.com/v1/messages', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'x-api-key': this.config.apiKey,
                    'anthropic-version': '2023-06-01',
                },
                body: JSON.stringify({
                    model: this.config.model,
                    max_tokens: maxTokens,
                    system: systemMessage?.content,
                    messages: userMessages.map(m => ({ role: m.role, content: m.content })),
                }),
                signal: controller.signal,
            })

            clearTimeout(timeoutId)

            if (!response.ok) {
                const errorText = await response.text()
                const status = response.status

                if (status === 401) {
                    throw new Error(`Anthropic API: Invalid API key. Check your Anthropic API key in AI Services.`)
                } else if (status === 429) {
                    throw new Error(`Anthropic API: Rate limit exceeded.`)
                } else if (status === 400) {
                    throw new Error(`Anthropic API: Bad request - ${errorText}`)
                } else {
                    throw new Error(`Anthropic API error (${status}): ${errorText}`)
                }
            }

            const data = await response.json()

            if (!data.content?.[0]?.text) {
                throw new Error('Anthropic API: Empty response received')
            }

            return {
                content: data.content[0].text,
                tokensUsed: (data.usage?.input_tokens || 0) + (data.usage?.output_tokens || 0),
                model: data.model,
            }
        } catch (error) {
            clearTimeout(timeoutId)

            if (error instanceof Error && error.name === 'AbortError') {
                throw new Error(`Anthropic API: Request timed out after ${API_TIMEOUT / 1000}s`)
            }
            throw error
        }
    }

    /**
     * Google API - Gemini models
     */
    private async googleChat(messages: AIMessage[], maxTokens: number = 2048): Promise<AIResponse> {
        const controller = new AbortController()
        const timeoutId = setTimeout(() => controller.abort(), API_TIMEOUT)

        try {
            // Gemini uses different format - combine messages into single prompt
            const prompt = messages.map(m => m.content).join('\n\n')

            const response = await fetch(
                `https://generativelanguage.googleapis.com/v1beta/models/${this.config.model}:generateContent?key=${this.config.apiKey}`,
                {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        generationConfig: {
                            maxOutputTokens: maxTokens,
                        },
                        contents: [{
                            parts: [{ text: prompt }]
                        }]
                    }),
                    signal: controller.signal,
                }
            )

            clearTimeout(timeoutId)

            if (!response.ok) {
                const errorText = await response.text()
                const status = response.status

                if (status === 400 && errorText.includes('API_KEY_INVALID')) {
                    throw new Error(`Google API: Invalid API key. Check your Google API key in AI Services.`)
                } else if (status === 429) {
                    throw new Error(`Google API: Rate limit exceeded.`)
                } else {
                    throw new Error(`Google API error (${status}): ${errorText}`)
                }
            }

            const data = await response.json()

            if (!data.candidates?.[0]?.content?.parts?.[0]?.text) {
                throw new Error('Google API: Empty response received')
            }

            return {
                content: data.candidates[0].content.parts[0].text,
                tokensUsed: data.usageMetadata?.totalTokenCount,
                model: this.config.model,
            }
        } catch (error) {
            clearTimeout(timeoutId)

            if (error instanceof Error && error.name === 'AbortError') {
                throw new Error(`Google API: Request timed out after ${API_TIMEOUT / 1000}s`)
            }
            throw error
        }
    }
}
