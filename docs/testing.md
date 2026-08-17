# NEXUS — Testing Strategy

> **Document status:** Phase 0 — Design  
> **Last updated:** 2026-08-17

---

## 1. Testing Philosophy

Every meaningful behavior must be tested. Tests are organized in three levels (Test Pyramid):

```
        /\
       /E2E\          (few, slow, high confidence)
      /──────\
     /Integr. \       (some, medium speed)
    /────────────\
   /  Unit Tests  \   (many, fast, isolated)
  /────────────────\
```

- **Unit tests** verify isolated functions and services with mocked dependencies.
- **Integration tests** verify that components interact correctly (API + real DB, worker + real queue).
- **E2E tests** verify complete user flows through the full stack.

---

## 2. Testing Stack

| Layer              | Technology                                | Runner                  |
| ------------------ | ----------------------------------------- | ----------------------- |
| NestJS Unit        | Jest (or Vitest)                          | `pnpm test`             |
| NestJS Integration | Jest + `@nestjs/testing` + Testcontainers | `pnpm test:integration` |
| Worker Unit        | Jest                                      | `pnpm test`             |
| Frontend Unit      | Vitest + Testing Library                  | `pnpm test`             |
| Frontend E2E       | Playwright                                | `pnpm test:e2e`         |
| Python Unit        | Pytest                                    | `pytest`                |
| Python Integration | Pytest + TestClient                       | `pytest -m integration` |

---

## 3. Unit Tests

### 3.1 NestJS Services (API + Workers)

**Coverage targets:**

- All service methods (>90% line coverage)
- All edge cases and error branches
- No real database or Redis connections (all mocked)

**Structure:**

```
apps/api/src/
  auth/
    auth.service.spec.ts       ← Unit test for AuthService
    auth.controller.spec.ts    ← Unit test for AuthController
  jobs/
    jobs.service.spec.ts
    jobs.controller.spec.ts
  ...
```

**Example:**

```typescript
describe('AuthService', () => {
  let service: AuthService;
  let prisma: DeepMockProxy<PrismaClient>;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: PrismaService, useValue: mockDeep<PrismaClient>() },
        { provide: JwtService, useValue: { sign: jest.fn(), verify: jest.fn() } },
      ],
    }).compile();

    service = module.get(AuthService);
    prisma = module.get(PrismaService);
  });

  it('should throw UnauthorizedException for invalid credentials', async () => {
    prisma.user.findUnique.mockResolvedValue(null);
    await expect(service.login({ email: 'x@x.com', password: 'pw' })).rejects.toThrow(
      UnauthorizedException,
    );
  });
});
```

### 3.2 Python Unit Tests

```
apps/ml-service/
  tests/
    unit/
      test_data_processor.py
      test_model_registry.py
      test_validators.py
```

```python
def test_data_processor_handles_empty_csv(tmp_path):
    processor = DataProcessor()
    empty_csv = tmp_path / "empty.csv"
    empty_csv.write_text("col1,col2\n")

    with pytest.raises(ValidationError, match="Dataset is empty"):
        processor.process(str(empty_csv))
```

### 3.3 Frontend Unit Tests

```
apps/web/src/
  components/
    JobCard/
      JobCard.test.tsx
  hooks/
    useJobStatus.test.ts
  lib/
    formatters.test.ts
```

---

## 4. Integration Tests

### 4.1 API Integration Tests

Run against a real PostgreSQL database (Testcontainers spins up a Docker container during tests).

**What to test:**

- Auth flow (register → login → refresh → logout)
- Job creation with database persistence
- Job status transitions via database
- Prisma constraints and unique violations
- Queue enqueue (real Redis or mock BullMQ)

**Setup:**

```typescript
// Test module with real Prisma, real Redis (or mock)
const app = await Test.createTestingModule({
  imports: [AppModule],
})
  .overrideProvider(ConfigService)
  .useValue(testConfig)
  .compile();

// Use Testcontainers for real PostgreSQL
const postgres = await new PostgreSqlContainer().start();
```

**Teardown:** Each test truncates all tables (not drops — faster) and resets sequences.

### 4.2 Worker Integration Tests

- Real BullMQ queue (Redis via Testcontainers)
- Mock the ML Service HTTP calls
- Verify job state transitions in PostgreSQL
- Verify retry behavior on worker failure

### 4.3 Python Integration Tests

