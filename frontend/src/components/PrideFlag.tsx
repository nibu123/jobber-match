export default function PrideFlag() {
  return (
    <svg viewBox="0 0 800 480" preserveAspectRatio="xMidYMid slice">
      <defs>
        <linearGradient id="silkRainbow" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#ff2d55" />
          <stop offset="16%" stopColor="#ff8c00" />
          <stop offset="33%" stopColor="#ffed00" />
          <stop offset="50%" stopColor="#3ddc84" />
          <stop offset="66%" stopColor="#00b4ff" />
          <stop offset="83%" stopColor="#5b5bff" />
          <stop offset="100%" stopColor="#a259ff" />
        </linearGradient>

        <filter id="silkWave" x="-30%" y="-30%" width="160%" height="160%">
          <feTurbulence
            type="fractalNoise"
            baseFrequency="0.006 0.012"
            numOctaves="3"
            seed="11"
            result="noise"
          >
            <animate
              attributeName="baseFrequency"
              dur="18s"
              values="0.006 0.012;0.009 0.018;0.006 0.012"
              repeatCount="indefinite"
            />
          </feTurbulence>
          <feDisplacementMap in="SourceGraphic" in2="noise" scale="60" xChannelSelector="R" yChannelSelector="G" />
        </filter>

        <radialGradient id="sheen" cx="30%" cy="20%" r="80%">
          <stop offset="0%" stopColor="#ffffff" stopOpacity="0.35" />
          <stop offset="45%" stopColor="#ffffff" stopOpacity="0.08" />
          <stop offset="100%" stopColor="#ffffff" stopOpacity="0" />
        </radialGradient>
      </defs>

      <g filter="url(#silkWave)">
        <rect x="0" y="0" width="800" height="480" fill="url(#silkRainbow)" />
      </g>
      <rect x="0" y="0" width="800" height="480" fill="url(#sheen)" />
    </svg>
  );
}
