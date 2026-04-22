import GraphView from './GraphView'

export const dynamic = 'force-dynamic'

// Break out of the admin layout's p-6 padding so the graph fills edge-to-edge.
// The negative margin cancels the parent padding; the height fills the remaining viewport.
export default function GraphPage() {
  return (
    <div className="-m-6 h-[calc(100vh-3rem)]">
      <GraphView />
    </div>
  )
}
