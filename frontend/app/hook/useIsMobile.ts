"use client";
import { useSyncExternalStore } from "react";

function subscribe(breakpoint: number, callback: () => void) {
  const mq = window.matchMedia(`(max-width: ${breakpoint}px)`);
  mq.addEventListener("change", callback);
  return () => mq.removeEventListener("change", callback);
}

export function useIsMobile(breakpoint = 768): boolean {
  return useSyncExternalStore(
    (callback) => subscribe(breakpoint, callback),
    () => window.matchMedia(`(max-width: ${breakpoint}px)`).matches,
    () => false, // server snapshot — matches SSR default, avoids hydration mismatch
  );
}
