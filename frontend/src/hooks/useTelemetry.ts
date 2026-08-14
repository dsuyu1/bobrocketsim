/**
 * useTelemetry – WebSocket hook.
 * Sends mission_id, payload_mass_kg, throttle_pct alongside launch params.
 */
import { useCallback, useRef, useState } from "react";
import type { TelemetryPoint, DebrisObject, SimSummary } from "../types";

interface UseTelemetryOptions {
  onComplete?: (summary: SimSummary) => void;
}

export function useTelemetry({ onComplete }: UseTelemetryOptions = {}) {
  const [telemetry, setTelemetry]       = useState<TelemetryPoint | null>(null);
  const [debrisPoints, setDebrisPoints] = useState<DebrisObject[]>([]);
  const [conjunctionAlerts, setAlerts]  = useState<string[]>([]);
  const [isConnected, setIsConnected]   = useState(false);
  const [statusMessage, setStatus]      = useState<string>(
    "Ready — choose a mission and press Launch."
  );
  const wsRef = useRef<WebSocket | null>(null);

  const startLaunch = useCallback(
    (
      lat: number,
      lon: number,
      t0: string,
      missionId: string,
      payloadMassKg: number,
      throttlePct: number,
    ) => {
      if (wsRef.current) wsRef.current.close();
      setTelemetry(null);
      setDebrisPoints([]);
      setAlerts([]);
      setStatus("Connecting to mission control server…");

      const protocol = window.location.protocol === "https:" ? "wss" : "ws";
      const ws = new WebSocket(`${protocol}://${window.location.host}/ws/telemetry`);
      wsRef.current = ws;

      ws.onopen = () => {
        setIsConnected(true);
        setStatus("Connected. Sending launch parameters…");
        ws.send(JSON.stringify({
          command: "launch",
          lat,
          lon,
          t0_iso: t0,
          mission_id: missionId,
          payload_mass_kg: payloadMassKg,
          throttle_pct: throttlePct,
        }));
      };

      ws.onmessage = (evt) => {
        const msg = JSON.parse(evt.data) as {
          type: string;
          data?: TelemetryPoint;
          summary?: SimSummary;
          message?: string;
        };

        if (msg.type === "status" && msg.message) {
          setStatus(msg.message);
        } else if (msg.type === "telemetry" && msg.data) {
          setTelemetry(msg.data);
          const altKm = (msg.data.altitude_m / 1000).toFixed(1);
          const tgt   = (msg.data.target_alt_m / 1000).toFixed(0);
          setStatus(`Simulating… T+${msg.data.t.toFixed(0)}s  |  Alt ${altKm} km  /  ${tgt} km target`);
          if (msg.data.conjunction_alert) {
            setAlerts((prev) => [
              `T+${msg.data!.t.toFixed(0)}s — debris within 20 km`,
              ...prev.slice(0, 4),
            ]);
          }
        } else if (msg.type === "complete" && msg.summary) {
          setDebrisPoints(msg.summary.debris_snapshot ?? []);
          const reached  = msg.summary.reached_target;
          const maxAlt   = (msg.summary.max_alt_reached_m / 1000).toFixed(0);
          const verdict  = reached
            ? `Mission success — reached ${maxAlt} km  |  ${msg.summary.go_nogo}  (risk ${msg.summary.risk_index.toFixed(1)}/100)`
            : `Did not reach target — max ${maxAlt} km  |  ${msg.summary.go_nogo}  (risk ${msg.summary.risk_index.toFixed(1)}/100)`;
          setStatus(verdict);
          onComplete?.(msg.summary);
        } else if (msg.type === "error" && msg.message) {
          setStatus(`Server error: ${msg.message}`);
        }
      };

      ws.onclose = (evt) => {
        setIsConnected(false);
        if (!evt.wasClean) {
          setStatus(
            `Connection lost (code ${evt.code}). ` +
            `Make sure the backend is running on port 8000 — ` +
            `run: cd backend && uvicorn main:app --reload --port 8000`
          );
        }
      };

      ws.onerror = () => {
        setStatus(
          "Could not reach the backend server. " +
          "Run: cd backend && uvicorn main:app --reload --port 8000"
        );
      };
    },
    [onComplete]
  );

  return { telemetry, debrisPoints, conjunctionAlerts, startLaunch, isConnected, statusMessage };
}
