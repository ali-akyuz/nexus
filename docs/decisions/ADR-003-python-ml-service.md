# ADR-003 — Separate Python ML Service

**Status:** Accepted  
**Date:** 2026-08-17  
**Deciders:** Architecture team

---

## Context

NEXUS must execute machine learning and data processing tasks. These tasks use Python ecosystem libraries (Pandas, Scikit-learn, NumPy) that:

- Have large installation footprints
- May require GPU support (CUDA)
- Can consume unbounded CPU and memory
- May crash or hang during computation
- Have their own runtime requirements (Python 3.12, specific library versions)
- Benefit from independent scaling (more ML compute nodes, not more API nodes)

The question is: should ML execution happen inside the NestJS API/worker process, or in a separate Python service?

---

## Decision

Run ML and data-processing tasks in a **dedicated Python FastAPI service** (`apps/ml-service`), called over HTTP by workers.

---

## Alternatives Considered

### Execute Python inside Node.js workers (child_process / worker_threads)

- **Pro:** No additional network hop. Simpler deployment (one less service).
- **Con:** `child_process.spawn('python', ...)` is fragile. Passing data between processes requires serialization (files or pipes). Python crashes can affect the Node.js worker process. Cannot leverage Python's async ecosystem. Terrible developer experience for the Python code (no IDE support, no testing).
- **Decision:** Rejected. Running Python as a subprocess from Node.js is an anti-pattern for production systems.

### JavaScript ML libraries (TensorFlow.js, ONNX Runtime for Node)

- **Pro:** Stays in the Node.js ecosystem. No separate service.
- **Con:** JavaScript ML ecosystem is immature compared to Python. TensorFlow.js has limited model support. Most ML engineers and data scientists work in Python. Scikit-learn has no JS equivalent. This would artificially constrain the ML capabilities of the platform.
- **Decision:** Rejected. The Python ML ecosystem is the industry standard and must be embraced.

### Run Python tasks directly in workers (using Python workers instead of Node.js)

- **Pro:** All computation in one place (Python worker).
- **Con:** Loses the NestJS/TypeScript ecosystem for worker orchestration, job lifecycle management, and BullMQ integration. Python's BullMQ support is less mature. The queue, retry, and worker lifecycle logic benefits from NestJS structure.
- **Decision:** Rejected. The division is: NestJS manages job lifecycle + orchestration; Python executes ML compute.

### gRPC instead of HTTP

- **Pro:** Strongly typed service contract, binary protocol (faster), bidirectional streaming.
- **Con:** More complex setup (protobuf definitions, code generation). HTTP/REST is sufficient for this call pattern (single request, structured JSON response). gRPC adds operational complexity without significant benefit at this scale.
- **Decision:** Deferred. HTTP for Phase 1, gRPC is a future optimization if latency becomes a bottleneck.

---

## Consequences

**Positive:**

- Full Python ecosystem available: Pandas, NumPy, Scikit-learn, HuggingFace, PyTorch, etc.
- ML service can be scaled independently (more ML pods, not more API pods).
- ML crashes do not affect the API or worker process.
- Clear API contract (HTTP + JSON/Pydantic) between services.
- ML engineers can own and develop `apps/ml-service` independently.
- Can be swapped for a GPU-enabled service without touching the API or workers.
- FastAPI provides auto-generated OpenAPI docs for the ML service API.

**Negative:**

- Additional service to operate, deploy, and monitor.
- Network latency between worker and ML service (local: <1ms; cross-region: significant).
- Must handle ML service unavailability in worker retry logic.
- Worker must pass job data to ML service (file URL or inline payload) — large datasets require shared storage or streaming.

---

## Notes

- Communication is authenticated with an internal API key (`X-Internal-API-Key`). The ML service is never publicly exposed.
- For large file processing, workers pass a file URL (e.g., S3 presigned URL or local path mount) rather than inline data.
- FastAPI is chosen over Flask because: async support, Pydantic validation, auto OpenAPI docs, performance.
