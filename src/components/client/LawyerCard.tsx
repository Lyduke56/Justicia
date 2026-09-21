/**
 * LawyerCard — Client-facing component
 * Displays a lawyer's profile summary in the discovery grid.
 * TODO: Show: avatar, name, practice areas chips, location, languages, hourly rate, avg rating (stars), "Book" CTA
 * TODO: Add verified badge
 * TODO: Add availability indicator (available today / next available: date)
 * TODO: Hover: show short bio excerpt
 */
interface LawyerCardProps {
  lawyerId: string;
  name: string;
  practiceAreas: string[];
  location: string;
  hourlyRate: number;
  rating: number;
  reviewCount: number;
  isVerified: boolean;
}

export function LawyerCard({ lawyerId, name, practiceAreas, location, hourlyRate, rating, reviewCount, isVerified }: LawyerCardProps) {
  return (
    <article
      className="rounded-2xl border bg-card p-5 space-y-3 hover:shadow-md transition-shadow"
      aria-label={`Lawyer: ${name}`}
    >
      <div className="flex items-center gap-3">
        {/* TODO: Avatar */}
        <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center text-lg font-bold">
          {name.charAt(0)}
        </div>
        <div>
          <h3 className="font-semibold text-sm">{name}</h3>
          <p className="text-xs text-muted-foreground">{location}</p>
        </div>
        {isVerified && (
          <span className="ml-auto text-xs text-green-600 font-medium" aria-label="Verified lawyer">✓ Verified</span>
        )}
      </div>
      <div className="flex flex-wrap gap-1">
        {practiceAreas.slice(0, 3).map((area) => (
          <span key={area} className="rounded-full bg-muted px-2 py-0.5 text-xs">{area}</span>
        ))}
      </div>
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span>⭐ {rating.toFixed(1)} ({reviewCount} reviews)</span>
        <span className="font-medium text-foreground">₱{hourlyRate.toLocaleString()}/hr</span>
      </div>
      <a
        href={`/lawyers/${lawyerId}`}
        className="block w-full text-center rounded-lg bg-primary text-primary-foreground py-2 text-sm font-medium hover:opacity-90 transition"
      >
        View Profile & Book
      </a>
    </article>
  );
}
