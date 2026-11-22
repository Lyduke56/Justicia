import React from 'react';

type IconProps = { className?: string };

const Svg = ({ className = 'w-4 h-4', children, strokeWidth = 2 }: IconProps & { children: React.ReactNode; strokeWidth?: number }) => (
  <svg
    className={className}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth={strokeWidth}
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    {children}
  </svg>
);

export const ReplyIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M9 14L4 9l5-5" />
    <path d="M4 9h10.5a5.5 5.5 0 015.5 5.5V20" />
  </Svg>
);

export const PinIcon = (p: IconProps) => (
  <Svg {...p} strokeWidth={1.9}>
    <path d="M9 4h6l-1 5 3.5 3.5v1.5h-11v-1.5L10 9 9 4z" />
    <path d="M12 14v6" />
  </Svg>
);

export const PlusIcon = (p: IconProps) => (
  <Svg {...p} strokeWidth={2.2}>
    <path d="M12 5v14M5 12h14" />
  </Svg>
);

export const ImageIcon = (p: IconProps) => (
  <Svg {...p} strokeWidth={1.8}>
    <rect x="3" y="4" width="18" height="16" rx="2.5" />
    <circle cx="9" cy="10" r="1.8" />
    <path d="M21 16l-5-5-8 9" />
  </Svg>
);

export const MicIcon = (p: IconProps) => (
  <Svg {...p} strokeWidth={1.9}>
    <rect x="9" y="3" width="6" height="11" rx="3" />
    <path d="M5.5 11a6.5 6.5 0 0013 0M12 17.5V21" />
  </Svg>
);

export const PlayIcon = ({ className = 'w-4 h-4' }: IconProps) => (
  <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
    <path d="M8 5.5v13a1 1 0 001.52.85l10.4-6.5a1 1 0 000-1.7L9.52 4.65A1 1 0 008 5.5z" />
  </svg>
);

export const PauseIcon = ({ className = 'w-4 h-4' }: IconProps) => (
  <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
    <rect x="6.5" y="5" width="4" height="14" rx="1.2" />
    <rect x="13.5" y="5" width="4" height="14" rx="1.2" />
  </svg>
);

export const CheckIcon = (p: IconProps) => (
  <Svg {...p} strokeWidth={2.4}>
    <path d="M5 12.5l4.5 4.5L19 7.5" />
  </Svg>
);

export const DoubleCheckIcon = (p: IconProps) => (
  <Svg {...p} strokeWidth={2.2}>
    <path d="M2.5 12.5L7 17l9.5-9.5" />
    <path d="M12 16l1 1 9.5-9.5" />
  </Svg>
);

export const StopIcon = ({ className = 'w-4 h-4' }: IconProps) => (
  <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
    <rect x="6" y="6" width="12" height="12" rx="2.5" />
  </svg>
);
