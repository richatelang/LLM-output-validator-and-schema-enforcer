import { z } from 'zod';
export interface RegisteredSchema {
  name: string;
  zodSchema: z.ZodTypeAny;
  jsonSchema: object;
  createdAt: string;
}
export type InjectionStrategy = 'json_instruction' | 'few_shot' | 'function_calling';
export interface CallRequest {
  schemaName: string;
  prompt: string;
  model?: string;
  variables?: Record<string, string>;
  strategy?: InjectionStrategy;
}
export interface AttemptResult {
  attempt: number;
  rawResponse: string;
  parsedResponse?: unknown;
  error?: string;
  tokensUsed: number;
  latencyMs: number;
}
export interface CallResponse {
  success: boolean;
  data?: unknown;
  attempts: AttemptResult[];
  totalAttempts: number;
  correctionNeeded: boolean;
  totalLatencyMs: number;
  totalTokensUsed: number;
  strategy: InjectionStrategy;
  warnings?: string[];
}
export interface FailureRecord {
  id: number;
  schemaName: string;
  prompt: string;
  model: string;
  strategy: string;
  attempts: string; // JSON stringified AttemptResult[]
  finalError: string;
  createdAt: string;
}
export interface FailureAnalysis {
  schemaName: string;
  totalFailures: number;
  commonErrors: { error: string; count: number }[];
  failuresByStrategy: { strategy: string; count: number }[];
}
