import type { ReactNode } from "react";
import { useFullWorkspaceControls } from "./studio-shell";

export function InspectorSection({ title, children, defaultOpen = false }: { title: string; children: ReactNode; defaultOpen?: boolean }) {
  const full = useFullWorkspaceControls();
  return full ? <section className="inspector-section"><h3>{title}</h3>{children}</section> : <details className="inspector-section" open={defaultOpen}><summary>{title}</summary>{children}</details>;
}
