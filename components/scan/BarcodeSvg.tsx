import { code128Modules } from "@/lib/barcode/code128";

/** Inline SVG Code 128 barcode (server/client safe: no DOM, no clock, no random). */
export function BarcodeSvg({
  value,
  height = 48,
  moduleWidth = 1.6,
  showText = true,
  className = "",
}: {
  value: string;
  height?: number;
  moduleWidth?: number;
  showText?: boolean;
  className?: string;
}) {
  const modules = code128Modules(value);
  const quiet = 10;
  const total = modules.length + quiet * 2;
  const bars: { x: number; w: number }[] = [];
  let i = 0;
  while (i < modules.length) {
    if (modules[i] === "1") {
      let j = i;
      while (j < modules.length && modules[j] === "1") j++;
      bars.push({ x: i + quiet, w: j - i });
      i = j;
    } else i++;
  }
  const textH = showText ? 16 : 0;
  return (
    <svg
      role="img"
      aria-label={`Barcode ${value}`}
      width={total * moduleWidth}
      height={height + textH}
      viewBox={`0 0 ${total} ${height + textH}`}
      preserveAspectRatio="none"
      className={className}
    >
      <rect width={total} height={height + textH} fill="#fff" />
      {bars.map((b) => (
        <rect key={b.x} x={b.x} y={0} width={b.w} height={height} fill="#000" />
      ))}
      {showText ? (
        <text
          x={total / 2}
          y={height + 12}
          textAnchor="middle"
          fontFamily="monospace"
          fontSize={9}
          fill="#000"
        >
          {value}
        </text>
      ) : null}
    </svg>
  );
}
