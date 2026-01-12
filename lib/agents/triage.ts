import { GoogleGenerativeAI } from "@google/generative-ai";
import { Signal } from "@/types";

const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY!);

export interface TriageScore {
    score: number;
    reasoning: string;
    recommended_action: 'approve' | 'archive' | 'review';
}

export async function scoreSignal(signal: Signal): Promise<TriageScore> {
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" }); // Use Flash for speed/cost

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

  Return a JSON object:
  {
    "score": number (0-100),
    "reasoning": "Brief, punchy explanation of the score.",
    "recommended_action": "approve" | "archive" | "review" (approve if >80, archive if <20, review otherwise)
  }
  `;

    try {
        const result = await model.generateContent(prompt);
        const text = result.response.text();
        // Simple JSON extraction for now - robust parsing can be added later
        const jsonStart = text.indexOf('{');
        const jsonEnd = text.lastIndexOf('}') + 1;
        const jsonStr = text.substring(jsonStart, jsonEnd);
        return JSON.parse(jsonStr) as TriageScore;
    } catch (error) {
        console.error("Triage Error:", error);
        return {
            score: 50,
            reasoning: "AI processing failed. Manual review required.",
            recommended_action: 'review'
        };
    }
}
