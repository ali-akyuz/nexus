import pytest
from app.schemas.processing import ProcessRequest
from app.processors.data_analysis import DataAnalysisProcessor
from app.processors.customer_segmentation import CustomerSegmentationProcessor

@pytest.mark.asyncio
async def test_data_analysis_empty_dataset():
    request = ProcessRequest(
        job_id="test",
        type="DATA_ANALYSIS",
        payload={"columns": [], "rows": []}
    )
    processor = DataAnalysisProcessor(request)
    
    events = []
    try:
        async for event in processor.process():
            events.append(event)
    except ValueError as e:
        assert "columns' and 'rows'" in str(e)
    else:
        pytest.fail("Expected ValueError")

@pytest.mark.asyncio
async def test_customer_segmentation_invalid_input():
    request = ProcessRequest(
        job_id="test",
        type="CUSTOMER_SEGMENTATION",
        payload={"features": [1, 2], "n_clusters": 3}
    )
    processor = CustomerSegmentationProcessor(request)
    
    try:
        async for _ in processor.process():
            pass
    except ValueError as e:
        assert "at least 3 rows" in str(e)
    else:
        pytest.fail("Expected ValueError")
