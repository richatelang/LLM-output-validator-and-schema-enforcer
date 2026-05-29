import { FastifyInstance } from 'fastify';
import { validateCall } from '../services/validator';
import { InjectionStrategy } from '../types';
export async function callRoutes(app: FastifyInstance) {
  app.post('/call', async (req: any, reply) => {
    const { schemaName, prompt, model, variables, strategy } = req.body;

    if (!schemaName || !prompt) {
      return reply.status(400).send({ error: 'schemaName and prompt are required' });
    }

    const validStrategies: InjectionStrategy[] = ['json_instruction', 'few_shot', 'function_calling'];
    const resolvedStrategy: InjectionStrategy = validStrategies.includes(strategy) ? strategy : 'json_instruction';

    try {
      const result = await validateCall({
        schemaName,
        prompt,
        model,
        variables,
        strategy: resolvedStrategy
      });

      const status = result.success ? 200 : 422;
      return reply.status(status).send(result);
    } catch (e: any) {
      return reply.status(400).send({ error: e.message });
    }
  });
}
