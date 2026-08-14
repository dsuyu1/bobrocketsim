"""Briefing router – generate natural-language mission summary."""
from __future__ import annotations

from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter
from pydantic import BaseModel, Field

from briefing import generate_briefing
from optimizer import optimize_launch_window
from tle_importer import fetch_tles
from physics.rocket_model import RocketModel

router = APIRouter()


class BriefingRequest(BaseModel):
    nominal_t0_iso: Optional[str] = None
    window_minutes: int = Field(30, ge=5, le=120)
    step_minutes:   int = Field(5,  ge=1, le=30)
    max_debris:     int = Field(300, ge=10, le=1000)


@router.post("/generate")
def create_briefing(req: BriefingRequest):
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

    text = generate_briefing(result, nominal_t0=t0.isoformat())

    return {
        "briefing":    text,
        "go_nogo":     result.get("go_nogo"),
        "risk_index":  result.get("risk_index"),
        "optimal_t0":  result.get("optimal_t0"),
        "conjunctions": result.get("conjunctions"),
    }
