"use client";

import { useEffect } from "react";

// This app's title never varies per route - every page inherits it
// unchanged from the root layout's metadata. Next's client-side router
// still briefly clears and rebuilds the <title> node on every navigation
// (even between two routes with identical, root-only metadata), which
// flashes an empty browser tab title for ~10-40ms. A MutationObserver
// callback runs as a microtask before the browser paints, so restoring the
// text here happens before that blank state is ever rendered to the screen.
export function TitleStabilizer() {
  useEffect(() => {
    const siteTitle = document.title;

    function restore() {
      if (document.title !== siteTitle) document.title = siteTitle;
    }

    const observer = new MutationObserver(restore);
    observer.observe(document.head, { subtree: true, childList: true, characterData: true });
    return () => observer.disconnect();
  }, []);

  return null;
}
