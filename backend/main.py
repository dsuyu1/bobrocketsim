"""
RocketSims by Bob – FastAPI entry point.
Starts the REST + WebSocket server.
"""
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from routers import simulation, optimization, briefing, telemetry_ws

app = FastAPI(
    title="RocketSims by Bob",
    description="AI-Driven Launch & Trajectory Optimization Engine",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(simulation.router, prefix="/api/simulation", tags=["Simulation"])
app.include_router(optimization.router, prefix="/api/optimization", tags=["Optimization"])
app.include_router(briefing.router, prefix="/api/briefing", tags=["Briefing"])
app.include_router(telemetry_ws.router, prefix="/ws", tags=["WebSocket"])


@app.get("/health")
def health() -> dict:
    return {"status": "ok", "service": "RocketSims by Bob"}
