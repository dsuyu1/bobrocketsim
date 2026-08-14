"""Optimization router – find the best launch window."""
from __future__ import annotations

from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter
from pydantic import BaseModel, Field

from optimizer import optimize_launch_window
from physics.rocket_model import RocketModel

router = APIRouter()


class OptimizeRequest(BaseModel):
    nominal_t0_iso: Optional[str] = Field(
        None, description="Nominal T0 in ISO-8601 UTC. Defaults to now.")
    window_minutes: int = Field(30, ge=5, le=120)
    step_minutes:   int = Field(5,  ge=1, le=30)
    max_debris:     int = Field(300, ge=10, le=1000)


@router.post("/window")
def find_optimal_window(req: OptimizeRequest):
    from tle_importer import fetch_tles

    t0 = (datetime.fromisoformat(req.nominal_t0_iso)
          if req.nominal_t0_iso
          else datetime.now(timezone.utc))

    tles   = fetch_tles(max_count=req.max_debris)
    rocket = RocketModel()

    result = optimize_launch_window(
        nominal_t0=t0,
        rocket=rocket,
        tles=tles,
        window_minutes=req.window_minutes,
        step_minutes=req.step_minutes,
    )

    # Strip heavy trajectory blob from the top-level response
    # (available via /api/simulation/run if needed)
    result.pop("_best_trajectory", None)
    result.pop("_best_conjunctions", None)

    return result
