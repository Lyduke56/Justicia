import { MAX_SUSPENSIONS } from '@/lib/moderation/constants';

/**
 * Offense meter: one well per allowed suspension (raised caramel once used), then the
 * termination step as a diamond (deep red once reached).
 */
export function OffenseMeter({ count, terminated, showLabel = true }: { count: number; terminated: boolean; showLabel?: boolean }) {
  return (
    <span className="inline-flex items-center gap-1.5" aria-label={terminated ? 'Terminated' : `${count} of ${MAX_SUSPENSIONS} suspensions used`} role="img">
      {Array.from({ length: MAX_SUSPENSIONS }).map((_, i) => (
        <span key={i} className={`admin-offense-dot ${i < count ? 'is-used' : ''}`} aria-hidden />
      ))}
      <span className={`admin-offense-end ${terminated ? 'is-used' : ''}`} aria-hidden />
      {showLabel && <span className="ml-1 font-inter text-[11.5px] tabular-nums text-[#5C4535]">{terminated ? 'Terminated' : `${count}/${MAX_SUSPENSIONS}`}</span>}
    </span>
  );
}
