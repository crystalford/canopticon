import { genAI } from '@/lib/google'

const embeddingModel = genAI.getGenerativeModel({ model: "text-embedding-004" });

export async function generateEmbedding(text: string): Promise<number[] | null> {
    if (!text) return null;

    try {
        const result = await embeddingModel.embedContent(text);
        const embedding = result.embedding;
        return embedding.values;
    } catch (error) {
        console.error("Gemini Embedding Failed:", error);
        return null;
    }
}
