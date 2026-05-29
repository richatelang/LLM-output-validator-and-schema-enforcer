import Fastify from 'fastify';
import cors from '@fastify/cors';
import dotenv from 'dotenv';
dotenv.config();
import { initDB } from './db/database';
import { registerBuiltinSchemas } from './services/schemaRegistry';
import { schemaRoutes } from './routes/schemas';
import { callRoutes } from './routes/call';
import { failureRoutes } from './routes/failures';
import { metricsRoutes } from './routes/metrics';
const app = Fastify({ logger: true });
async function bootstrap() {
  // Init DB
  initDB();

  // Register built-in schemas
  registerBuiltinSchemas();

  // CORS
  await app.register(cors, { origin: true });

  // Health check
  app.get('/health', async () => ({ status: 'ok', timestamp: new Date().toISOString() }));

  // Routes
  await app.register(schemaRoutes);
  await app.register(callRoutes);
  await app.register(failureRoutes);
  await app.register(metricsRoutes);

  const port = Number(process.env.PORT) || 3000;
  await app.listen({ port, host: '0.0.0.0' });
  console.log(`[Server] Running on http://localhost:${port}`);
  console.log('[Server] Endpoints:');
  console.log('  GET  /health');
  console.log('  GET  /schemas');
  console.log('  POST /schemas');
  console.log('  GET  /schemas/:name');
  console.log('  DELETE /schemas/:name');
  console.log('  POST /call');
  console.log('  GET  /failures');
  console.log('  GET  /metrics');
}
bootstrap().catch(err => {
  console.error('[Server] Fatal error:', err);
  process.exit(1);
});
