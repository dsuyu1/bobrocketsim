import React from "react";
import type { TelemetryPoint } from "../types";

interface Props {
  telemetry: TelemetryPoint;
}

function fmt(n: number, dec = 1) {
  return isFinite(n) ? n.toFixed(dec) : "—";
}

function AttitudeIndicator({ pitchDeg, rollDeg }: { pitchDeg: number; rollDeg: number }) {
  const SIZE   = 90;
  const cx     = SIZE / 2;
  const cy     = SIZE / 2;
  const r      = SIZE / 2 - 2;
  const offset = Math.max(-r, Math.min(r, pitchDeg * 0.8));

  return (
    <svg width={SIZE} height={SIZE} viewBox={`0 0 ${SIZE} ${SIZE}`}>
      <defs>
        <clipPath id="adClip">
          <circle cx={cx} cy={cy} r={r} />
        </clipPath>
      </defs>
      <circle cx={cx} cy={cy} r={r} fill="#0e3a6e" />
      <g clipPath="url(#adClip)" transform={`rotate(${-rollDeg}, ${cx}, ${cy})`}>
        <rect x={0} y={cy + offset} width={SIZE} height={SIZE} fill="#5c3a1e" />
        <line x1={0} y1={cy + offset} x2={SIZE} y2={cy + offset} stroke="#e2e8f0" strokeWidth={1.5} />
        {[-10, -5, 5, 10].map(d => {
          const ly = cy + offset + d * 0.8;
          const hw = d % 10 === 0 ? 20 : 12;
          return <line key={d} x1={cx - hw} y1={ly} x2={cx + hw} y2={ly} stroke="#e2e8f080" strokeWidth={1} />;
        })}
      </g>
      <g stroke="#fff" strokeWidth={1.5} fill="none">
        <line x1={cx - 20} y1={cy} x2={cx - 6} y2={cy} />
        <line x1={cx + 6}  y1={cy} x2={cx + 20} y2={cy} />
        <circle cx={cx} cy={cy} r={3} fill="#fff" />
      </g>
      <circle cx={cx} cy={cy} r={r} stroke="#aaa" strokeWidth={1.5} fill="none" />
    </svg>
  );
}

function Panel({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      background: "#fff", border: "1px solid #999",
      padding: "6px 10px", fontFamily: "Arial, sans-serif",
      textAlign: "center", minWidth: 100,
    }}>
      {children}
    </div>
  );
}

