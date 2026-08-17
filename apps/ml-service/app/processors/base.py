from abc import ABC, abstractmethod
from typing import Any, AsyncGenerator, Dict

from app.schemas.processing import ProcessRequest

class BaseProcessor(ABC):
    def __init__(self, request: ProcessRequest):
        self.request = request
        self.job_id = request.job_id
        self.payload = request.payload

    async def emit_progress(self, stage: str, percent: int, log_message: str = "") -> Dict[str, Any]:
        """Returns a progress event dictionary."""
        return {
            "type": "progress",
            "job_id": self.job_id,
            "stage": stage,
            "percent": percent,
            "log": log_message
        }

    @abstractmethod
    async def process(self) -> AsyncGenerator[Dict[str, Any], None]:
        """
        Executes the processing task. Yields progress events, and finally yields the result event.
        """
        pass
