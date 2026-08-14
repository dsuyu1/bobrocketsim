import React from "react";

interface Props {
  message: string;
  isConnected: boolean;
}

export default function StatusBar({ message, isConnected }: Props) {
  return (
    <div style={{
      position: "absolute",
      bottom: 0, left: 0, right: 0,
      height: 28,
      background: "#f0f0f0",
      borderTop: "1px solid #999",
      display: "flex",
      alignItems: "center",
      padding: "0 10px",
      gap: 10,
      zIndex: 100,
      fontFamily: "Arial, sans-serif",
      fontSize: 11,
    }}>
      <span style={{
        padding: "1px 6px",
        border: "1px solid #999",
        background: isConnected ? "#d4edda" : "#f8d7da",
        color: isConnected ? "#155724" : "#721c24",
        fontWeight: "bold",
      }}>
        {isConnected ? "LIVE" : "OFFLINE"}
      </span>

      <span style={{ flex: 1, color: "#333", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
        {message}
      </span>

      <span style={{ color: "#666", fontWeight: "bold" }}>RocketSims by Bob</span>
    </div>
  );
}
