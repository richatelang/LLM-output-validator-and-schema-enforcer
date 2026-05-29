export function extractJSON(raw: string): string {
  // Remove markdown code blocks
  let cleaned = raw
    .replace(/```json\s*/gi, '')
    .replace(/```\s*/g, '')
    .trim();

  // Try to find JSON object or array boundaries
  const firstBrace = cleaned.indexOf('{');
  const firstBracket = cleaned.indexOf('[');

  let startIdx = -1;
  if (firstBrace !== -1 && firstBracket !== -1) {
    startIdx = Math.min(firstBrace, firstBracket);
  } else if (firstBrace !== -1) {
    startIdx = firstBrace;
  } else if (firstBracket !== -1) {
    startIdx = firstBracket;
  }

  if (startIdx > 0) {
    cleaned = cleaned.substring(startIdx);
  }

  // Find the closing brace/bracket
  const isObject = cleaned.startsWith('{');
  const openChar = isObject ? '{' : '[';
  const closeChar = isObject ? '}' : ']';

  let depth = 0;
  let endIdx = -1;
  let inString = false;
  let escape = false;

  for (let i = 0; i < cleaned.length; i++) {
    const ch = cleaned[i];
    if (escape) { escape = false; continue; }
    if (ch === '\\') { escape = true; continue; }
    if (ch === '"') { inString = !inString; continue; }
    if (inString) continue;
    if (ch === openChar) depth++;
    if (ch === closeChar) {
      depth--;
      if (depth === 0) { endIdx = i; break; }
    }
  }

  if (endIdx !== -1) {
    return cleaned.substring(0, endIdx + 1);
  }

  return cleaned;
}
export function tryParseJSON(raw: string): { success: true; data: unknown } | { success: false; error: string } {
  try {
    const extracted = extractJSON(raw);
    const parsed = JSON.parse(extracted);
    return { success: true, data: parsed };
  } catch (e: any) {
    return { success: false, error: `JSON parse error: ${e.message}` };
  }
}
