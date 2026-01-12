import OpenAI from "openai";
import { Signal, VideoMaterial } from "@/types";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export async function generateVideoMaterials(signal: Signal): Promise<VideoMaterial | null> {
    const prompt = `
  You are 'The Producer', a veteran political content strategist for a Canadian conservative creator.
  Your goal is to turn this news signal into high-impact video materials for TikTok (1-3 mins) and YouTube.

  SIGNAL:
  Headline: ${signal.headline}
  Summary: ${signal.summary || signal.ai_summary}
  Source: ${signal.source}
  Detailed Content: ${JSON.stringify(signal.raw_content || "")}

  TASK:
  Generate a JSON object containing:
  1. "script": A 60-90 second monologue script. Direct, clear, punchy. Hook the audience immediately. Focus on the 'Why this matters' angle.
  2. "quotes": Extract 2-3 key quotes (or construct paraphrase if raw quotes missing).
  3. "contradictions": Identify 1-2 contradictions or hypocrisies if applicable (e.g. "They said X, but did Y").
  4. "angles": 3 distinct angles/hooks for the video (e.g. "The Financial Cost", "The Freedom Angle", "The hidden detail").

  Output JSON format:
  {
    "script": "markdown string",
    "quotes": [{ "text": "...", "attribution": "..." }],
    "contradictions": [{ "claim": "...", "counter": "...", "evidence": "..." }],
    "angles": ["Angle 1", "Angle 2", "Angle 3"]
  }
  `;

    try {
        const completion = await openai.chat.completions.create({
            model: "gpt-4o", // Use 4o for high quality creative writing
            messages: [{ role: "user", content: prompt }],
            response_format: { type: "json_object" },
            temperature: 0.7,
        });

        const text = completion.choices[0].message.content;
        if (!text) return null;

        const data = JSON.parse(text) as VideoMaterial;
        return data;

    } catch (error) {
        console.error("VideoProducer Error:", error);
        return null;
    }
}
