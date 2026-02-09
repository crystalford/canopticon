import { generateObject } from 'ai'
import { z } from 'zod'
import { chatModel } from '@/lib/ai/providers'

const FallacySchema = z.object({
    fallacies: z.array(z.object({
        type: z.string().describe('The name of the logical fallacy, e.g., "Ad Hominem", "Straw Man", "False Dichotomy"'),
        explanation: z.string().describe('A brief explanation of how the tweet commits this fallacy'),
        severity: z.enum(['low', 'medium', 'high']).describe('How egregious the fallacy is'),
        correction: z.string().describe('A polite suggestion for how the argument could be rephrased constructively')
    })).describe('List of logical fallacies found in the text. Return empty array if none found.')
})

export async function detectFallacies(text: string, context = 'Canadian political discourse') {
    try {
        const { object } = await generateObject({
            model: chatModel, // Helper that returns model instance
            schema: FallacySchema,
            prompt: `
            Analyze the following text for logical fallacies.
            Context: ${context}
            
            Text to analyze:
            "${text}"
            
            Identify any logical fallacies such as:
            - Straw Man
            - Ad Hominem
            - False Dichotomy / False Dilemma
            - Appeal to Emotion
            - Slippery Slope
            - Tu Quoque (Whataboutism)
            - Appeal to Authority
            - Circular Reasoning
            
            Be strict but fair. If it's just an opinion, it's not a fallacy.
            `,
        })

        return object.fallacies
    } catch (error) {
        console.error('Fallacy detection failed:', error)
        return []
    }
}
