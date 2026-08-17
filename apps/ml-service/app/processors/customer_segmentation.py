import asyncio
import pandas as pd
import numpy as np
from sklearn.cluster import KMeans
from typing import Any, AsyncGenerator, Dict

from app.processors.base import BaseProcessor

class CustomerSegmentationProcessor(BaseProcessor):
    async def process(self) -> AsyncGenerator[Dict[str, Any], None]:
        yield await self.emit_progress("validation", 10, "Validating customer features")
        
        features = self.payload.get("features", [])
        n_clusters = self.payload.get("n_clusters", 3)
        
        if not features or len(features) < n_clusters:
            raise ValueError(f"Payload must contain 'features' array with at least {n_clusters} rows")
            
        yield await self.emit_progress("preprocessing", 40, "Preprocessing data for clustering")
        await asyncio.sleep(0.5)
        
        X = np.array(features)
        
        if X.ndim != 2:
            raise ValueError("Features must be a 2D array of numeric values")
            
        yield await self.emit_progress("clustering", 70, "Executing KMeans clustering")
        await asyncio.sleep(0.5)
        
        # Fixed random state for determinism
        kmeans = KMeans(n_clusters=n_clusters, random_state=42, n_init=10)
        labels = kmeans.fit_predict(X)
        
        yield await self.emit_progress("aggregation", 90, "Aggregating cluster statistics")
        await asyncio.sleep(0.5)
        
        # Calculate cluster sizes
        unique, counts = np.unique(labels, return_counts=True)
        cluster_sizes = dict(zip([int(u) for u in unique], [int(c) for c in counts]))
        
        yield {
            "type": "result",
            "data": {
                "job_id": self.job_id,
                "status": "COMPLETED",
                "result": {
                    "cluster_assignments": labels.tolist(),
                    "cluster_sizes": cluster_sizes,
                    "cluster_centers": kmeans.cluster_centers_.tolist()
                },
                "metrics": {
                    "inertia": float(kmeans.inertia_),
                    "n_clusters": n_clusters
                }
            }
        }
