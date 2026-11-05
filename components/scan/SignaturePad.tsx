"use client";

import { useEffect, useRef, useState } from "react";
import { useT } from "@/lib/i18n/useT";
import { Button } from "../ui/Button";

/**
 * Pointer-event signature canvas. `onChange` receives a downscaled PNG data URL
 * (about 5-10 KB) or null when cleared.
 */
export function SignaturePad({
  onChange,
  disabled = false,
}: {
  onChange: (dataUrl: string | null) => void;
  disabled?: boolean;
}) {
  const { tr } = useT();
  const ref = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);
  const [empty, setEmpty] = useState(true);

  useEffect(() => {
    const c = ref.current;
    if (!c) return;
    const ctx = c.getContext("2d");
    if (!ctx) return;
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, c.width, c.height);
    ctx.lineWidth = 3;
    ctx.lineCap = "round";
    ctx.strokeStyle = "#171717";
  }, []);

  const pos = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const c = ref.current!;
    const r = c.getBoundingClientRect();
    return {
      x: ((e.clientX - r.left) / r.width) * c.width,
      y: ((e.clientY - r.top) / r.height) * c.height,
    };
  };

  const down = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (disabled) return;
    const ctx = ref.current!.getContext("2d")!;
    drawing.current = true;
    ref.current!.setPointerCapture(e.pointerId);
    const p = pos(e);
    ctx.beginPath();
    ctx.moveTo(p.x, p.y);
  };
  const move = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!drawing.current) return;
    const ctx = ref.current!.getContext("2d")!;
    const p = pos(e);
    ctx.lineTo(p.x, p.y);
    ctx.stroke();
  };
  const up = () => {
    if (!drawing.current) return;
    drawing.current = false;
    setEmpty(false);
    // downscale to keep the stored signature small
    const src = ref.current!;
    const out = document.createElement("canvas");
    out.width = 300;
    out.height = 100;
    const octx = out.getContext("2d")!;
    octx.fillStyle = "#fff";
    octx.fillRect(0, 0, out.width, out.height);
    octx.drawImage(src, 0, 0, out.width, out.height);
    onChange(out.toDataURL("image/png"));
  };

  const clear = () => {
    const c = ref.current!;
    const ctx = c.getContext("2d")!;
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, c.width, c.height);
    setEmpty(true);
    onChange(null);
  };

  return (
    <div>
      <canvas
        ref={ref}
        width={900}
        height={300}
        aria-label={tr("ช่องเซ็นชื่อ", "Signature pad")}
        onPointerDown={down}
        onPointerMove={move}
        onPointerUp={up}
        onPointerLeave={up}
        className={`h-40 w-full touch-none rounded-control border-2 border-dashed border-muted bg-white ${
          disabled ? "opacity-50" : "cursor-crosshair"
        }`}
      />
      <div className="mt-2 flex items-center justify-between text-xs text-muted">
        <span>{empty ? tr("เซ็นชื่อในกรอบด้านบน", "Sign in the box above") : tr("เซ็นแล้ว", "Signed")}</span>
        <Button variant="secondary" size="sm" onClick={clear} disabled={disabled || empty}>
          {tr("ล้างลายเซ็น", "Clear")}
        </Button>
      </div>
    </div>
  );
}
