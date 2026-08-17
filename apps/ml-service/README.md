# NEXUS ML Service

> **Status:** Phase 0 — Placeholder  
> Implementation begins in Phase 7+.

## Description

Python FastAPI ML and data processing service for NEXUS. Called by workers over HTTP to execute compute-intensive tasks.

**Technology:**

- Python 3.12
- FastAPI
- Uvicorn
- Pydantic v2
- Pandas
- Scikit-learn
- structlog

## Structure (planned)

```
apps/ml-service/
├── app/
│   ├── api/
│   │   ├── routes/        # FastAPI route handlers
│   │   └── dependencies.py
│   ├── core/
│   │   ├── config.py      # Settings (pydantic-settings)
│   │   ├── logging.py     # structlog configuration
│   │   └── security.py    # API key validation
│   ├── services/
│   │   ├── data_processor.py
│   │   ├── model_trainer.py
│   │   └── predictor.py
│   ├── models/            # Pydantic request/response models
│   └── main.py            # FastAPI app entry point
├── tests/
│   ├── unit/
│   └── integration/
├── requirements.txt
├── pyproject.toml
└── README.md
```

## Authentication

All endpoints require the `X-Internal-API-Key` header. This service is never publicly exposed.

## Running locally

```bash
cd apps/ml-service
python -m venv .venv
source .venv/bin/activate   # or .venv\Scripts\activate on Windows
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```
