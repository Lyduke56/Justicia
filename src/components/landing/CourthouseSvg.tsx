import React from 'react';

interface CourthouseSvgProps {
  className?: string;
}

export function CourthouseSvg({ className = 'w-full h-auto' }: CourthouseSvgProps) {
  return (
    <svg
      viewBox="0 0 1200 650"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      role="img"
      aria-label="Neoclassical courthouse with grand colonnade and central dome"
    >
      <defs>
        <linearGradient id="skyGrad" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#140d08" />
          <stop offset="60%" stopColor="#221811" />
          <stop offset="100%" stopColor="#120c08" />
        </linearGradient>

        <linearGradient id="stoneLight" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#453528" />
          <stop offset="50%" stopColor="#675341" />
          <stop offset="100%" stopColor="#302319" />
        </linearGradient>

        <linearGradient id="columnGrad" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#251a13" />
          <stop offset="25%" stopColor="#604b3a" />
          <stop offset="60%" stopColor="#8d725a" />
          <stop offset="85%" stopColor="#4d3b2c" />
          <stop offset="100%" stopColor="#18110b" />
        </linearGradient>

        <linearGradient id="domeGrad" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#7a624d" />
          <stop offset="50%" stopColor="#4a392b" />
          <stop offset="100%" stopColor="#1c130d" />
        </linearGradient>

        <radialGradient id="courthouseVignette" cx="50%" cy="50%" r="50%">
          <stop offset="50%" stopColor="#000000" stopOpacity="0" />
          <stop offset="100%" stopColor="#0c0805" stopOpacity="0.85" />
        </radialGradient>
      </defs>

      {/* Sky / Ambient background */}
      <rect width="1200" height="650" fill="url(#skyGrad)" />

      {/* Background Arch & Central Dome */}
      {/* Central Dome Drum */}
      <rect x="520" y="160" width="160" height="90" fill="url(#stoneLight)" />
      {/* Dome Ribbed Shell */}
      <path
        d="M510 160 C510 70, 690 70, 690 160 Z"
        fill="url(#domeGrad)"
      />
      {/* Dome Cupola / Lantern */}
      <rect x="585" y="45" width="30" height="30" fill="#675341" />
      <path d="M580 45 L600 20 L620 45 Z" fill="#9e8268" />
      {/* Dome finial spire */}
      <line x1="600" y1="20" x2="600" y2="5" stroke="#c59341" strokeWidth="2.5" />

      {/* Central Portico Pediment (Triangular gable) */}
      <polygon points="380,240 600,120 820,240" fill="url(#stoneLight)" />
      <polygon points="405,234 600,132 795,234" fill="#1b120c" opacity="0.6" />

      {/* Pediment Frieze Relief Carvings */}
      <ellipse cx="600" cy="195" rx="35" ry="18" fill="#8d725a" opacity="0.5" />
      <rect x="360" y="240" width="480" height="26" fill="#3a2a1f" />
      <rect x="370" y="244" width="460" height="4" fill="#8d725a" opacity="0.4" />

      {/* Massive Colonnade - Classical Fluted Columns */}
      {/* Left Outer Wings / Curved Colonnade */}
      {/* Archways in background */}
      <path
        d="M0 260 L380 260 L380 550 L0 550 Z"
        fill="#1f1610"
      />
      <path
        d="M820 260 L1200 260 L1200 550 L820 550 Z"
        fill="#1f1610"
      />

      {/* Left Wing Curved Columns */}
      <g id="left-curved-colonnade">
        {/* Arch row */}
        <path d="M30 330 A 25 35 0 0 1 80 330 L80 500 L30 500 Z" fill="#0d0805" />
        <path d="M110 330 A 25 35 0 0 1 160 330 L160 500 L110 500 Z" fill="#0d0805" />
        <path d="M190 330 A 25 35 0 0 1 240 330 L240 500 L190 500 Z" fill="#0d0805" />
        <path d="M270 330 A 25 35 0 0 1 320 330 L320 500 L270 500 Z" fill="#0d0805" />

        {/* Outer curved giant columns */}
        <rect x="15" y="260" width="22" height="250" rx="3" fill="url(#columnGrad)" />
        <rect x="95" y="260" width="22" height="250" rx="3" fill="url(#columnGrad)" />
        <rect x="175" y="260" width="22" height="250" rx="3" fill="url(#columnGrad)" />
        <rect x="255" y="260" width="22" height="250" rx="3" fill="url(#columnGrad)" />
        <rect x="335" y="260" width="22" height="250" rx="3" fill="url(#columnGrad)" />
      </g>

      {/* Main Portico Columns (The 6 Grand Columns) */}
      <g id="main-portico-columns">
        {/* Column 1 */}
        <rect x="400" y="266" width="34" height="260" rx="4" fill="url(#columnGrad)" />
        <path d="M394 266 L440 266 L435 278 L399 278 Z" fill="#8d725a" />
        <rect x="392" y="520" width="50" height="12" fill="#584231" />

        {/* Column 2 */}
        <rect x="475" y="266" width="34" height="260" rx="4" fill="url(#columnGrad)" />
        <path d="M469 266 L515 266 L510 278 L474 278 Z" fill="#8d725a" />
        <rect x="467" y="520" width="50" height="12" fill="#584231" />

        {/* Column 3 */}
        <rect x="550" y="266" width="34" height="260" rx="4" fill="url(#columnGrad)" />
        <path d="M544 266 L590 266 L585 278 L549 278 Z" fill="#8d725a" />
        <rect x="542" y="520" width="50" height="12" fill="#584231" />

        {/* Column 4 */}
        <rect x="625" y="266" width="34" height="260" rx="4" fill="url(#columnGrad)" />
        <path d="M619 266 L665 266 L660 278 L624 278 Z" fill="#8d725a" />
        <rect x="617" y="520" width="50" height="12" fill="#584231" />

        {/* Column 5 */}
        <rect x="700" y="266" width="34" height="260" rx="4" fill="url(#columnGrad)" />
        <path d="M694 266 L740 266 L735 278 L699 278 Z" fill="#8d725a" />
        <rect x="692" y="520" width="50" height="12" fill="#584231" />

        {/* Column 6 */}
        <rect x="775" y="266" width="34" height="260" rx="4" fill="url(#columnGrad)" />
        <path d="M769 266 L815 266 L810 278 L774 278 Z" fill="#8d725a" />
        <rect x="767" y="520" width="50" height="12" fill="#584231" />
      </g>

      {/* Right Wing Curved Colonnade */}
      <g id="right-curved-colonnade">
        <path d="M850 330 A 25 35 0 0 1 900 330 L900 500 L850 500 Z" fill="#0d0805" />
        <path d="M930 330 A 25 35 0 0 1 980 330 L980 500 L930 500 Z" fill="#0d0805" />
        <path d="M1010 330 A 25 35 0 0 1 1060 330 L1060 500 L1010 500 Z" fill="#0d0805" />
        <path d="M1090 330 A 25 35 0 0 1 1140 330 L1140 500 L1090 500 Z" fill="#0d0805" />

        <rect x="835" y="260" width="22" height="250" rx="3" fill="url(#columnGrad)" />
        <rect x="915" y="260" width="22" height="250" rx="3" fill="url(#columnGrad)" />
        <rect x="995" y="260" width="22" height="250" rx="3" fill="url(#columnGrad)" />
        <rect x="1075" y="260" width="22" height="250" rx="3" fill="url(#columnGrad)" />
        <rect x="1155" y="260" width="22" height="250" rx="3" fill="url(#columnGrad)" />
      </g>

      {/* Monumental Stone Steps (Base of Court) */}
      <polygon points="320,532 880,532 920,555 280,555" fill="#3d2c20" />
      <polygon points="280,555 920,555 960,580 240,580" fill="#2d1f16" />
      <polygon points="240,580 960,580 1020,620 180,620" fill="#20150e" />
      <rect x="0" y="620" width="1200" height="30" fill="#120c08" />

      {/* Soft Vignette Overlay */}
      <rect width="1200" height="650" fill="url(#courthouseVignette)" />
    </svg>
  );
}
