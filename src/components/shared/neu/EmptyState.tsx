import React from 'react';

/**
 * Shared empty / no-results state, modelled on the Find a Lawyer "No Verified Counsel Found"
 * card: recessed icon well, Lora title, Inter description, optional raised action.
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
      <div
        className={`neu-recessed mx-auto rounded-full flex items-center justify-center text-[#C58B3C] ${compact ? 'size-12' : 'size-14 sm:size-16'}`}
      >
        <span className={`neu-float flex ${compact ? '[&>svg]:w-5 [&>svg]:h-5' : '[&>svg]:w-7 [&>svg]:h-7'}`}>{icon}</span>
      </div>
      <div className="space-y-1.5">
        <h3 className={`font-lora font-bold text-[#34150F] ${compact ? 'text-sm sm:text-base' : 'text-lg sm:text-xl'}`}>{title}</h3>
        {description && (
          <p
            className={`font-inter text-[#7A6756] leading-relaxed mx-auto ${compact ? 'text-[11.5px] sm:text-xs max-w-xs' : 'text-xs sm:text-[13px] max-w-sm'
              }`}
          >
            {description}
          </p>
        )}
      </div>
      {action && <div className="pt-1 flex flex-wrap items-center justify-center gap-3">{action}</div>}
    </>
  );

  if (variant === 'card') {
    return (
      <div
        className={`neu-raised bg-[#E5D8CB] rounded-[28px] px-8 py-10 sm:px-12 sm:py-14 max-w-lg mx-auto text-center space-y-5 select-none ${className}`}
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
