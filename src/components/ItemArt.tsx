import type { ItemId } from "../game/types";

export default function ItemArt({
  item,
  className = "",
}: {
  item: ItemId | string;
  className?: string;
}) {
  return (
    <svg
      className={`item-art ${className}`}
      viewBox="0 0 80 80"
      fill="none"
      aria-hidden="true"
    >
      <ellipse cx="40" cy="67" rx="23" ry="5" fill="#665936" opacity=".1" />
      {item === "peach" ? (
        <>
          <path
            d="M40 24C17 12 7 34 15 53c7 17 20 17 25 14 8 5 25-1 28-16 5-22-11-34-28-27Z"
            fill="#f19b83"
          />
          <path
            d="M39 27c-9 11-9 26-2 36"
            stroke="#dc7b69"
            strokeWidth="3"
            strokeLinecap="round"
          />
          <path
            d="M39 25c-1-9 4-14 8-18"
            stroke="#86704c"
            strokeWidth="4"
            strokeLinecap="round"
          />
          <path d="M45 17C50 4 64 11 67 9c-1 12-14 18-22 8Z" fill="#80aa63" />
          <ellipse
            cx="25"
            cy="35"
            rx="6"
            ry="9"
            fill="#ffd0b4"
            transform="rotate(28 25 35)"
          />
        </>
      ) : item === "wood" ? (
        <>
          <path d="m17 33 34-13 16 29-34 15Z" fill="#ac7950" />
          <path d="m17 34 17 29c-11 9-28-16-17-29Z" fill="#e9c78d" />
          <ellipse
            cx="24"
            cy="49"
            rx="6"
            ry="13"
            transform="rotate(-25 24 49)"
            stroke="#b68a52"
            strokeWidth="2"
          />
          <path
            d="m31 36 27-10m-19 29 23-9"
            stroke="#835b3a"
            strokeWidth="3"
            strokeLinecap="round"
          />
          <path d="m50 35 1-16 8-3 1 14" fill="#b98555" />
          <ellipse cx="55" cy="18" rx="5" ry="3" fill="#e7c183" />
        </>
      ) : item === "stone" ? (
        <>
          <path d="m11 49 10-25 23-9 23 20 3 22-25 12-26-6Z" fill="#a2afa4" />
          <path d="m21 24 23-9 8 30-41 4Z" fill="#c6d0ba" />
          <path d="m52 45 15-10 3 22-25 12Z" fill="#829b93" />
          <path d="m11 49 41-4-7 24-26-6Z" fill="#aab9ab" />
        </>
      ) : item === "shell" ? (
        <>
          <path
            d="M38 65C18 61 4 49 10 29c4-14 13-15 20-9 6-12 17-12 23 0 12-4 19 6 19 18 0 14-12 24-30 27Z"
            fill="#efcfc4"
          />
          <path
            d="m38 60-18-34m20 34-3-40m5 40 12-32m-11 33 20-20"
            stroke="#cfaa9e"
            strokeWidth="3"
            strokeLinecap="round"
          />
          <path d="M30 61h22l-2 8H32Z" fill="#d6b4a5" />
        </>
      ) : item === "fish" ? (
        <>
          <path d="m18 39-12-13 2 29 13-10" fill="#69a59d" />
          <path d="M16 41C26 20 54 14 71 37c-9 24-42 29-55 4Z" fill="#86beb2" />
          <path d="M32 29 38 13l15 9" fill="#60928b" />
          <path d="m37 54 9 11 9-16" fill="#60928b" />
          <path d="M53 26q-10 15 2 24" stroke="#4f8c83" strokeWidth="2.5" />
          <circle cx="61" cy="35" r="3" fill="#344f46" />
          <circle cx="62" cy="34" r="1" fill="#fff9dd" />
          <path
            d="m26 36 13-6m-11 17 14-4"
            stroke="#a9dac2"
            strokeWidth="3"
            strokeLinecap="round"
          />
        </>
      ) : item === "butterfly" ? (
        <>
          <path
            d="M37 37C14-2-4 28 23 42 2 53 25 74 38 45M43 37C66-2 84 28 57 42c21 11-2 32-15 3"
            fill="#ddbe6f"
          />
          <path
            d="M35 36C15 5 4 28 26 36m20 0C66 5 76 28 54 36"
            fill="#f9dfa0"
          />
          <path
            d="M40 27v31m-2-32-7-9m12 9 7-9"
            stroke="#6c6250"
            strokeWidth="4"
            strokeLinecap="round"
          />
          <circle cx="25" cy="51" r="4" fill="#c08a61" />
          <circle cx="55" cy="51" r="4" fill="#c08a61" />
        </>
      ) : item === "flower" ? (
        <>
          <path
            d="M39 63V36"
            stroke="#789b57"
            strokeWidth="5"
            strokeLinecap="round"
          />
          <path
            d="M38 53C22 55 19 43 22 40c11-1 18 5 16 13Zm4 3C58 58 61 46 58 43c-11-1-18 5-16 13Z"
            fill="#8db566"
          />
          {[
            [40, 15],
            [56, 26],
            [50, 44],
            [29, 43],
            [23, 25],
          ].map(([x, y], i) => (
            <ellipse key={i} cx={x} cy={y} rx="11" ry="12" fill="#f2beae" />
          ))}
          <circle cx="40" cy="30" r="10" fill="#e2b75c" />
          <circle cx="38" cy="28" r="4" fill="#f4d994" />
        </>
      ) : (
        <>
          <path
            d="M17 52C11 27 38 16 64 15c3 27-12 47-35 41L47 29Z"
            fill="#72a778"
          />
          <path
            d="m21 66 27-36"
            stroke="#72a778"
            strokeWidth="5"
            strokeLinecap="round"
          />
        </>
      )}
    </svg>
  );
}
