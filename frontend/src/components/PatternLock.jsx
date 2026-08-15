import { useRef, useState, useCallback } from "react";

// 3x3 unlock-pattern drawer. Dots are numbered 1..9 (top-left to bottom-right).
// Emits the drawn sequence as a dash-joined string, e.g. "1-2-3-6-9".
// Works via drag (pointer) and tap-to-connect (click) so it's easy to use and test.

const DOTS = [1, 2, 3, 4, 5, 6, 7, 8, 9];
const SIZE = 220;
const PAD = 34;
const STEP = (SIZE - PAD * 2) / 2;

function dotCenter(n) {
  const idx = n - 1;
  const row = Math.floor(idx / 3);
  const col = idx % 3;
  return { x: PAD + col * STEP, y: PAD + row * STEP };
}

export function PatternDisplay({ value, size = 120 }) {
  const seq = (value || "").split("-").filter(Boolean).map(Number);
  const scale = size / SIZE;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${SIZE} ${SIZE}`} className="bg-white rounded-lg border border-border" data-testid="pattern-display">
      {seq.map((n, i) => {
        if (i === 0) return null;
        const a = dotCenter(seq[i - 1]);
        const b = dotCenter(n);
        return <line key={i} x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke="#2563eb" strokeWidth={4} strokeLinecap="round" />;
      })}
      {DOTS.map((n) => {
        const c = dotCenter(n);
        const active = seq.includes(n);
        return <circle key={n} cx={c.x} cy={c.y} r={active ? 9 : 6} fill={active ? "#2563eb" : "#cbd5e1"} />;
      })}
    </svg>
  );
}

export default function PatternLock({ value, onChange }) {
  const [seq, setSeq] = useState(() => (value || "").split("-").filter(Boolean).map(Number));
  const [drawing, setDrawing] = useState(false);
  const svgRef = useRef(null);

  const commit = useCallback((next) => {
    setSeq(next);
    onChange && onChange(next.join("-"));
  }, [onChange]);

  const addDot = (n) => {
    setSeq((prev) => {
      if (prev.includes(n)) return prev;
      const next = [...prev, n];
      onChange && onChange(next.join("-"));
      return next;
    });
  };

  const pointFromEvent = (e) => {
    const svg = svgRef.current;
    if (!svg) return null;
    const rect = svg.getBoundingClientRect();
    const cx = ((e.touches ? e.touches[0].clientX : e.clientX) - rect.left) * (SIZE / rect.width);
    const cy = ((e.touches ? e.touches[0].clientY : e.clientY) - rect.top) * (SIZE / rect.height);
    for (const n of DOTS) {
      const c = dotCenter(n);
      if (Math.hypot(c.x - cx, c.y - cy) < 26) return n;
    }
    return null;
  };

  const onDown = (e) => { setDrawing(true); const n = pointFromEvent(e); if (n) addDot(n); };
  const onMove = (e) => { if (!drawing) return; const n = pointFromEvent(e); if (n) addDot(n); };
  const onUp = () => setDrawing(false);
  const reset = () => commit([]);

  return (
    <div className="inline-flex flex-col items-center gap-2" data-testid="pattern-lock">
      <svg
        ref={svgRef}
        width={SIZE}
        height={SIZE}
        viewBox={`0 0 ${SIZE} ${SIZE}`}
        className="bg-white rounded-lg border border-border touch-none cursor-pointer select-none"
        onMouseDown={onDown}
        onMouseMove={onMove}
        onMouseUp={onUp}
        onMouseLeave={onUp}
        onTouchStart={onDown}
        onTouchMove={onMove}
        onTouchEnd={onUp}
      >
        {seq.map((n, i) => {
          if (i === 0) return null;
          const a = dotCenter(seq[i - 1]);
          const b = dotCenter(n);
          return <line key={i} x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke="#2563eb" strokeWidth={5} strokeLinecap="round" />;
        })}
        {DOTS.map((n) => {
          const c = dotCenter(n);
          const active = seq.includes(n);
          return (
            <g key={n} onClick={() => addDot(n)} data-testid={`pattern-dot-${n}`} style={{ cursor: "pointer" }}>
              <circle cx={c.x} cy={c.y} r={22} fill="transparent" />
              <circle cx={c.x} cy={c.y} r={active ? 12 : 8} fill={active ? "#2563eb" : "#cbd5e1"} />
              {active && <text x={c.x} y={c.y + 4} textAnchor="middle" fontSize="11" fill="#fff">{seq.indexOf(n) + 1}</text>}
            </g>
          );
        })}
      </svg>
      <div className="flex items-center gap-3">
        <span className="font-mono text-xs text-muted-foreground" data-testid="pattern-sequence">
          {seq.length ? seq.join(" → ") : "Muster zeichnen…"}
        </span>
        <button type="button" data-testid="pattern-reset" onClick={reset}
          className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground hover:text-foreground underline">
          Zurücksetzen
        </button>
      </div>
    </div>
  );
}
