"""
Launch window optimization agent.

Evaluates candidate launch timestamps (T0 ± 30 minutes in 5-minute steps)
and selects the window with the lowest conjunction risk index.
"""
from __future__ import annotations

import logging
from datetime import datetime, timedelta, timezone
from typing import List, Optional

from debris_checker import proximity_check, risk_index, ConjunctionEvent
from missions import get_mission
from physics.integrator import run_rk4, TrajectoryPoint
from physics.rocket_model import RocketModel
from tle_importer import TLERecord, build_position_snapshot

log = logging.getLogger(__name__)


class WindowCandidate:
    def __init__(self, t0: datetime, trajectory: List[TrajectoryPoint],
                 events: List[ConjunctionEvent], score: float):
        self.t0         = t0
        self.trajectory = trajectory
        self.events     = events
        self.risk       = score
        self.go_nogo    = "GO" if score < 30.0 else "NO-GO"


def evaluate_window(
    t0: datetime,
    rocket: RocketModel,
    tles: List[TLERecord],
    launch_lat: float = 28.573,
    launch_lon: float = -80.649,
    mission_id: str = "leo",
) -> WindowCandidate:
    """Run one full simulation for a given launch time and score it."""
    mission = get_mission(mission_id)
    traj    = run_rk4(rocket, launch_lat, launch_lon, mission["steer_fn"],
                      dt=2.0, t_max=mission["t_max_s"],
                      target_alt_m=mission["target_alt_m"])
    snap    = build_position_snapshot(tles, t0)
    events  = proximity_check(traj, snap)
    score   = risk_index(events)
    return WindowCandidate(t0, traj, events, score)


def optimize_launch_window(
    nominal_t0: datetime,
    rocket: Optional[RocketModel] = None,
    tles: Optional[List[TLERecord]] = None,
    window_minutes: int = 30,
    step_minutes: int = 5,
    mission_id: str = "leo",
) -> dict:
    """
    Search T0 ± *window_minutes* in steps of *step_minutes* and return
    the optimal window candidate together with the full candidate set.
    """
    from tle_importer import fetch_tles

    if rocket is None:
        rocket = RocketModel()
    if tles is None:
        log.info("Fetching TLEs for optimization…")
        tles = fetch_tles(max_count=300)

    candidates: List[WindowCandidate] = []
    steps = range(-window_minutes, window_minutes + step_minutes, step_minutes)

    for offset_min in steps:
        t0 = nominal_t0 + timedelta(minutes=offset_min)
        log.info("Evaluating T0 offset %+d min → %s", offset_min, t0.isoformat())
        try:
            cand = evaluate_window(t0, rocket, tles, mission_id=mission_id)
            candidates.append(cand)
        except Exception as e:
            log.warning("Window evaluation failed for offset %d: %s", offset_min, e)

    if not candidates:
        return {"error": "All window evaluations failed"}

    best = min(candidates, key=lambda c: c.risk)
    log.info("Optimal T0: %s  risk=%.1f  %s", best.t0.isoformat(), best.risk, best.go_nogo)

    return {
        "optimal_t0":    best.t0.isoformat(),
        "risk_index":    best.risk,
        "go_nogo":       best.go_nogo,
        "conjunctions":  len(best.events),
        "trajectory_points": len(best.trajectory),
        "all_windows": [
            {
                "t0":          c.t0.isoformat(),
                "risk_index":  c.risk,
                "go_nogo":     c.go_nogo,
                "conjunctions": len(c.events),
            }
            for c in candidates
        ],
        "_best_trajectory": [
            {
                "t": tp.t,
                "x": tp.x, "y": tp.y, "z": tp.z,
                "altitude_m":            tp.altitude_m,
                "speed_m_s":             tp.speed_m_s,
                "dynamic_pressure_Pa":   tp.dynamic_pressure_Pa,
                "mass_kg":               tp.mass_kg,
                "thrust_N":              tp.thrust_N,
            }
            for tp in best.trajectory
        ],
        "_best_conjunctions": [
            {
                "debris_name": e.debris_name,
                "t_s":         e.t_s,
                "distance_m":  e.distance_m,
            }
            for e in best.events
        ],
    }
