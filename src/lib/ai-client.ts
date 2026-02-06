/**
 * AI Client - Universal interface for different AI providers
 * Supports: Perplexity, ChatGPT, Claude, Gemini
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

/**
 * Universal AI client
 */
export class AIClient {
    constructor(private config: AIClientConfig) {}

    async chat(messages: AIMessage[]): Promise<AIResponse> {
        switch (this.config.provider) {
            case 'perplexity':
                return this.perplexityChat(messages)
            case 'openai':
                return this.openaiChat(messages)
            case 'anthropic':
                return this.anthropicChat(messages)
            case 'google':
                return this.googleChat(messages)
            default:
                throw new Error(`Unsupported provider: ${this.config.provider}`)
        }
    }

    private async perplexityChat(messages: AIMessage[]): Promise<AIResponse> {
        const response = await fetch('https://api.perplexity.ai/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${this.config.apiKey}`,
            },
            body: JSON.stringify({
                model: this.config.model,
                messages: messages.map(m => ({ role: m.role, content: m.content })),
            }),
        })

        if (!response.ok) {
            const error = await response.text()
            throw new Error(`Perplexity API error: ${error}`)
        }

        const data = await response.json()
        return {
            content: data.choices[0].message.content,
            tokensUsed: data.usage?.total_tokens,
            model: data.model,
        }
    }

    private async openaiChat(messages: AIMessage[]): Promise<AIResponse> {
        const response = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${this.config.apiKey}`,
            },
            body: JSON.stringify({
                model: this.config.model,
                messages: messages.map(m => ({ role: m.role, content: m.content })),
            }),
        })

        if (!response.ok) {
            const error = await response.text()
            throw new Error(`OpenAI API error: ${error}`)
        }

        const data = await response.json()
        return {
            content: data.choices[0].message.content,
            tokensUsed: data.usage?.total_tokens,
            model: data.model,
        }
    }

    private async anthropicChat(messages: AIMessage[]): Promise<AIResponse> {
        // Extract system message if present
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
                max_tokens: 4096,
                system: systemMessage?.content,
                messages: userMessages.map(m => ({ role: m.role, content: m.content })),
            }),
        })

        if (!response.ok) {
            const error = await response.text()
            throw new Error(`Anthropic API error: ${error}`)
        }

        const data = await response.json()
        return {
            content: data.content[0].text,
            tokensUsed: data.usage?.input_tokens + data.usage?.output_tokens,
            model: data.model,
        }
    }

    private async googleChat(messages: AIMessage[]): Promise<AIResponse> {
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
                    contents: [{
                        parts: [{ text: prompt }]
                    }]
                }),
            }
        )

        if (!response.ok) {
            const error = await response.text()
            throw new Error(`Google API error: ${error}`)
        }

        const data = await response.json()
        return {
            content: data.candidates[0].content.parts[0].text,
            tokensUsed: data.usageMetadata?.totalTokenCount,
            model: this.config.model,
        }
    }
}
