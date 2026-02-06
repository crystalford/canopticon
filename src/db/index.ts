import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import * as schema from './schema'

// Create postgres connection
const connectionString = process.env.DATABASE_URL!

// For query purposes
const queryClient = postgres(connectionString)

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
} from './schema'

