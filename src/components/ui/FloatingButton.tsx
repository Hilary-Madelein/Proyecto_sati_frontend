import type { ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/cn";

/** Botón con efecto vidrio que flota sobre el mapa. */
export function FloatingButton({ className, ...props }: ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type="button"
      className={cn(
        "z-1000 flex items-center gap-2 rounded-xl bg-white/90 px-4 py-2.5 text-sm font-semibold text-slate-800 shadow-lg ring-1 shadow-slate-900/10 ring-slate-900/10 backdrop-blur-md transition hover:bg-white hover:text-slate-950",
        "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600",
        className,
      )}
      {...props}
    />
  );
}
