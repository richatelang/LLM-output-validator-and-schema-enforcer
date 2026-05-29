#!/bin/bash
# Full API test script — run after starting the server
BASE_URL="http://localhost:3000"

echo "========================================="
echo "LLM Validator API - Full Test Suite"
echo "========================================="
echo ""

echo "1. Health Check"
curl -s "$BASE_URL/health" | python3 -m json.tool 2>/dev/null || curl -s "$BASE_URL/health"
echo ""

echo "2. List Schemas"
curl -s "$BASE_URL/schemas" | python3 -m json.tool 2>/dev/null || curl -s "$BASE_URL/schemas"
echo ""

echo "3. Register a custom schema"
curl -s -X POST "$BASE_URL/schemas" \
  -H "Content-Type: application/json" \
  -d '{"name": "my_sentiment", "type": "sentiment"}' | python3 -m json.tool 2>/dev/null
echo ""

echo "4. Test: Valid call with sentiment schema (json_instruction)"
curl -s -X POST "$BASE_URL/call" \
  -H "Content-Type: application/json" \
  -d '{
    "schemaName": "sentiment",
    "prompt": "Analyze the sentiment of: I absolutely love this product! It works perfectly.",
    "strategy": "json_instruction"
  }' | python3 -m json.tool 2>/dev/null
echo ""

echo "5. Test: Call with few_shot strategy"
curl -s -X POST "$BASE_URL/call" \
  -H "Content-Type: application/json" \
  -d '{
    "schemaName": "product_review",
    "prompt": "Write a review for a mechanical keyboard that is excellent for typing but slightly expensive.",
    "strategy": "few_shot"
  }' | python3 -m json.tool 2>/dev/null
echo ""

echo "6. Test: Task extraction with variables"
curl -s -X POST "$BASE_URL/call" \
  -H "Content-Type: application/json" \
  -d '{
    "schemaName": "task_extraction",
    "prompt": "Extract tasks from: {{meeting_notes}}",
    "variables": {
      "meeting_notes": "John needs to finish the report by Friday. Sarah will review the design on Monday. Team lunch is optional next week. DevOps must deploy to production urgently."
    },
    "strategy": "function_calling"
  }' | python3 -m json.tool 2>/dev/null
echo ""

echo "7. View Failures"
curl -s "$BASE_URL/failures" | python3 -m json.tool 2>/dev/null || curl -s "$BASE_URL/failures"
echo ""

echo "8. View Metrics"
curl -s "$BASE_URL/metrics" | python3 -m json.tool 2>/dev/null || curl -s "$BASE_URL/metrics"
echo ""

echo "========================================="
echo "Test Suite Complete"
echo "========================================="
