"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { CloseIcon } from "@/components/ui/icons";
import { cn } from "@/lib/cn";

interface ResponsivePanelProps {
  title: string;
  subtitle?: ReactNode;
  /** Ícono de la cabecera (normalmente un <IconTile />). */
  icon?: ReactNode;
  /** Visible como hoja inferior (< lg). */
  mobileOpen: boolean;
  /** Visible como panel flotante (≥ lg). */
  desktopOpen: boolean;
  onClose: () => void;
  /**
   * Posición y tamaño en escritorio. Debe definir `lg:left-*`, `lg:right-*`,
   * `lg:top-*`/`lg:bottom-*`, `lg:w-*` y `lg:max-h-*`.
   */
  desktopClassName: string;
  /** Pie que solo se muestra en escritorio. */
  desktopFooter?: ReactNode;
  children: ReactNode;
}

/**
 * Panel con efecto vidrio que flota sobre el mapa en escritorio y se convierte
 * en hoja inferior en pantallas pequeñas. Solo usa clases responsivas (sin
 * `matchMedia`), así el HTML del servidor coincide con el del cliente.
 */
export function ResponsivePanel({
  title,
  subtitle,
  icon,
  mobileOpen,
  desktopOpen,
  onClose,
  desktopClassName,
  desktopFooter,
  children,
}: ResponsivePanelProps) {
  const sectionRef = useRef<HTMLElement>(null);

  // Al abrir la hoja en móvil, el botón que la abrió desaparece: se mueve el foco
  // al panel para que el teclado (Escape, Tab) y los lectores de pantalla sigan ahí.
  useEffect(() => {
    if (mobileOpen) sectionRef.current?.focus({ preventScroll: true });
  }, [mobileOpen]);

  if (!mobileOpen && !desktopOpen) return null;

  return (
    <section
      ref={sectionRef}
      tabIndex={-1}
      aria-label={title}
      onKeyDown={(event) => {
        if (event.key === "Escape") onClose();
      }}
      className={cn(
        "absolute z-1100 flex flex-col overflow-hidden outline-none bg-white/90 shadow-2xl ring-1 shadow-slate-900/20 ring-slate-900/10 backdrop-blur-xl",
        // Móvil: hoja inferior a todo el ancho.
        "inset-x-0 bottom-0 max-h-[80%] rounded-t-3xl",
        // Tablet: hoja flotante centrada.
        "md:right-auto md:bottom-4 md:left-1/2 md:w-140 md:-translate-x-1/2 md:rounded-3xl",
        // Escritorio: panel flotante.
        "lg:translate-x-0 lg:rounded-2xl",
        !mobileOpen && "max-lg:hidden",
        !desktopOpen && "lg:hidden",
        desktopClassName,
      )}
    >
      <span aria-hidden="true" className="mx-auto mt-2 h-1 w-10 shrink-0 rounded-full bg-slate-300 lg:hidden" />

      <header className="flex shrink-0 items-center gap-3 border-b border-slate-200/80 px-4 py-3">
        {icon}
        <div className="min-w-0 flex-1">
          <h2 className="truncate text-sm font-semibold text-slate-900">{title}</h2>
          {subtitle && <p className="truncate text-xs text-slate-500">{subtitle}</p>}
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label={`Cerrar ${title.toLowerCase()}`}
          className="grid size-8 shrink-0 place-items-center rounded-lg text-slate-500 transition hover:bg-slate-100 hover:text-slate-900 focus-visible:outline-2 focus-visible:outline-blue-600"
        >
          <CloseIcon className="size-4" />
        </button>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-4">{children}</div>

      {desktopFooter && (
        <div className="hidden shrink-0 border-t border-slate-200/80 p-2 lg:block">{desktopFooter}</div>
      )}
    </section>
  );
}
