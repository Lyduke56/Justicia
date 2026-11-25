/**
 * The three loading illustrations in public/assets, and how one is chosen.
 *
 * Every new loading screen gets a random GIF, never the one shown last (also across reloads, via
 * sessionStorage). A screen that takes over from another one still on screen keeps its GIF: the
 * shell's transition overlay hands over to a route's loading.tsx without the picture changing.
 */
export const LOADING_GIFS = [
  '/assets/loading_bars.gif',
  '/assets/loading_drawer.gif',
  '/assets/loading_files.gif',
] as const;

export type LoadingGif = (typeof LOADING_GIFS)[number];

const STORAGE_KEY = 'justicia:last-loading-gif';
/** A loader mounting this soon after another one closed continues the same loading screen. */
const HANDOFF_MS = 350;

let current: LoadingGif | null = null;
let visibleLoaders = 0;
let lastHiddenAt = 0;

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

/** The GIF for a loading screen that is about to appear. */
export function pickLoadingGif(): LoadingGif {
  if (typeof window === 'undefined') return LOADING_GIFS[0];
  const continuing = current && (visibleLoaders > 0 || Date.now() - lastHiddenAt < HANDOFF_MS);
  if (continuing && current) return current;

  const previous = current ?? readStored();
  const choices = LOADING_GIFS.filter((gif) => gif !== previous);
  const next = choices[Math.floor(Math.random() * choices.length)] ?? LOADING_GIFS[0];
  current = next;
  store(next);
  return next;
}

/** Loaders report while they are on screen, so a loader replacing them keeps the same GIF. */
export function loaderShown() {
  visibleLoaders += 1;
}

export function loaderHidden() {
  visibleLoaders = Math.max(0, visibleLoaders - 1);
  lastHiddenAt = Date.now();
}

let warmed = false;

/**
 * Downloads the GIFs in the background (one at a time, when the browser is idle) so the first
 * loading screen doesn't wait for its own picture. Safe to call many times.
 */
export function warmLoadingGifs() {
  if (warmed || typeof window === 'undefined') return;
  warmed = true;
  const idle = (cb: () => void) => {
    const w = window as Window & { requestIdleCallback?: (cb: () => void, o?: { timeout: number }) => number };
    if (w.requestIdleCallback) w.requestIdleCallback(cb, { timeout: 4000 });
    else setTimeout(cb, 1500);
  };
  const load = (index: number) => {
    if (index >= LOADING_GIFS.length) return;
    idle(() => {
      const img = new Image();
      img.decoding = 'async';
      const next = () => load(index + 1);
      img.onload = next;
      img.onerror = next;
      img.src = LOADING_GIFS[index];
    });
  };
  load(0);
}
