import { createElement, type ReactElement } from "react";
import { flushSync } from "react-dom";
import { createRoot } from "react-dom/client";

// Renders through react-dom/client rather than react-dom/server so tests
// exercise the same branch the app does - `useSyncExternalStore` reads its
// server snapshot under a server render, and this app never has one.
// `flushSync` keeps the render synchronous, so callers stay plain and sync.

/** The markup a component produces, for asserting on rendered output. */
export function renderMarkup(element: ReactElement): string {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);
  flushSync(() => root.render(element));
  // Read before unmounting: tearing the root down empties the container.
  const html = container.innerHTML;
  root.unmount();
  container.remove();
  return html;
}

/**
 * Runs a hook once and hands back what it returned. Hooks can't be called
 * outside a component, so it rides along on a throwaway one.
 */
export function renderHook<T>(hook: () => T): T {
  let result!: T;
  function Probe() {
    result = hook();
    return null;
  }
  renderMarkup(createElement(Probe));
  return result;
}
