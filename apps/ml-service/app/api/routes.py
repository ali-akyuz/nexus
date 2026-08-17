import json
import logging
import asyncio
from typing import AsyncGenerator
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse

from app.schemas.processing import ProcessRequest
from app.api.auth import verify_internal_key
from app.processors.registry import process_job

logger = logging.getLogger("nexus.ml-service")
router = APIRouter()

@router.post("/process", dependencies=[Depends(verify_internal_key)])
async def process_endpoint(request: ProcessRequest):
    """
    Executes an ML processing task. Returns a StreamingResponse (JSON-lines) 
    that yields progress updates followed by the final result.
    """
    logger.info(f"Received job {request.job_id} of type {request.type}")

    # The process_job generator yields dictionaries
    async def event_generator() -> AsyncGenerator[str, None]:
        try:
            async for event in process_job(request):
                yield json.dumps(event) + "\n"
                
                # Small sleep to allow graceful flushing of chunks (simulating CPU blocking release)
                await asyncio.sleep(0.01)
                
        except ValueError as e:
            logger.error(f"Validation error processing job {request.job_id}: {str(e)}")
            yield json.dumps({
                "type": "result",
                "data": {
                    "job_id": request.job_id,
                    "status": "FAILED",
                    "error": str(e)
                }
            }) + "\n"
        except Exception as e:
            logger.exception(f"Internal error processing job {request.job_id}")
            yield json.dumps({
                "type": "result",
                "data": {
                    "job_id": request.job_id,
                    "status": "FAILED",
                    "error": "Internal processing error"
                }
            }) + "\n"

    return StreamingResponse(event_generator(), media_type="application/x-ndjson")
