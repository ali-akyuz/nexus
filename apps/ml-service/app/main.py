from fastapi import FastAPI, Request
from app.api.routes import router
from prometheus_client import make_asgi_app, Counter, Histogram
import time
from opentelemetry import trace
from opentelemetry.exporter.otlp.proto.http.trace_exporter import OTLPSpanExporter
from opentelemetry.sdk.resources import Resource
from opentelemetry.sdk.trace import TracerProvider
from opentelemetry.sdk.trace.export import BatchSpanProcessor
from opentelemetry.instrumentation.fastapi import FastAPIInstrumentor
import os

# OpenTelemetry Setup
resource = Resource(attributes={"service.name": "nexus-ml-service"})
provider = TracerProvider(resource=resource)
otlp_endpoint = os.getenv("OTLP_ENDPOINT", "http://localhost:4318/v1/traces")
processor = BatchSpanProcessor(OTLPSpanExporter(endpoint=otlp_endpoint))
provider.add_span_processor(processor)
trace.set_tracer_provider(provider)

app = FastAPI(
    title="NEXUS ML Service",
    description="Internal ML Microservice for NEXUS platform",
    version="1.0.0"
)

# Prometheus Metrics Setup
metrics_app = make_asgi_app()
app.mount("/metrics", metrics_app)

ML_REQUESTS_TOTAL = Counter("ml_requests_total", "Total ML requests processed", ["processor_type", "status"])
ML_REQUEST_DURATION = Histogram("ml_request_duration_seconds", "ML request duration", ["processor_type"])

@app.middleware("http")
async def prometheus_middleware(request: Request, call_next):
    # Only track our specific processor endpoints, not health or metrics
    if request.url.path.startswith("/v1/process"):
        start_time = time.time()
        response = await call_next(request)
        process_time = time.time() - start_time
        
        # Simple extraction of processor_type from URL for labels
        processor_type = request.url.path.split("/")[-1].upper()
        if processor_type in ["DATA_ANALYSIS", "CUSTOMER_SEGMENTATION", "CREDIT_RISK"]:
            ML_REQUEST_DURATION.labels(processor_type=processor_type).observe(process_time)
            status = "success" if response.status_code == 200 else "error"
            ML_REQUESTS_TOTAL.labels(processor_type=processor_type, status=status).inc()
            
        return response
    return await call_next(request)

# Auto-instrument FastAPI
FastAPIInstrumentor.instrument_app(app)

@app.get("/health")
async def health_check():
    return {
        "status": "ok",
        "service": "nexus-ml-service",
        "version": "1.0.0"
    }

app.include_router(router, prefix="/v1")
