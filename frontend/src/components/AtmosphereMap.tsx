import React, { useMemo } from "react";

interface Props {
  altitude_m: number;
  target_alt_m: number;
  speed_m_s: number;
  thrust_N: number;
}

const LAYERS = [
  { name: "TROPOSPHERE",  topKm:  12, color: "#1a3a6b", textColor: "#93c5fd" },
  { name: "STRATOSPHERE", topKm:  50, color: "#0e2a52", textColor: "#7dd3fc" },
  { name: "MESOSPHERE",   topKm:  80, color: "#081e3f", textColor: "#60a5fa" },
  { name: "THERMOSPHERE", topKm: 120, color: "#050f26", textColor: "#3b82f6" },
  { name: "EXOSPHERE",    topKm: 600, color: "#020810", textColor: "#2563eb" },
];

const MARKERS = [
  { km: 10,  label: "Cruising altitude" },
  { km: 12,  label: "Tropopause" },
  { km: 36,  label: "Max-Q zone (typ.)" },
  { km: 50,  label: "Stratopause" },
  { km: 80,  label: "Mesopause" },
  { km: 100, label: "Kármán line" },
  { km: 120, label: "Thermosphere entry" },
  { km: 200, label: "LEO (200 km)" },
  { km: 400, label: "ISS orbit" },
  { km: 600, label: "GTO injection" },
];

const WIDTH  = 160;
const HEIGHT = 340;
const BAR_X  = 40;
const BAR_W  = 80;
const ROCKET_X = BAR_X + BAR_W / 2;

function altToY(altKm: number, viewCentreKm: number, kmPerPx: number): number {
  return HEIGHT / 2 - (altKm - viewCentreKm) / kmPerPx;
}

function PixelRocket({ cx, cy, thrusting }: { cx: number; cy: number; thrusting: boolean }) {
  const S = 3;
  const pixels: [number, number, number][] = [
    [3, 0, 1], [4, 0, 1],
    [2, 1, 1], [3, 1, 1], [4, 1, 1], [5, 1, 1],
    [2, 2, 1], [3, 2, 2], [4, 2, 2], [5, 2, 1],
    [2, 3, 1], [3, 3, 1], [4, 3, 1], [5, 3, 1],
    [2, 4, 1], [3, 4, 1], [4, 4, 1], [5, 4, 1],
    [2, 5, 1], [3, 5, 1], [4, 5, 1], [5, 5, 1],
    [1, 6, 3], [2, 6, 1], [3, 6, 1], [4, 6, 1], [5, 6, 1], [6, 6, 3],
    [1, 7, 3], [2, 7, 1], [3, 7, 1], [4, 7, 1], [5, 7, 1], [6, 7, 3],
    [2, 8, 3], [3, 8, 1], [4, 8, 1], [5, 8, 3],
  ];
  const flames: [number, number, number][] = thrusting ? [
    [3, 9, 4], [4, 9, 4],
    [2, 10, 5], [3, 10, 4], [4, 10, 4], [5, 10, 5],
    [3, 11, 5], [4, 11, 5],
    [3, 12, 4], [4, 12, 4],
  ] : [];

  const colors: Record<number, string> = { 1: "#e2e8f0", 2: "#38bdf8", 3: "#64748b", 4: "#f97316", 5: "#fbbf24" };
  const totalH = 13;
  const offsetY = cy - (totalH * S) / 2;
  const offsetX = cx - (7 * S) / 2;

  return (
    <g>
      {[...pixels, ...flames].map(([col, row, color], i) => (
        <rect key={i} x={offsetX + col * S} y={offsetY + row * S} width={S} height={S} fill={colors[color]} />
      ))}
    </g>
  );
}

