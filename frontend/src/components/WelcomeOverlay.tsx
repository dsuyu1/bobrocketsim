import React from "react";

interface Props {
  onDismiss: () => void;
}

export default function WelcomeOverlay({ onDismiss }: Props) {
  return (
    <div style={{
      position: "absolute", inset: 0, zIndex: 300,
      background: "rgba(255,255,255,0.92)",
      display: "flex", alignItems: "center", justifyContent: "center",
    }}>
      <div style={{
        background: "#fff",
        border: "1px solid #999",
        padding: "24px 28px",
        maxWidth: 480, width: "90vw",
        fontFamily: "Arial, sans-serif",
      }}>
        <h2 style={{ fontSize: 18, fontWeight: "bold", marginBottom: 4 }}>RocketSims by Bob</h2>
        <p style={{ fontSize: 12, color: "#555", marginBottom: 16, borderBottom: "1px solid #ccc", paddingBottom: 12 }}>
          AI-Driven Launch &amp; Trajectory Optimization
        </p>

        <ol style={{ paddingLeft: 20, fontSize: 13, lineHeight: "1.8", marginBottom: 16 }}>
          <li><strong>Configure</strong> — pick a mission, launch site, payload and throttle (bottom-left panel).</li>
          <li><strong>Launch</strong> — the backend runs an RK4 physics simulation and streams live telemetry.</li>
          <li><strong>Camera</strong> — toggle between 3rd-person chase and cockpit view at the top.</li>
          <li><strong>AI Brief</strong> — press "AI Brief" to get a GO/NO-GO from IBM Granite.</li>
        </ol>

        <div style={{ fontSize: 11, color: "#555", border: "1px solid #ccc", padding: "6px 10px", marginBottom: 16, display: "flex", gap: 14, flexWrap: "wrap" }}>
          <strong>Legend:</strong>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
            <span style={{ width: 10, height: 10, borderRadius: "50%", background: "#ff6030", display: "inline-block" }} />
            3D Rocket
          </span>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
            <span style={{ width: 16, height: 3, background: "#00bfff", display: "inline-block" }} />
            Flight path
          </span>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
            <span style={{ width: 10, height: 10, borderRadius: "50%", background: "#f97316", display: "inline-block" }} />
            Debris
          </span>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
            <span style={{ width: 10, height: 10, borderRadius: "50%", background: "red", display: "inline-block" }} />
            Launch site
          </span>
        </div>

        <button
          onClick={onDismiss}
          style={{
            width: "100%", padding: "9px 0",
            background: "#000", color: "#fff",
            border: "none", fontSize: 13, fontWeight: "bold",
            cursor: "pointer",
          }}
        >
          Start Simulation
        </button>
      </div>
    </div>
  );
}
