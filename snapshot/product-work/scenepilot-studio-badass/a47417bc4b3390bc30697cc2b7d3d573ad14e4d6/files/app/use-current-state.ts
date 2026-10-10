import { useCallback, useRef, useState, type SetStateAction } from "react";

/** Event-time state for async completions. Functional writes compose even before
 * React commits the next render; no side effects run inside React's updater. */
export function useCurrentState<T>(initial: T) {
  const [value, publish] = useState(initial);
  const current = useRef(value);
  const set = useCallback((next: SetStateAction<T>) => {
    current.current = typeof next === "function" ? (next as (value: T) => T)(current.current) : next;
    publish(current.current);
  }, []);
  return [value, set, current] as const;
}
