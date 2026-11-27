'use client';

/**
 * The per-slot loading store and contexts behind screen readiness (see ScreenReadiness.tsx).
 * Kept on their own so ScreenLoader can read them without importing the gate (which imports
 * ScreenLoader through the transition overlay).
 */
import { createContext, useContext, useId, useLayoutEffect } from 'react';

// ─── Store: what is still loading, per slot ───────────────────────────────────

export interface ScreenStore {
  set(slot: string, id: string, loading: boolean): void;
  remove(slot: string, id: string): void;
  isBusy(slot: string): boolean;
  subscribe(listener: () => void): () => void;
  version(): number;
}

export function createScreenStore(): ScreenStore {
  const pending = new Map<string, Set<string>>();
  const listeners = new Set<() => void>();
  let v = 0;
  const emit = () => {
    v += 1;
    listeners.forEach((l) => l());
  };
  return {
    set(slot, id, loading) {
      const ids = pending.get(slot) ?? new Set<string>();
      const had = ids.has(id);
      if (loading === had) return;
      if (loading) ids.add(id);
      else ids.delete(id);
      pending.set(slot, ids);
      emit();
    },
    remove(slot, id) {
      const ids = pending.get(slot);
      if (ids?.delete(id)) emit();
    },
    isBusy(slot) {
      return (pending.get(slot)?.size ?? 0) > 0;
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    version: () => v,
  };
}

// ─── Contexts ─────────────────────────────────────────────────────────────────

export const SlotContext = createContext<{ store: ScreenStore; slot: string } | null>(null);

export interface ScreenReveal {
  /** The loading screen over this screen has lifted. */
  revealed: boolean;
  /** Changes every time the screen is revealed: key the entrance with it to replay it. */
  revealKey: number;
}
export const RevealContext = createContext<ScreenReveal>({ revealed: true, revealKey: 0 });

/**
 * Reports that this part of the screen is still loading its information. While any part of the
 * active screen reports `true`, the portal keeps its loading screen up.
 */
export function useScreenLoading(loading: boolean) {
  const ctx = useContext(SlotContext);
  const id = useId();
  // Layout effects: registered before the shell's (parent) effects decide anything.
  useLayoutEffect(() => {
    ctx?.store.set(ctx.slot, id, loading);
  }, [ctx, id, loading]);
  useLayoutEffect(() => {
    if (!ctx) return;
    return () => ctx.store.remove(ctx.slot, id);
  }, [ctx, id]);
}

/** Whether this screen has been revealed (its loading screen lifted), and a key per reveal. */
export function useScreenReveal(): ScreenReveal {
  return useContext(RevealContext);
}

/** True inside a portal shell's screen slot, where the shell draws the one loading screen. */
export function useInScreenSlot(): boolean {
  return useContext(SlotContext) !== null;
}
