/**
 * Small stroke icon set shared by the neumorphic modals, alerts and empty states, so every
 * surface uses the same 24px grid, stroke weight and rounded caps.
 */
import React from 'react';

type IconProps = { className?: string };

function Svg({ className = 'w-5 h-5', strokeWidth = 2, children }: IconProps & { strokeWidth?: number; children: React.ReactNode }) {
  return (
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
}

export const CalendarIcon = (p: IconProps) => (
  <Svg {...p}>
    <rect x="3" y="5" width="18" height="16" rx="2.5" />
    <path d="M16 3v4M8 3v4M3 10h18" />
  </Svg>
);

export const CalendarClockIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M21 10.5V7.5A2.5 2.5 0 0018.5 5h-13A2.5 2.5 0 003 7.5v11A2.5 2.5 0 005.5 21H11" />
    <path d="M16 3v4M8 3v4M3 10h18" />
    <circle cx="17.5" cy="17.5" r="4" />
    <path d="M17.5 15.8v1.9l1.2.8" />
  </Svg>
);

export const ClockIcon = (p: IconProps) => (
  <Svg {...p}>
    <circle cx="12" cy="12" r="9" />
    <path d="M12 7v5l3 2" />
  </Svg>
);

export const VideoIcon = (p: IconProps) => (
  <Svg {...p}>
    <rect x="2.5" y="6" width="13" height="12" rx="2.5" />
    <path d="M15.5 10.5l5-3v9l-5-3" />
  </Svg>
);

export const PhoneIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M5 4h3.3l1.6 4.2-2 1.3a11 11 0 006.6 6.6l1.3-2 4.2 1.6V19a2 2 0 01-2 2A16 16 0 013 6a2 2 0 012-2z" />
  </Svg>
);

export const AlertIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M10.3 3.9L2.4 17.6A2 2 0 004.1 20.6h15.8a2 2 0 001.7-3L13.7 3.9a2 2 0 00-3.4 0z" />
    <path d="M12 9v4M12 17h.01" />
  </Svg>
);

export const InfoIcon = (p: IconProps) => (
  <Svg {...p}>
    <circle cx="12" cy="12" r="9" />
    <path d="M12 11v5M12 8h.01" />
  </Svg>
);

export const CheckCircleIcon = (p: IconProps) => (
  <Svg {...p}>
    <circle cx="12" cy="12" r="9" />
    <path d="M8.5 12.5l2.5 2.5 4.5-5" />
  </Svg>
);

export const CloseIcon = (p: IconProps) => (
  <Svg {...p} strokeWidth={2.4}>
    <path d="M6 6l12 12M18 6L6 18" />
  </Svg>
);

export const ChevronLeftIcon = (p: IconProps) => (
  <Svg {...p} strokeWidth={2.5}>
    <path d="M15 18l-6-6 6-6" />
  </Svg>
);

export const ChevronRightIcon = (p: IconProps) => (
  <Svg {...p} strokeWidth={2.5}>
    <path d="M9 18l6-6-6-6" />
  </Svg>
);

export const ArrowDownIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M12 5v14M6 13l6 6 6-6" />
  </Svg>
);

export const SendIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M21 3L10 14M21 3l-7 18-4-7-7-4 18-7z" />
  </Svg>
);

export const SearchIcon = (p: IconProps) => (
  <Svg {...p} strokeWidth={1.8}>
    <circle cx="11" cy="11" r="7.5" />
    <path d="M20.5 20.5l-4.2-4.2" />
  </Svg>
);

export const FolderIcon = (p: IconProps) => (
  <Svg {...p} strokeWidth={1.8}>
    <path d="M3 7.5A2.5 2.5 0 015.5 5H9l2 2.5h7.5A2.5 2.5 0 0121 10v7.5a2.5 2.5 0 01-2.5 2.5h-13A2.5 2.5 0 013 17.5v-10z" />
  </Svg>
);

