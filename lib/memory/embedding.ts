import { googleModel } from '@/lib/google'
import { GoogleGenerativeAI } from "@google/generative-ai";

const apiKey = process.env.GOOGLE_API_KEY || "";
const genAI = new GoogleGenerativeAI(apiKey);
const embeddingModel = genAI.getGenerativeModel({ model: "text-embedding-004" });

export async function generateEmbedding(text: string): Promise<number[] | null> {
    if (!text || !apiKey) return null;

    try {
        const result = await embeddingModel.embedContent(text);
        const embedding = result.embedding;
        return embedding.values;
    } catch (error) {
        console.error("Gemini Embedding Failed:", error);
        return null;
    }
}
