/**
 * GlobeView – CesiumJS 3D globe with GLB rocket model and dual camera modes.
 *
 * Camera modes
 * ────────────
 * THIRD_PERSON  (default)
 *   Camera sits ~8 km behind and ~3 km above the rocket, always looking at
 *   the rocket. Scales back as altitude increases. Throttled to update only
 *   when altitude changes by >1 km to avoid the sun-flash strobe.
 *
 * FIRST_PERSON  (cockpit)
 *   Camera is placed at the rocket's nose tip, looking forward along the
 *   velocity vector. The caller renders a cockpit HUD on top via a React
 *   overlay — this component just positions the camera.
 *
 * Rocket model
 * ────────────
 * Loaded from /rocket.glb (procedural GLB in frontend/public/).
 * Orientation: the GLB is Y-up (standard glTF). Cesium is Z-up (ENU).
 * We use Cesium.Transforms.headingPitchRollQuaternion to orient the model
 * nose-up at the surface, then tilt it toward the velocity vector.
 */
import React, { useEffect, useRef } from "react";
import { Viewer, Entity, PolylineGraphics } from "resium";
import * as Cesium from "cesium";
import type { TelemetryPoint, DebrisObject } from "../types";

export type CameraMode = "third_person" | "first_person";

interface Props {
  telemetry: TelemetryPoint | null;
  debrisPoints: DebrisObject[];
  conjunctionAlerts: string[];
  cameraMode: CameraMode;
  launchLat: number | null;
  launchLon: number | null;
}

function ecefCart(x: number, y: number, z: number) {
  return new Cesium.Cartesian3(x, y, z);
}

/**
 * Orient the rocket model so its +Y nose axis points along the velocity vector.
 *
 * Strategy: use Cesium's ENU frame as the base, then apply a heading/pitch
 * rotation derived from the velocity vector expressed in that local frame.
 *
 * glTF convention: +Y is up (nose), +X is right, -Z is forward.
 * Cesium ENU:       +X is East, +Y is North, +Z is Up.
 *
 * When velocity is purely radial (+Z in ENU), the rocket points straight up → pitch = 90°.
 * As the rocket pitches over, the ENU-Z component decreases and ENU horizontal grows.
 *
 * We compute heading (azimuth of horizontal velocity) and pitch (elevation angle)
 * then build a HeadingPitchRoll quaternion — which is exactly what Cesium expects.
 */
function rocketOrientation(
  pos: Cesium.Cartesian3,
  vx: number, vy: number, vz: number,
): Cesium.Quaternion {
  const velEcef = new Cesium.Cartesian3(vx, vy, vz);
  const velLen  = Cesium.Cartesian3.magnitude(velEcef);

  // ENU transform at rocket position
  const enuMat = Cesium.Transforms.eastNorthUpToFixedFrame(pos);

  if (velLen < 10) {
    // On pad — straight up. In ENU that is heading=0, pitch=+90°.
    // We need the quaternion that rotates model +Y (nose) to ENU +Z (up).
    // HeadingPitchRoll: heading=0, pitch=0, roll=0 keeps the model in ENU frame
    // with +X→East, +Y→Up (because Cesium's model default is +Y up in ENU).
    // So no extra rotation needed — just return the ENU frame quaternion.
    const m3 = Cesium.Matrix4.getMatrix3(enuMat, new Cesium.Matrix3());
    return Cesium.Quaternion.fromRotationMatrix(m3, new Cesium.Quaternion());
  }

  // Project velocity into ENU (invert ENU matrix = transpose for orthonormal)
  const enuInv = Cesium.Matrix4.inverseTransformation(enuMat, new Cesium.Matrix4());
  const velEnu = Cesium.Matrix4.multiplyByPointAsVector(enuInv, velEcef, new Cesium.Cartesian3());

  // Horizontal component (East-North plane) and vertical (Up)
  const vHoriz = Math.sqrt(velEnu.x * velEnu.x + velEnu.y * velEnu.y);
  const vUp    = velEnu.z;

  // Heading: azimuth of horizontal velocity from North, clockwise
  // atan2(East, North) gives bearing from North
  const heading = Math.atan2(velEnu.x, velEnu.y);   // radians, 0 = North

  // Pitch: elevation angle above local horizontal
  // pitch=0 → horizontal, pitch=+π/2 → straight up
  // Cesium HeadingPitchRoll pitch is rotation around the local right axis:
  // positive pitch tilts nose DOWN in Cesium convention, so we negate.
  const elevation = Math.atan2(vUp, vHoriz);          // 0..+π/2
  const pitch     = elevation - Math.PI / 2;           // subtract 90° because model default is nose-up

  const hpr = new Cesium.HeadingPitchRoll(heading, pitch, 0);
  return Cesium.Transforms.headingPitchRollQuaternion(pos, hpr, Cesium.Ellipsoid.WGS84);
}

