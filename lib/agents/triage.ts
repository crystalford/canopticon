import OpenAI from "openai";
import { Signal, TriageScore } from "@/types";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export async function scoreSignal(signal: Signal, sourceReliability?: number): Promise<TriageScore> {
    const prompt = `
  You are 'The General', a ruthless Intelligence Officer for a high-tech news empire.
  Your job is to TRIAGE incoming information signals.
  
  Evaluate this signal for immediate strategic value:
  HEADLINE: ${signal.headline}
  SUMMARY: ${signal.summary}
  SOURCE: ${signal.source}
  
  Criteria for HIGH SCORE (80-100):
  - Major geopolitical shift
  - Breakthrough technology (AI, Space, Biotech)
  - Critical security threat
  - High viral potential (scandal, major announcement)
  
  Criteria for LOW SCORE (0-20):
  - Generic press release
  - Minor incremental update
  - Irrelevant clickbait
  - Duplicate or stale news

  Return ONLY a JSON object:
  {
    "score": number (0-100),
    "reasoning": "Brief, punchy explanation.",
    "recommended_action": "approve" | "archive" | "review" (approve if >80, archive if <20, review otherwise)
  }
  `;

    try {
        const completion = await openai.chat.completions.create({
            model: "gpt-3.5-turbo",
            messages: [{ role: "user", content: prompt }],
            temperature: 0.3,
        });

        const text = completion.choices[0].message.content || "{}";
        const jsonStart = text.indexOf('{');
        const jsonEnd = text.lastIndexOf('}') + 1;
        const jsonStr = text.substring(jsonStart, jsonEnd);

        let result = JSON.parse(jsonStr) as TriageScore;

        // Auto-Approval Override (Phase 1 Logic)
        // If high confidence score (from AI) AND high source reliability (from DB), auto-approve.
        if (sourceReliability && sourceReliability > 0.7 && result.score >= 75) {
            // Ensure it's approved if it meets the bar, even if AI was slightly conservative on action
            if (result.recommended_action === 'review') {
                result.recommended_action = 'approve';
                result.reasoning += " [Auto-Approved due to Reliability]";
            }
        }

        return result;

    } catch (error) {
        console.error("Triage Error:", error);
        return {
            score: 50,
            reasoning: "AI processing failed. Manual review required.",
            recommended_action: 'review'
        };
    }
}
