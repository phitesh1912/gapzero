// Dark hero backdrop: dot grid over a teal/cyan horizon glow, with a heartbeat trace along it.
export function Aurora() {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden bg-black" aria-hidden>
      <div className="gz-aurora" />
      <div className="gz-dome" />
      <div className="gz-floor" />
      <div className="gz-dots" />
      <svg className="absolute inset-x-0 bottom-[4%] h-16 w-full" viewBox="0 0 1600 100" preserveAspectRatio="none" fill="none">
        {["gz-ecg-base", "gz-ecg-pulse"].map((cls) => (
          <path
            key={cls}
            className={cls}
            strokeWidth="1.5"
            vectorEffect="non-scaling-stroke"
            d="M0 70 H1240 l14 -6 l12 6 h18 l10 -52 l12 88 l11 -52 l9 16 h26 l12 -12 l14 12 H1600"
          />
        ))}
      </svg>
    </div>
  );
}
