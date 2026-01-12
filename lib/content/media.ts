import OpenAI from 'openai';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY || 'dummy' });

export async function generateThumbnail(headline: string): Promise<string | null> {
    if (!process.env.OPENAI_API_KEY) return null;

    try {
        const response = await openai.images.generate({
            model: "dall-e-3",
            prompt: `Editorial political art, high contrast, minimalist, dark mode aesthetic, conceptual representation of: ${headline}. No text. Digital art style.`,
            n: 1,
            size: "1024x1024",
            quality: "standard" // cost control, use hd if needed
        });
        return response.data?.[0]?.url || null;
    } catch (e) {
        console.error("DALL-E Generation Failed:", e);
        return null;
    }
}

export async function generateAudio(script: string): Promise<string | null> {
    if (!process.env.OPENAI_API_KEY) return null;

    try {
        const mp3 = await openai.audio.speech.create({
            model: "tts-1", // tts-1 is cheaper than tts-1-hd
            voice: "onyx", // Deep, serious tone
            input: script,
        });

        // Convert raw buffer to base64 for immediate frontend playback without file storage complexity for MVP
        const buffer = Buffer.from(await mp3.arrayBuffer());
        return `data:audio/mp3;base64,${buffer.toString('base64')}`;
    } catch (e) {
        console.error("TTS Generation Failed:", e);
        return null;
    }
}
// ... existing exports

export async function generateInfographic(headline: string, summary: string): Promise<string | null> {
    if (!process.env.OPENAI_API_KEY) return null;

    try {
        // Step 1: Design the layout
        const designResponse = await openai.chat.completions.create({
            model: "gpt-4o",
            messages: [
                { role: "system", content: "You are a data visualization expert. Describe a clear, high-contrast, minimalist infographic that represents the news story. Focus on ONE key statistic, map, or relationship. Do not ask for complex text. Output a specific image prompt for DALL-E 3." },
                { role: "user", content: `Headline: ${headline}\nSummary: ${summary}` }
            ]
        });

        const visualPrompt = designResponse.choices[0].message.content || `An infographic about ${headline}`;

        // Step 2: Render
        const response = await openai.images.generate({
            model: "dall-e-3",
            prompt: `A professional, vector-style flat infographic. ${visualPrompt}. High contrast colors (Cyan, Dark Blue, White). Minimal text. clean lines, corporate memphis style, political news context.`,
            n: 1,
            size: "1024x1024",
            quality: "standard"
        });

        return response.data?.[0]?.url || null;
    } catch (e) {
        console.error("Infographic Generation Failed:", e);
        return null;
    }
}
