"use client";

import { useSyncExternalStore } from "react";

const PHONE_QUERY = "(max-width: 760px), (pointer: coarse) and (max-width: 1024px) and (max-height: 500px)";

function subscribe(onChange: () => void) {
  const media = window.matchMedia(PHONE_QUERY);
  media.addEventListener("change", onChange);
  return () => media.removeEventListener("change", onChange);
}

function getSnapshot() {
  return new URLSearchParams(window.location.search).get("mobile") === "1"
    || window.matchMedia(PHONE_QUERY).matches;
}

/** CSS-sized phone workspace, including landscape; the server stays hydration-safe. */
export function useMobileWorkspace() {
  return useSyncExternalStore(subscribe, getSnapshot, () => false);
}
