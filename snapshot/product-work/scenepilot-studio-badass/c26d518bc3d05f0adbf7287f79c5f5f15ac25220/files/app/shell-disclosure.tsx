"use client";

import { useEffect, useRef, type KeyboardEvent, type ReactNode } from "react";

/** Shared dismissal for disclosures with either menu or custom settings content. */
export function useDismissibleDisclosure() {
  const ref = useRef<HTMLDetailsElement>(null);
  useEffect(() => {
    const outside = (event: PointerEvent) => {
      if (ref.current?.open && event.target instanceof Node && !ref.current.contains(event.target)) ref.current.open = false;
    };
    document.addEventListener("pointerdown", outside);
    return () => document.removeEventListener("pointerdown", outside);
  }, []);
  const onKeyDown = (event: KeyboardEvent<HTMLDetailsElement>) => {
    if (event.key === "Escape" && event.currentTarget.open) {
      event.preventDefault(); event.stopPropagation(); event.currentTarget.open = false;
      event.currentTarget.querySelector("summary")?.focus();
    }
  };
  return { ref, onKeyDown };
}

/** Native disclosure semantics: Tab visits actions, Escape returns to its trigger. */
export function ShellDisclosure({ label, children, className = "", closeOnAction = false, expanded = false }: { label: ReactNode; children: ReactNode; className?: string; closeOnAction?: boolean; expanded?: boolean }) {
  const disclosure = useDismissibleDisclosure();
  const { ref } = disclosure;
  if (expanded) return <div className={`shell-expanded ${className}`}>{children}</div>;
  return <details {...disclosure} className={`shell-disclosure ${className}`}>
    <summary>{label}</summary>
    <div className="shell-disclosure-content" onClick={(event) => {
      if (closeOnAction && event.target instanceof Element && event.target.closest("button:not(:disabled)") && ref.current) {
        ref.current.open = false; ref.current.querySelector("summary")?.focus();
      }
    }}>{children}</div>
  </details>;
}
