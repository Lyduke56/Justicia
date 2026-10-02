import React from 'react';

interface LadyJusticeSvgProps {
  className?: string;
}

export function LadyJusticeSvg({ className = 'w-full h-auto' }: LadyJusticeSvgProps) {
  return (
    <svg
      viewBox="0 0 500 700"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-label="Statue of Lady Justice holding the scales of justice and a sword"
      role="img"
    >
      <defs>
        {/* Gradients for rich marble and antique bronze/gold lighting */}
        <linearGradient id="marbleLight" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#f5f0e8" stopOpacity="0.95" />
          <stop offset="50%" stopColor="#d8cfc0" stopOpacity="0.85" />
          <stop offset="100%" stopColor="#8d8174" stopOpacity="0.4" />
        </linearGradient>

        <linearGradient id="goldScales" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#ffe4a0" />
          <stop offset="45%" stopColor="#c59341" />
          <stop offset="100%" stopColor="#7a4f15" />
        </linearGradient>

        <linearGradient id="swordBlade" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#9a9590" />
          <stop offset="50%" stopColor="#f0ece6" />
          <stop offset="100%" stopColor="#69635c" />
        </linearGradient>

        <linearGradient id="draperyShadow" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#b4a999" stopOpacity="0.8" />
          <stop offset="60%" stopColor="#5d5449" stopOpacity="0.9" />
          <stop offset="100%" stopColor="#2b241c" stopOpacity="0.95" />
        </linearGradient>

        <radialGradient id="statueAura" cx="50%" cy="40%" r="50%">
          <stop offset="0%" stopColor="#c59341" stopOpacity="0.25" />
          <stop offset="50%" stopColor="#c59341" stopOpacity="0.08" />
          <stop offset="100%" stopColor="#000000" stopOpacity="0" />
        </radialGradient>

        <filter id="softGlow" x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur stdDeviation="12" result="blur" />
          <feComposite in="SourceGraphic" in2="blur" operator="over" />
        </filter>
      </defs>

      {/* Atmospheric Backlight Glow */}
      <circle cx="280" cy="300" r="220" fill="url(#statueAura)" />

      {/* Group for the entire Lady Justice statue */}
      <g id="lady-justice-vector">
        {/* Classical Crown / Laurel Wreath */}
        <path
          d="M260 72 C255 60, 275 52, 285 58 C295 50, 315 56, 312 68 C325 65, 335 75, 328 85 C320 82, 310 84, 305 88 C295 82, 280 82, 270 86 Z"
          fill="url(#goldScales)"
          opacity="0.85"
        />

        {/* Head and Hair */}
        <path
          d="M265 78 C255 88, 252 108, 258 120 C262 135, 272 148, 285 152 C298 148, 310 138, 315 122 C320 105, 316 88, 305 78 C292 72, 278 72, 265 78 Z"
          fill="url(#marbleLight)"
        />

        {/* Blindfold / Cloth over eyes */}
        <path
          d="M256 96 C262 93, 292 90, 316 94 C318 103, 315 109, 313 114 C292 110, 268 112, 258 116 C255 108, 255 101, 256 96 Z"
          fill="#443c33"
        />
        <path
          d="M258 100 L314 98 L313 108 L257 110 Z"
          fill="#eedfcb"
          opacity="0.9"
        />
        {/* Knot of blindfold hanging on side */}
        <path
          d="M256 102 C250 106, 246 116, 248 128 C250 120, 254 112, 256 108 Z"
          fill="#d8cebf"
        />

        {/* Nose, Lips, and Chin (Chiseled Classical Features) */}
        <path d="M284 112 L287 126 L283 129" stroke="#796d5e" strokeWidth="1.5" strokeLinecap="round" />
        <path d="M280 135 C284 134, 288 134, 292 135" stroke="#706253" strokeWidth="2" strokeLinecap="round" />
        <path d="M283 143 C286 145, 289 145, 292 143" stroke="#8c7d6c" strokeWidth="1.5" strokeLinecap="round" />

        {/* Neck & Trapezius */}
        <path
          d="M275 148 C270 162, 260 174, 245 186 L325 186 C315 172, 305 160, 300 148 Z"
          fill="url(#marbleLight)"
        />

        {/* Left Arm (Raised holding Scales) */}
        {/* Shoulder */}
        <path
          d="M322 186 C340 188, 365 178, 380 162 C395 145, 408 120, 415 95 C418 85, 416 75, 412 68 C406 60, 396 62, 394 72 C390 92, 380 115, 368 132 C355 148, 340 162, 328 170 Z"
          fill="url(#marbleLight)"
        />
        {/* Hand grasping scale hook */}
        <circle cx="410" cy="65" r="10" fill="url(#marbleLight)" />
        <path d="M405 60 C408 55, 416 55, 418 60 C420 66, 415 72, 408 72 Z" fill="#d4c9b9" />

        {/* THE SCALES OF JUSTICE (Suspended in air) */}
        {/* Balance Beam / Crossbar */}
        <g id="scales" filter="url(#softGlow)">
          {/* Main fulcrum ring */}
          <circle cx="410" cy="78" r="8" stroke="url(#goldScales)" strokeWidth="3" fill="#1b140e" />
          <path d="M410 70 L410 98" stroke="url(#goldScales)" strokeWidth="4" strokeLinecap="round" />

          {/* Crossbeam with decorative classical curls */}
          <path
            d="M340 120 C365 105, 390 100, 410 100 C430 100, 455 105, 480 120"
            stroke="url(#goldScales)"
            strokeWidth="4"
            fill="none"
            strokeLinecap="round"
          />
          {/* Beam finials */}
          <circle cx="340" cy="120" r="4" fill="url(#goldScales)" />
          <circle cx="480" cy="120" r="4" fill="url(#goldScales)" />

          {/* Left Pan Chains */}
          <line x1="340" y1="124" x2="315" y2="180" stroke="url(#goldScales)" strokeWidth="1.5" strokeDasharray="3 2" />
          <line x1="340" y1="124" x2="340" y2="180" stroke="url(#goldScales)" strokeWidth="1.5" strokeDasharray="3 2" />
          <line x1="340" y1="124" x2="365" y2="180" stroke="url(#goldScales)" strokeWidth="1.5" strokeDasharray="3 2" />

          {/* Left Weighing Pan (Brass bowl) */}
          <ellipse cx="340" cy="182" rx="28" ry="8" fill="url(#goldScales)" />
          <path
            d="M312 182 C312 198, 368 198, 368 182 Z"
            fill="url(#goldScales)"
            opacity="0.9"
          />

          {/* Right Pan Chains */}
          <line x1="480" y1="124" x2="455" y2="195" stroke="url(#goldScales)" strokeWidth="1.5" strokeDasharray="3 2" />
          <line x1="480" y1="124" x2="480" y2="195" stroke="url(#goldScales)" strokeWidth="1.5" strokeDasharray="3 2" />
          <line x1="480" y1="124" x2="505" y2="195" stroke="url(#goldScales)" strokeWidth="1.5" strokeDasharray="3 2" />

          {/* Right Weighing Pan */}
          <ellipse cx="480" cy="197" rx="28" ry="8" fill="url(#goldScales)" />
          <path
            d="M452 197 C452 213, 508 213, 508 197 Z"
            fill="url(#goldScales)"
            opacity="0.9"
          />
        </g>

        {/* Right Arm (Holding Sword downwards) */}
        <path
          d="M245 186 C225 195, 205 215, 185 245 C165 275, 150 310, 138 350 C135 362, 138 375, 148 380 C158 385, 168 378, 175 365 C188 335, 205 295, 225 265 C235 250, 245 235, 252 220 Z"
          fill="url(#marbleLight)"
        />
        {/* Hand around sword hilt */}
        <ellipse cx="145" cy="370" rx="14" ry="16" fill="url(#marbleLight)" />

        {/* THE SWORD OF JUSTICE */}
        <g id="sword">
          {/* Pommel */}
          <circle cx="120" cy="342" r="7" fill="url(#goldScales)" />
          {/* Grip */}
          <line x1="124" y1="347" x2="142" y2="368" stroke="#3b322a" strokeWidth="7" strokeLinecap="round" />
          {/* Crossguard */}
          <path
            d="M125 385 C138 375, 155 360, 168 350"
            stroke="url(#goldScales)"
            strokeWidth="8"
            strokeLinecap="round"
          />
          {/* Steel Blade extending downwards */}
          <polygon
            points="142,374 156,360 215,580 200,590 195,585"
            fill="url(#swordBlade)"
            filter="drop-shadow(2px 4px 6px rgba(0,0,0,0.6))"
          />
          {/* Blade Center Ridge */}
          <line x1="149" y1="367" x2="204" y2="583" stroke="#ffffff" strokeWidth="1.2" opacity="0.8" />
        </g>

        {/* Torso & Sculpted Roman Chiton / Drapery */}
        <path
          d="M240 188 C255 190, 275 195, 290 196 C308 196, 325 188, 332 184 C342 220, 350 260, 345 300 C340 330, 330 360, 320 390 C310 430, 325 470, 335 510 C345 560, 350 620, 355 690 L180 690 C185 640, 195 580, 210 520 C220 470, 228 420, 230 370 C232 320, 230 270, 235 220 Z"
          fill="url(#draperyShadow)"
        />

        {/* Marble Drapery Highlights & Deep Chiseled Folds */}
        {/* Chest and Stola */}
        <path
          d="M255 190 C265 210, 280 240, 295 240 C312 240, 322 215, 330 192 C325 225, 310 260, 290 265 C270 265, 255 235, 250 200 Z"
          fill="url(#marbleLight)"
          opacity="0.9"
        />

        {/* Classical Belt / Cingulum below bust */}
        <path
          d="M245 272 C265 278, 295 280, 325 270 C324 282, 295 292, 245 284 Z"
          fill="url(#goldScales)"
        />

        {/* Diagonal Sweeping Folds of the Gown */}
        <path
          d="M245 284 C260 320, 285 365, 315 390 C300 395, 270 360, 250 315 Z"
          fill="url(#marbleLight)"
          opacity="0.8"
        />
        <path
          d="M235 320 C250 360, 275 420, 305 450 C290 455, 260 410, 240 350 Z"
          fill="url(#marbleLight)"
          opacity="0.75"
        />
        <path
          d="M225 380 C240 440, 268 510, 295 560 C280 565, 250 500, 230 420 Z"
          fill="url(#marbleLight)"
          opacity="0.85"
        />
        <path
          d="M215 450 C235 520, 270 610, 305 685 C285 685, 250 605, 220 510 Z"
          fill="url(#marbleLight)"
          opacity="0.9"
        />

        {/* Right side flowing cascading fabric */}
        <path
          d="M325 270 C345 320, 375 390, 390 460 C370 450, 345 380, 330 310 Z"
          fill="url(#marbleLight)"
          opacity="0.7"
        />
        <path
          d="M335 430 C360 500, 390 580, 420 670 C395 660, 365 570, 340 480 Z"
          fill="url(#marbleLight)"
          opacity="0.75"
        />

        {/* Base Pedestal / Classical Plinth */}
        <path
          d="M170 685 L370 685 L385 700 L155 700 Z"
          fill="url(#goldScales)"
          opacity="0.7"
        />
      </g>
    </svg>
  );
}
