import clsx from "clsx";

// A pill whose gap is closing: the product in one mark.
export function Logo({ size = "md" }: { size?: "sm" | "md" }) {
  return (
    <span className={clsx("grid place-items-center rounded-lg bg-gradient-to-br from-teal-400 to-teal-700 shadow-sm shadow-teal-900/40", size === "sm" ? "size-7" : "size-9")}>
      <svg viewBox="0 0 24 24" className={size === "sm" ? "size-4" : "size-5"} fill="none" aria-hidden>
        <rect x="3" y="8" width="8" height="8" rx="4" fill="white" />
        <rect x="13" y="8" width="8" height="8" rx="4" fill="white" fillOpacity="0.55" />
      </svg>
    </span>
  );
}
