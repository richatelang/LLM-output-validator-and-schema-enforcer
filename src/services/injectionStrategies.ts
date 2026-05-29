import { InjectionStrategy } from '../types';
import zodToJsonSchema from 'zod-to-json-schema';
import { z } from 'zod';
export function buildSystemPrompt(
  basePrompt: string,
  zodSchema: z.ZodTypeAny,
  schemaName: string,
  strategy: InjectionStrategy
): string {
  const jsonSchema = zodToJsonSchema(zodSchema, { name: schemaName, $refStrategy: 'none' });

  switch (strategy) {
    case 'json_instruction':
      return buildJsonInstruction(basePrompt, jsonSchema);
    case 'few_shot':
      return buildFewShot(basePrompt, zodSchema, jsonSchema, schemaName);
    case 'function_calling':
      return buildFunctionCallingPrompt(basePrompt, jsonSchema);
  }
}
function buildJsonInstruction(basePrompt: string, jsonSchema: object): string {
  return `${basePrompt}
CRITICAL INSTRUCTIONS:
- Respond ONLY with valid JSON. No markdown, no code blocks, no explanation text.
- Your entire response must be parseable by JSON.parse()
- The JSON must match this exact schema:
${JSON.stringify(jsonSchema, null, 2)}
- Do not include any text before or after the JSON object.`;
}
function buildFewShot(basePrompt: string, zodSchema: z.ZodTypeAny, jsonSchema: object, schemaName: string): string {
  const example = generateSchemaExample(zodSchema);

  return `${basePrompt}
You must respond with valid JSON only. Here is an example of the exact format expected:
EXAMPLE OUTPUT:
${JSON.stringify(example, null, 2)}
SCHEMA (for reference):
${JSON.stringify(jsonSchema, null, 2)}
Return ONLY a JSON object matching this format. No explanations, no markdown, no code blocks.`;
}
function buildFunctionCallingPrompt(basePrompt: string, jsonSchema: object): string {
  return `${basePrompt}
You are a structured data extractor. You MUST respond with a single JSON object only.
The JSON object must be complete, valid, and strictly follow this schema:
${JSON.stringify(jsonSchema, null, 2)}
Rules:
1. Output raw JSON only — no markdown fences, no prose
2. All required fields must be present
3. All values must match the specified types
4. Numbers must be actual numbers (not strings)
5. Arrays must be proper JSON arrays`;
}
function generateSchemaExample(schema: z.ZodTypeAny): unknown {
  // Generate synthetic examples for known schema shapes
  if (schema instanceof z.ZodObject) {
    const shape = schema.shape;
    const result: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(shape)) {
      result[key] = generateFieldExample(value as z.ZodTypeAny, key);
    }
    return result;
  }
  return {};
}
function generateFieldExample(schema: z.ZodTypeAny, key: string): unknown {
  if (schema instanceof z.ZodOptional) return generateFieldExample(schema.unwrap(), key);
  if (schema instanceof z.ZodString) {
    if (key.includes('email')) return 'user@example.com';
    if (key.includes('name')) return 'Example Name';
    if (key.includes('url')) return 'https://example.com';
    return 'example string';
  }
  if (schema instanceof z.ZodNumber) {
    const checks = (schema as any)._def.checks || [];
    const min = checks.find((c: any) => c.kind === 'min')?.value ?? 0;
    const max = checks.find((c: any) => c.kind === 'max')?.value ?? 100;
    return Math.round((min + max) / 2);
  }
  if (schema instanceof z.ZodBoolean) return true;
  if (schema instanceof z.ZodEnum) return schema.options[0];
  if (schema instanceof z.ZodArray) return [generateFieldExample(schema.element, key)];
  if (schema instanceof z.ZodObject) return generateSchemaExample(schema);
  return null;
}
export function buildCorrectionPrompt(
  originalPrompt: string,
  previousResponse: string,
  validationError: string,
  zodSchema: z.ZodTypeAny,
  schemaName: string,
  strategy: InjectionStrategy
): string {
  const jsonSchema = zodToJsonSchema(zodSchema, { name: schemaName, $refStrategy: 'none' });

  return `Your previous response failed validation with this error: ${validationError}
Your previous (invalid) response was:
${previousResponse}
The expected schema is:
${JSON.stringify(jsonSchema, null, 2)}
Please try again and return ONLY valid JSON that matches the schema exactly.
Do not include any explanation, markdown, or code blocks — just raw JSON.
Original task: ${originalPrompt}`;
}
