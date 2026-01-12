import { recallMemories, Memory } from '@/lib/memory/cortex';
import { googleModel } from '@/lib/google';

export interface DailyBriefing {
    date: string;
    narrative: string;
    key_themes: string[];
}

export async function generateDailyBriefing(): Promise<DailyBriefing | null> {
    const today = new Date().toISOString().split('T')[0];

    // 1. Recall recent memories (last 24h context ideally, but for now we just query key themes)
    // In a real system we'd filter by time in the metadata
    // Here we just ask for "Political instability, Tech regulation, Global conflict" context
    const contextMemories = await recallMemories("Political instability Tech regulation Global conflict", 0.3, 20);

    if (contextMemories.length === 0) return null;

    const contextText = contextMemories.map(m => `- ${m.content}`).join('\n');

    // 2. Synthesize with Gemini
    const prompt = `You are The Watchman, a strategic intelligence AI.
  
  Review the following intelligence signals from the last 24 hours:
  ${contextText}

  Task:
  1. Identify the 3 dominant narratives.
  2. Write a "Morning Briefing" (max 200 words) tailored for a Prime Minister or CEO.
  3. Flag any contradictions or reliable patterns.

  Output JSON: { "date": "${today}", "narrative": "...", "key_themes": ["..."] }`;

    try {
        const result = await googleModel.generateContent(prompt);
        const responseText = result.response.text();
        // Simple cleaning of markdown json blocks if present
        const jsonStr = responseText.replace(/```json/g, '').replace(/```/g, '').trim();
        return JSON.parse(jsonStr) as DailyBriefing;
    } catch (e) {
        console.error("Watchman Synthesis Failed:", e);
        return null;
    }
}
