// Renders the same calculator glyph as public/icon.svg, for use with
// next/og's ImageResponse (satori) in the PWA icon routes and apple-icon.
// Satori lays out with flexbox only, so every box needs display:"flex".

const INK = "#1e2a22";
const PAPER = "#edf1e4";
const BRASS = "#b8933a";

// public/icon.svg's shapes live on a 0-32 grid. left/top/width/height as
// percentages resolve against the canvas (the containing block), which is
// what we want. border-radius percentages resolve against the element's
// OWN box instead, so those need to be computed as absolute pixels against
// the actual render size passed in.
function pct(value: number): string {
  return `${(value / 32) * 100}%`;
}

const BUTTONS: [x: number, y: number][] = [
  [7, 17],
  [13.5, 17],
  [20, 17],
  [7, 22.75],
  [13.5, 22.75],
  [20, 22.75],
];

export function CalculatorIcon({ size, fullBleed = false }: { size: number; fullBleed?: boolean }) {
  const px = (value: number) => (value / 32) * size;

  return (
    <div style={{ width: "100%", height: "100%", position: "relative", display: "flex" }}>
      <div
        style={{
          position: "absolute",
          left: fullBleed ? "0%" : pct(3),
          top: fullBleed ? "0%" : pct(2),
          width: fullBleed ? "100%" : pct(26),
          height: fullBleed ? "100%" : pct(28),
          borderRadius: fullBleed ? 0 : px(5),
          background: INK,
          display: "flex",
        }}
      />
      <div
        style={{
          position: "absolute",
          left: pct(7),
          top: pct(6),
          width: pct(18),
          height: pct(8),
          borderRadius: px(1.5),
          background: PAPER,
          display: "flex",
        }}
      />
      {BUTTONS.map(([x, y]) => (
        <div
          key={`${x}-${y}`}
          style={{
            position: "absolute",
            left: pct(x),
            top: pct(y),
            width: pct(5),
            height: pct(4.25),
            borderRadius: px(1),
            background: BRASS,
            display: "flex",
          }}
        />
      ))}
    </div>
  );
}
