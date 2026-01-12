import Anthropic from '@anthropic-ai/sdk';
import OpenAI from 'openai';

// Initialize Clients (safely)
const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY || 'dummy' });
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY || 'dummy' });

export interface AIAnalysisResult {
  summary: string;
  script: string;
  tags: string[];
}

export async function analyzeSignal(headline: string, content: string): Promise<AIAnalysisResult> {
  // 1. Try OpenAI (Primary)
  if (process.env.OPENAI_API_KEY) {
    try {
      return await analyzeWithOpenAI(headline, content);
    } catch (e) {
      console.warn("OpenAI Failed, failing over to Anthropic", e);
    }
  }

  // 2. Fallback to Anthropic
  if (process.env.ANTHROPIC_API_KEY) {
    return await analyzeWithAnthropic(headline, content);
  }

  return {
    summary: "System Offline: No valid AI API Keys configured.",
    script: "Check configuration.",
    tags: ["Error"]
  };
}

async function analyzeWithOpenAI(headline: string, content: string): Promise<AIAnalysisResult> {
  const completion = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [
      {
        role: "system",
        content: `You are CANOPTICON, an advanced political signal intelligence engine. 
          Return a JSON object with: summary (comprehensive, 2-3 paragraphs), script (30s TikTok style), tags (3 metadata tags).`
      },
      {
        role: "user",
        content: `Analyze this signal:\nHEADLINE: ${headline}\nCONTENT: ${content}`
      }
    ],
    response_format: { type: "json_object" },
  });
  const result = JSON.parse(completion.choices[0].message.content || "{}");
  return {
    summary: result.summary || "Analysis failed.",
    script: result.script || "No script generated.",
    tags: result.tags || []
  };
}

async function analyzeWithAnthropic(headline: string, content: string): Promise<AIAnalysisResult> {
  const msg = await anthropic.messages.create({
    model: "claude-3-haiku-20240307",
    max_tokens: 1024,
    system: `You are CANOPTICON. Return JSON with: summary, script, tags.`,
    messages: [
      {
        role: "user",
        content: `Analyze this signal:\nHEADLINE: ${headline}\nCONTENT: ${content}\n\nRespond with valid JSON only.`
      }
    ]
  });
  const textContent = msg.content[0].type === 'text' ? msg.content[0].text : "{}";
  const result = JSON.parse(textContent);
  return {
    summary: result.summary || "Analysis failed.",
    script: result.script || "No script generated.",
    tags: result.tags || []
  };
}
