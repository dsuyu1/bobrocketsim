# RocketSim by Bob 🚀
### AI-Driven Launch & Trajectory Optimization Engine

> Built entirely with **IBM Bob** (VS Code extension) as the primary AI coding tool.

---

## Overview

RocketSim by Bob is a full-stack web app that:

1. **Ingests live TLE data** from CelesTrak into an in-memory LEO object dataset.
2. **Simulates rocket ascent** with an RK4 integrator — J2 gravity, US76 atmosphere, two-stage thrust model.
3. **Optimises the launch window** by scoring T0 ± 30 min (5-min steps) against debris conjunction risk.
4. **Generates a mission briefing** (GO / NO-GO) via IBM Granite on watsonx.ai.
5. **Renders a 3D view** in CesiumJS with a third-person camera tracking the rocket to orbital insertion.

---

## Tech Stack

| Layer | Technology |
|---|---|
| AI Coding Tool | **IBM Bob** |
| AI Briefing | **IBM Granite** via watsonx.ai |
| Frontend | React 18 + TypeScript + CesiumJS |
| Backend | Python 3.11 + FastAPI |
| Physics | NumPy + custom RK4 + sgp4 |
| Communication | WebSockets |

---

## Quick Start

### Prerequisites
- Python 3.11+
- Node.js 20+

### Option A — Docker Compose (recommended)

```bash
cp backend/.env.example backend/.env   # add watsonx credentials
docker compose up --build
```

- Frontend → [http://localhost:5173](http://localhost:5173)
- API docs → [http://localhost:8000/docs](http://localhost:8000/docs)

### Option B — Local Dev

**Backend**
```bash
cd backend
python -m venv .venv && .venv\Scripts\activate   # Windows
# python -m venv .venv && source .venv/bin/activate  # macOS/Linux
pip install -r requirements.txt
cp .env.example .env   # add watsonx credentials (optional)
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

**Frontend**
```bash
cd frontend
npm install
npm run dev
```

Open [http://localhost:5173](http://localhost:5173)

---

## Environment Variables

Copy `backend/.env.example` to `backend/.env` and fill in:

| Variable | Required | Description |
|---|---|---|
| `WATSONX_API_KEY` | Optional | IBM watsonx API key (for AI briefings) |
| `WATSONX_PROJECT_ID` | Optional | watsonx project ID |
| `WATSONX_URL` | Optional | watsonx endpoint (default: us-south) |
| `SPACETRACK_USER` / `PASS` | Optional | Higher TLE quota from Space-Track.org |

---

## Key API Endpoints

| Method | Path | Description |
|---|---|---|
| `POST` | `/api/simulation/run` | Single trajectory simulation |
| `POST` | `/api/optimization/window` | Launch window optimizer |
| `POST` | `/api/briefing/generate` | AI mission briefing |
| `WS` | `/ws/telemetry` | Live telemetry stream |
| `GET` | `/health` | Health check |

---

## License

MIT — see [LICENSE](LICENSE)
