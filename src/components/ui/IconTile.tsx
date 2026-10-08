import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

/** Cuadro redondeado con un ícono; el color se pasa con clases (p. ej. "bg-blue-50 text-blue-600"). */
export function IconTile({ children, className }: { children: ReactNode; className: string }) {
  return (
    <span aria-hidden="true" className={cn("grid size-9 shrink-0 place-items-center rounded-xl", className)}>
      {children}
    </span>
  );
}
