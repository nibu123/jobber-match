export default function PrideFlag() {
  return (
    <svg viewBox="0 0 800 480" preserveAspectRatio="xMidYMid slice">
      <defs>
        <filter id="cloudFilter" x="-40%" y="-40%" width="180%" height="180%">
          <feTurbulence
            type="turbulence"
            baseFrequency="0.010 0.015"
            numOctaves="3"
            seed="4"
            result="noise"
          >
            <animate
              attributeName="seed"
              dur="30s"
              values="4;9;4"
              repeatCount="indefinite"
            />
          </feTurbulence>
          <feDisplacementMap in="SourceGraphic" in2="noise" scale="80" xChannelSelector="R" yChannelSelector="G" result="displaced" />
          <feGaussianBlur in="displaced" stdDeviation="18" />
        </filter>

        <radialGradient id="blobRed" cx="15%" cy="35%" r="45%">
          <stop offset="0%" stopColor="#ff2d55" stopOpacity="1" />
          <stop offset="100%" stopColor="#ff2d55" stopOpacity="0" />
        </radialGradient>
        <radialGradient id="blobOrange" cx="32%" cy="55%" r="45%">
          <stop offset="0%" stopColor="#ff9500" stopOpacity="1" />
          <stop offset="100%" stopColor="#ff9500" stopOpacity="0" />
        </radialGradient>
        <radialGradient id="blobYellow" cx="48%" cy="30%" r="42%">
          <stop offset="0%" stopColor="#ffe600" stopOpacity="1" />
          <stop offset="100%" stopColor="#ffe600" stopOpacity="0" />
        </radialGradient>
        <radialGradient id="blobGreen" cx="62%" cy="60%" r="45%">
          <stop offset="0%" stopColor="#2ee6a6" stopOpacity="1" />
          <stop offset="100%" stopColor="#2ee6a6" stopOpacity="0" />
        </radialGradient>
        <radialGradient id="blobBlue" cx="78%" cy="35%" r="45%">
          <stop offset="0%" stopColor="#00baff" stopOpacity="1" />
          <stop offset="100%" stopColor="#00baff" stopOpacity="0" />
        </radialGradient>
        <radialGradient id="blobPurple" cx="90%" cy="60%" r="42%">
          <stop offset="0%" stopColor="#a259ff" stopOpacity="1" />
          <stop offset="100%" stopColor="#a259ff" stopOpacity="0" />
        </radialGradient>
      </defs>

      <g filter="url(#cloudFilter)">
        <rect x="0" y="0" width="800" height="480" fill="url(#blobRed)" />
        <rect x="0" y="0" width="800" height="480" fill="url(#blobOrange)" />
        <rect x="0" y="0" width="800" height="480" fill="url(#blobYellow)" />
        <rect x="0" y="0" width="800" height="480" fill="url(#blobGreen)" />
        <rect x="0" y="0" width="800" height="480" fill="url(#blobBlue)" />
        <rect x="0" y="0" width="800" height="480" fill="url(#blobPurple)" />
      </g>
    </svg>
  );
}
