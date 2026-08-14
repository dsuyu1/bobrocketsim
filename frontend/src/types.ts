/** Shared TypeScript types for RocketSims by Bob frontend. */

export interface TelemetryPoint {
  t: number;
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  altitude_m: number;
  speed_m_s: number;
  dynamic_pressure_Pa: number;
  mass_kg: number;
  thrust_N: number;
  conjunction_alert: boolean;
  target_alt_m: number;
}

export interface DebrisObject {
  name: string;
  x: number;
  y: number;
  z: number;
}

export interface ConjunctionEvent {
  debris_name: string;
  t_s: number;
  distance_m: number;
}

export interface SimSummary {
  risk_index: number;
  go_nogo: "GO" | "NO-GO";
  conjunctions: number;
  max_alt_reached_m: number;
  target_alt_m: number;
  reached_target: boolean;
  mission_label: string;
  debris_snapshot: DebrisObject[];
  conjunction_events: ConjunctionEvent[];
}

export interface MissionPreset {
  label: string;
  description: string;
}
