import { db, aiProviders, prompts, pipelineConfig, generationRuns } from '@/db'
import { eq } from 'drizzle-orm'
import { AIClient } from './ai-client'

export interface PipelineResult {
    success: boolean
    taskType: string
    output: unknown
    generationRunId: string
    tokensUsed?: number
    cost?: string
    error?: string
}

/**
 * Pipeline Runner - Orchestrates any pipeline based on config
 * Looks up provider + prompt from database and executes the pipeline
 */
export class PipelineRunner {
    /**
     * Run any pipeline by task type
     * Looks up config, gets credentials, and delegates to task handler
     */
    async runPipeline(
        task: string,
        handler: (client: AIClient, promptText: string) => Promise<unknown>
    ): Promise<PipelineResult> {
        try {
            // Get pipeline config for this task
            const config = await db
                .select()
                .from(pipelineConfig)
                .where(eq(pipelineConfig.task, task))
                .limit(1)

            if (config.length === 0) {
                throw new Error(`No pipeline config found for task: ${task}`)
            }

            const cfg = config[0]

            // Get AI provider
            const provider = await db
                .select()
                .from(aiProviders)
                .where(eq(aiProviders.id, cfg.providerId))
                .limit(1)

            if (provider.length === 0) {
                throw new Error(
                    `Provider not found: ${cfg.providerId}`
                )
            }

            const prov = provider[0]

            // Get prompt
            const prompt = await db
                .select()
                .from(prompts)
                .where(eq(prompts.id, cfg.promptId))
                .limit(1)

            if (prompt.length === 0) {
                throw new Error(`Prompt not found: ${cfg.promptId}`)
            }

            const p = prompt[0]

            // Create AI client
            const client = new AIClient({
                provider: prov.provider as any,
                apiKey: prov.apiKey,
                model: cfg.model,
            })

            // Execute handler with client and prompt
            const output = await handler(client, p.promptText)

            // Log generation run
            const [runRecord] = await db
                .insert(generationRuns)
                .values({
                    task,
                    providerId: prov.id,
                    promptId: p.id,
                    input: JSON.stringify({ task, promptText: p.promptText }),
                    output: JSON.stringify(output),
                    status: 'success',
                })
                .returning()

            return {
                success: true,
                taskType: task,
                output,
                generationRunId: runRecord.id,
            }
        } catch (error) {
            const message =
                error instanceof Error ? error.message : String(error)
            console.error(`Pipeline ${task} failed:`, message)

            return {
                success: false,
                taskType: task,
                output: null,
                generationRunId: '',
                error: message,
            }
        }
    }
}

export const pipelineRunner = new PipelineRunner()
