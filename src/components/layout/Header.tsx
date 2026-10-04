import Image from "next/image";
import type { ReactNode } from "react";
import { BRAND } from "@/constants/brand";

/** Header institucional. `children` se muestra a la derecha (p. ej. el estado del sistema). */
export function Header({ children }: { children?: ReactNode }) {
  return (
    <header className="relative z-20 shrink-0 overflow-hidden bg-brand-950 text-white shadow-lg shadow-brand-950/30">
      {/* Fondo decorativo: brillo azul + ondas sutiles. */}
      <div
        aria-hidden="true"
        className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,rgb(56_189_248/0.18),transparent_55%),linear-gradient(to_right,var(--color-brand-950),var(--color-brand-900))]"
      />
      <div aria-hidden="true" className="header-ripples absolute inset-0" />

      <div className="relative flex h-16 items-center gap-4 px-4 sm:h-18 sm:px-6">
        <Image
          src={BRAND.logo.src}
          alt={BRAND.logo.alt}
          width={BRAND.logo.width}
          height={BRAND.logo.height}
          priority
          className="h-9 w-auto shrink-0 sm:h-11"
        />

        <div className="hidden items-center gap-4 lg:flex">
          <span aria-hidden="true" className="h-9 w-px bg-white/15" />
          <div className="leading-tight">
            <p className="text-[10px] font-bold tracking-[0.25em] text-sky-300 uppercase">{BRAND.appShortName}</p>
            <p className="text-sm font-semibold tracking-tight text-white">{BRAND.appTitle}</p>
          </div>
        </div>

        {children && <div className="ml-auto flex items-center gap-2">{children}</div>}
      </div>

      {/* Franja tricolor de la bandera: amarillo (doble), azul y rojo. */}
      <div aria-hidden="true" className="relative flex h-1">
        <span className="flex-2 bg-ec-yellow" />
        <span className="flex-1 bg-ec-blue" />
        <span className="flex-1 bg-ec-red" />
      </div>
    </header>
  );
}
