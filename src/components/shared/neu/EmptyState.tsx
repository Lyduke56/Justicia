import React from 'react';
import { EmptyMedallion } from './EmptyMedallion';

/**
 * Shared empty / no-results state: the EmptyMedallion (pressed-in well, raised disc with the
 * caramel icon, a slow orbiting bead), a Lora title, an Inter description and optional actions.
 *  - variant "card":  stands alone on the page inside a raised parchment card
 *  - variant "plain": sits inside an existing container (lists, modals, panels)
 */
export interface EmptyStateProps {
  icon: React.ReactNode;
  title: React.ReactNode;
  description?: React.ReactNode;
  action?: React.ReactNode;
  variant?: 'card' | 'plain';
  size?: 'md' | 'sm';
  className?: string;
}

export function EmptyState({
  icon,
  title,
  description,
  action,
  variant = 'plain',
  size = 'md',
  className = '',
}: EmptyStateProps) {
  const compact = size === 'sm';
  const content = (
    <>
      <EmptyMedallion icon={icon} size={compact ? 'sm' : variant === 'card' ? 'lg' : 'md'} />
      <div className={compact ? 'space-y-1' : 'space-y-2'}>
        <h3 className={`text-balance font-lora font-bold text-[#34150F] ${compact ? 'text-sm sm:text-[15px]' : 'text-lg sm:text-xl'}`}>{title}</h3>
        {description && (
          <p
            className={`mx-auto text-pretty font-inter leading-relaxed text-[#7A6756] ${
              compact ? 'max-w-xs text-[11.5px] sm:text-xs' : 'max-w-sm text-xs sm:text-[13px]'
            }`}
          >
            {description}
          </p>
        )}
      </div>
      {action && <div className="flex flex-wrap items-center justify-center gap-3 pt-1">{action}</div>}
    </>
  );

  if (variant === 'card') {
    return (
      <div
        className={`neu-raised bg-[#E5D8CB] rounded-[28px] px-8 py-10 sm:px-12 sm:py-12 max-w-lg mx-auto text-center space-y-5 select-none ${className}`}
      >
        {content}
      </div>
    );
  }
  return (
    <div className={`text-center select-none ${compact ? 'space-y-3 px-4 py-6' : 'space-y-4 px-6 py-10'} ${className}`}>
      {content}
    </div>
  );
}

export default EmptyState;
