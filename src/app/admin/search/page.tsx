import SearchInterface from './SearchInterface'

export const dynamic = 'force-dynamic'

export default function SearchPage() {
  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h1 className="font-display text-xl font-bold text-text-primary">Search</h1>
        <p className="font-mono text-xs text-text-muted mt-1">Keyword or semantic search across entities and claims.</p>
      </div>
      <SearchInterface />
    </div>
  )
}
