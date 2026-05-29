import { z } from 'zod';
import { db } from '../db/database';
import { callLLM } from './llmClient';
import { buildSystemPrompt, buildCorrectionPrompt } from './injectionStrategies';
import { tryParseJSON } from './responseParser';
import {
  CallRequest,
  CallResponse,
  AttemptResult,
  InjectionStrategy
} from '../types';
import { getSchema } from './schemaRegistry';
const MAX_ATTEMPTS = 3;
const RETRY_DELAY_MS = 4000;

function sleep(ms: number) { return new Promise(r => setTimeout(r, ms)); }

function isQuotaError(msg: string) {
  return msg.includes('429') || msg.toLowerCase().includes('quota') || msg.toLowerCase().includes('too many requests');
}

export async function validateCall(request: CallRequest): Promise<CallResponse> {
  const { schemaName, prompt, model = 'gemini-2.5-flash', variables = {}, strategy = 'json_instruction' } = request;

  const zodSchema = getSchema(schemaName);
  if (!zodSchema) {
    throw new Error(`Schema '${schemaName}' not found. Please register it first via POST /schemas`);
  }

  // Interpolate variables into prompt
  let resolvedPrompt = prompt;
  for (const [k, v] of Object.entries(variables)) {
    resolvedPrompt = resolvedPrompt.replace(new RegExp(`\\{\\{${k}\\}\\}`, 'g'), v);
  }

  const attempts: AttemptResult[] = [];
  let lastError = '';
  let totalTokens = 0;
  let totalLatency = 0;
  const overallStart = Date.now();

  for (let attemptNum = 1; attemptNum <= MAX_ATTEMPTS; attemptNum++) {
    const attemptStart = Date.now();

    let systemPrompt: string;
    let userMessage: string;

    if (attemptNum === 1) {
      systemPrompt = buildSystemPrompt(
        'You are a structured data extraction assistant.',
        zodSchema,
        schemaName,
        strategy
      );
      userMessage = resolvedPrompt;
    } else {
      // Correction attempt — wait before retrying to respect rate limits
      await sleep(RETRY_DELAY_MS);
      systemPrompt = 'You are a structured data extraction assistant that corrects malformed JSON responses.';
      userMessage = buildCorrectionPrompt(
        resolvedPrompt,
        attempts[attemptNum - 2].rawResponse,
        lastError,
        zodSchema,
        schemaName,
        strategy
      );
    }

    let rawResponse = '';
    let tokensUsed = 0;
    let latencyMs = 0;

    try {
      const result = await callLLM(systemPrompt, userMessage, model);
      rawResponse = result.rawContent;
      tokensUsed = result.tokensUsed;
      latencyMs = result.latencyMs;
    } catch (e: any) {
      const errMsg = `LLM call failed: ${e.message}`;
      const attempt: AttemptResult = {
        attempt: attemptNum,
        rawResponse: '',
        error: errMsg,
        tokensUsed: 0,
        latencyMs: Date.now() - attemptStart
      };
      attempts.push(attempt);
      lastError = errMsg;
      totalLatency += attempt.latencyMs;
      // Don't retry quota/rate-limit errors — they won't recover in milliseconds
      if (isQuotaError(e.message)) break;
      continue;
    }

    totalTokens += tokensUsed;
    totalLatency += latencyMs;

    // Parse JSON
    const parseResult = tryParseJSON(rawResponse);
    if (!parseResult.success) {
      const attempt: AttemptResult = {
        attempt: attemptNum,
        rawResponse,
        error: parseResult.error,
        tokensUsed,
        latencyMs
      };
      attempts.push(attempt);
      lastError = parseResult.error;
      continue;
    }

    // Validate against Zod schema
    const zodResult = zodSchema.safeParse(parseResult.data);

    if (zodResult.success) {
      const attempt: AttemptResult = {
        attempt: attemptNum,
        rawResponse,
        parsedResponse: zodResult.data,
        tokensUsed,
        latencyMs
      };
      attempts.push(attempt);

      const response: CallResponse = {
        success: true,
        data: zodResult.data,
        attempts,
        totalAttempts: attemptNum,
        correctionNeeded: attemptNum > 1,
        totalLatencyMs: Date.now() - overallStart,
        totalTokensUsed: totalTokens,
        strategy
      };

      // Log success
      logCall(request, response, zodResult.data);
      trackStrategyStats(schemaName, strategy, true, attemptNum);

      return response;
    }

    // Partial recovery: check optional fields
    const partialResult = attemptPartialRecovery(zodSchema, parseResult.data);
    if (partialResult.recovered && attemptNum === MAX_ATTEMPTS) {
      const warnings = [`Partial recovery: removed failing optional fields: ${partialResult.removedFields.join(', ')}`];
      const attempt: AttemptResult = {
        attempt: attemptNum,
        rawResponse,
        parsedResponse: partialResult.data,
        error: `Partial recovery applied. Removed: ${partialResult.removedFields.join(', ')}`,
        tokensUsed,
        latencyMs
      };
      attempts.push(attempt);

      const response: CallResponse = {
        success: true,
        data: partialResult.data,
        attempts,
        totalAttempts: attemptNum,
        correctionNeeded: true,
        totalLatencyMs: Date.now() - overallStart,
        totalTokensUsed: totalTokens,
        strategy,
        warnings
      };

      logCall(request, response, partialResult.data);
      return response;
    }

    const zodErrors = zodResult.error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join('; ');
    lastError = `Zod validation failed: ${zodErrors}`;

    const attempt: AttemptResult = {
      attempt: attemptNum,
      rawResponse,
      parsedResponse: parseResult.data,
      error: lastError,
      tokensUsed,
      latencyMs
    };
    attempts.push(attempt);
  }

  // All attempts failed
  const response: CallResponse = {
    success: false,
    attempts,
    totalAttempts: MAX_ATTEMPTS,
    correctionNeeded: true,
    totalLatencyMs: Date.now() - overallStart,
    totalTokensUsed: totalTokens,
    strategy
  };

  logFailure(request, attempts, lastError);
  trackStrategyStats(schemaName, strategy, false, MAX_ATTEMPTS);

  return response;
}
function attemptPartialRecovery(schema: z.ZodTypeAny, data: unknown): {
  recovered: boolean;
  data?: unknown;
  removedFields: string[];
} {
  if (!(schema instanceof z.ZodObject) || typeof data !== 'object' || data === null) {
    return { recovered: false, removedFields: [] };
  }

  const shape = schema.shape;
  const cleaned = { ...(data as Record<string, unknown>) };
  const removedFields: string[] = [];

  for (const [key, fieldSchema] of Object.entries(shape)) {
    const isOptional = fieldSchema instanceof z.ZodOptional;
    if (isOptional && key in cleaned) {
      const fieldResult = (fieldSchema as z.ZodTypeAny).safeParse(cleaned[key]);
      if (!fieldResult.success) {
        delete cleaned[key];
        removedFields.push(key);
      }
    }
  }

  if (removedFields.length === 0) return { recovered: false, removedFields: [] };

  const finalResult = schema.safeParse(cleaned);
  if (finalResult.success) {
    return { recovered: true, data: finalResult.data, removedFields };
  }

  return { recovered: false, removedFields: [] };
}
function logCall(request: CallRequest, response: CallResponse, result: unknown) {
  db.prepare(`
    INSERT INTO call_logs (schema_name, prompt, model, strategy, success, total_attempts, total_tokens, total_latency_ms, correction_needed, result)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    request.schemaName,
    request.prompt,
    request.model || 'gemini-2.5-flash',
    request.strategy || 'json_instruction',
    1,
    response.totalAttempts,
    response.totalTokensUsed,
    response.totalLatencyMs,
    response.correctionNeeded ? 1 : 0,
    JSON.stringify(result)
  );
}
function logFailure(request: CallRequest, attempts: AttemptResult[], finalError: string) {
  db.prepare(`
    INSERT INTO failures (schema_name, prompt, model, strategy, attempts, final_error)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(
    request.schemaName,
    request.prompt,
    request.model || 'gemini-2.5-flash',
    request.strategy || 'json_instruction',
    JSON.stringify(attempts),
    finalError
  );
}
function trackStrategyStats(schemaName: string, strategy: string, success: boolean, attemptNumber: number) {
  db.prepare(`
    INSERT INTO strategy_stats (schema_name, strategy, success, attempt_number)
    VALUES (?, ?, ?, ?)
  `).run(schemaName, strategy, success ? 1 : 0, attemptNumber);
}
