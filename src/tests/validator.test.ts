import { describe, it, expect, beforeAll, vi } from 'vitest';
import { z } from 'zod';
import { tryParseJSON, extractJSON } from '../services/responseParser';
import { buildSystemPrompt, buildCorrectionPrompt } from '../services/injectionStrategies';
import { registerSchema, getSchema } from '../services/schemaRegistry';
// Mock DB
vi.mock('../db/database', () => ({
  db: {
    prepare: () => ({
      run: vi.fn(),
      get: vi.fn(() => null),
      all: vi.fn(() => [])
    })
  },
  initDB: vi.fn()
}));
describe('ResponseParser', () => {
  it('extracts JSON from markdown code block', () => {
    const raw = '```json\n{"key": "value"}\n```';
    const result = tryParseJSON(raw);
    expect(result.success).toBe(true);
    if (result.success) expect(result.data).toEqual({ key: 'value' });
  });

  it('extracts JSON with surrounding text', () => {
    const raw = 'Here is the response: {"key": "value"} Hope this helps!';
    const result = tryParseJSON(raw);
    expect(result.success).toBe(true);
  });

  it('handles plain JSON', () => {
    const raw = '{"sentiment": "positive", "confidence": 0.9, "reasoning": "test"}';
    const result = tryParseJSON(raw);
    expect(result.success).toBe(true);
  });

  it('returns error for invalid JSON', () => {
    const raw = 'This is not JSON at all';
    const result = tryParseJSON(raw);
    expect(result.success).toBe(false);
  });

  it('extracts nested JSON objects', () => {
    const raw = 'Response: {"tasks": [{"title": "task1", "priority": "high"}]}';
    const result = tryParseJSON(raw);
    expect(result.success).toBe(true);
  });
});
describe('InjectionStrategies', () => {
  const schema = z.object({
    sentiment: z.enum(['positive', 'negative', 'neutral']),
    confidence: z.number().min(0).max(1)
  });
  it('builds json_instruction system prompt', () => {
    const prompt = buildSystemPrompt('Base', schema, 'test', 'json_instruction');
    expect(prompt).toContain('valid JSON');
    expect(prompt).toContain('schema');
  });

  it('builds few_shot system prompt with example', () => {
    const prompt = buildSystemPrompt('Base', schema, 'test', 'few_shot');
    expect(prompt).toContain('EXAMPLE OUTPUT');
  });

  it('builds function_calling system prompt', () => {
    const prompt = buildSystemPrompt('Base', schema, 'test', 'function_calling');
    expect(prompt).toContain('JSON object');
  });

  it('builds correction prompt with error', () => {
    const correctionPrompt = buildCorrectionPrompt(
      'original prompt',
      '{"bad": "response"}',
      'confidence: Required',
      schema,
      'test',
      'json_instruction'
    );
    expect(correctionPrompt).toContain('failed validation');
    expect(correctionPrompt).toContain('confidence: Required');
  });
});
describe('SchemaRegistry', () => {
  it('registers and retrieves schema', () => {
    const schema = z.object({ name: z.string() });
    registerSchema('test_schema', schema);
    const retrieved = getSchema('test_schema');
    expect(retrieved).not.toBeNull();
  });

  it('validates data with retrieved schema', () => {
    const schema = z.object({ count: z.number().int() });
    registerSchema('count_schema', schema);
    const retrieved = getSchema('count_schema');
    expect(retrieved).not.toBeNull();
    if (retrieved) {
      expect(retrieved.safeParse({ count: 5 }).success).toBe(true);
      expect(retrieved.safeParse({ count: 'not a number' }).success).toBe(false);
    }
  });
});
describe('ZodValidation', () => {
  it('validates sentiment schema correctly', () => {
    const schema = z.object({
      sentiment: z.enum(['positive', 'negative', 'neutral']),
      confidence: z.number().min(0).max(1),
      reasoning: z.string()
    });

    const valid = { sentiment: 'positive', confidence: 0.95, reasoning: 'test' };
    expect(schema.safeParse(valid).success).toBe(true);

    const invalid = { sentiment: 'happy', confidence: 0.95, reasoning: 'test' };
    expect(schema.safeParse(invalid).success).toBe(false);
  });

  it('handles optional fields correctly', () => {
    const schema = z.object({
      name: z.string(),
      email: z.string().email().optional()
    });

    expect(schema.safeParse({ name: 'Alice' }).success).toBe(true);
    expect(schema.safeParse({ name: 'Alice', email: 'alice@example.com' }).success).toBe(true);
    expect(schema.safeParse({ name: 'Alice', email: 'not-an-email' }).success).toBe(false);
  });
});
