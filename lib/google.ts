import { GoogleGenerativeAI } from "@google/generative-ai";

const apiKey = process.env.GOOGLE_API_KEY || "";
const genAI = new GoogleGenerativeAI(apiKey);

export const googleModel = genAI.getGenerativeModel({ model: "gemini-1.5-pro" });

export async function deepResearch(content: string, context: string = ""): Promise<string | null> {
    if (!apiKey) return null;

    try {
        const prompt = `
      You are a senior political analyst. Perform a "Deep Dive" research analysis on the following signal.
      
      SIGNAL CONTENT:
      ${content}

      ADDITIONAL CONTEXT:
      ${context}

      TASK:
      1. Identify the core conflict and key stakeholders.
      2. Provide historical context or precedent (e.g., "This is similar to the 2015 policy...").
      3. Analyze the strategic implications for the main parties (Liberals, Conservatives, NDP).
      4. flag any potential misinformation or missing context.

      OUTPUT FORMAT:
      Return a structured Markdown report. Use bolding for key terms. Keep it dense and insightful, like a privileged intelligence briefing.
    `;

        const result = await googleModel.generateContent(prompt);
        const response = await result.response;
        return response.text();
    } catch (error) {
        console.error("Gemini Deep Research Failed:", error);
        return null;
    }
}
