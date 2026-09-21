/**
 * ClientNav — Client navigation sidebar component
 * TODO: Replace static HTML nav in (client)/layout.tsx with this component
 * TODO: Highlight active route
 * TODO: Show unread message count badge
 * TODO: Show notification bell with count
 * TODO: Language switcher
 * TODO: Mobile drawer support
 */
export function ClientNav() {
  // TODO: Implement full ClientNav
  return (
    <aside className="w-64 border-r bg-muted/30 p-4 hidden md:flex flex-col" aria-label="Client navigation">
      <div className="text-sm font-bold mb-6">Justicia</div>
      <nav className="space-y-1 text-sm text-muted-foreground flex-1">
        {/* TODO: Implement nav links with active state, icons, badges */}
        <p className="px-3 py-2 text-xs text-muted-foreground">TODO: Implement ClientNav links</p>
      </nav>
    </aside>
  );
}