```python
# Test FastAPI endpoints with TestClient (no real HTTP)
from fastapi.testclient import TestClient

def test_data_process_endpoint_returns_result(client: TestClient):
    response = client.post(
        "/tasks/data-process",
        json={"file_url": "s3://...", "operations": ["normalize"]},
        headers={"X-Internal-API-Key": "test-key"},
    )
    assert response.status_code == 200
    assert "result" in response.json()
```

---

## 5. End-to-End Tests

### 5.1 Setup

E2E tests run against the full Docker Compose stack:

```yaml
# tests/e2e/docker-compose.test.yml
services:
  api: (full NestJS API)
  web: (Next.js)
  postgres: (real PostgreSQL)
  redis: (real Redis)
  worker: (real processor worker)
  ml: (real or mocked ML service)
```

Playwright controls the browser and makes HTTP assertions.

### 5.2 Core E2E Flow — Happy Path

```gherkin
Feature: Job Processing

  Scenario: User registers, submits a job, and sees it complete

    Given I am on the registration page
    When I register with email "test@example.com" and password "Password123!"
    Then I should see the dashboard

    When I click "New Job"
    And I fill in job name "Test CSV Processing"
    And I select job type "DATA_PROCESSING"
    And I upload the file "sample.csv"
    And I click "Submit"
    Then I should see the job in status "QUEUED"

    When the worker processes the job
    Then I should see the job status update to "PROCESSING" in real-time
    And I should see log entries appear in the job detail panel
    And I should see the progress bar advance
    Then I should see the job status update to "COMPLETED"
    And I should see a "Download Results" button
```

### 5.3 E2E Test Scenarios

| Scenario                                 | Priority |
| ---------------------------------------- | -------- |
| Register → Login → Submit Job → Complete | P0       |
| Login failure with wrong password        | P0       |
| Token refresh on expiry                  | P0       |
| Job cancellation by user                 | P1       |
| Job failure and retry behavior           | P1       |
| Admin views all jobs                     | P1       |
| Admin views worker status                | P2       |
| Concurrent jobs from same user           | P2       |
| File upload size limit enforcement       | P2       |
| Rate limiting on login endpoint          | P2       |

### 5.4 Playwright Configuration

```typescript
// playwright.config.ts
export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: false, // E2E tests share state
  retries: 2,
  use: {
    baseURL: 'http://localhost:3000',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
});
```

---

## 6. Test Coverage Targets

| Component           | Line Coverage Target                      |
| ------------------- | ----------------------------------------- |
| API Services        | ≥90%                                      |
| API Controllers     | ≥80%                                      |
| Worker Processors   | ≥85%                                      |
| ML Service routes   | ≥80%                                      |
| Frontend utilities  | ≥75%                                      |
| Frontend components | ≥70% (meaningful behavior, not snapshots) |

Coverage is enforced in CI — PRs that decrease coverage by more than 2% are blocked.

---

## 7. Test Data & Fixtures

- **Unit tests:** Inline mock objects.
- **Integration tests:** Factory functions (using `fishery` or `@anatine/zod-mock`) that create test entities.
- **E2E tests:** Seed scripts (`infrastructure/scripts/seed-test-data.ts`) that populate the database before test runs.

---

## 8. CI Test Pipeline

```yaml
# .github/workflows/test.yml

jobs:
  unit-tests:
    - pnpm install
    - pnpm turbo run test --filter=api
    - pnpm turbo run test --filter=web
    - pnpm turbo run test --filter=workers

  integration-tests:
    needs: unit-tests
    services:
      - postgres
      - redis
    steps:
      - pnpm turbo run test:integration

  e2e-tests:
    needs: integration-tests
    steps:
      - docker compose -f docker-compose.test.yml up -d
      - pnpm playwright test
      - docker compose down

  python-tests:
    steps:
      - pip install -r requirements.txt
      - pytest --cov=app --cov-report=xml
```

---

## 9. Test Isolation

- Each test file is fully isolated — no shared mutable state.
- Integration tests truncate database tables in `afterEach` or `afterAll`.
- Redis is flushed between test suites.
- No shared ports between parallel test runs (use dynamic port allocation).

---

## 10. Debugging Failed Tests

When a test fails in CI:

1. Screenshots and videos are uploaded as artifacts (Playwright).
2. Pino logs from the API are captured and attached.
3. A `correlationId` is assigned to each E2E test run for log tracing.
