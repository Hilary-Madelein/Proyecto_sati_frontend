import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

/** Piezas visuales compartidas por las pantallas del panel de administración. */

export const inputClass =
  "w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 shadow-xs outline-none transition placeholder:text-slate-400 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/15 aria-invalid:border-red-400 aria-invalid:focus:ring-red-500/15";

const BUTTON_VARIANTS = {
  primary: "bg-blue-600 text-white shadow-sm shadow-blue-600/20 hover:bg-blue-700",
  dark: "bg-slate-900 text-white shadow-sm hover:bg-slate-800",
  secondary: "bg-white text-slate-700 ring-1 ring-slate-300 shadow-xs hover:bg-slate-50",
  ghost: "text-slate-600 hover:bg-slate-100 hover:text-slate-900",
  danger: "bg-red-600 text-white shadow-sm hover:bg-red-700",
} as const;

export function buttonClass(variant: keyof typeof BUTTON_VARIANTS = "primary", className?: string) {
  return cn(
    "inline-flex items-center justify-center gap-1.5 rounded-xl px-4 py-2.5 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-60",
    "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600",
    BUTTON_VARIANTS[variant],
    className,
  );
}

/** Botón cuadrado solo con ícono (editar, borrar…). */
export const iconButtonClass = (tone: "default" | "danger" = "default") =>
  cn(
    "grid size-9 place-items-center rounded-lg text-slate-500 transition",
    "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600",
    tone === "danger" ? "hover:bg-red-50 hover:text-red-600" : "hover:bg-slate-100 hover:text-slate-900",
  );

/** Etiqueta + campo + ayuda o error. */
export function Field({
  id,
  label,
  error,
  hint,
  children,
  className,
}: {
  id: string;
  label: string;
  error?: string;
  hint?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={className}>
      <label htmlFor={id} className="mb-1.5 block text-sm font-medium text-slate-700">
        {label}
      </label>
      {children}
      {error ? (
        <p id={`${id}-error`} className="mt-1.5 text-xs font-medium text-red-600">
          {error}
        </p>
      ) : (
        hint && <p className="mt-1.5 text-xs text-slate-500">{hint}</p>
      )}
    </div>
  );
}

const BADGE_TONES = {
  slate: "bg-slate-100 text-slate-700 ring-slate-500/15",
  blue: "bg-blue-50 text-blue-700 ring-blue-600/15",
  green: "bg-emerald-50 text-emerald-700 ring-emerald-600/20",
  red: "bg-red-50 text-red-700 ring-red-600/15",
  amber: "bg-amber-50 text-amber-800 ring-amber-600/20",
  orange: "bg-orange-50 text-orange-700 ring-orange-600/15",
} as const;

export function Badge({ tone = "slate", children }: { tone?: keyof typeof BADGE_TONES; children: ReactNode }) {
  return (
    <span className={cn("inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1", BADGE_TONES[tone])}>
      {children}
    </span>
  );
}

export function Card({ className, children }: { className?: string; children: ReactNode }) {
  return <div className={cn("rounded-2xl bg-white shadow-sm ring-1 ring-slate-900/5", className)}>{children}</div>;
}

/** Título de página con descripción y acciones a la derecha. */
export function PageHeader({ title, description, actions }: { title: string; description?: ReactNode; actions?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-4">
      <div className="max-w-2xl min-w-64 flex-1">
        <h1 className="text-xl font-semibold tracking-tight text-slate-900 sm:text-2xl">{title}</h1>
        {description && <p className="mt-1 text-sm text-slate-500">{description}</p>}
      </div>
      {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
    </div>
  );
}

export function EmptyState({ icon, title, children }: { icon: ReactNode; title: string; children?: ReactNode }) {
  return (
    <Card className="flex flex-col items-center px-6 py-12 text-center">
      <span className="grid size-12 place-items-center rounded-2xl bg-blue-50 text-blue-600 ring-1 ring-blue-600/10">{icon}</span>
      <p className="mt-4 font-semibold text-slate-900">{title}</p>
      {children && <div className="mt-1 max-w-sm text-sm text-slate-500">{children}</div>}
    </Card>
  );
}

/** Círculo con las iniciales de una persona. */
export function Avatar({ name, muted = false, className }: { name: string; muted?: boolean; className?: string }) {
  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word[0]!.toUpperCase())
    .join("");
  return (
    <span
      aria-hidden="true"
      className={cn(
        "grid size-10 shrink-0 place-items-center rounded-full text-sm font-semibold",
        muted ? "bg-slate-100 text-slate-400" : "bg-gradient-to-br from-blue-500 to-sky-400 text-white shadow-sm",
        className,
      )}
    >
      {initials || "?"}
    </span>
  );
}

/** Mensaje de error al no poder cargar los datos de una página. */
export function LoadError({ message }: { message: string }) {
  return (
    <p role="alert" className="rounded-2xl bg-red-50 p-4 text-sm text-red-700 ring-1 ring-red-600/15">
      {message}
    </p>
  );
}
