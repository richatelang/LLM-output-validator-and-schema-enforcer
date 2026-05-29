import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { registerSchema, listSchemas, deleteSchema, getSchemaJson } from '../services/schemaRegistry';
// Registry of Zod schema builders for API registration
const SCHEMA_BUILDERS: Record<string, () => z.ZodTypeAny> = {
  sentiment: () => z.object({
    sentiment: z.enum(['positive', 'negative', 'neutral']),
    confidence: z.number().min(0).max(1),
    reasoning: z.string().min(1).max(500)
  }),
  product_review: () => z.object({
    rating: z.number().int().min(1).max(5),
    pros: z.array(z.string()).min(1).max(5),
    cons: z.array(z.string()).max(5),
    summary: z.string().min(10).max(300),
    recommended: z.boolean()
  }),
  user_profile: () => z.object({
    name: z.string().min(1),
    age: z.number().int().min(0).max(150).optional(),
    email: z.string().email().optional(),
    interests: z.array(z.string()).optional(),
    bio: z.string().max(500).optional()
  }),
  task_extraction: () => z.object({
    tasks: z.array(z.object({
      title: z.string().min(1),
      priority: z.enum(['low', 'medium', 'high']),
      deadline: z.string().optional(),
      assignee: z.string().optional()
    })).min(1)
  })
};
export async function schemaRoutes(app: FastifyInstance) {
  // GET /schemas — list all registered schemas
  app.get('/schemas', async (req, reply) => {
    const schemas = listSchemas();
    return reply.send({ schemas, count: schemas.length });
  });
  // GET /schemas/:name — get a specific schema
  app.get('/schemas/:name', async (req: any, reply) => {
    const { name } = req.params;
    const jsonSchema = getSchemaJson(name);
    if (!jsonSchema) {
      return reply.status(404).send({ error: `Schema '${name}' not found` });
    }
    return reply.send({ name, schema: jsonSchema });
  });
  // POST /schemas — register a named schema
  app.post('/schemas', async (req: any, reply) => {
    const { name, type } = req.body;

    if (!name || !type) {
      return reply.status(400).send({ error: 'name and type are required' });
    }

    const builder = SCHEMA_BUILDERS[type];
    if (!builder) {
      return reply.status(400).send({
        error: `Unknown schema type '${type}'. Available: ${Object.keys(SCHEMA_BUILDERS).join(', ')}`
      });
    }

    registerSchema(name, builder());
    return reply.status(201).send({ message: `Schema '${name}' registered successfully`, name });
  });
  // DELETE /schemas/:name
  app.delete('/schemas/:name', async (req: any, reply) => {
    const { name } = req.params;
    const deleted = deleteSchema(name);
    if (!deleted) {
      return reply.status(404).send({ error: `Schema '${name}' not found` });
    }
    return reply.send({ message: `Schema '${name}' deleted` });
  });
}
