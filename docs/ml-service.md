# NEXUS ML Service

## Overview
The ML Service (`apps/ml-service`) is an internal FastAPI Python microservice responsible for CPU-heavy data processing, analytics, and machine learning inference.

## Architecture
This service is intentionally stateless. It does NOT connect to PostgreSQL or Redis.
All application state is managed by the NEXUS Processor Worker (Node.js). The worker sends HTTP requests to the ML Service containing the necessary input data.

## API Contract
**Endpoint:** `POST /v1/process`
**Security:** Requires header `X-Internal-Service-Key` matching the environment variable `INTERNAL_SERVICE_KEY`.

**Input Payload (JSON):**
```json
{
  "job_id": "uuid",
  "type": "DATA_ANALYSIS",
  "payload": { "columns": [...], "rows": [...] }
}
```

**Output (Streaming NDJSON):**
The service returns an HTTP stream yielding progress lines, followed by a final result.
```json
{"type": "progress", "job_id": "uuid", "stage": "loading", "percent": 30, "log": "Loading..."}
{"type": "result", "data": {"job_id": "uuid", "status": "COMPLETED", "result": {...}, "metrics": {...}}}
```

## Processors Implemented
1. **DATA_ANALYSIS**: Uses Pandas to calculate data statistics.
2. **CUSTOMER_SEGMENTATION**: Uses scikit-learn `KMeans` for deterministic clustering.
3. **CREDIT_RISK**: Applies a deterministic ruleset evaluating Debt-to-Income and Credit Scores.
