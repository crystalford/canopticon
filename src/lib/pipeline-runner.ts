import { db, aiProviders, prompts, pipelineConfig, generationRuns } from '@/db'
import { eq } from 'drizzle-orm'
import { AIClient } from './ai-client'

/**
 * Pipeline Result
 * Returned after every pipeline execution with full context
 */
export interface PipelineResult {
    success: boolean
    taskType: string
    output: unknown
    generationRunId: string
    tokensUsed?: number
    cost?: string
    error?: string
    duration?: number
}

/**
 * Pipeline Runner - Orchestrates any pipeline based on config
 *
 * Purpose: Execute AI workflows by looking up config from database
 *
 * Data Flow:
 * 1. Receive task name (e.g., "discovery", "writing")
 * 2. Look up pipeline config (which service + prompt to use)
 * 3. Load AI provider credentials and prompt text
 * 4. Create AI client and execute the handler
 * 5. Log results to generation_runs table
 * 6. Return result with success/error details
 *
 * All steps are logged for transparency and debugging
 */
export class PipelineRunner {
    /**
     * Run any pipeline by task type
     *
     * @param task - Task identifier (matches pipeline_config.task)
     * @param handler - Async function that uses the AI client
     * @returns PipelineResult with output or error
     */
    async runPipeline(
        task: string,
        handler: (client: AIClient, promptText: string) => Promise<unknown>
    ): Promise<PipelineResult> {
        const startTime = Date.now()
        console.log(`\n[pipeline] ========================================`)
        console.log(`[pipeline] Starting pipeline: "${task}"`)
        console.log(`[pipeline] ========================================`)

        try {
            // ============================================================
            // STEP 1: Load pipeline configuration
            // ============================================================
            console.log(`[pipeline] Step 1: Loading config for task "${task}"...`)

            const config = await db
                .select()
                .from(pipelineConfig)
                .where(eq(pipelineConfig.task, task))
                .limit(1)

            if (config.length === 0) {
                throw new Error(
                    `No pipeline config found for task: "${task}"\n` +
                    `Go to Workflows page and create a workflow with task name "${task}"`
                )
            }

            const cfg = config[0]
            console.log(`[pipeline]    Config found - provider: ${cfg.providerId}, model: ${cfg.model}`)

            // ============================================================
            // STEP 2: Load AI provider credentials
            // ============================================================
            console.log(`[pipeline] Step 2: Loading AI provider...`)

            const provider = await db
                .select()
                .from(aiProviders)
                .where(eq(aiProviders.id, cfg.providerId))
                .limit(1)

            if (provider.length === 0) {
                throw new Error(
                    `AI provider not found: ${cfg.providerId}\n` +
                    `The provider may have been deleted. Update the workflow config.`
                )
            }

            const prov = provider[0]
            console.log(`[pipeline]    Provider: "${prov.name}" (${prov.provider})`)

            // ============================================================
            // STEP 3: Load prompt template
            // ============================================================
            console.log(`[pipeline] Step 3: Loading prompt...`)

            const prompt = await db
                .select()
                .from(prompts)
                .where(eq(prompts.id, cfg.promptId))
                .limit(1)

            if (prompt.length === 0) {
                throw new Error(
                    `Prompt not found: ${cfg.promptId}\n` +
                    `The prompt may have been deleted. Update the workflow config.`
                )
            }

            const p = prompt[0]
            console.log(`[pipeline]    Prompt: "${p.name}" (${p.promptText.length} characters)`)

            // ============================================================
            // STEP 4: Create AI client and execute handler
            // ============================================================
            console.log(`[pipeline] Step 4: Executing AI handler...`)
            console.log(`[pipeline]    Model: ${cfg.model}`)

            const client = new AIClient({
                provider: prov.provider as any,
                apiKey: prov.apiKey,
                model: cfg.model,
            })

            const handlerStartTime = Date.now()
            const output = await handler(client, p.promptText)
            const handlerDuration = Date.now() - handlerStartTime

            console.log(`[pipeline]    Handler completed in ${handlerDuration}ms`)

            // ============================================================
            // STEP 5: Log to generation_runs
            // ============================================================
            console.log(`[pipeline] Step 5: Logging to generation_runs...`)

            const [runRecord] = await db
                .insert(generationRuns)
                .values({
                    task,
                    providerId: prov.id,
                    promptId: p.id,
                    input: JSON.stringify({ task, promptName: p.name }),
                    output: JSON.stringify(output),
                    status: 'success',
                })
                .returning()

            const totalDuration = Date.now() - startTime

            console.log(`[pipeline]    Generation run: ${runRecord.id}`)
            console.log(`[pipeline] ========================================`)
            console.log(`[pipeline] Pipeline "${task}" completed successfully`)
            console.log(`[pipeline] Total duration: ${totalDuration}ms`)
            console.log(`[pipeline] ========================================\n`)

            return {
                success: true,
                taskType: task,
                output,
                generationRunId: runRecord.id,
                duration: totalDuration,
            }
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error)
            const totalDuration = Date.now() - startTime

            console.error(`[pipeline] ========================================`)
            console.error(`[pipeline] Pipeline "${task}" FAILED`)
            console.error(`[pipeline] Error: ${message}`)
            console.error(`[pipeline] Duration: ${totalDuration}ms`)
            console.error(`[pipeline] ========================================\n`)

            // Try to log failed run
            try {
                await db.insert(generationRuns).values({
                    task,
                    providerId: '',
                    promptId: '',
                    input: JSON.stringify({ task, error: message }),
                    output: null,
                    status: 'error',
                })
            } catch (logError) {
                console.error(`[pipeline] Failed to log error to generation_runs:`, logError)
            }

            return {
                success: false,
                taskType: task,
                output: null,
                generationRunId: '',
                error: message,
                duration: totalDuration,
            }
        }
    }
}

export const pipelineRunner = new PipelineRunner()
