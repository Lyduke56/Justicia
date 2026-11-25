import type { ReactNode } from 'react';
import type { ActivityIcon as ActivityIconName } from './activity';

/** Line icons for the admin Overview, drawn like the lawyer dashboard's KPI icons. */
const iconProps = {
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.75,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
  'aria-hidden': true,
};
type IconProps = { className?: string };

export const QueueShieldIcon = ({ className }: IconProps) => (
  <svg {...iconProps} className={className}>
    <path d="M12 3 4.5 6v5.5c0 4.6 3.2 8.4 7.5 9.5 4.3-1.1 7.5-4.9 7.5-9.5V6L12 3Z" />
    <path d="m8.8 12 2.2 2.2 4.4-4.4" />
  </svg>
);
export const ScalesIcon = ({ className }: IconProps) => (
  <svg {...iconProps} className={className}>
    <path d="M12 3v17M8 20h8M4.5 7.5h15" />
    <path d="M6.5 7.5 3.5 13.5a3 3 0 0 0 6 0l-3-6ZM17.5 7.5l-3 6a3 3 0 0 0 6 0l-3-6Z" />
  </svg>
);
export const PeopleIcon = ({ className }: IconProps) => (
  <svg {...iconProps} className={className}>
    <circle cx="9" cy="8" r="3.5" />
    <path d="M3 20a6 6 0 0 1 12 0M16 4.5a3.5 3.5 0 0 1 0 7M18 14.5a6 6 0 0 1 3 5.5" />
  </svg>
);
export const ReportFlagIcon = ({ className }: IconProps) => (
  <svg {...iconProps} className={className}>
    <path d="M5 21V4M5 4h11l-2 4 2 4H5" />
  </svg>
);

const ACTIVITY_PATHS: Record<ActivityIconName, ReactNode> = {
  check: <path d="m5 12.5 4.5 4.5L19 7.5" />,
  cross: <path d="M6.5 6.5l11 11M17.5 6.5l-11 11" />,
  file: (
    <>
      <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8l-5-5Z" />
      <path d="M14 3v5h5M9 13h6M9 17h4" />
    </>
  ),
  flag: <path d="M5 21V4M5 4h11l-2 4 2 4H5" />,
  user: (
    <>
      <circle cx="12" cy="8" r="4" />
      <path d="M4 21a8 8 0 0 1 16 0" />
    </>
  ),
  redo: <path d="M20 11a8 8 0 1 0-2.3 5.7M20 4v7h-7" />,
  pulse: <path d="M3 12h4l3-8 4 16 3-8h4" />,
};

export const ActivityIcon = ({ name, className }: IconProps & { name: ActivityIconName }) => (
  <svg {...iconProps} strokeWidth={2} className={className}>
    {ACTIVITY_PATHS[name]}
  </svg>
);
