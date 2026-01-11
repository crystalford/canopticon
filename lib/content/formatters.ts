import OpenAI from 'openai';
import { Signal } from '@/types';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY || 'dummy' });

export async function generateXThread(signal: Signal, analysis: { summary: string, script: string }): Promise<string[] | null> {
    if (!process.env.OPENAI_API_KEY) return null;

    try {
        const completion = await openai.chat.completions.create({
            model: "gpt-4o-mini",
            messages: [
                {
                    role: "system",
                    content: `You are a social media manager for a political news outlet. 
                    Convert the following news signal into a compelling, viral X (Twitter) thread.
                    - First tweet must be a hook.
                    - Max 250 chars per tweet.
                    - 3-5 tweets total.
                    - Last tweet should be a call to action or question.
                    - Return ONLY a JSON array of strings. ["Tweet 1", "Tweet 2", ...]`
                },
                {
                    role: "user",
                    content: `Headline: ${signal.headline}\nSummary: ${analysis.summary}\nScript Context: ${analysis.script}`
                }
            ],
            response_format: { type: "json_object" }
        });

        const content = completion.choices[0].message.content || "{}";
        const json = JSON.parse(content);
        return json.tweets || json.thread || (Array.isArray(json) ? json : null);
    } catch (e) {
        console.error("X Thread Generation Failed:", e);
        return null;
    }
}

export async function generateSubstackArticle(signal: Signal, analysis: { summary: string, script: string }): Promise<string | null> {
    if (!process.env.OPENAI_API_KEY) return null;

    try {
        const completion = await openai.chat.completions.create({
            model: "gpt-4o-mini",
            messages: [
                {
                    role: "system",
                    content: `You are a senior political editor. Write a Substack article based on this news.
                    - Title: Provocative and engaging.
                    - Style: Deep dive, analytical, slightly cynical but informative.
                    - Formatting: Use Markdown (## Headers, **Bold**, etc).
                    - Length: 600-800 words.`
                },
                {
                    role: "user",
                    content: `Headline: ${signal.headline}\nSummary: ${analysis.summary}\nFull Context: ${JSON.stringify(signal)}`
                }
            ]
        });

        return completion.choices[0].message.content || null;
    } catch (e) {
        console.error("Article Generation Failed:", e);
        return null;
    }
}
