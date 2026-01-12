import { googleModel } from '@/lib/google'

export interface VideoScene {
    time: string;
    visual: string;
    audio: string;
    text_overlay?: string;
    voiceover?: string;
    headline?: string;
}

export interface VideoScript {
    intro: VideoScene;
    scenes: VideoScene[];
    outro: VideoScene;
}

export async function generateVideoScript(headline: string, summary: string): Promise<VideoScene[] | null> {
    try {
        const prompt = `
      You are a viral TikTok/Shorts producer. Create a high-retention, shot-by-shot video script for this news story.
      
      HEADLINE: ${headline}
      SUMMARY: ${summary}
      
      REQUIREMENTS:
      - Total duration: 60 seconds max.
      - Hook in the first 3 seconds.
      - Visuals: Describe specific stock footage, AI images, or text overlays (e.g., "Split screen of politician X and a burning graph").
      - Audio: Casual, high-energy narration.
      
      OUTPUT FORMAT:
      Return ONLY a valid JSON array of objects. Do not wrap in markdown code blocks.
      Schema: [{ "time": "0:00-0:05", "visual": "...", "audio": "..." }]
    `;

        const result = await googleModel.generateContent(prompt);
        const text = result.response.text().replace(/```json/g, '').replace(/```/g, '').trim();

        return JSON.parse(text) as VideoScene[];
    } catch (error) {
        console.error("Gemini Video Script Failed:", error);
        return null;
    }
}
