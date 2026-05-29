import { FastifyInstance } from 'fastify';
import { db } from '../db/database';
export async function metricsRoutes(app: FastifyInstance) {
  app.get('/metrics', async (req, reply) => {
    // Overall success rate
    const overall = db.prepare(`
      SELECT
        COUNT(*) as total_calls,
        SUM(success) as successful_calls,
        AVG(total_latency_ms) as avg_latency_ms,
        AVG(total_tokens) as avg_tokens,
        SUM(correction_needed) as calls_needing_correction
      FROM call_logs
    `).get() as any;

    // Strategy performance
    const strategyStats = db.prepare(`
      SELECT
        strategy,
        COUNT(*) as total,
        SUM(success) as successes,
        AVG(attempt_number) as avg_attempts_when_success,
        CAST(SUM(success) AS FLOAT) / COUNT(*) as pass_rate
      FROM strategy_stats
      GROUP BY strategy
      ORDER BY pass_rate DESC
    `).all();

    // Schema performance
    const schemaStats = db.prepare(`
      SELECT
        schema_name,
        COUNT(*) as total_calls,
        SUM(success) as successful,
        AVG(total_latency_ms) as avg_latency,
        CAST(SUM(success) AS FLOAT) / COUNT(*) as success_rate
      FROM call_logs
      GROUP BY schema_name
      ORDER BY success_rate ASC
    `).all();

    // First-attempt pass rate by strategy
    const firstAttemptRate = db.prepare(`
      SELECT
        strategy,
        COUNT(*) as total,
        SUM(CASE WHEN attempt_number = 1 AND success = 1 THEN 1 ELSE 0 END) as first_attempt_success,
        CAST(SUM(CASE WHEN attempt_number = 1 AND success = 1 THEN 1 ELSE 0 END) AS FLOAT) / COUNT(*) as first_attempt_rate
      FROM strategy_stats
      GROUP BY strategy
      ORDER BY first_attempt_rate DESC
    `).all();

    const successRate = overall.total_calls > 0
      ? (overall.successful_calls / overall.total_calls * 100).toFixed(1)
      : '0';

    return reply.send({
      summary: {
        totalCalls: overall.total_calls || 0,
        successRate: `${successRate}%`,
        avgLatencyMs: Math.round(overall.avg_latency_ms || 0),
        avgTokensPerCall: Math.round(overall.avg_tokens || 0),
        callsNeedingCorrection: overall.calls_needing_correction || 0
      },
      strategyComparison: strategyStats,
      firstAttemptPassRate: firstAttemptRate,
      schemaPerformance: schemaStats
    });
  });
}
