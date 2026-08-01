export default function PrideFlag() {
  return (
    <svg viewBox="0 0 800 480" preserveAspectRatio="xMidYMid slice">
      <defs>
        <filter id="waveFilter" x="-20%" y="-20%" width="140%" height="140%">
          <feTurbulence
            type="fractalNoise"
            baseFrequency="0.004 0.02"
            numOctaves="2"
            seed="7"
            result="noise"
          >
            <animate
              attributeName="baseFrequency"
              dur="14s"
              values="0.008 0.04;0.012 0.05;0.008 0.04"
              repeatCount="indefinite"
            />
          </feTurbulence>
          <feDisplacementMap in="SourceGraphic" in2="noise" scale="15" xChannelSelector="R" yChannelSelector="G" />
        </filter>
      </defs>
      <g filter="url(#waveFilter)">
        <rect x="0" y="0" width="800" height="80" fill="#e40303" />
        <rect x="0" y="80" width="800" height="80" fill="#ff8c00" />
        <rect x="0" y="160" width="800" height="80" fill="#ffed00" />
        <rect x="0" y="240" width="800" height="80" fill="#008026" />
        <rect x="0" y="320" width="800" height="80" fill="#004dff" />
        <rect x="0" y="400" width="800" height="80" fill="#750787" />
      </g>
    </svg>
  );
}

