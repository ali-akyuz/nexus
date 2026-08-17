import os
from fastapi import Header, HTTPException, status

INTERNAL_SERVICE_KEY = os.getenv("INTERNAL_SERVICE_KEY", "super-secret-internal-key-for-ml-service")

async def verify_internal_key(x_internal_service_key: str = Header(None)):
    if not x_internal_service_key or x_internal_service_key != INTERNAL_SERVICE_KEY:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid internal service key"
        )
