"""
WebSocket router – streams live trajectory telemetry to connected clients.

Protocol:
  Client → { "command": "launch", "lat": float, "lon": float,
             "t0_iso": str, "mission_id": str,
             "payload_mass_kg": float, "throttle_pct": float }
  Server → stream of { "type": "telemetry", "data": { ... } }
  Server → { "type": "complete", "summary": { ... } }
  Server → { "type": "error",   "message": str }
  Server → { "type": "status",  "message": str }
"""
from __future__ import annotations

import asyncio
import json
import logging
from datetime import datetime, timezone

from fastapi import APIRouter, WebSocket, WebSocketDisconnect

from missions import get_mission
from physics.integrator import run_rk4
from physics.rocket_model import RocketModel
from tle_importer import fetch_tles, build_position_snapshot
from debris_checker import proximity_check, risk_index

log    = logging.getLogger(__name__)
router = APIRouter()

STREAM_INTERVAL_MS = 50   # ~20 fps


@router.websocket("/telemetry")
async def telemetry_ws(ws: WebSocket):
    await ws.accept()

    try:
        raw = await asyncio.wait_for(ws.receive_text(), timeout=15.0)
        msg = json.loads(raw)
    except Exception as e:
        log.warning("Bad WS handshake: %s", e)
        return

    if msg.get("command") != "launch":
        await ws.send_json({"type": "error", "message": "Expected {'command':'launch'}"})
        await ws.close()
        return

    lat              = float(msg.get("lat", 28.573))
    lon              = float(msg.get("lon", -80.649))
    t0_iso           = msg.get("t0_iso")
    mission_id       = msg.get("mission_id", "leo")
    payload_mass_kg  = float(msg.get("payload_mass_kg", 5000.0))
    throttle_pct     = float(msg.get("throttle_pct", 100.0))

    t0 = datetime.fromisoformat(t0_iso) if t0_iso else datetime.now(timezone.utc)

    await ws.send_json({"type": "status", "message": "Fetching live TLE debris catalogue…"})

    loop = asyncio.get_event_loop()
    tles = await loop.run_in_executor(None, lambda: fetch_tles(max_count=300))
    await ws.send_json({"type": "status",
                        "message": f"Loaded {len(tles)} debris objects. Computing trajectory…"})

    mission = get_mission(mission_id)
    rocket  = RocketModel(
        payload_mass_kg=payload_mass_kg,
        throttle_fraction=throttle_pct / 100.0,
    )

    trajectory = await loop.run_in_executor(
        None,
        lambda: run_rk4(
            rocket, lat, lon,
            mission["steer_fn"],
            dt=2.0,
            t_max=mission["t_max_s"],
            target_alt_m=mission["target_alt_m"],
        ),
    )

    snap   = build_position_snapshot(tles, t0)
    events = proximity_check(trajectory, snap)
    ri     = risk_index(events)
    max_alt = max(tp.altitude_m for tp in trajectory)
    reached = max_alt >= mission["target_alt_m"] * 0.95

    await ws.send_json({"type": "status",
                        "message": f"Trajectory ready ({len(trajectory)} points). Streaming…"})

    conjunction_times = {e.t_s for e in events}

    for tp in trajectory:
        frame = {
            "t": tp.t,
            "x": tp.x, "y": tp.y, "z": tp.z,
            "vx": tp.vx, "vy": tp.vy, "vz": tp.vz,
            "altitude_m":          tp.altitude_m,
            "speed_m_s":           tp.speed_m_s,
            "dynamic_pressure_Pa": tp.dynamic_pressure_Pa,
            "mass_kg":             tp.mass_kg,
            "thrust_N":            tp.thrust_N,
            "conjunction_alert":   tp.t in conjunction_times,
            "target_alt_m":        mission["target_alt_m"],
        }
        try:
            await ws.send_json({"type": "telemetry", "data": frame})
        except WebSocketDisconnect:
            return
        await asyncio.sleep(STREAM_INTERVAL_MS / 1000.0)

    await ws.send_json({
        "type": "complete",
        "summary": {
            "risk_index":        ri,
            "go_nogo":           "GO" if ri < 30.0 else "NO-GO",
            "conjunctions":      len(events),
            "max_alt_reached_m": max_alt,
            "target_alt_m":      mission["target_alt_m"],
            "reached_target":    reached,
            "mission_label":     mission["label"],
            "debris_snapshot":   snap[:200],
            "conjunction_events": [
                {"debris_name": e.debris_name, "t_s": e.t_s, "distance_m": e.distance_m}
                for e in events
            ],
        },
    })
    await ws.close()
