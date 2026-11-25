/**
 * Set while this tab is signing out on purpose, so the live session check (LiveProvider) does
 * not race the sign-out and send the tab to /login instead of the landing page.
 */
let leaving = false;

export function markLeaving(): void {
  leaving = true;
}

export function isLeaving(): boolean {
  return leaving;
}

/** Full page load to the landing page, so no signed-in state survives in memory. */
export function leaveToLanding(): void {
  markLeaving();
  window.location.replace('/');
}
