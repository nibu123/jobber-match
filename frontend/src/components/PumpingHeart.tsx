export default function PumpingHeart() {
  return (
    <div style={{ display: "flex", justifyContent: "center", marginBottom: 12 }}>
      <style>{`
        @keyframes pump {
          0% { transform: scale(1); }
          15% { transform: scale(1.15); }
          30% { transform: scale(1); }
          45% { transform: scale(1.1); }
          60% { transform: scale(1); }
          100% { transform: scale(1); }
        }
        .pumping-heart { animation: pump 1.2s ease-in-out infinite; transform-origin: center; }
      `}</style>
      <svg className="pumping-heart" width="72" height="72" viewBox="0 0 140 140">
        <defs>
          <clipPath id="hcp"><path d="M70 130 C10 90 0 55 20 32 C38 12 62 15 70 35 C78 15 102 12 120 32 C140 55 130 90 70 130 Z" /></clipPath>
          <radialGradient id="bigShineP" cx="32%" cy="20%" r="42%">
            <stop offset="0%" stopColor="#FFFFFF" stopOpacity="0.9" />
            <stop offset="60%" stopColor="#FFFFFF" stopOpacity="0.1" />
            <stop offset="100%" stopColor="#FFFFFF" stopOpacity="0" />
          </radialGradient>
        </defs>
        <g transform="translate(10,5)">
          <g clipPath="url(#hcp)">
            <rect x="-10" y="0" width="150" height="16.25" fill="#FF69B4" />
            <rect x="-10" y="16.25" width="150" height="16.25" fill="#E40303" />
            <rect x="-10" y="32.5" width="150" height="16.25" fill="#FF8C00" />
            <rect x="-10" y="48.75" width="150" height="16.25" fill="#FFED00" />
            <rect x="-10" y="65" width="150" height="16.25" fill="#008026" />
            <rect x="-10" y="81.25" width="150" height="16.25" fill="#24408E" />
            <rect x="-10" y="97.5" width="150" height="16.25" fill="#732982" />
            <rect x="-10" y="113.75" width="150" height="16.25" fill="#8B4513" />
            <ellipse cx="40" cy="38" rx="26" ry="16" fill="url(#bigShineP)" transform="rotate(-28 40 38)" />
          </g>
        </g>
      </svg>
    </div>
  );
}
