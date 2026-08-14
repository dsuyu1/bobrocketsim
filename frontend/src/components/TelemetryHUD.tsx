import React from "react";
import type { TelemetryPoint, SimSummary } from "../types";

interface Props {
  telemetry: TelemetryPoint | null;
  summary: SimSummary | null;
  conjunctionAlerts: string[];
  launching: boolean;
  compact?: boolean;
}

function fmt(n: number, dec = 1) { return isFinite(n) ? n.toFixed(dec) : "—"; }

function flightPhase(tp: TelemetryPoint): string {
  if (tp.altitude_m < 0)        return "On Pad";
  if (tp.thrust_N > 3_000_000)  return "Stage 1 Burn";
  if (tp.thrust_N > 0)          return "Stage 2 Burn";
  return "Coasting";
}

function Row({ label, value, warn }: { label: string; value: string; warn?: boolean }) {
  return (
    <tr>
      <td style={{ color: "#555", padding: "3px 6px 3px 0", fontSize: 11 }}>{label}</td>
      <td style={{ fontWeight: "bold", color: warn ? "#c00" : "#000", textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{value}</td>
    </tr>
  );
}

export default function TelemetryHUD({ telemetry, summary, conjunctionAlerts, launching, compact }: Props) {
  return (
    <div style={{
      width: 240,
      background: "#fff",
      border: "1px solid #999",
      padding: "10px 12px",
      fontFamily: "Arial, sans-serif",
      fontSize: 12,
    }}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid #ccc", paddingBottom: 6, marginBottom: 8 }}>
        <strong style={{ fontSize: 13 }}>Telemetry</strong>
        <span style={{ fontSize: 11, color: "#555" }}>
          {telemetry ? `T+${fmt(telemetry.t, 0)}s` : launching ? "Computing…" : "Standby"}
        </span>
      </div>

      {!telemetry ? (
        <div style={{ color: "#555", fontSize: 12, padding: "8px 0" }}>
          {launching ? "Computing trajectory…" : "Select a mission and press Launch."}
        </div>
      ) : (
        <>
          {/* Altitude progress */}
          <div style={{ marginBottom: 8 }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 2 }}>
              <span style={{ color: "#555", fontSize: 11 }}>Altitude</span>
              <strong style={{ fontVariantNumeric: "tabular-nums" }}>
                {fmt(Math.max(telemetry.altitude_m, 0) / 1000, 1)} km
              </strong>
            </div>
            <div style={{ background: "#eee", height: 6, border: "1px solid #ccc" }}>
              <div style={{
                width: `${Math.max(0, Math.min((telemetry.altitude_m / telemetry.target_alt_m) * 100, 100))}%`,
                height: "100%", background: "#000",
                transition: "width 0.25s",
              }} />
            </div>
            <div style={{ fontSize: 10, color: "#666", textAlign: "right", marginTop: 1 }}>
              target: {(telemetry.target_alt_m / 1000).toFixed(0)} km
            </div>
          </div>

          {!compact && (
            <table style={{ width: "100%", borderCollapse: "collapse", marginBottom: 8 }}>
              <tbody>
                <Row label="Speed"     value={`${fmt(telemetry.speed_m_s / 1000, 2)} km/s`} />
                <Row label="Mach"      value={fmt(telemetry.speed_m_s / 343, 1)} />
                <Row label="Dyn. Press" value={`${fmt(telemetry.dynamic_pressure_Pa / 1000, 2)} kPa`}
                     warn={telemetry.dynamic_pressure_Pa > 35_000} />
                <Row label="Mass"      value={`${fmt(telemetry.mass_kg / 1000, 0)} t`} />
                <Row label="Thrust"    value={`${fmt(telemetry.thrust_N / 1000, 0)} kN`} />
              </tbody>
            </table>
          )}

          {compact && (
            <table style={{ width: "100%", borderCollapse: "collapse", marginBottom: 8 }}>
              <tbody>
                <Row label="Speed"  value={`${fmt(telemetry.speed_m_s / 1000, 2)} km/s`} />
                <Row label="Thrust" value={`${fmt(telemetry.thrust_N / 1000, 0)} kN`} />
              </tbody>
            </table>
          )}

          <div style={{ border: "1px solid #ccc", padding: "3px 6px", textAlign: "center", fontSize: 11, background: "#f0f0f0" }}>
            {flightPhase(telemetry)}
          </div>
        </>
      )}

      {/* Mission outcome */}
      {summary && (
        <div style={{ marginTop: 10, borderTop: "1px solid #ccc", paddingTop: 8 }}>
          <div style={{
            padding: "5px 8px", marginBottom: 6,
            background: summary.reached_target ? "#d4edda" : "#fff3cd",
            border: `1px solid ${summary.reached_target ? "#c3e6cb" : "#ffeeba"}`,
          }}>
            <strong>{summary.reached_target ? "Target Reached" : "Target Missed"}</strong>
            <div style={{ fontSize: 11, color: "#333" }}>
              Max: {(summary.max_alt_reached_m / 1000).toFixed(0)} km / {(summary.target_alt_m / 1000).toFixed(0)} km
            </div>
          </div>

          <div style={{ marginBottom: 6 }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 2 }}>
              <span style={{ fontSize: 11, color: "#555" }}>Debris Risk</span>
              <strong style={{ fontVariantNumeric: "tabular-nums" }}>{fmt(summary.risk_index, 1)} / 100</strong>
            </div>
            <div style={{ background: "#eee", height: 6, border: "1px solid #ccc" }}>
              <div style={{ width: `${summary.risk_index}%`, height: "100%", background: summary.risk_index < 30 ? "#28a745" : summary.risk_index < 60 ? "#ffc107" : "#dc3545" }} />
            </div>
          </div>

          <div style={{ display: "flex", gap: 6 }}>
            <div style={{
              flex: 1, textAlign: "center", padding: "5px",
              border: "1px solid #999",
              background: summary.go_nogo === "GO" ? "#d4edda" : "#f8d7da",
              fontWeight: "bold", fontSize: 14,
            }}>
              {summary.go_nogo}
            </div>
            <div style={{ flex: 1, textAlign: "center", padding: "5px", border: "1px solid #999", fontSize: 11 }}>
              <strong style={{ fontSize: 14 }}>{summary.conjunctions}</strong><br />
              conjunction{summary.conjunctions !== 1 ? "s" : ""}
            </div>
          </div>
        </div>
      )}

      {/* Conjunction alerts */}
      {conjunctionAlerts.length > 0 && (
        <div style={{ marginTop: 8, borderTop: "1px solid #ccc", paddingTop: 6 }}>
          <div style={{ fontWeight: "bold", color: "#c00", fontSize: 11, marginBottom: 2 }}>Proximity Alerts</div>
          {conjunctionAlerts.map((a, i) => (
            <div key={i} style={{ fontSize: 11, color: "#c00" }}>{a}</div>
          ))}
        </div>
      )}
    </div>
  );
}
