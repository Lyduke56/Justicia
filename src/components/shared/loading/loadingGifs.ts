/**
 * The three loading illustrations, and how one is chosen.
 *
 * Assets: public/assets/loading/*.vN.webp — the original 800×800 GIFs (public/assets/*.gif,
 * 1.8–6.8 MB each) re-encoded as 360×360 animated WebP (~0.25–0.4 MB each; 360px is twice the
 * largest size the loader shows, so it stays sharp on high-density screens). next.config.ts
 * caches this folder for a year, so when a picture changes, save it under a new version number
 * (e.g. bars.v2.webp) and update the list below.
 *
 * Every new loading screen gets a random picture, never the one shown last (also across reloads,
 * via sessionStorage). A screen that takes over from another one still on screen keeps its
 * picture: the shell's transition overlay hands over to a route's loading screen without the
 * picture changing.
 */
export const LOADING_GIFS = [
  '/assets/loading/bars.v1.webp',
  '/assets/loading/drawer.v1.webp',
  '/assets/loading/files.v1.webp',
] as const;

export type LoadingGif = (typeof LOADING_GIFS)[number];

const STORAGE_KEY = 'justicia:last-loading-gif';
/**
 * A loader asking for a picture this soon after the last pick (or after another loader closed)
 * continues the same loading screen. This also makes the pick idempotent when React renders a
 * component twice (Strict Mode, or a render it throws away), so two loaders on screen can never
 * disagree about the picture.
 */
const HANDOFF_MS = 350;

let current: LoadingGif | null = null;
let visibleLoaders = 0;
/** Last time a picture was picked or a loader closed. */
let lastActiveAt = 0;

function readStored(): LoadingGif | null {
  try {
    const value = window.sessionStorage.getItem(STORAGE_KEY);
    return (LOADING_GIFS as readonly string[]).includes(value ?? '') ? (value as LoadingGif) : null;
  } catch {
    return null;
  }
}

function store(gif: LoadingGif) {
  try {
    window.sessionStorage.setItem(STORAGE_KEY, gif);
  } catch {
    // Private mode or storage disabled: the in-memory value still avoids repeats in this tab.
  }
}

/** The picture for a loading screen that is about to appear. */
export function pickLoadingGif(): LoadingGif {
  if (typeof window === 'undefined') return LOADING_GIFS[0];
  const now = Date.now();
  if (current && (visibleLoaders > 0 || now - lastActiveAt < HANDOFF_MS)) {
    lastActiveAt = now;
    return current;
  }

  const previous = current ?? readStored();
  const choices = LOADING_GIFS.filter((gif) => gif !== previous);
  const next = choices[Math.floor(Math.random() * choices.length)] ?? LOADING_GIFS[0];
  current = next;
  lastActiveAt = now;
  store(next);
  return next;
}

/** Loaders report while they are on screen, so a loader replacing them keeps the same picture. */
export function loaderShown() {
  visibleLoaders += 1;
}

export function loaderHidden() {
  visibleLoaders = Math.max(0, visibleLoaders - 1);
  lastActiveAt = Date.now();
}

let warmed = false;

/**
 * Downloads the pictures in the background so a loading screen never waits for its own picture.
 * Starts right away (they are small, and a loading screen can come at any moment), one after
 * another at low priority so they don't compete with the page. Safe to call many times.
 */
export function warmLoadingGifs() {
  if (warmed || typeof window === 'undefined') return;
  warmed = true;
  const load = (index: number) => {
    if (index >= LOADING_GIFS.length) return;
    const img = new Image();
    img.decoding = 'async';
    (img as HTMLImageElement & { fetchPriority?: string }).fetchPriority = 'low';
    const next = () => load(index + 1);
    img.onload = next;
    img.onerror = next;
    img.src = LOADING_GIFS[index];
  };
  load(0);
}
