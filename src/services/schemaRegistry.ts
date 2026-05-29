import { z } from 'zod';
import { db } from '../db/database';
import zodToJsonSchema from 'zod-to-json-schema';
// In-memory cache of compiled Zod schemas
const schemaCache = new Map<string, z.ZodTypeAny>();
export function registerSchema(name: string, zodSchema: z.ZodTypeAny): void {
  const jsonSchema = zodToJsonSchema(zodSchema, { name, $refStrategy: 'none' });
  const zodSource = JSON.stringify(jsonSchema);

  const stmt = db.prepare(`
    INSERT OR REPLACE INTO schemas (name, json_schema, zod_source, created_at)
    VALUES (?, ?, ?, CURRENT_TIMESTAMP)
  `);
  stmt.run(name, JSON.stringify(jsonSchema), zodSource);
  schemaCache.set(name, zodSchema);
}
export function getSchema(name: string): z.ZodTypeAny | null {
  if (schemaCache.has(name)) return schemaCache.get(name)!;

  const row = db.prepare('SELECT json_schema FROM schemas WHERE name = ?').get(name) as any;
  if (!row) return null;

  // Return null — schema must be re-registered in memory after server restart
  // This is by design: Zod schemas are code, not serializable. The DB stores metadata.
  return null;
}
export function getSchemaJson(name: string): object | null {
  const row = db.prepare('SELECT json_schema FROM schemas WHERE name = ?').get(name) as any;
  if (!row) return null;
  return JSON.parse(row.json_schema);
}
export function listSchemas(): { name: string; createdAt: string }[] {
  return db.prepare('SELECT name, created_at as createdAt FROM schemas ORDER BY created_at DESC').all() as any[];
}
export function deleteSchema(name: string): boolean {
  const result = db.prepare('DELETE FROM schemas WHERE name = ?').run(name);
  schemaCache.delete(name);
  return result.changes > 0;
}
// Pre-built common schemas for demo purposes
export function registerBuiltinSchemas() {
  registerSchema('sentiment', z.object({
    sentiment: z.enum(['positive', 'negative', 'neutral']),
    confidence: z.number().min(0).max(1),
    reasoning: z.string().min(1).max(500)
  }));
  registerSchema('product_review', z.object({
    rating: z.number().int().min(1).max(5),
    pros: z.array(z.string()).min(1).max(5),
    cons: z.array(z.string()).max(5),
    summary: z.string().min(10).max(300),
    recommended: z.boolean()
  }));
  registerSchema('user_profile', z.object({
    name: z.string().min(1),
    age: z.number().int().min(0).max(150).optional(),
    email: z.string().email().optional(),
    interests: z.array(z.string()).optional(),
    bio: z.string().max(500).optional()
  }));
  registerSchema('task_extraction', z.object({
    tasks: z.array(z.object({
      title: z.string().min(1),
      priority: z.enum(['low', 'medium', 'high']),
      deadline: z.string().optional(),
      assignee: z.string().optional()
    })).min(1)
  }));

  registerSchema('movie_review', z.object({
    title: z.string(),
    rating: z.number().int().min(1).max(10),
    genre: z.array(z.string()),
    summary: z.string(),
    recommended: z.boolean()
  }));
  
  console.log('[SchemaRegistry] Built-in schemas registered');
}
