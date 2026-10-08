"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { HistoryIcon, ShieldIcon, UserIcon, UsersIcon } from "@/components/ui/icons";
import { cn } from "@/lib/cn";

const LINKS = [
  { href: "/admin", label: "Suscriptores", icon: UsersIcon },
  { href: "/admin/historial", label: "Historial de envíos", icon: HistoryIcon },
  { href: "/admin/usuarios", label: "Administradores", icon: ShieldIcon },
  { href: "/admin/cuenta", label: "Mi cuenta", icon: UserIcon },
] as const;

/** Navegación del panel: columna en escritorio, fila desplazable en móvil. */
export function AdminNav() {
  const pathname = usePathname();
  return (
    <nav aria-label="Secciones de administración" className="flex gap-1 overflow-x-auto lg:flex-col lg:overflow-visible">
      {LINKS.map(({ href, label, icon: Icon }) => {
        const active = pathname === href;
        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "flex shrink-0 items-center gap-2.5 rounded-xl px-3 py-2 text-sm font-medium transition-colors lg:py-2.5",
              active ? "bg-blue-50 text-blue-700 ring-1 ring-blue-600/10" : "text-slate-600 hover:bg-slate-100 hover:text-slate-900",
            )}
          >
            <Icon className={cn("size-4", active ? "text-blue-600" : "text-slate-400")} />
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
