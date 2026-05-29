# LLM Output Validator & Schema Enforcer

A production-grade middleware layer that guarantees LLM responses match your expected Zod schema — or automatically corrects them with up to 3 self-healing retry attempts.

Watch the full demo here: https://www.loom.com/share/6bf4136fe6f14564ac6bdd9b8af5400a

## Quick Start

```bash
# 1. Clone / enter project
cd "LLM Output Validator"

# 2. Install dependencies
npm install

# 3. Add your Gemini API key
#    Get a free key at https://aistudio.google.com
echo GEMINI_API_KEY=your_key_here >> .env

# 4. Start the server
npm start
# → Running on http://localhost:3000
```

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | /health | Liveness check |
| GET | /schemas | List all registered schemas |
| POST | /schemas | Register a schema by name + type |
| GET | /schemas/:name | Get a schema's JSON definition |
| DELETE | /schemas/:name | Remove a schema |
| POST | /call | Make a validated LLM call |
| GET | /failures | Failure log with error pattern analysis |
| GET | /metrics | Strategy comparison & success rates |

## POST /call — Request Body

```json
{
  "schemaName": "sentiment",
  "prompt": "Analyze: I love this product!",
  "model": "gemini-2.5-flash",
  "strategy": "json_instruction",
  "variables": {}
}
```

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `schemaName` | string | required | Name of a registered schema |
| `prompt` | string | required | User prompt — supports `{{variable}}` interpolation |
| `model` | string | `gemini-2.5-flash` | Any Gemini model name |
| `strategy` | string | `json_instruction` | Prompt injection strategy (see below) |
| `variables` | object | `{}` | Key-value pairs substituted into `{{placeholders}}` |

## Injection Strategies

| Strategy | Description |
|----------|-------------|
| `json_instruction` | Appends the full JSON schema + strict rules to the system prompt |
| `few_shot` | Includes a synthetic example of valid output before the schema |
| `function_calling` | Frames the task as a structured data extractor with explicit rules |

## Built-in Schemas

| Name | Fields |
|------|--------|
| `sentiment` | `sentiment` (enum), `confidence` (0–1), `reasoning` |
| `product_review` | `rating` (1–5), `pros`, `cons`, `summary`, `recommended` |
| `user_profile` | `name`, `age?`, `email?`, `interests?`, `bio?` |
| `task_extraction` | `tasks[]` with `title`, `priority`, `deadline?`, `assignee?` |

Register additional schemas via `POST /schemas` using any of the built-in types as a named alias:

```json
POST /schemas
{ "name": "my_sentiment", "type": "sentiment" }
```

## Variable Interpolation

Embed `{{placeholder}}` tokens in your prompt and supply values in the `variables` field:

```json
{
  "schemaName": "task_extraction",
  "prompt": "Extract tasks from these meeting notes: {{notes}}",
  "variables": { "notes": "Alice: finish report by Friday. Bob: urgent deploy needed." }
}
```

## Retry & Correction Logic

On validation failure the system automatically retries with a correction prompt:

```
Your previous response failed validation with this error: [error].
The expected schema is: [schema].
Please try again and return ONLY valid JSON.
```

- Up to **3 attempts** per call
- **4-second delay** between correction attempts (respects rate limits)
- **Quota errors (429)** abort immediately — no wasted retries
- **Partial recovery** on last attempt: removes failing optional fields and re-validates

## Response Shape

```json
{
  "success": true,
  "data": { ... },
  "attempts": [{ "attempt": 1, "rawResponse": "...", "tokensUsed": 333, "latencyMs": 2584 }],
  "totalAttempts": 1,
  "correctionNeeded": false,
  "totalLatencyMs": 2600,
  "totalTokensUsed": 333,
  "strategy": "json_instruction",
  "warnings": []
}
```

## GET /metrics — Strategy Comparison

Returns aggregated stats across all calls:

```json
{
  "summary": {
    "totalCalls": 42,
    "successRate": "97.6%",
    "avgLatencyMs": 2400,
    "avgTokensPerCall": 410,
    "callsNeedingCorrection": 3
  },
  "strategyComparison": [...],
  "firstAttemptPassRate": [...],
  "schemaPerformance": [...]
}
```

## Development

```bash
npm run dev        # tsx watch — hot reload
npm test           # vitest run (13 unit tests)
npm run test:watch # vitest interactive watch mode
npm run build      # tsc → dist/
```

## Architecture

```
src/
├── index.ts                  # Fastify bootstrap
├── types/index.ts            # Shared interfaces
├── db/database.ts            # SQLite init (4 tables)
├── routes/
│   ├── schemas.ts            # Schema CRUD
│   ├── call.ts               # /call endpoint
│   ├── failures.ts           # Failure log + analysis
│   └── metrics.ts            # Strategy metrics
├── services/
│   ├── schemaRegistry.ts     # In-memory cache + DB persistence
│   ├── injectionStrategies.ts# 3 prompt strategies + correction prompt
│   ├── llmClient.ts          # Gemini API wrapper
│   ├── responseParser.ts     # JSON extraction from raw LLM output
│   └── validator.ts          # Core retry + correction loop
└── tests/
    └── validator.test.ts     # 13 unit tests (parser, strategies, registry, zod)
```

## SQLite Schema

| Table | Purpose |
|-------|---------|
| `schemas` | Registered schema names + JSON definitions |
| `call_logs` | Every successful call with tokens, latency, correction flag |
| `failures` | All failed calls with per-attempt details |
| `strategy_stats` | Per-strategy attempt tracking for pass-rate analysis |

## Features

- Zod schema registry — persistent in SQLite, cached in memory
- 3 injection strategies with head-to-head metrics comparison
- Auto-retry with correction prompts (up to 3 attempts)
- Partial recovery — strips failing optional fields on last attempt
- Structured failure logging with error pattern analysis
- Variable interpolation in prompts via `{{key}}` syntax
- Quota-safe retry logic — 429 errors abort immediately
- Never silently returns unvalidated data
