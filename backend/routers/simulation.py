"""Simulation router – run a single trajectory and get telemetry."""
from __future__ import annotations

from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter
from pydantic import BaseModel, Field

from missions import get_mission, MISSIONS
from physics.integrator import run_rk4
from physics.rocket_model import RocketModel
from tle_importer import fetch_tles, build_position_snapshot
from debris_checker import proximity_check, risk_index

router = APIRouter()


class SimRequest(BaseModel):
    launch_lat:       float = Field(28.573)
    launch_lon:       float = Field(-80.649)
    t0_iso:           Optional[str] = None
    mission_id:       str   = Field("leo")
    payload_mass_kg:  float = Field(5_000.0, ge=100, le=50_000)
    throttle_pct:     float = Field(100.0,   ge=60,  le=100)
    max_debris:       int   = Field(300)
    dt_s:             float = Field(2.0)


@router.get("/missions")
def list_missions():
    return {k: {"label": v["label"], "description": v["description"]} for k, v in MISSIONS.items()}


@router.post("/run")
def run_simulation(req: SimRequest):
    t0 = (datetime.fromisoformat(req.t0_iso)
          if req.t0_iso else datetime.now(timezone.utc))

    mission = get_mission(req.mission_id)
    rocket  = RocketModel(
        payload_mass_kg=req.payload_mass_kg,
        throttle_fraction=req.throttle_pct / 100.0,
    )
    tles = fetch_tles(max_count=req.max_debris)

    trajectory = run_rk4(
        rocket,
        req.launch_lat,
        req.launch_lon,
        mission["steer_fn"],
        dt=req.dt_s,
        t_max=mission["t_max_s"],
        target_alt_m=mission["target_alt_m"],
    )

    snap   = build_position_snapshot(tles, t0)
    events = proximity_check(trajectory, snap)
    ri     = risk_index(events)
    max_alt = max(tp.altitude_m for tp in trajectory)

    return {
        "t0":              t0.isoformat(),
        "mission_id":      req.mission_id,
        "mission_label":   mission["label"],
        "target_alt_m":    mission["target_alt_m"],
        "max_alt_reached_m": max_alt,
        "reached_target":  max_alt >= mission["target_alt_m"] * 0.95,
        "risk_index":      ri,
        "go_nogo":         "GO" if ri < 30.0 else "NO-GO",
        "conjunctions":    len(events),
        "trajectory": [
            {
                "t": tp.t, "x": tp.x, "y": tp.y, "z": tp.z,
                "altitude_m":          tp.altitude_m,
                "speed_m_s":           tp.speed_m_s,
                "dynamic_pressure_Pa": tp.dynamic_pressure_Pa,
                "mass_kg":             tp.mass_kg,
                "thrust_N":            tp.thrust_N,
            }
            for tp in trajectory
        ],
        "conjunctions_detail": [
            {"debris_name": e.debris_name, "t_s": e.t_s, "distance_m": e.distance_m}
            for e in events
        ],
        "debris_snapshot": snap[:200],
    }
