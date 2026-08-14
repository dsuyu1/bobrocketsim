"""
RK4 trajectory integrator.

State vector:  [x, y, z, vx, vy, vz]  in Earth-Centered Earth-Fixed (ECEF) [m, m/s].
Gravity model: inverse-square + J2 perturbation.
Drag:          US76 atmosphere + vehicle Cd / Aref.
Thrust:        Steered by pitch/yaw profile callable.
"""
from __future__ import annotations

import math
from typing import Callable, List, NamedTuple

import numpy as np

from physics.atmosphere import density
from physics.rocket_model import RocketModel

# Earth constants
GM      = 3.986004418e14   # m³/s²
R_E     = 6_371_000.0      # m  (mean radius)
J2      = 1.08263e-3
OMEGA_E = 7.2921150e-5     # rad/s  (Earth rotation)


class TrajectoryPoint(NamedTuple):
    t: float
    x: float
    y: float
    z: float
    vx: float
    vy: float
    vz: float
    altitude_m: float
    speed_m_s: float
    dynamic_pressure_Pa: float
    mass_kg: float
    thrust_N: float


def _altitude(x, y, z) -> float:
    return math.sqrt(x*x + y*y + z*z) - R_E


def _gravity_j2(x, y, z):
    r     = math.sqrt(x*x + y*y + z*z)
    r2    = r * r
    coeff = -GM / (r * r2)
    j2c   = 1.5 * J2 * (R_E * R_E) / r2
    z_r2  = (z / r) ** 2
    ax    = coeff * x * (1 - j2c * (5 * z_r2 - 1))
    ay    = coeff * y * (1 - j2c * (5 * z_r2 - 1))
    az    = coeff * z * (1 - j2c * (5 * z_r2 - 3))
    return ax, ay, az


def _derivatives(
    t: float,
    state: np.ndarray,
    rocket: RocketModel,
    steer_fn: Callable[[float, np.ndarray], tuple],
) -> np.ndarray:
    x, y, z, vx, vy, vz = state
    alt = _altitude(x, y, z)
    r   = alt + R_E

    # Gravity
    gx, gy, gz = _gravity_j2(x, y, z)

    # Drag
    rho      = density(max(alt, 0.0))
    speed    = math.sqrt(vx*vx + vy*vy + vz*vz)
    Cd, Aref = rocket.drag_params_at(t)
    mass     = rocket.current_mass(t)
    if speed > 0 and mass > 0:
        drag_mag = 0.5 * rho * speed * speed * Cd * Aref / mass
        drag_ax  = -drag_mag * vx / speed
        drag_ay  = -drag_mag * vy / speed
        drag_az  = -drag_mag * vz / speed
    else:
        drag_ax = drag_ay = drag_az = 0.0

    # Thrust
    thrust     = rocket.thrust_at(t, alt)
    pitch, yaw = steer_fn(t, state)

    lat = math.asin(max(-1.0, min(1.0, z / r)))
    lon = math.atan2(y, x)
    e_e  = np.array([-math.sin(lon), math.cos(lon), 0.0])
    e_n  = np.array([-math.sin(lat)*math.cos(lon),
                     -math.sin(lat)*math.sin(lon),
                      math.cos(lat)])
    e_up = np.array([ math.cos(lat)*math.cos(lon),
                      math.cos(lat)*math.sin(lon),
                      math.sin(lat)])
    t_dir = (math.cos(pitch) * e_up
             + math.sin(pitch) * (math.cos(yaw) * e_n + math.sin(yaw) * e_e))
    t_acc = (thrust / mass) * t_dir if mass > 0 else np.zeros(3)

    return np.array([
        vx,
        vy,
        vz,
        gx + drag_ax + t_acc[0],
        gy + drag_ay + t_acc[1],
        gz + drag_az + t_acc[2],
    ])


def run_rk4(
    rocket: RocketModel,
    launch_lat_deg: float,
    launch_lon_deg: float,
    steer_fn: Callable[[float, np.ndarray], tuple],
    dt: float = 2.0,
    t_max: float = 1200.0,
    target_alt_m: float = 200_000.0,
    abort_below_alt_m: float = -500.0,
) -> List[TrajectoryPoint]:
    """
    Propagate from liftoff until target_alt_m is reached or t_max elapses.
    abort_below_alt_m terminates the simulation if the rocket falls below
    the launch pad (prevents runaway negative altitude loops).
    """
    lat = math.radians(launch_lat_deg)
    lon = math.radians(launch_lon_deg)
    r0  = R_E

    x0 = r0 * math.cos(lat) * math.cos(lon)
    y0 = r0 * math.cos(lat) * math.sin(lon)
    z0 = r0 * math.sin(lat)

    v_surf = OMEGA_E * R_E * math.cos(lat)
    vx0    = -v_surf * math.sin(lon)
    vy0    =  v_surf * math.cos(lon)
    vz0    =  0.0

    state  = np.array([x0, y0, z0, vx0, vy0, vz0])
    t      = 0.0
    points: List[TrajectoryPoint] = []

    while t <= t_max:
        x, y, z, vx, vy, vz = state
        alt   = _altitude(x, y, z)
        speed = math.sqrt(vx*vx + vy*vy + vz*vz)
        rho   = density(max(alt, 0.0))
        dyn_q = 0.5 * rho * speed * speed
        mass  = rocket.current_mass(t)
        thr   = rocket.thrust_at(t, alt)

        points.append(TrajectoryPoint(
            t=round(t, 2), x=x, y=y, z=z,
            vx=vx, vy=vy, vz=vz,
            altitude_m=alt,
            speed_m_s=speed,
            dynamic_pressure_Pa=dyn_q,
            mass_kg=mass,
            thrust_N=thr,
        ))

        # Stop conditions
        if alt < abort_below_alt_m and t > 5.0:
            break

        k1 = _derivatives(t,        state,           rocket, steer_fn)
        k2 = _derivatives(t + dt/2, state + dt/2*k1, rocket, steer_fn)
        k3 = _derivatives(t + dt/2, state + dt/2*k2, rocket, steer_fn)
        k4 = _derivatives(t + dt,   state + dt*k3,   rocket, steer_fn)

        state = state + (dt / 6.0) * (k1 + 2*k2 + 2*k3 + k4)
        t    += dt

    return points
