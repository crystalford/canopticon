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
export * from './schema'
