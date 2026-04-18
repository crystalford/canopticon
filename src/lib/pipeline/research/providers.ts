import { anthropic } from '@ai-sdk/anthropic';
import { openai } from '@ai-sdk/openai';
import { createGoogleGenerativeAI } from '@ai-sdk/google';

export function getAnthropicModel(modelName: string) {
    return anthropic(modelName);
}

export function getOpenAIModel(modelName: string) {
    return openai(modelName);
}

const google = createGoogleGenerativeAI({
  apiKey: process.env.GOOGLE_GENERATIVE_AI_API_KEY,
});

export function getGoogleModel(modelName: string) {
    return google(modelName);
}
