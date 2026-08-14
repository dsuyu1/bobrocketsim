import React from "react";
import type { CameraMode } from "./GlobeView";

interface Props {
  mode: CameraMode;
  onChange: (m: CameraMode) => void;
  disabled?: boolean;
}

export default function CameraToggle({ mode, onChange, disabled }: Props) {
  const btn = (id: CameraMode, label: string) => (
    <button
      onClick={() => onChange(id)}
      disabled={disabled}
      style={{
        padding: "5px 14px",
        border: "1px solid #999",
        borderRight: id === "third_person" ? "none" : "1px solid #999",
        background: mode === id ? "#000" : "#fff",
        color: mode === id ? "#fff" : "#000",
        fontSize: 11,
        fontWeight: mode === id ? "bold" : "normal",
        cursor: disabled ? "not-allowed" : "pointer",
        opacity: disabled ? 0.5 : 1,
        fontFamily: "Arial, sans-serif",
      }}
    >
      {label}
    </button>
  );

  return (
    <div style={{
      position: "absolute", top: 10, left: "50%",
      transform: "translateX(-50%)",
      display: "flex",
      zIndex: 110,
    }}>
      {btn("third_person", "3rd Person")}
      {btn("first_person", "Cockpit")}
    </div>
  );
}
