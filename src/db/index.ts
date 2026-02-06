import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import * as schema from './schema'

// Create postgres connection
const connectionString = process.env.DATABASE_URL!

// Configure postgres-js for serverless environment
// These settings prevent connection exhaustion in Vercel functions
const queryClient = postgres(connectionString, {
    max: 1, // One connection per serverless function instance
    idle_timeout: 20, // Close idle connections after 20 seconds
    connect_timeout: 10, // Fail fast if can't connect within 10 seconds
    prepare: false, // Disable prepared statements (required for connection poolers)
})

// Create drizzle client
export const db = drizzle(queryClient, { schema })

// Export schema for convenience
export {
    sources,
    rawArticles,
    clusters,
    clusterArticles,
    signals,
    articles,
    videoMaterials,
    logs,
    aiUsage,
    operators,
    subscribers,
    systemSettings,
    briefs,
    secondarySources,
    secondaryArticles,
    analysisReports,
    socialAccounts,
    aiProviders,
    prompts,
    pipelineConfig,
    generationRuns,
    contentSources,
} from './schema'

