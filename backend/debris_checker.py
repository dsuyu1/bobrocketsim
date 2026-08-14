"""
Debris proximity checker.

Given a trajectory (list of TrajectoryPoint) and a snapshot of debris ECEF
positions, find all conjunction events where a debris object passes within
*safety_radius_m* of the rocket.
"""
from __future__ import annotations

import math
from typing import List

import numpy as np

from physics.integrator import TrajectoryPoint

SAFETY_RADIUS_M = 20_000.0   # 20 km bounding-sphere


class ConjunctionEvent:
    __slots__ = ("debris_name", "t_s", "rocket_pos", "debris_pos", "distance_m")

    def __init__(self, debris_name: str, t_s: float,
                 rocket_pos: np.ndarray, debris_pos: np.ndarray):
        self.debris_name = debris_name
        self.t_s         = t_s
        self.rocket_pos  = rocket_pos
        self.debris_pos  = debris_pos
        self.distance_m  = float(np.linalg.norm(rocket_pos - debris_pos))


def proximity_check(
    trajectory: List[TrajectoryPoint],
    debris_snapshot: List[dict],
    safety_radius_m: float = SAFETY_RADIUS_M,
) -> List[ConjunctionEvent]:
    """
    Broad-phase O(N·M) bounding-sphere check.

    For MVP the debris snapshot is a static position set (propagated to launch
    epoch).  A production system would re-propagate each debris object at every
    trajectory time-step.

    Returns a list of ConjunctionEvent, sorted by closest approach distance.
    """
    if not debris_snapshot:
        return []

    # Build numpy array of debris positions for vectorised distance calc
    debris_names = [d["name"] for d in debris_snapshot]
    debris_pos   = np.array([[d["x"], d["y"], d["z"]] for d in debris_snapshot])

    events: List[ConjunctionEvent] = []
    seen: set = set()  # (debris_name) – record only closest approach per object

    for tp in trajectory:
        rkt = np.array([tp.x, tp.y, tp.z])
        diffs   = debris_pos - rkt
        dists   = np.linalg.norm(diffs, axis=1)
        hits    = np.where(dists < safety_radius_m)[0]

        for idx in hits:
            name = debris_names[idx]
            ev   = ConjunctionEvent(
                debris_name=name,
                t_s=tp.t,
                rocket_pos=rkt,
                debris_pos=debris_pos[idx],
            )
            # Keep only closest approach per debris object
            if name not in seen or ev.distance_m < _closest_dist(events, name):
                seen.add(name)
                events.append(ev)

    events.sort(key=lambda e: e.distance_m)
    return events


def _closest_dist(events: List[ConjunctionEvent], name: str) -> float:
    return min(e.distance_m for e in events if e.debris_name == name)


def risk_index(events: List[ConjunctionEvent]) -> float:
    """
    Compute a normalised flight risk index [0–100].

    Score increases with number of conjunctions and decreases with
    minimum miss distance.
    """
    if not events:
        return 0.0

    n   = len(events)
    d_min = events[0].distance_m  # already sorted closest-first

    # Penalty: full score if inside 1 km, linear fall-off to 20 km
    proximity_score = max(0.0, 1.0 - d_min / SAFETY_RADIUS_M)
    count_score     = min(n / 10.0, 1.0)   # saturates at 10 events

    return round(min((proximity_score * 0.7 + count_score * 0.3) * 100, 100.0), 2)