export const FolderOpenIcon = (p: IconProps) => (
  <Svg {...p} strokeWidth={1.8}>
    <path d="M4 19.5l2.6-7.1A2 2 0 018.5 11H21l-2.8 7.4a2 2 0 01-1.9 1.1H5.5A2.5 2.5 0 013 17V7.5A2.5 2.5 0 015.5 5H9l2 2.5h5.5A2.5 2.5 0 0119 10v1" />
  </Svg>
);

export const PencilIcon = (p: IconProps) => (
  <Svg {...p} strokeWidth={1.8}>
    <path d="M16.5 3.5a2.1 2.1 0 013 3L8 18l-4 1 1-4L16.5 3.5z" />
    <path d="M14.5 5.5l3 3" />
  </Svg>
);

export const TrashIcon = (p: IconProps) => (
  <Svg {...p} strokeWidth={1.8}>
    <path d="M4 7h16M10 11v6M14 11v6M6 7l1 12a2 2 0 002 2h6a2 2 0 002-2l1-12M9 7V4.5A1.5 1.5 0 0110.5 3h3A1.5 1.5 0 0115 4.5V7" />
  </Svg>
);

export const FileIcon = (p: IconProps) => (
  <Svg {...p} strokeWidth={1.8}>
    <path d="M14 3H7a2 2 0 00-2 2v14a2 2 0 002 2h10a2 2 0 002-2V8l-5-5z" />
    <path d="M14 3v5h5M9 13h6M9 17h4" />
  </Svg>
);

export const StarIcon = (p: IconProps) => (
  <Svg {...p} strokeWidth={1.8}>
    <path d="M12 3.5l2.6 5.3 5.9.9-4.3 4.1 1 5.8L12 16.9l-5.2 2.7 1-5.8-4.3-4.1 5.9-.9L12 3.5z" />
  </Svg>
);

export const RefreshIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M20 11a8 8 0 00-14.5-4.5L4 8M4 4v4h4M4 13a8 8 0 0014.5 4.5L20 16M20 20v-4h-4" />
  </Svg>
);

export const QrIcon = (p: IconProps) => (
  <Svg {...p} strokeWidth={1.8}>
    <rect x="3.5" y="3.5" width="6.5" height="6.5" rx="1" />
    <rect x="14" y="3.5" width="6.5" height="6.5" rx="1" />
    <rect x="3.5" y="14" width="6.5" height="6.5" rx="1" />
    <path d="M14 14h2.5v2.5H14zM18 18h2.5v2.5H18zM18 14h2.5M14 18v2.5" />
  </Svg>
);

export const LinkIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M10 13a5 5 0 007.07 0l3-3a5 5 0 00-7.07-7.07l-1.5 1.5" />
    <path d="M14 11a5 5 0 00-7.07 0l-3 3a5 5 0 007.07 7.07l1.5-1.5" />
  </Svg>
);

export const ClipboardIcon = (p: IconProps) => (
  <Svg {...p}>
    <rect x="6" y="4" width="12" height="17" rx="2" />
    <path d="M9 4.5V3.5a1 1 0 011-1h4a1 1 0 011 1v1M9 11h6M9 15h4" />
  </Svg>
);

export const WalletIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M19 7V5.5A1.5 1.5 0 0017.5 4H5a2 2 0 000 4h14a1 1 0 011 1v9a2 2 0 01-2 2H5a2 2 0 01-2-2V6" />
    <path d="M16.5 14h.01" />
  </Svg>
);

export const ExternalLinkIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M14 4h6v6M20 4l-9 9M18 14v4a2 2 0 01-2 2H6a2 2 0 01-2-2V8a2 2 0 012-2h4" />
  </Svg>
);

export const UserIcon = (p: IconProps) => (
  <Svg {...p}>
    <circle cx="12" cy="8" r="3.8" />
    <path d="M5 20c0-3.8 3.1-6.5 7-6.5s7 2.7 7 6.5" />
  </Svg>
);

export function Spinner({ className = 'w-4 h-4' }: IconProps) {
  return (
    <svg className={`${className} animate-spin`} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeOpacity="0.25" strokeWidth="3" />
      <path d="M21 12a9 9 0 00-9-9" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}