export default function AtmosphereMap({ altitude_m, target_alt_m, speed_m_s, thrust_N }: Props) {
  const altKm    = Math.max(0, altitude_m / 1000);
  const targetKm = target_alt_m / 1000;
  const thrusting = thrust_N > 1000;

  // Scale is fixed by mission target so layers have consistent proportions,
  // but the view window centres on the rocket so it never leaves the panel.
  const kmPerPx      = useMemo(() => Math.max(targetKm * 1.15, 20) / HEIGHT, [targetKm]);
  const viewCentreKm = altKm;
  const viewTopKm    = viewCentreKm + (HEIGHT / 2) * kmPerPx;
  const viewBottomKm = viewCentreKm - (HEIGHT / 2) * kmPerPx;

  const rocketY = altToY(altKm, viewCentreKm, kmPerPx);

  const layerRects = useMemo(() => {
    const rects: { y: number; h: number; color: string }[] = [];
    let layerBottomKm = 0;
    for (const layer of LAYERS) {
      const layerTopKm = layer.topKm;
      const yTop    = altToY(layerTopKm,    viewCentreKm, kmPerPx);
      const yBottom = altToY(layerBottomKm, viewCentreKm, kmPerPx);
      const y = Math.max(0, Math.min(HEIGHT, yTop));
      const h = Math.min(HEIGHT, yBottom) - y;
      if (h > 0) rects.push({ y, h, color: layer.color });
      layerBottomKm = layerTopKm;
      if (layerBottomKm > viewTopKm) break;
    }
    return rects;
  }, [viewCentreKm, kmPerPx]);

  const visibleMarkers = MARKERS.filter(m => m.km >= viewBottomKm - 5 && m.km <= viewTopKm + 5);
  const targetY = altToY(targetKm, viewCentreKm, kmPerPx);
  const showTarget = targetY >= 0 && targetY <= HEIGHT;

  return (
    <div style={{
      position: "absolute",
      top: 16,
      right: 16,
      width: WIDTH,
      background: "#fff",
      border: "1px solid #999",
      overflow: "hidden",
      fontFamily: "Arial, sans-serif",
      zIndex: 100,
    }}>
      {/* Header */}
      <div style={{
        padding: "4px 8px",
        borderBottom: "1px solid #999",
        fontSize: 11, fontWeight: "bold",
        display: "flex", justifyContent: "space-between", alignItems: "center",
        background: "#f0f0f0",
      }}>
        <span>Altitude</span>
        <span style={{ fontVariantNumeric: "tabular-nums" }}>
          {altKm >= 1 ? `${altKm.toFixed(1)} km` : `${(altitude_m).toFixed(0)} m`}
        </span>
      </div>

      <svg width={WIDTH} height={HEIGHT} style={{ display: "block" }}>
        <rect width={WIDTH} height={HEIGHT} fill="#020810" />

        {altKm > 60 && [
          [10,20],[25,45],[130,15],[115,80],[20,100],[140,130],
          [8,180],[35,200],[120,220],[150,170],[45,270],[100,300],
        ].map(([sx,sy],i) => (
          <circle key={i} cx={sx} cy={sy} r={0.8} fill="#ffffff88" />
        ))}

        {layerRects.map((r, i) => (
          <rect key={i} x={BAR_X} y={r.y} width={BAR_W} height={r.h + 1} fill={r.color} />
        ))}

        {viewBottomKm < 0 && (
          <rect x={BAR_X} y={altToY(0, viewCentreKm, kmPerPx)} width={BAR_W} height={HEIGHT} fill="#2d4a1e" />
        )}

        {LAYERS.map((layer, i) => {
          const y = altToY(layer.topKm, viewCentreKm, kmPerPx);
          if (y < 0 || y > HEIGHT) return null;
          const prevTop = i === 0 ? 0 : LAYERS[i - 1].topKm;
          const bandCentreY = altToY((layer.topKm + prevTop) / 2, viewCentreKm, kmPerPx);
          return (
            <g key={layer.name}>
              <line x1={BAR_X} y1={y} x2={BAR_X + BAR_W} y2={y} stroke="#ffffff22" strokeWidth={0.8} strokeDasharray="3,2" />
              {bandCentreY >= 0 && bandCentreY <= HEIGHT && (
                <text x={BAR_X + BAR_W / 2} y={bandCentreY} textAnchor="middle" dominantBaseline="middle"
                  fontSize={6} fill={layer.textColor} fontWeight="bold" letterSpacing={0.8}
                  style={{ fontFamily: "Arial, sans-serif" }}>
                  {layer.name}
                </text>
              )}
            </g>
          );
        })}

        {visibleMarkers.map(m => {
          const y = altToY(m.km, viewCentreKm, kmPerPx);
          if (y < 4 || y > HEIGHT - 4) return null;
          return (
            <g key={m.km}>
              <line x1={BAR_X + BAR_W} y1={y} x2={BAR_X + BAR_W + 5} y2={y} stroke="#4a6080" strokeWidth={0.8} />
              <text x={BAR_X + BAR_W + 7} y={y} dominantBaseline="middle" fontSize={6.5} fill="#4a6080"
                style={{ fontFamily: "Arial, sans-serif" }}>
                {m.km} km
              </text>
            </g>
          );
        })}

        {[...Array(Math.ceil((viewTopKm - viewBottomKm) / (kmPerPx * 30)) + 1)].map((_, i) => {
          const tickKm = Math.round((viewBottomKm + i * kmPerPx * 30) / 10) * 10;
          if (tickKm < 0 || tickKm > 700) return null;
          const y = altToY(tickKm, viewCentreKm, kmPerPx);
          if (y < 0 || y > HEIGHT) return null;
          return (
            <g key={tickKm}>
              <line x1={BAR_X - 4} y1={y} x2={BAR_X} y2={y} stroke="#2a3f5f" strokeWidth={0.8} />
              <text x={BAR_X - 6} y={y} textAnchor="end" dominantBaseline="middle" fontSize={6} fill="#2a3f5f"
                style={{ fontFamily: "Arial, sans-serif" }}>
                {tickKm}
              </text>
            </g>
          );
        })}

        {showTarget && (
          <g>
            <line x1={BAR_X} y1={targetY} x2={BAR_X + BAR_W} y2={targetY} stroke="#34d39966" strokeWidth={1} strokeDasharray="4,3" />
            <text x={BAR_X + 2} y={targetY - 3} fontSize={6} fill="#34d39999" style={{ fontFamily: "Arial, sans-serif" }}>
              TARGET
            </text>
          </g>
        )}

        <rect x={BAR_X} y={0} width={BAR_W} height={HEIGHT} fill="none" stroke="#2a3f5f88" strokeWidth={0.8} />
        <PixelRocket cx={ROCKET_X} cy={rocketY} thrusting={thrusting} />

        <text x={ROCKET_X} y={rocketY + 30} textAnchor="middle" fontSize={7} fill="#94a3b8"
          style={{ fontFamily: "Arial, sans-serif" }}>
          {(speed_m_s / 1000).toFixed(2)} km/s
        </text>
      </svg>

      {/* Footer */}
      <div style={{
        padding: "3px 8px",
        borderTop: "1px solid #999",
        fontSize: 9, color: "#555",
        textAlign: "center",
        background: "#f0f0f0",
      }}>
        {altKm < 12  ? "TROPOSPHERE" :
         altKm < 50  ? "STRATOSPHERE" :
         altKm < 80  ? "MESOSPHERE" :
         altKm < 120 ? "THERMOSPHERE" :
                       "EXOSPHERE / SPACE"}
      </div>
    </div>
  );
}
