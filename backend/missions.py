"""
Mission presets and steering profiles.

Each preset defines:
  - target_alt_m      : target apogee altitude [m]
  - t_max_s           : max simulation time [s]
  - description       : human-readable mission description
  - steer_fn          : pitch/yaw steering callable(t, state) -> (pitch_rad, yaw_rad)

Pitch convention: 0 = straight up (vertical), π/2 = horizontal.
The gravity-turn pitch-over rate is tuned so the rocket reaches the target
altitude rather than pitching over too fast and losing altitude.
"""
from __future__ import annotations

import math
import numpy as np
from typing import Callable, Tuple

SteerFn = Callable[[float, np.ndarray], Tuple[float, float]]


def _make_gravity_turn(
    hold_vertical_s: float,
    pitch_over_end_s: float,
    final_pitch_deg: float,
) -> SteerFn:
    """
    Factory for a smooth gravity-turn steering law.

    Phase 1 [0 → hold_vertical_s]:       pitch = 0  (vertical)
    Phase 2 [hold_vertical_s → pitch_over_end_s]:  smooth sinusoidal pitch-over
    Phase 3 [pitch_over_end_s → ∞]:       hold final_pitch_deg

    Using a sinusoidal (cosine) interpolation avoids abrupt angular rate
    changes that cause numerical instability in the integrator.
    """
    final_pitch_rad = math.radians(final_pitch_deg)
    span = pitch_over_end_s - hold_vertical_s

    def steer(t: float, _state: np.ndarray) -> Tuple[float, float]:
        if t < hold_vertical_s:
            pitch = 0.0
        elif t < pitch_over_end_s:
            frac  = (t - hold_vertical_s) / span
            # Smooth cosine interpolation: 0 → final_pitch_deg
            pitch = final_pitch_rad * 0.5 * (1.0 - math.cos(math.pi * frac))
        else:
            pitch = final_pitch_rad
        return pitch, 0.0   # yaw = 0 (due-east launch)

    return steer


# ── Mission profiles ──────────────────────────────────────────────────────────

MISSIONS: dict = {
    "leo": {
        "label":       "Low Earth Orbit (LEO)",
        "description": "Reach a 200 km circular orbit — the baseline for ISS resupply, "
                       "Earth observation, and most commercial satellites. "
                       "The rocket pitches over gradually after liftoff to build horizontal velocity.",
        "target_alt_m": 200_000.0,
        "t_max_s":      1000.0,
        # Gentle pitch-over: hold vertical 12 s, pitch to 45° over 3 min
        "steer_fn": _make_gravity_turn(
            hold_vertical_s=12.0,
            pitch_over_end_s=200.0,
            final_pitch_deg=45.0,
        ),
    },
    "iss": {
        "label":       "ISS Rendezvous (400 km)",
        "description": "Target the International Space Station orbit at 400 km, "
                       "28.5° inclination. Requires more energy than LEO — the second "
                       "stage burns longer to circularise at the higher altitude.",
        "target_alt_m": 400_000.0,
        "t_max_s":      1200.0,
        # Slightly later pitch-over to carry more energy upward
        "steer_fn": _make_gravity_turn(
            hold_vertical_s=12.0,
            pitch_over_end_s=240.0,
            final_pitch_deg=42.0,
        ),
    },
    "gto": {
        "label":       "Geostationary Transfer Orbit (GTO)",
        "description": "Loft a communications satellite toward geostationary orbit "
                       "(35 786 km). The rocket must achieve a high apogee of ~600 km "
                       "before the satellite's own kick-motor raises it the rest of the way. "
                       "Demands near-horizontal flight at stage-2 cutoff.",
        "target_alt_m": 600_000.0,
        "t_max_s":      1500.0,
        # Fast pitch-over for high-energy injection
        "steer_fn": _make_gravity_turn(
            hold_vertical_s=10.0,
            pitch_over_end_s=180.0,
            final_pitch_deg=55.0,
        ),
    },
    "suborbital": {
        "label":       "Suborbital (Karman Line, 100 km)",
        "description": "A brief hop past the Karman line at 100 km — the internationally "
                       "recognised boundary of space. No orbital velocity is needed; "
                       "the rocket flies mostly straight up and back down.",
        "target_alt_m": 100_000.0,
        "t_max_s":      600.0,
        # Near-vertical profile, minimal pitch-over
        "steer_fn": _make_gravity_turn(
            hold_vertical_s=15.0,
            pitch_over_end_s=120.0,
            final_pitch_deg=20.0,
        ),
    },
}

DEFAULT_MISSION = "leo"


def get_mission(mission_id: str) -> dict:
    return MISSIONS.get(mission_id, MISSIONS[DEFAULT_MISSION])
