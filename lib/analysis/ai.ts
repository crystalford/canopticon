import Anthropic from '@anthropic-ai/sdk';
import OpenAI from 'openai';

// Initialize Clients (safely)
const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY || 'dummy' });
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY || 'dummy' });

export interface AIAnalysisResult {
  summary: string;
  script: string;
  tags: string[];
  fallacies: Array<{
    name: string;
    confidence: number;
    quote: string;
    explanation: string;
  }>;
  bias: {
    orientation: 'Left' | 'Right' | 'Center' | 'Unknown';
    intensity: number; // 0 to 1
    explanation: string;
  };
  rhetoric: string[];
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
    tags: ["Error"],
    fallacies: [],
    bias: { orientation: 'Unknown', intensity: 0, explanation: "System offline" },
    rhetoric: []
  };
}

async function analyzeWithOpenAI(headline: string, content: string): Promise<AIAnalysisResult> {
  const completion = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [
      {
        role: "system",
        content: `You are CANOPTICON, an advanced political signal intelligence engine. 
          Return a JSON object with: 
          - summary (comprehensive, 2-3 paragraphs)
          - script (30s TikTok style)
          - tags (3 metadata tags)
          - fallacies (array of objects: { name, confidence (0-1), quote, explanation }). Detect logical fallacies.
          - bias (object: { orientation: 'Left'|'Right'|'Center'|'Unknown', intensity: 0-1, explanation: string }). Assess political slant.
          - rhetoric (array of strings). Detect persuasive devices (e.g., 'Fear Mongering', 'Loaded Language', 'Appeal to Authority').`
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
    tags: result.tags || [],
    fallacies: result.fallacies || [],
    bias: result.bias || { orientation: 'Unknown', intensity: 0, explanation: "Analysis failed" },
    rhetoric: result.rhetoric || []
  };
}

async function analyzeWithAnthropic(headline: string, content: string): Promise<AIAnalysisResult> {
  const msg = await anthropic.messages.create({
    model: "claude-3-haiku-20240307",
    max_tokens: 1024,
    system: `You are CANOPTICON. Return JSON with: summary, script, tags, fallacies, bias (orientation, intensity, explanation), rhetoric (array).`,
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
    tags: result.tags || [],
    fallacies: result.fallacies || [],
    bias: result.bias || { orientation: 'Unknown', intensity: 0, explanation: "Analysis failed" },
    rhetoric: result.rhetoric || []
  };
}

export async function generateSocialPost(headline: string, content: string): Promise<string> {
  if (!process.env.OPENAI_API_KEY) return "Error: No OpenAI Key";

  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content: `You are an expert social media manager for a political news site. Write a viral, engaging, but factual post for X/Twitter about the following news.
- Max 280 characters.
- Use 1-2 relevant hashtags.
- Be punchy and hook the reader immediately.
- Do NOT use emojis unless strictly necessary for tone.
- Do NOT wrap in quotes.`
        },
        {
          role: "user",
          content: `HEADLINE: ${headline}\nCONTENT: ${content}`
        }
      ],
    });
    return completion.choices[0].message.content || "";
  } catch (e) {
    console.error("Social Gen Error", e);
    return "Error generating post.";
  }
}
