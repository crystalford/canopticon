import { runIngest } from '@/app/simple-actions'

export default function IngestButton() {
    return (
        <form action={runIngest}>
            <button className="bg-blue-600 hover:bg-blue-700 px-6 py-3 rounded font-bold">
                Run Ingestion
            </button>
        </form>
    )
}
