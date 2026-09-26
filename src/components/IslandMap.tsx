import type { Position } from "../game/types";
import { WORLD_ENTITIES } from "../game/world";

export default function IslandMap({
  player,
  onSelect,
  large = false,
}: {
  player: Position;
  onSelect?: (x: number, z: number) => void;
  large?: boolean;
}) {
  const mx = (x: number) => 100 + x * 5,
    mz = (z: number) => 86 + z * 4.6;
  const land = (scale: number) =>
    Array.from({ length: 88 }, (_, i) => {
      const a = (i / 88) * Math.PI * 2;
      const r =
        1 + Math.sin(a * 3 + 0.8) * 0.055 + Math.sin(a * 7 - 0.3) * 0.025;
      return `${i ? "L" : "M"}${mx(Math.cos(a) * 17.2 * r * scale)},${mz(Math.sin(a) * 13.8 * r * scale - 0.8)}`;
    }).join(" ") + " Z";
  const trace = (points: number[][]) =>
    points.map(([x, z], i) => `${i ? "L" : "M"}${mx(x)},${mz(z)}`).join(" ");
  const river = [
    [-1.7, -13],
    [-1.2, -10.1],
    [2, -8.4],
    [5.7, -7],
    [6.8, -4.5],
    [7.2, -1.6],
    [9, 0.5],
    [12.1, 1.5],
    [16, 4.2],
  ];
  return (
    <svg
      className={large ? "island-map large" : "island-map"}
      viewBox="0 0 200 176"
      role="img"
      aria-label="Island map. Select a spot to walk there."
      onClick={
        onSelect
          ? (event) => {
              const r = event.currentTarget.getBoundingClientRect();
              const scale = Math.min(r.width / 200, r.height / 176);
              const x =
                (event.clientX - r.left - (r.width - 200 * scale) / 2) / scale;
              const y =
                (event.clientY - r.top - (r.height - 176 * scale) / 2) / scale;
              onSelect((x - 100) / 5, (y - 86) / 4.6);
            }
          : undefined
      }
    >
      <defs>
        <pattern
          id={large ? "water-big" : "water-small"}
          width="22"
          height="20"
          patternUnits="userSpaceOnUse"
        >
          <path
            d="M3 10q3 2 6 0"
            fill="none"
            stroke="#acd8d3"
            strokeWidth="1"
          />
        </pattern>
      </defs>
      <rect width="200" height="176" rx="20" fill="#c3e2dd" />
      <rect
        width="200"
        height="176"
        fill={`url(#${large ? "water-big" : "water-small"})`}
      />
      <path d={land(1.06)} fill="#d5e6cd" />
      <path d={land(1)} fill="#f0dcaf" />
      <path d={land(0.885)} fill="#97b77c" />
      <path
        d={trace(river)}
        fill="none"
        stroke="#abd9d2"
        strokeWidth="10"
        strokeLinejoin="round"
      />
      <path
        d={trace([
          [-5.1, -6],
          [-5, -2],
          [-3, 0.3],
          [-0.7, 2],
          [1.1, 5.5],
          [1.1, 10.7],
        ])}
        fill="none"
        stroke="#e2cd9d"
        strokeWidth="6"
        strokeLinejoin="round"
      />
      <path
        d={trace([
          [-10.2, 2],
          [-6.7, 2],
          [-3.8, 1.2],
          [-0.7, 2],
          [3, 0.1],
          [5.3, -3.4],
          [8.8, -3.4],
          [11.3, -4.2],
        ])}
        fill="none"
        stroke="#e2cd9d"
        strokeWidth="6"
        strokeLinejoin="round"
      />
      <rect
        x={mx(5)}
        y={mz(-4.2)}
        width="18"
        height="8"
        rx="1"
        fill="#b58c63"
      />
      <rect
        x={mx(0.1)}
        y={mz(11.2)}
        width="10"
        height="20"
        rx="1"
        fill="#b58c63"
      />
      {WORLD_ENTITIES.filter((e) =>
        ["tree", "home", "shop", "villager", "rock"].includes(e.kind),
      ).map((e) => (
        <g key={e.id} transform={`translate(${mx(e.x)} ${mz(e.z)})`}>
          {e.kind === "tree" ? (
            <>
              <circle r="6" fill="#6c9864" />
              <circle cx="-1" cy="-2" r="4" fill="#7da96d" />
              <circle cx="3" cy="1" r="1.2" fill="#e8a081" />
            </>
          ) : e.kind === "home" ? (
            <>
              <path d="m-8-1 8-7 8 7v9H-8Z" fill="#f4e7c2" />
              <path
                d="m-10-1 10-9 10 9"
                stroke="#c78665"
                strokeWidth="3.5"
                strokeLinejoin="round"
              />
            </>
          ) : e.kind === "shop" ? (
            <>
              <rect
                x="-7"
                y="-4"
                width="14"
                height="11"
                rx="2"
                fill="#eee0b9"
              />
              <path d="M-8-2H8L6-7H-6Z" fill="#d39b71" />
            </>
          ) : e.kind === "rock" ? (
            <ellipse rx="3" ry="2.5" fill="#9ca68c" />
          ) : (
            <circle r="2" fill="#f5e9bd" stroke="#91a676" strokeWidth="1" />
          )}
        </g>
      ))}
      <circle
        cx={mx(player.x)}
        cy={mz(player.z)}
        r="6"
        fill="#fff9ed"
        opacity=".5"
      />
      <circle
        cx={mx(player.x)}
        cy={mz(player.z)}
        r="3.5"
        fill="#d47c55"
        stroke="#fff9ed"
        strokeWidth="1.5"
      />
      <text x="182" y="21" fontSize="8" fontFamily="sans-serif" fill="#628f87">
        N
      </text>
      <path d="m183 27-2 5h4Z" fill="#628f87" />
    </svg>
  );
}
