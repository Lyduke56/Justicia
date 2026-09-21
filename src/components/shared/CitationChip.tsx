/**
 * CitationChip — Shared component
 *
 * Renders an inline legal source citation with a link to the source detail page.
 * Displayed alongside AI-generated responses to show which sources were used.
 *
 * TODO: Add hover tooltip with excerpt preview
 * TODO: Add click handler to open source reader
 * TODO: Add "outdated" badge if source status !== 'active'
 */

interface CitationChipProps {
  sourceId: string;
  citation: string;
  title?: string;
  status?: 'active' | 'outdated' | 'superseded';
}

export function CitationChip({ sourceId, citation, title, status = 'active' }: CitationChipProps) {
  const isStale = status !== 'active';

  return (
    <a
      href={`/legal-research/${sourceId}`}
      className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-medium transition-colors hover:bg-muted ${
        isStale
          ? 'border-amber-300 bg-amber-50 text-amber-700 dark:border-amber-700 dark:bg-amber-950 dark:text-amber-300'
          : 'border-border bg-background text-foreground'
      }`}
      title={title ?? citation}
      aria-label={`Legal source: ${title ?? citation}${isStale ? ` (${status})` : ''}`}
    >
      📖 {citation}
      {isStale && (
        <span className="ml-1 rounded-sm bg-amber-200 px-1 text-[10px] dark:bg-amber-800">
          {status}
        </span>
      )}
    </a>
  );
}