export default function CockpitHUD({ telemetry }: Props) {
  const alt       = Math.max(0, telemetry.altitude_m);
  const speed     = telemetry.speed_m_s;
  const mach      = speed / 343;
  const q_kpa     = telemetry.dynamic_pressure_Pa / 1000;
  const thrust_kN = telemetry.thrust_N / 1000;

  const velMag = Math.sqrt(telemetry.vx**2 + telemetry.vy**2 + telemetry.vz**2);
  const posMag = Math.sqrt(telemetry.x**2  + telemetry.y**2  + telemetry.z**2);
  let pitchDeg = 90;
  if (velMag > 10 && posMag > 0) {
    const dot = (telemetry.vx * telemetry.x + telemetry.vy * telemetry.y + telemetry.vz * telemetry.z)
                / (velMag * posMag);
    pitchDeg = Math.asin(Math.max(-1, Math.min(1, dot))) * (180 / Math.PI);
  }

  const phase = thrust_kN > 3000 ? "Stage 1 Burn" : thrust_kN > 0 ? "Stage 2 Burn" : "Coasting";

  return (
    <div style={{ position: "absolute", inset: 0, pointerEvents: "none", zIndex: 50 }}>

      {/* Top-centre: phase + T+ */}
      <div style={{
        position: "absolute", top: 12, left: "50%", transform: "translateX(-50%)",
        display: "flex", gap: 10, alignItems: "center",
        fontFamily: "Arial, sans-serif",
      }}>
        <div style={{ background: "#fff", border: "1px solid #999", padding: "3px 12px", fontWeight: "bold", fontSize: 12 }}>
          {phase}
        </div>
        <div style={{ background: "#fff", border: "1px solid #999", padding: "3px 10px", fontSize: 11 }}>
          T+{fmt(telemetry.t, 0)}s
        </div>
      </div>

      {/* Bottom instrument cluster */}
      <div style={{
        position: "absolute", bottom: 36, left: "50%",
        transform: "translateX(-50%)",
        display: "flex", gap: 6, alignItems: "flex-end",
      }}>
        <Panel>
          <div style={{ fontSize: 9, color: "#555", marginBottom: 2 }}>ALTITUDE</div>
          <div style={{ fontSize: 20, fontWeight: "bold", fontVariantNumeric: "tabular-nums" }}>{fmt(alt / 1000, 1)}</div>
          <div style={{ fontSize: 10, color: "#555" }}>km</div>
          <div style={{ fontSize: 9, color: "#777" }}>of {(telemetry.target_alt_m / 1000).toFixed(0)} km</div>
        </Panel>

        <div style={{ textAlign: "center" }}>
          <div style={{ fontSize: 9, color: "#555", fontFamily: "Arial, sans-serif", marginBottom: 2 }}>ATTITUDE</div>
          <AttitudeIndicator pitchDeg={pitchDeg} rollDeg={0} />
          <div style={{ fontSize: 9, color: "#555", fontFamily: "Arial, sans-serif", marginTop: 2 }}>
            PITCH {fmt(pitchDeg, 1)}°
          </div>
        </div>

        <Panel>
          <div style={{ fontSize: 9, color: "#555", marginBottom: 2 }}>SPEED</div>
          <div style={{ fontSize: 20, fontWeight: "bold", fontVariantNumeric: "tabular-nums" }}>{fmt(speed / 1000, 2)}</div>
          <div style={{ fontSize: 10, color: "#555" }}>km/s</div>
          <div style={{ fontSize: 9, color: "#777" }}>Mach {fmt(mach, 1)}</div>
        </Panel>

        <Panel>
          <div style={{ fontSize: 9, color: "#555", marginBottom: 2 }}>THRUST</div>
          <div style={{ fontSize: 20, fontWeight: "bold", fontVariantNumeric: "tabular-nums" }}>{fmt(thrust_kN, 0)}</div>
          <div style={{ fontSize: 10, color: "#555" }}>kN</div>
        </Panel>

        <Panel>
          <div style={{ fontSize: 9, color: "#555", marginBottom: 2 }}>DYN. PRESS</div>
          <div style={{ fontSize: 20, fontWeight: "bold", fontVariantNumeric: "tabular-nums", color: q_kpa > 35 ? "#c00" : "#000" }}>{fmt(q_kpa, 1)}</div>
          <div style={{ fontSize: 10, color: "#555" }}>kPa</div>
          {q_kpa > 35 && <div style={{ fontSize: 9, color: "#c00" }}>MAX-Q</div>}
        </Panel>
      </div>

      {/* Crosshair */}
      <div style={{ position: "absolute", top: "50%", left: "50%", transform: "translate(-50%, -50%)" }}>
        <svg width={60} height={60} viewBox="0 0 60 60">
          <circle cx={30} cy={30} r={12} stroke="#00000060" strokeWidth={1} fill="none" />
          <line x1={30} y1={4}  x2={30} y2={16} stroke="#00000080" strokeWidth={1} />
          <line x1={30} y1={44} x2={30} y2={56} stroke="#00000080" strokeWidth={1} />
          <line x1={4}  y1={30} x2={16} y2={30} stroke="#00000080" strokeWidth={1} />
          <line x1={44} y1={30} x2={56} y2={30} stroke="#00000080" strokeWidth={1} />
          <circle cx={30} cy={30} r={1.5} fill="#000000aa" />
        </svg>
      </div>

      {/* Conjunction alert */}
      {telemetry.conjunction_alert && (
        <div style={{
          position: "absolute", top: 56, left: "50%", transform: "translateX(-50%)",
          background: "#f8d7da", border: "1px solid #f5c6cb",
          padding: "4px 16px",
          color: "#721c24", fontSize: 12, fontWeight: "bold",
          fontFamily: "Arial, sans-serif",
        }}>
          DEBRIS PROXIMITY — 20 km RADIUS
        </div>
      )}

      {/* Vehicle mass (top-left) */}
      <div style={{
        position: "absolute", top: 12, left: 12,
        background: "#fff", border: "1px solid #999",
        padding: "5px 10px",
        fontFamily: "Arial, sans-serif",
      }}>
        <div style={{ fontSize: 9, color: "#555" }}>Vehicle Mass</div>
        <div style={{ fontSize: 16, fontWeight: "bold" }}>{fmt(telemetry.mass_kg / 1000, 0)} t</div>
      </div>
    </div>
  );
}
