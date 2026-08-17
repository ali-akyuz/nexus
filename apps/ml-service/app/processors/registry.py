from typing import AsyncGenerator, Dict, Any

from app.schemas.processing import ProcessRequest
from app.processors.data_analysis import DataAnalysisProcessor
from app.processors.customer_segmentation import CustomerSegmentationProcessor
from app.processors.credit_risk import CreditRiskProcessor

PROCESSOR_REGISTRY = {
    "DATA_ANALYSIS": DataAnalysisProcessor,
    "CUSTOMER_SEGMENTATION": CustomerSegmentationProcessor,
    "CREDIT_RISK": CreditRiskProcessor,
}

async def process_job(request: ProcessRequest) -> AsyncGenerator[Dict[str, Any], None]:
    processor_class = PROCESSOR_REGISTRY.get(request.type)
    
    if not processor_class:
        raise ValueError(f"Unsupported job type: {request.type}")
        
    processor = processor_class(request)
    
    async for event in processor.process():
        yield event
