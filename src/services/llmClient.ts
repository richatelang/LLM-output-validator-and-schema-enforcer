import { GoogleGenerativeAI } from '@google/generative-ai';
import dotenv from 'dotenv';
dotenv.config();

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

export interface LLMCallResult {
  rawContent: string;
  tokensUsed: number;
  latencyMs: number;
}

export async function callLLM(
  systemPrompt: string,
  userMessage: string,
  model: string = 'gemini-2.5-flash'
): Promise<LLMCallResult> {
  const start = Date.now();

  const geminiModel = genAI.getGenerativeModel({
    model,
    systemInstruction: systemPrompt
  });

  const result = await geminiModel.generateContent({
    contents: [{ role: 'user', parts: [{ text: userMessage }] }],
    generationConfig: { maxOutputTokens: 512 }
  });

  const latencyMs = Date.now() - start;
  const rawContent = result.response.text();
  const usage = result.response.usageMetadata;
  const tokensUsed = (usage?.promptTokenCount ?? 0) + (usage?.candidatesTokenCount ?? 0);

  return { rawContent, tokensUsed, latencyMs };
}
