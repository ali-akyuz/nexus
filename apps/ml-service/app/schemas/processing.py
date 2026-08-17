from typing import Any, Dict, List, Optional
from pydantic import BaseModel, Field

class ProcessRequest(BaseModel):
    job_id: str = Field(..., description="The unique identifier for the job")
    type: str = Field(..., description="The type of processing task")
    payload: Dict[str, Any] = Field(..., description="The input data for the task")

class ProcessResult(BaseModel):
    job_id: str
    status: str
    result: Optional[Dict[str, Any]] = None
    metrics: Optional[Dict[str, Any]] = None
    error: Optional[str] = None
