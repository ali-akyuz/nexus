from fastapi.testclient import TestClient
from app.main import app
from app.api.auth import INTERNAL_SERVICE_KEY

client = TestClient(app)

def test_health():
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json()["status"] == "ok"

def test_unauthorized_process():
    response = client.post("/v1/process", json={"job_id": "123", "type": "DATA_ANALYSIS", "payload": {}})
    assert response.status_code == 401

def test_process_validation_error():
    headers = {"X-Internal-Service-Key": INTERNAL_SERVICE_KEY}
    response = client.post("/v1/process", json={"job_id": "123", "type": "DATA_ANALYSIS"}, headers=headers)
    # Missing payload should return 422 Unprocessable Entity
    assert response.status_code == 422
