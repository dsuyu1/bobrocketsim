import React, { useState } from "react";

interface Props {
  launching: boolean;
  briefingLoading: boolean;
  onLaunch: (lat: number, lon: number, t0: string, missionId: string, payloadKg: number, throttlePct: number) => void;
  onBriefing: (t0: string) => void;
}

const MISSIONS: Record<string, { label: string; desc: string; targetKm: number }> = {
  suborbital: { label: "Suborbital",            desc: "Cross the Kármán line at 100 km.",                                  targetKm: 100  },
  leo:        { label: "Low Earth Orbit",        desc: "Reach a 200 km circular orbit.",                                    targetKm: 200  },
  iss:        { label: "ISS Rendezvous",         desc: "Target the ISS orbit at 400 km.",                                   targetKm: 400  },
  gto:        { label: "Geostationary Transfer", desc: "Inject toward geostationary orbit (600 km injection point).",      targetKm: 600  },
};

const PADS: Record<string, { lat: number; lon: number; label: string }> = {
  capecanaveral: { lat: 28.573,  lon: -80.649,  label: "Cape Canaveral SLC-40"       },
  kennedy:       { lat: 28.608,  lon: -80.604,  label: "Kennedy Space Center LC-39A" },
  baikonur:      { lat: 45.965,  lon:  63.305,  label: "Baikonur Cosmodrome"         },
  vandenberg:    { lat: 34.632,  lon: -120.611, label: "Vandenberg SLC-4E"           },
};

const label: React.CSSProperties = { display: "block", fontWeight: "bold", marginBottom: 2, fontSize: 11 };
const field: React.CSSProperties = { width: "100%", padding: "4px 6px", border: "1px solid #999", fontSize: 12, marginBottom: 8 };

export default function ControlPanel({ launching, briefingLoading, onLaunch, onBriefing }: Props) {
  const [missionId, setMissionId] = useState("leo");
  const [pad, setPad]             = useState("capecanaveral");
  const [t0, setT0]               = useState(() => new Date().toISOString().slice(0, 16));
  const [payload, setPayload]     = useState(5000);
  const [throttle, setThrottle]   = useState(100);

  const handleLaunch = () => {
    const { lat, lon } = PADS[pad];
    onLaunch(lat, lon, t0 + ":00Z", missionId, payload, throttle);
  };

  return (
    <div style={{
      position: "absolute", bottom: 30, left: 10, width: 280,
      background: "#fff",
      border: "1px solid #999",
      padding: "10px 12px",
      fontFamily: "Arial, sans-serif",
      fontSize: 12,
      zIndex: 100,
    }}>
      <div style={{ fontWeight: "bold", fontSize: 13, marginBottom: 8, borderBottom: "1px solid #ccc", paddingBottom: 6 }}>
        Mission Control
      </div>

      {/* Mission */}
      <label style={label}>Mission Profile</label>
      <select value={missionId} onChange={e => setMissionId(e.target.value)} style={field}>
        {Object.entries(MISSIONS).map(([id, m]) => (
          <option key={id} value={id}>{m.label} ({m.targetKm} km)</option>
        ))}
      </select>
      <div style={{ fontSize: 11, color: "#555", marginTop: -6, marginBottom: 8 }}>
        {MISSIONS[missionId].desc}
      </div>

      {/* Launch site */}
      <label style={label}>Launch Site</label>
      <select value={pad} onChange={e => setPad(e.target.value)} style={field}>
        {Object.entries(PADS).map(([key, { label: l }]) => (
          <option key={key} value={key}>{l}</option>
        ))}
      </select>

      {/* T0 */}
      <label style={label}>
        Debris Epoch (UTC)
        <span title="Sets the epoch used to propagate debris orbital positions via SGP4. A different time places debris objects at different points in their orbits, changing conjunction risk. This is not weather data." style={{ marginLeft: 5, cursor: "help", color: "#555", fontWeight: "normal" }}>(?)</span>
      </label>
      <input type="datetime-local" value={t0} onChange={e => setT0(e.target.value)} style={field} />

      {/* Payload */}
      <label style={label}>Payload: <strong>{payload.toLocaleString()} kg</strong></label>
      <input type="range" min={500} max={20000} step={500} value={payload}
        onChange={e => setPayload(Number(e.target.value))}
        style={{ width: "100%", marginBottom: 2 }} />
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10, color: "#666", marginBottom: 8 }}>
        <span>500 kg</span><span>20,000 kg</span>
      </div>

      {/* Throttle */}
      <label style={label}>Throttle: <strong>{throttle}%</strong></label>
      <input type="range" min={60} max={100} step={5} value={throttle}
        onChange={e => setThrottle(Number(e.target.value))}
        style={{ width: "100%", marginBottom: 2 }} />
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10, color: "#666", marginBottom: 10 }}>
        <span>60%</span><span>100%</span>
      </div>

      {/* Buttons */}
      <div style={{ display: "flex", gap: 6 }}>
        <button onClick={handleLaunch} disabled={launching} style={{
          flex: 1, padding: "7px 0",
          background: launching ? "#ccc" : "#000",
          color: launching ? "#666" : "#fff",
          border: "1px solid #999",
          fontWeight: "bold", fontSize: 12,
          cursor: launching ? "not-allowed" : "pointer",
        }}>
          {launching ? "Simulating…" : "Launch"}
        </button>
        <button onClick={() => onBriefing(t0 + ":00Z")} disabled={briefingLoading || launching} style={{
          flex: 1, padding: "7px 0",
          background: "#fff",
          color: (briefingLoading || launching) ? "#999" : "#000",
          border: "1px solid #999",
          fontSize: 12,
          cursor: (briefingLoading || launching) ? "not-allowed" : "pointer",
        }}>
          {briefingLoading ? "Loading…" : "AI Brief"}
        </button>
      </div>
    </div>
  );
}