export default function GlobeView({ telemetry, debrisPoints, conjunctionAlerts, cameraMode, launchLat, launchLon }: Props) {
  const viewerRef    = useRef<Cesium.Viewer | null>(null);
  const lastCamAlt   = useRef<number>(-1);
  const trailRef     = useRef<Cesium.Cartesian3[]>([]);
  const prevModeRef  = useRef<CameraMode>("third_person");

  // ── Lock / unlock Cesium mouse input based on camera mode ────────────────
  useEffect(() => {
    if (!viewerRef.current) return;
    const ctrl = viewerRef.current.scene.screenSpaceCameraController;
    if (cameraMode === "first_person") {
      // Hard-lock: user cannot drag/zoom away from cockpit view
      ctrl.enableInputs = false;
    } else {
      // Free navigation in third-person
      ctrl.enableInputs = true;
    }
  }, [cameraMode, viewerRef.current]);

  // ── Camera update ────────────────────────────────────────────────────────
  useEffect(() => {
    if (!telemetry || !viewerRef.current) return;
    const viewer = viewerRef.current;
    const pos    = ecefCart(telemetry.x, telemetry.y, telemetry.z);

    // Accumulate trail (cap at 400 points)
    trailRef.current.push(pos.clone());
    if (trailRef.current.length > 400) trailRef.current.shift();

    const alt        = telemetry.altitude_m;
    const modeChange = cameraMode !== prevModeRef.current;
    prevModeRef.current = cameraMode;

    // First-person: re-anchor every frame (no throttle — user can't escape)
    // Third-person: throttle to every 1 km altitude change to prevent sun-flash
    if (cameraMode === "third_person" && !modeChange && Math.abs(alt - lastCamAlt.current) < 1000) return;
    lastCamAlt.current = alt;

    const norm = Cesium.Cartesian3.normalize(pos, new Cesium.Cartesian3());

    if (cameraMode === "first_person") {
      // ── Cockpit / first-person ────────────────────────────────────────────
      // Place camera at rocket nose (top of model ≈ 67 m above CoM).
      // The model origin is at base (y=0 in GLB), nose is at y≈67m.
      // In ECEF the "up" direction is the surface normal scaled by 67 m.
      const noseTip = Cesium.Cartesian3.add(
        pos,
        Cesium.Cartesian3.multiplyByScalar(norm, 70, new Cesium.Cartesian3()),
        new Cesium.Cartesian3()
      );

      // Forward direction: velocity vector (or straight up if stationary)
      const velMag = Math.sqrt(telemetry.vx**2 + telemetry.vy**2 + telemetry.vz**2);
      let   fwd: Cesium.Cartesian3;
      if (velMag > 50) {
        fwd = Cesium.Cartesian3.normalize(
          new Cesium.Cartesian3(telemetry.vx, telemetry.vy, telemetry.vz),
          new Cesium.Cartesian3()
        );
      } else {
        fwd = norm.clone();
      }

      viewer.camera.setView({
        destination: noseTip,
        orientation: {
          direction: fwd,
          up: norm,
        },
      });
    } else {
      // ── Third-person ─────────────────────────────────────────────────────
      // Distance: tight near pad, pull back as altitude climbs
      const camDist = Math.max(500, 8_000 + alt * 0.06);

      // Tangent behind-rocket (cross surface normal with world-Z for E-W component)
      let tangent = Cesium.Cartesian3.cross(
        norm, Cesium.Cartesian3.UNIT_Z, new Cesium.Cartesian3()
      );
      if (Cesium.Cartesian3.magnitudeSquared(tangent) < 0.001) {
        tangent = Cesium.Cartesian3.cross(norm, Cesium.Cartesian3.UNIT_X, new Cesium.Cartesian3());
      }
      Cesium.Cartesian3.normalize(tangent, tangent);

      // Camera = rocket + back * 0.6 * camDist  +  up * 0.4 * camDist
      const back = Cesium.Cartesian3.multiplyByScalar(tangent, -camDist * 0.6, new Cesium.Cartesian3());
      const up   = Cesium.Cartesian3.multiplyByScalar(norm,     camDist * 0.4, new Cesium.Cartesian3());
      const camPos = Cesium.Cartesian3.add(
        Cesium.Cartesian3.add(pos, back, new Cesium.Cartesian3()),
        up,
        new Cesium.Cartesian3()
      );

      viewer.camera.setView({
        destination: camPos,
        orientation: {
          direction: Cesium.Cartesian3.normalize(
            Cesium.Cartesian3.subtract(pos, camPos, new Cesium.Cartesian3()),
            new Cesium.Cartesian3()
          ),
          up: norm,
        },
      });
    }
  }, [telemetry, cameraMode]);

  // Reset on new launch
  useEffect(() => {
    if (!telemetry) {
      trailRef.current    = [];
      lastCamAlt.current  = -1;
    }
  }, [telemetry]);

  const hasRocket    = telemetry !== null;
  const rocketPos    = hasRocket ? ecefCart(telemetry!.x, telemetry!.y, telemetry!.z) : null;
  const isAlert      = conjunctionAlerts.length > 0 && telemetry?.conjunction_alert;
  const trailPoints  = trailRef.current.length > 1 ? [...trailRef.current] : null;

  // Rocket orientation quaternion (velocity-aligned)
  const rocketQuat = (hasRocket && telemetry!.speed_m_s > 10)
    ? rocketOrientation(rocketPos!, telemetry!.vx, telemetry!.vy, telemetry!.vz)
    : undefined;

  // Scale: 5× makes the model clearly visible. minimumPixelSize=64 keeps
  // it legible even when zoomed far out.
  const modelScale = 5.0;

  return (
    <div style={{ position: "absolute", inset: 0 }}>
      {isAlert && (
        <div style={{
          position: "absolute", inset: 0, pointerEvents: "none", zIndex: 10,
          boxShadow: "inset 0 0 40px 8px rgba(255,40,40,0.7)",
          animation: "alertPulse 0.6s ease-in-out infinite",
        }} />
      )}

      <Viewer
        full
        animation={false}
        timeline={false}
        baseLayerPicker={false}
        navigationHelpButton={false}
        sceneModePicker={false}
        geocoder={false}
        homeButton={false}
        infoBox={false}
        selectionIndicator={false}
        ref={(r) => {
          if (r?.cesiumElement) {
            viewerRef.current = r.cesiumElement;
            // Apply lock immediately on mount if already in cockpit mode
            r.cesiumElement.scene.screenSpaceCameraController.enableInputs =
              cameraMode !== "first_person";
          }
        }}
        style={{ position: "absolute", inset: 0 }}
      >
        {/* GLB Rocket model */}
        {rocketPos && (
          <Entity
            position={rocketPos}
            orientation={rocketQuat
              ? new Cesium.ConstantProperty(rocketQuat)
              : undefined}
            model={{
              uri:              "/rocket.glb",
              minimumPixelSize: 64,
              maximumScale:     200_000,
              scale:            modelScale,
              silhouetteColor:  Cesium.Color.ORANGERED.withAlpha(0.5),
              silhouetteSize:   2.0,
              runAnimations:    false,
            }}
            label={{
              text: cameraMode === "first_person"
                ? ""
                : `${(Math.max(0, telemetry!.altitude_m) / 1000).toFixed(1)} km`,
              font:            "bold 13px sans-serif",
              fillColor:       Cesium.Color.WHITE,
              outlineColor:    Cesium.Color.BLACK,
              outlineWidth:    2,
              style:           Cesium.LabelStyle.FILL_AND_OUTLINE,
              pixelOffset:     new Cesium.Cartesian2(0, -56),
              disableDepthTestDistance: Number.POSITIVE_INFINITY,
              showBackground:  true,
              backgroundColor: new Cesium.Color(0, 0, 0, 0.55),
              backgroundPadding: new Cesium.Cartesian2(6, 4),
            }}
          />
        )}

        {/* Flight path trail */}
        {trailPoints && (
          <Entity>
            <PolylineGraphics
              positions={trailPoints}
              width={2.5}
              material={new Cesium.PolylineGlowMaterialProperty({
                glowPower: 0.25,
                color: Cesium.Color.DEEPSKYBLUE.withAlpha(0.85),
              })}
              clampToGround={false}
            />
          </Entity>
        )}

        {/* Launch site red dot */}
        {launchLat !== null && launchLon !== null && (
          <Entity
            position={Cesium.Cartesian3.fromDegrees(launchLon, launchLat)}
            point={{
              pixelSize: 10,
              color: Cesium.Color.RED,
              outlineColor: Cesium.Color.WHITE,
              outlineWidth: 1.5,
              disableDepthTestDistance: Number.POSITIVE_INFINITY,
            }}
            label={{
              text: "Launch Site",
              font: "11px Arial",
              fillColor: Cesium.Color.WHITE,
              outlineColor: Cesium.Color.BLACK,
              outlineWidth: 2,
              style: Cesium.LabelStyle.FILL_AND_OUTLINE,
              pixelOffset: new Cesium.Cartesian2(0, -20),
              disableDepthTestDistance: Number.POSITIVE_INFINITY,
            }}
          />
        )}

        {/* Debris point cloud */}
        {debrisPoints.map((d) => (
          <Entity
            key={d.name}
            position={ecefCart(d.x, d.y, d.z)}
            point={{
              pixelSize: 4,
              color: Cesium.Color.ORANGE.withAlpha(0.55),
              disableDepthTestDistance: Number.POSITIVE_INFINITY,
            }}
          />
        ))}
      </Viewer>

      <style>{`
        @keyframes alertPulse {
          0%,100% { opacity: 1; }
          50%      { opacity: 0; }
        }
      `}</style>
    </div>
  );
}
