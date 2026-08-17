import asyncio
import numpy as np
from typing import Any, AsyncGenerator, Dict

from app.processors.base import BaseProcessor

class CreditRiskProcessor(BaseProcessor):
    async def process(self) -> AsyncGenerator[Dict[str, Any], None]:
        yield await self.emit_progress("validation", 10, "Validating applicant data")
        
        amount = self.payload.get("loan_amount", 0)
        income = self.payload.get("annual_income", 0)
        score = self.payload.get("credit_score", 0)
        
        if income <= 0 or amount <= 0:
            raise ValueError("Invalid loan_amount or annual_income")
            
        yield await self.emit_progress("feature_processing", 40, "Calculating financial ratios")
        await asyncio.sleep(0.5)
        
        dti = amount / income
        
        yield await self.emit_progress("prediction", 70, "Evaluating deterministic risk model")
        await asyncio.sleep(0.5)
        
        # Deterministic logic
        np.random.seed(42) # Ensure any probabilistic math is deterministic
        base_risk = 0.5
        
        if score > 750:
            base_risk -= 0.3
        elif score < 600:
            base_risk += 0.3
            
        if dti > 0.5:
            base_risk += 0.2
        elif dti < 0.2:
            base_risk -= 0.1
            
        # Bound between 0.01 and 0.99
        final_probability = float(np.clip(base_risk, 0.01, 0.99))
        
        label = "HIGH_RISK" if final_probability > 0.6 else ("MEDIUM_RISK" if final_probability > 0.3 else "LOW_RISK")
        
        yield await self.emit_progress("finalization", 90, "Finalizing risk assessment")
        await asyncio.sleep(0.5)
        
        yield {
            "type": "result",
            "data": {
                "job_id": self.job_id,
                "status": "COMPLETED",
                "result": {
                    "risk_label": label,
                    "probability_of_default": round(final_probability, 4),
                    "disclaimer": "This is a demonstration model and not a production financial decision system."
                },
                "metrics": {
                    "debt_to_income_ratio": round(dti, 4)
                }
            }
        }
