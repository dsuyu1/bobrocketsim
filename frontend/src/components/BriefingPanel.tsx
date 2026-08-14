import React from "react";

interface Props {
  text: string;
  onClose: () => void;
}

export default function BriefingPanel({ text, onClose }: Props) {
  return (
    <div
      style={{
        position: "absolute", inset: 0, zIndex: 200,
        background: "rgba(255,255,255,0.88)",
        display: "flex", alignItems: "center", justifyContent: "center",
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: "#fff",
          border: "1px solid #999",
          padding: "24px 28px",
          maxWidth: 560, width: "90vw",
          fontFamily: "Arial, sans-serif",
        }}
        onClick={e => e.stopPropagation()}
      >
        <div style={{ borderBottom: "1px solid #ccc", paddingBottom: 10, marginBottom: 16, display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
          <strong style={{ fontSize: 14 }}>AI Mission Briefing</strong>
          <span style={{ fontSize: 11, color: "#666" }}>IBM Granite / RocketSims by Bob</span>
        </div>

        <div
          style={{ fontSize: 13, color: "#222", lineHeight: 1.7, whiteSpace: "pre-wrap", wordBreak: "break-word", marginBottom: 20 }}
          dangerouslySetInnerHTML={{
            __html: text
              .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
              .replace(/\n/g, "<br/>"),
          }}
        />

        <button
          onClick={onClose}
          style={{
            padding: "7px 20px",
            background: "#fff", border: "1px solid #999",
            fontSize: 12, cursor: "pointer",
          }}
        >
          Close
        </button>
      </div>
    </div>
  );
}
