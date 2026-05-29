import { FastifyInstance } from 'fastify';
import { db } from '../db/database';
export async function failureRoutes(app: FastifyInstance) {
  // GET /failures — failure analysis
  app.get('/failures', async (req: any, reply) => {
    const { schemaName, limit = 50 } = req.query;

    let failures: any[];
    if (schemaName) {
      failures = db.prepare(`
        SELECT * FROM failures WHERE schema_name = ? ORDER BY created_at DESC LIMIT ?
      `).all(schemaName, Number(limit));
    } else {
      failures = db.prepare(`
        SELECT * FROM failures ORDER BY created_at DESC LIMIT ?
      `).all(Number(limit));
    }

    // Aggregate analysis
    const analysis = db.prepare(`
      SELECT
        schema_name,
        COUNT(*) as total_failures,
        strategy,
        COUNT(strategy) as strategy_count
      FROM failures
      GROUP BY schema_name, strategy
      ORDER BY total_failures DESC
    `).all();

    // Error pattern analysis
    const errorPatterns = failures.reduce((acc: Record<string, number>, f: any) => {
      const err = f.final_error?.substring(0, 100) || 'unknown';
      acc[err] = (acc[err] || 0) + 1;
      return acc;
    }, {});

    const topErrors = Object.entries(errorPatterns)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([error, count]) => ({ error, count }));

    return reply.send({
      total: failures.length,
      failures: failures.map(f => ({
        ...f,
        attempts: JSON.parse(f.attempts)
      })),
      analysis,
      topErrors
    });
  });
}
