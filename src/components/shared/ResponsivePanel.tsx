"use client";

import { useEffect, useRef, useState, type CSSProperties, type KeyboardEvent, type PointerEvent, type ReactNode } from "react";
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

/** Alturas de la hoja en móvil: solo la cabecera, media pantalla o casi completa. */
type Snap = "collapsed" | "half" | "full";
const SNAPS: readonly Snap[] = ["collapsed", "half", "full"];
const SNAP_FRACTION = { half: 0.5, full: 0.92 } as const;
/** Velocidad (px/ms) a partir de la cual un gesto rápido pasa a la altura siguiente. */
const FLICK_SPEED = 0.5;
/** Arrastrar por debajo de esta fracción de la altura mínima cierra la hoja. */
const CLOSE_RATIO = 0.6;

interface Drag {
  startY: number;
  startHeight: number;
  lastY: number;
  lastTime: number;
  speed: number;
  moved: boolean;
}

/**
 * Panel con efecto vidrio que flota sobre el mapa en escritorio y se convierte
 * en hoja inferior en pantallas pequeñas. En móvil la hoja se arrastra desde la
 * barra o la cabecera entre tres alturas (cabecera sola, media pantalla, casi
 * completa); arrastrarla hasta abajo la cierra. Solo usa clases responsivas
 * (sin `matchMedia`), así el HTML del servidor coincide con el del cliente.
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
  const headerRef = useRef<HTMLElement>(null);
  const drag = useRef<Drag | null>(null);
  const [snap, setSnap] = useState<Snap>("half");
  /** Altura en px mientras se arrastra (null = la de `snap`). */
  const [dragHeight, setDragHeight] = useState<number | null>(null);
  /** Altura de la hoja minimizada (barra + cabecera), medida al minimizar. */
  const [collapsedPx, setCollapsedPx] = useState(88);

  // Cada vez que se abre en móvil empieza a media pantalla.
  const [wasOpen, setWasOpen] = useState(mobileOpen);
  if (mobileOpen !== wasOpen) {
    setWasOpen(mobileOpen);
    if (mobileOpen) setSnap("half");
  }

  // Al abrir la hoja en móvil, el botón que la abrió desaparece: se mueve el foco
  // al panel para que el teclado (Escape, Tab) y los lectores de pantalla sigan ahí.
  useEffect(() => {
    if (mobileOpen) sectionRef.current?.focus({ preventScroll: true });
  }, [mobileOpen]);

  if (!mobileOpen && !desktopOpen) return null;

  const containerHeight = () => sectionRef.current?.parentElement?.clientHeight ?? window.innerHeight;
  const measureCollapsed = () => {
    const header = headerRef.current;
    return header ? header.offsetTop + header.offsetHeight : collapsedPx;
  };
  const heightOf = (target: Snap) =>
    target === "collapsed" ? measureCollapsed() : containerHeight() * SNAP_FRACTION[target];

  const goTo = (target: Snap) => {
    if (target === "collapsed") setCollapsedPx(measureCollapsed());
    setSnap(target);
    setDragHeight(null);
  };

  const onPointerDown = (event: PointerEvent<HTMLElement>) => {
    // Solo arrastre táctil o con el botón principal, y no desde el botón de cerrar.
    if (event.button !== 0 || (event.target as HTMLElement).closest("button[data-close]")) return;
    const height = sectionRef.current?.getBoundingClientRect().height ?? heightOf(snap);
    drag.current = { startY: event.clientY, startHeight: height, lastY: event.clientY, lastTime: event.timeStamp, speed: 0, moved: false };
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const onPointerMove = (event: PointerEvent<HTMLElement>) => {
    const current = drag.current;
    if (!current) return;
    const delta = event.clientY - current.startY;
    if (!current.moved && Math.abs(delta) < 4) return;
    current.moved = true;
    const elapsed = Math.max(event.timeStamp - current.lastTime, 1);
    current.speed = (event.clientY - current.lastY) / elapsed;
    current.lastY = event.clientY;
    current.lastTime = event.timeStamp;
    setDragHeight(Math.min(Math.max(current.startHeight - delta, 0), heightOf("full")));
  };

  const onPointerUp = (event: PointerEvent<HTMLElement>) => {
    const current = drag.current;
    drag.current = null;
    if (!current) return;
    event.currentTarget.releasePointerCapture(event.pointerId);

    // Toque sin arrastre: pasa a la altura siguiente (y de la más alta vuelve a la mínima).
    if (!current.moved) {
      goTo(SNAPS[(SNAPS.indexOf(snap) + 1) % SNAPS.length]);
      return;
    }

    const height = current.startHeight - (event.clientY - current.startY);
    const collapsed = measureCollapsed();
    if (height < collapsed * CLOSE_RATIO) {
      setDragHeight(null);
      onClose();
      return;
    }

    let target: Snap;
    if (current.speed > FLICK_SPEED) {
      // Gesto rápido hacia abajo: la primera altura por debajo de donde se soltó.
      target = [...SNAPS].reverse().find((item) => heightOf(item) < height) ?? "collapsed";
    } else if (current.speed < -FLICK_SPEED) {
      // Gesto rápido hacia arriba: la primera altura por encima de donde se soltó.
      target = SNAPS.find((item) => heightOf(item) > height) ?? "full";
    } else {
      target = SNAPS.reduce((best, item) => (Math.abs(heightOf(item) - height) < Math.abs(heightOf(best) - height) ? item : best));
    }
    goTo(target);
  };

  const onHandleKeyDown = (event: KeyboardEvent<HTMLElement>) => {
    const index = SNAPS.indexOf(snap);
    if (event.key === "ArrowUp" && index < SNAPS.length - 1) goTo(SNAPS[index + 1]);
    else if (event.key === "ArrowDown" && index > 0) goTo(SNAPS[index - 1]);
    else if (event.key === "Enter" || event.key === " ") goTo(SNAPS[(index + 1) % SNAPS.length]);
    else return;
    event.preventDefault();
  };

  // Altura de la hoja en móvil (en escritorio la variable no se usa).
  const sheetHeight =
    dragHeight !== null
      ? `${dragHeight}px`
      : snap === "collapsed"
        ? `${collapsedPx}px`
        : `${SNAP_FRACTION[snap] * 100}%`;

  const dragHandlers = { onPointerDown, onPointerMove, onPointerUp, onPointerCancel: onPointerUp };

  return (
    <section
      ref={sectionRef}
      tabIndex={-1}
      aria-label={title}
      onKeyDown={(event) => {
        if (event.key === "Escape") onClose();
      }}
      style={{ "--sheet-h": sheetHeight } as CSSProperties}
      className={cn(
        "absolute z-1100 flex flex-col overflow-hidden outline-none bg-white/90 shadow-2xl ring-1 shadow-slate-900/20 ring-slate-900/10 backdrop-blur-xl",
        // Móvil: hoja inferior a todo el ancho, con la altura que se elija arrastrando.
        "inset-x-0 bottom-0 rounded-t-3xl max-lg:h-(--sheet-h)",
        dragHeight === null && "max-lg:transition-[height] max-lg:duration-200 max-lg:ease-out",
        // Tablet: hoja flotante centrada.
        "md:right-auto md:bottom-4 md:left-1/2 md:w-140 md:-translate-x-1/2 md:rounded-3xl",
        // Escritorio: panel flotante.
        "lg:translate-x-0 lg:rounded-2xl",
        !mobileOpen && "max-lg:hidden",
        !desktopOpen && "lg:hidden",
        desktopClassName,
      )}
    >
      {/* Barra para arrastrar (móvil): tocarla cambia de altura; con teclado, ↑ y ↓. */}
      <div
        role="slider"
        tabIndex={0}
        aria-label={`Altura del panel ${title.toLowerCase()}`}
        aria-valuemin={0}
        aria-valuemax={2}
        aria-valuenow={SNAPS.indexOf(snap)}
        aria-valuetext={snap === "collapsed" ? "minimizado" : snap === "half" ? "media pantalla" : "pantalla completa"}
        onKeyDown={onHandleKeyDown}
        {...dragHandlers}
        className="flex shrink-0 cursor-grab touch-none justify-center pt-2 pb-1 outline-none focus-visible:bg-slate-100 active:cursor-grabbing lg:hidden"
      >
        <span aria-hidden="true" className="h-1.5 w-12 rounded-full bg-slate-300" />
      </div>

      <header
        ref={headerRef}
        {...dragHandlers}
        className="flex shrink-0 touch-none items-center gap-3 border-b border-slate-200/80 px-4 py-3 select-none max-lg:cursor-grab lg:touch-auto lg:select-auto"
      >
        {icon}
        <div className="min-w-0 flex-1">
          <h2 className="truncate text-sm font-semibold text-slate-900">{title}</h2>
          {subtitle && <p className="truncate text-xs text-slate-500">{subtitle}</p>}
        </div>
        <button
          type="button"
          data-close
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
