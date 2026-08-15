import React, { useState, useEffect, useRef } from "react";
import GlobeView from "./components/GlobeView";
import type { CameraMode } from "./components/GlobeView";
import TelemetryHUD from "./components/TelemetryHUD";
import ControlPanel from "./components/ControlPanel";
import BriefingPanel from "./components/BriefingPanel";
import WelcomeOverlay from "./components/WelcomeOverlay";
import StatusBar from "./components/StatusBar";
import CockpitHUD from "./components/CockpitHUD";
import CameraToggle from "./components/CameraToggle";
import AtmosphereMap from "./components/AtmosphereMap";
import { useTelemetry } from "./hooks/useTelemetry";
import type { SimSummary } from "./types";

export default function App() {
  const [launching, setLaunching]           = useState(false);
  const [summary, setSummary]               = useState<SimSummary | null>(null);
  const [briefing, setBriefing]             = useState<string>("");
  const [showBriefing, setShowBriefing]     = useState(false);
  const [showWelcome, setShowWelcome]       = useState(true);
  const [briefingLoading, setBriefingLoading] = useState(false);
  const [cameraMode, setCameraMode]         = useState<CameraMode>("third_person");
  const [missionToast, setMissionToast]     = useState<{ reached: boolean; altKm: number } | null>(null);
  const [launchPad, setLaunchPad]           = useState<{ lat: number; lon: number } | null>(null);
  const targetHitRef                        = useRef(false);

  const { telemetry, debrisPoints, conjunctionAlerts, startLaunch, isConnected, statusMessage } =
    useTelemetry({
      onComplete: (s) => {
        setSummary(s);
        setLaunching(false);
      },
    });

  // Show toast the first time the rocket hits its target altitude
  useEffect(() => {
    if (!telemetry || targetHitRef.current) return;
    if (telemetry.altitude_m >= telemetry.target_alt_m) {
      targetHitRef.current = true;
      const altKm = Math.round(telemetry.altitude_m / 1000);
      setMissionToast({ reached: true, altKm });
      setTimeout(() => setMissionToast(null), 5000);
    }
  }, [telemetry]);

  const handleLaunch = (
    lat: number, lon: number, t0: string,
    missionId: string, payloadKg: number, throttlePct: number
  ) => {
    setSummary(null);
    setBriefing("");
    setShowBriefing(false);
    setLaunching(true);
    setMissionToast(null);
    setLaunchPad({ lat, lon });
    targetHitRef.current = false;
    startLaunch(lat, lon, t0, missionId, payloadKg, throttlePct);
  };

  const handleBriefing = async (t0: string) => {
    setBriefingLoading(true);
    try {
      const res = await fetch("/api/briefing/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nominal_t0_iso: t0 }),
      });
      const data = await res.json();
      setBriefing(data.briefing ?? "No briefing available.");
      setShowBriefing(true);
    } catch {
      setBriefing("Could not reach the backend. Make sure the server is running.");
      setShowBriefing(true);
    } finally {
      setBriefingLoading(false);
    }
  };

  // Atmosphere minimap shows whenever there is telemetry (regardless of camera mode)
  const showAtmoMap    = telemetry !== null || launching;
  // Standard HUD shows in third-person only; offset right to sit beside the minimap
  const showStandardHUD = cameraMode === "third_person";

  return (
    <div style={{ position: "relative", width: "100vw", height: "100vh", background: "#000" }}>

      {/* ── 3-D Globe ── */}
      <GlobeView
        telemetry={telemetry}
        debrisPoints={debrisPoints}
        conjunctionAlerts={conjunctionAlerts}
        cameraMode={cameraMode}
        launchLat={launchPad?.lat ?? null}
        launchLon={launchPad?.lon ?? null}
      />

      {/* ── Cockpit HUD (first-person overlay) ── */}
      {cameraMode === "first_person" && telemetry && (
        <CockpitHUD telemetry={telemetry} />
      )}

      {/* ── Camera mode toggle (top-centre) ── */}
      <CameraToggle
        mode={cameraMode}
        onChange={setCameraMode}
        disabled={!telemetry}
      />

      {/* ── Atmosphere minimap (top-right, always visible when flying) ── */}
      {showAtmoMap && telemetry && (
        <AtmosphereMap
          altitude_m={telemetry.altitude_m}
          target_alt_m={telemetry.target_alt_m}
          speed_m_s={telemetry.speed_m_s}
          thrust_N={telemetry.thrust_N}
        />
      )}

      {/* ── Telemetry HUD (third-person only, positioned left of minimap) ── */}
      {showStandardHUD && (
        <div style={{ position: "absolute", top: 10, right: showAtmoMap && telemetry ? 186 : 10 }}>
          <TelemetryHUD
            telemetry={telemetry}
            summary={summary}
            conjunctionAlerts={conjunctionAlerts}
            launching={launching}
            compact={showAtmoMap && telemetry !== null}
          />
        </div>
      )}

      {/* ── Control Panel (bottom-left) ── */}
      <ControlPanel
        launching={launching}
        briefingLoading={briefingLoading}
        onLaunch={handleLaunch}
        onBriefing={handleBriefing}
      />

      {/* ── Status bar (bottom) ── */}
      <StatusBar message={statusMessage} isConnected={isConnected} />

      {/* ── Mission target toast ── */}
      {missionToast && (
        <div style={{
          position: "absolute", top: 60, left: "50%", transform: "translateX(-50%)",
          zIndex: 200, pointerEvents: "none",
          background: missionToast.reached ? "#d4edda" : "#f8d7da",
          border: `1px solid ${missionToast.reached ? "#c3e6cb" : "#f5c6cb"}`,
          padding: "10px 24px",
          fontFamily: "Arial, sans-serif", fontSize: 14, fontWeight: "bold",
          color: missionToast.reached ? "#155724" : "#721c24",
          textAlign: "center",
          minWidth: 260,
        }}>
          {missionToast.reached
            ? `Target reached — ${missionToast.altKm} km`
            : `Target missed — max ${missionToast.altKm} km`}
          <div style={{ fontSize: 11, fontWeight: "normal", marginTop: 2 }}>
            Simulation continuing…
          </div>
        </div>
      )}

      {/* ── AI Briefing modal ── */}
      {showBriefing && (
        <BriefingPanel text={briefing} onClose={() => setShowBriefing(false)} />
      )}

      {/* ── First-run welcome overlay ── */}
      {showWelcome && <WelcomeOverlay onDismiss={() => setShowWelcome(false)} />}
    </div>
  );
}
