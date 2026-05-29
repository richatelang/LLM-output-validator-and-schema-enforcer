$BASE_URL = "http://localhost:3000"

Write-Host "========================================="
Write-Host "LLM Validator API - Full Test Suite"
Write-Host "========================================="

Write-Host "`n1. Health Check"
Invoke-RestMethod -Uri "$BASE_URL/health" | ConvertTo-Json

Write-Host "`n2. List Schemas"
Invoke-RestMethod -Uri "$BASE_URL/schemas" | ConvertTo-Json -Depth 5

Write-Host "`n3. Register a custom schema"
Invoke-RestMethod -Uri "$BASE_URL/schemas" -Method POST -ContentType "application/json" `
  -Body '{"name": "my_sentiment", "type": "sentiment"}' | ConvertTo-Json

Write-Host "`n4. Test: Valid call with sentiment schema (json_instruction)"
Invoke-RestMethod -Uri "$BASE_URL/call" -Method POST -ContentType "application/json" `
  -Body '{"schemaName": "sentiment", "prompt": "Analyze the sentiment of: I absolutely love this product! It works perfectly.", "strategy": "json_instruction"}' | ConvertTo-Json -Depth 10

Write-Host "`n5. Test: Call with few_shot strategy"
Invoke-RestMethod -Uri "$BASE_URL/call" -Method POST -ContentType "application/json" `
  -Body '{"schemaName": "product_review", "prompt": "Write a review for a mechanical keyboard that is excellent for typing but slightly expensive.", "strategy": "few_shot"}' | ConvertTo-Json -Depth 10

Write-Host "`n6. Test: Task extraction with variables"
$body = @{
  schemaName = "task_extraction"
  prompt = "Extract tasks from: {{meeting_notes}}"
  variables = @{ meeting_notes = "John needs to finish the report by Friday. Sarah will review the design on Monday. Team lunch is optional next week. DevOps must deploy to production urgently." }
  strategy = "function_calling"
} | ConvertTo-Json
Invoke-RestMethod -Uri "$BASE_URL/call" -Method POST -ContentType "application/json" -Body $body | ConvertTo-Json -Depth 10

Write-Host "`n7. View Failures"
Invoke-RestMethod -Uri "$BASE_URL/failures" | ConvertTo-Json -Depth 5

Write-Host "`n8. View Metrics"
Invoke-RestMethod -Uri "$BASE_URL/metrics" | ConvertTo-Json -Depth 5

Write-Host "`n========================================="
Write-Host "Test Suite Complete"
Write-Host "========================================="
