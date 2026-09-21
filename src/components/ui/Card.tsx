import React from 'react';

/**
 * Card — Shared UI component
 * A container with a border, background, padding, and optional header/footer.
 * TODO: Add hover effect variant for clickable cards
 * TODO: Add loading skeleton state
 */

interface CardProps {
  children: React.ReactNode;
  className?: string;
  as?: React.ElementType;
  'aria-label'?: string;
}

export function Card({ children, className = '', as: Tag = 'div', ...props }: CardProps) {
  return (
    <Tag
      className={`rounded-2xl border bg-card text-card-foreground shadow-sm ${className}`}
      {...props}
    >
      {children}
    </Tag>
  );
}

export function CardHeader({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <div className={`flex flex-col space-y-1.5 p-6 ${className}`}>{children}</div>;
}

export function CardTitle({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <h3 className={`text-lg font-semibold leading-none tracking-tight ${className}`}>{children}</h3>;
}

export function CardContent({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <div className={`p-6 pt-0 ${className}`}>{children}</div>;
}

export function CardFooter({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <div className={`flex items-center p-6 pt-0 ${className}`}>{children}</div>;
}
