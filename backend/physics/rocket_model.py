"""
Generic two-stage rocket model.

Stage parameters represent a medium-lift vehicle (Falcon-9 class).
"""
from __future__ import annotations

import math
from dataclasses import dataclass, field
from typing import List


@dataclass
class Stage:
    name: str
    wet_mass_kg: float
    dry_mass_kg: float
    thrust_vac_N: float
    isp_vac_s: float
    burn_time_s: float
    drag_coeff: float = 0.3
    ref_area_m2: float = 10.52

    @property
    def mass_flow_rate(self) -> float:
        return self.thrust_vac_N / (self.isp_vac_s * 9.80665)

    @property
    def propellant_mass_kg(self) -> float:
        return self.wet_mass_kg - self.dry_mass_kg


@dataclass
class RocketModel:
    """Two-stage rocket with configurable payload and throttle."""
    payload_mass_kg: float = 5_000.0
    throttle_fraction: float = 1.0       # 0.6 – 1.0

    stages: List[Stage] = field(default_factory=lambda: [
        Stage(
            name="Stage 1",
            wet_mass_kg=410_900.0,
            dry_mass_kg=25_600.0,
            thrust_vac_N=7_607_000.0,
            isp_vac_s=311.0,
            burn_time_s=162.0,
        ),
        Stage(
            name="Stage 2",
            wet_mass_kg=111_500.0,
            dry_mass_kg=4_000.0,
            thrust_vac_N=934_000.0,
            isp_vac_s=348.0,
            burn_time_s=397.0,
        ),
    ])

    def total_liftoff_mass(self) -> float:
        return sum(s.wet_mass_kg for s in self.stages) + self.payload_mass_kg

    def stage_at(self, elapsed_s: float) -> tuple:
        """Return (stage_index, time_within_stage). (None,None) = all burned."""
        t = 0.0
        for i, s in enumerate(self.stages):
            if elapsed_s < t + s.burn_time_s:
                return i, elapsed_s - t
            t += s.burn_time_s
            # 5 s coast between stages
            if elapsed_s < t + 5.0:
                return None, None
            t += 5.0
        return None, None

    def current_mass(self, elapsed_s: float) -> float:
        """Total vehicle mass [kg] at *elapsed_s* after ignition."""
        mass = self.payload_mass_kg
        t = 0.0
        for s in self.stages:
            if elapsed_s <= t:
                mass += s.wet_mass_kg
            elif elapsed_s < t + s.burn_time_s:
                mdot  = s.mass_flow_rate * self.throttle_fraction
                burned = mdot * (elapsed_s - t)
                mass += max(s.wet_mass_kg - burned, s.dry_mass_kg)
            else:
                mass += s.dry_mass_kg
            t += s.burn_time_s + 5.0
        return mass

    def thrust_at(self, elapsed_s: float, altitude_m: float) -> float:
        """Effective thrust [N] applying throttle and SL→vacuum correction."""
        idx, _ = self.stage_at(elapsed_s)
        if idx is None:
            return 0.0
        s = self.stages[idx]
        t_factor  = min(max(altitude_m, 0.0) / 50_000.0, 1.0)
        thrust_sl = s.thrust_vac_N * 0.82
        raw       = thrust_sl + t_factor * (s.thrust_vac_N - thrust_sl)
        return raw * self.throttle_fraction

    def drag_params_at(self, elapsed_s: float) -> tuple:
        idx, _ = self.stage_at(elapsed_s)
        s = self.stages[idx] if idx is not None else self.stages[-1]
        return s.drag_coeff, s.ref_area_m2
