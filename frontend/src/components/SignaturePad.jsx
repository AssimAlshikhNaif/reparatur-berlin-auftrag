import React, { useRef, useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { Eraser, Check, PencilSimple } from "@phosphor-icons/react";

/**
 * Canvas-based digital signature pad (no external dependency).
 * Supports mouse and touch. Calls onSave(dataUrl) when the user confirms.
 */
export default function SignaturePad({ onSave, saving = false, height = 180, label }) {
  const { t } = useTranslation();
  const canvasRef = useRef(null);
  const drawing = useRef(false);
  const last = useRef({ x: 0, y: 0 });
  const [hasDrawn, setHasDrawn] = useState(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ratio = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * ratio;
    canvas.height = height * ratio;
    const ctx = canvas.getContext("2d");
    ctx.scale(ratio, ratio);
    ctx.lineWidth = 2.2;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.strokeStyle = "#111827";
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, rect.width, height);
  }, [height]);

  const pos = (e) => {
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const touch = e.touches && e.touches[0];
    const clientX = touch ? touch.clientX : e.clientX;
    const clientY = touch ? touch.clientY : e.clientY;
    return { x: clientX - rect.left, y: clientY - rect.top };
  };

  const start = (e) => {
    e.preventDefault();
    drawing.current = true;
    last.current = pos(e);
  };

  const move = (e) => {
    if (!drawing.current) return;
    e.preventDefault();
    const ctx = canvasRef.current.getContext("2d");
    const p = pos(e);
    ctx.beginPath();
    ctx.moveTo(last.current.x, last.current.y);
    ctx.lineTo(p.x, p.y);
    ctx.stroke();
    last.current = p;
    if (!hasDrawn) setHasDrawn(true);
  };

  const end = () => { drawing.current = false; };

  const clear = () => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    const rect = canvas.getBoundingClientRect();
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, rect.width, height);
    setHasDrawn(false);
  };

  const save = () => {
    if (!hasDrawn) return;
    const dataUrl = canvasRef.current.toDataURL("image/png");
    onSave && onSave(dataUrl);
  };

  return (
    <div className="space-y-2" data-testid="signature-pad">
      <div className="flex items-center gap-2 text-[11px] font-mono uppercase tracking-wider text-muted-foreground">
        <PencilSimple size={13} /> {label || t("sig.defaultLabel")}
      </div>
      <div className="border border-border rounded-lg overflow-hidden bg-white">
        <canvas
          ref={canvasRef}
          data-testid="signature-canvas"
          style={{ width: "100%", height: `${height}px`, touchAction: "none", cursor: "crosshair", display: "block" }}
          onMouseDown={start}
          onMouseMove={move}
          onMouseUp={end}
          onMouseLeave={end}
          onTouchStart={start}
          onTouchMove={move}
          onTouchEnd={end}
        />
      </div>
      <div className="flex gap-2">
        <button type="button" data-testid="signature-clear" onClick={clear}
          className="flex items-center gap-1.5 text-xs font-mono uppercase tracking-wider border border-border px-3 py-1.5 rounded-lg text-muted-foreground hover:bg-muted transition-colors">
          <Eraser size={13} /> {t("sig.clear")}
        </button>
        <button type="button" data-testid="signature-save" onClick={save} disabled={!hasDrawn || saving}
          className="flex items-center gap-1.5 text-xs font-head font-semibold uppercase tracking-wider bg-primary text-primary-foreground px-4 py-1.5 rounded-lg hover:bg-blue-600 transition-colors disabled:opacity-40 disabled:cursor-not-allowed">
          <Check size={13} /> {saving ? t("sig.saving") : t("sig.confirm")}
        </button>
      </div>
    </div>
  );
}
