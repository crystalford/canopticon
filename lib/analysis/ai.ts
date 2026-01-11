import Anthropic from '@anthropic-ai/sdk';

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

export interface AIAnalysisResult {
  summary: string;
  script: string;
  tags: string[];
}

export async function analyzeSignal(headline: string, content: string): Promise<AIAnalysisResult> {
  if (!process.env.ANTHROPIC_API_KEY) {
    console.error("Missing ANTHROPIC_API_KEY");
    return {
      summary: "Configuration Error: Missing API Key",
      script: "System offline",
      tags: ["Error"]
    };
  }

  try {
    const msg = await anthropic.messages.create({
      model: "claude-3-haiku-20240307", // Fast & Cost effective
      max_tokens: 1024,
      system: `You are CANOPTICON, an advanced political signal intelligence engine. 
      Your goal is to analyze raw political data (bills, news) and convert it into high-impact content.
      
      Return a JSON object with:
      - summary: A 1-sentence "Bottom Line Up Front" briefing.
      - script: A 30-second rapid-fire script for TikTok/Shorts. Style: Urgent, cynical, insider.
      - tags: Array of 3 key metadata tags.`,
      messages: [
        {
          role: "user",
          content: `Analyze this signal:\nHEADLINE: ${headline}\nCONTENT: ${content}\n\nRespond with valid JSON only.`
        }
      ]
    });

    // Handle potential TextBlock content
    const textContent = msg.content[0].type === 'text' ? msg.content[0].text : "{}";
    const result = JSON.parse(textContent);

    return {
      summary: result.summary || "Analysis failed.",
      script: result.script || "No script generated.",
      tags: result.tags || []
    };

  } catch (error) {
    console.error("AI Analysis Failed:", error);
    return {
      summary: "Error during analysis service call.",
      script: "System offline.",
      tags: ["Error"]
    };
  }
}
