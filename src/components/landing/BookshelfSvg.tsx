import React from 'react';

interface BookshelfSvgProps {
  className?: string;
}

export function BookshelfSvg({ className = 'w-full h-full' }: BookshelfSvgProps) {
  return (
    <svg
      viewBox="0 0 1600 1000"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      preserveAspectRatio="xMidYMid slice"
    >
      <defs>
        <linearGradient id="woodPanel" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#1a110a" />
          <stop offset="50%" stopColor="#2c1d12" />
          <stop offset="100%" stopColor="#140c07" />
        </linearGradient>

        <linearGradient id="shelfShadow" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#080402" stopOpacity="0.9" />
          <stop offset="30%" stopColor="#080402" stopOpacity="0.4" />
          <stop offset="100%" stopColor="#080402" stopOpacity="0.8" />
        </linearGradient>

        <radialGradient id="libraryVignette" cx="50%" cy="50%" r="50%">
          <stop offset="40%" stopColor="#000000" stopOpacity="0.2" />
          <stop offset="100%" stopColor="#080503" stopOpacity="0.9" />
        </radialGradient>
      </defs>

      {/* Main Wood Wall */}
      <rect width="1600" height="1000" fill="url(#woodPanel)" />

      {/* Repeating Shelves & Leather Book Volumes */}
      {[120, 260, 400, 540, 680, 820].map((shelfY, shelfIdx) => (
        <g key={shelfIdx}>
          {/* Books row shadow */}
          <rect x="0" y={shelfY - 110} width="1600" height="110" fill="#110b06" />

          {/* Individual antique books with varied rich leather colors */}
          {Array.from({ length: 48 }).map((_, bookIdx) => {
            const colors = ['#3d2817', '#543820', '#2a1a0e', '#612513', '#1e261f', '#422e1b', '#5c4530', '#74281a', '#221915'];
            const heightVariation = (bookIdx * 7) % 22;
            const bookColor = colors[(bookIdx + shelfIdx * 5) % colors.length];
            const bookWidth = 26 + ((bookIdx * 11) % 12);
            const bookX = bookIdx * 34;

            return (
              <g key={bookIdx}>
                <rect
                  x={bookX}
                  y={shelfY - 95 - heightVariation}
                  width={bookWidth}
                  height={95 + heightVariation}
                  rx="2"
                  fill={bookColor}
                />
                {/* Gold tooling lines on book spine */}
                <line
                  x1={bookX + 4}
                  y1={shelfY - 80 - heightVariation}
                  x2={bookX + bookWidth - 4}
                  y2={shelfY - 80 - heightVariation}
                  stroke="#c59341"
                  strokeWidth="0.8"
                  opacity="0.6"
                />
                <line
                  x1={bookX + 4}
                  y1={shelfY - 76 - heightVariation}
                  x2={bookX + bookWidth - 4}
                  y2={shelfY - 76 - heightVariation}
                  stroke="#c59341"
                  strokeWidth="0.8"
                  opacity="0.6"
                />
                <line
                  x1={bookX + 4}
                  y1={shelfY - 30}
                  x2={bookX + bookWidth - 4}
                  y2={shelfY - 30}
                  stroke="#c59341"
                  strokeWidth="0.8"
                  opacity="0.6"
                />
              </g>
            );
          })}

          {/* Deep Shelf Under-shadow */}
          <rect x="0" y={shelfY - 110} width="1600" height="110" fill="url(#shelfShadow)" />

          {/* Thick Solid Mahogany Shelf Plank */}
          <rect x="0" y={shelfY} width="1600" height="18" fill="#442a17" />
          <rect x="0" y={shelfY + 18} width="1600" height="6" fill="#1b1007" />
          <rect x="0" y={shelfY} width="1600" height="2" fill="#845934" opacity="0.6" />
        </g>
      ))}

      {/* Vertical architectural divider pilasters */}
      {[0, 380, 780, 1180, 1580].map((pilasterX, pIdx) => (
        <g key={pIdx}>
          <rect x={pilasterX} y="0" width="30" height="1000" fill="#2d1c10" />
          <rect x={pilasterX + 2} y="0" width="6" height="1000" fill="#583b23" opacity="0.7" />
          <rect x={pilasterX + 26} y="0" width="4" height="1000" fill="#0d0804" />
        </g>
      ))}

      {/* Atmospheric Vignette overlay */}
      <rect width="1600" height="1000" fill="url(#libraryVignette)" />
    </svg>
  );
}
