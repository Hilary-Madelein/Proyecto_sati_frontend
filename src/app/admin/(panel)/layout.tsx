import Link from "next/link";
import { LogOutIcon, MapIcon } from "@/components/ui/icons";
import { logout } from "@/features/admin/actions";
import { AdminNav } from "@/features/admin/components/AdminNav";
import { Avatar } from "@/features/admin/components/ui";
import { getCurrentAdmin } from "@/features/admin/lib/session";

/**
 * Marco del panel: barra lateral en escritorio, barra superior en móvil.
 * La sesión NO se verifica aquí (los layouts no se vuelven a ejecutar al
 * navegar): la verifica cada página y cada Server Action. Aquí solo se lee
 * la cuenta para mostrar el nombre.
 */
export default async function AdminPanelLayout({ children }: LayoutProps<"/admin">) {
  const admin = await getCurrentAdmin().catch(() => null);

  return (
    <div className="flex min-h-0 flex-1 flex-col bg-slate-50 lg:flex-row">
      <aside className="shrink-0 border-b border-slate-200 bg-white lg:flex lg:w-64 lg:flex-col lg:border-r lg:border-b-0">
        <div className="flex items-center justify-between gap-3 px-4 pt-3 lg:block lg:px-5 lg:pt-6">
          <div>
            <p className="text-[11px] font-bold tracking-[0.2em] text-blue-600 uppercase">Administración</p>
            <p className="font-semibold text-slate-900">Alertas por correo</p>
          </div>
          <div className="flex items-center gap-1 lg:hidden">
            <Link href="/" className="grid size-9 place-items-center rounded-lg text-slate-500 hover:bg-slate-100" aria-label="Ver mapa">
              <MapIcon className="size-4" />
            </Link>
            <form action={logout}>
              <button type="submit" aria-label="Cerrar sesión" className="grid size-9 place-items-center rounded-lg text-slate-500 hover:bg-slate-100">
                <LogOutIcon className="size-4" />
              </button>
            </form>
          </div>
        </div>

        <div className="px-3 py-2 lg:mt-6 lg:flex-1 lg:px-3">
          <AdminNav />
        </div>

        <div className="hidden border-t border-slate-100 p-3 lg:block">
          <Link href="/" className="flex items-center gap-2.5 rounded-xl px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100">
            <MapIcon className="size-4 text-slate-400" />
            Ver mapa
          </Link>
          {admin && (
            <div className="mt-2 flex items-center gap-3 rounded-xl bg-slate-50 p-3 ring-1 ring-slate-900/5">
              <Avatar name={admin.name} className="size-9 text-xs" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-slate-900">{admin.name}</p>
                <p className="truncate text-xs text-slate-500">{admin.email}</p>
              </div>
              <form action={logout}>
                <button
                  type="submit"
                  aria-label="Cerrar sesión"
                  title="Cerrar sesión"
                  className="grid size-8 place-items-center rounded-lg text-slate-400 hover:bg-white hover:text-slate-700"
                >
                  <LogOutIcon className="size-4" />
                </button>
              </form>
            </div>
          )}
        </div>
      </aside>

      <main className="min-h-0 flex-1 overflow-y-auto">
        <div className="mx-auto max-w-5xl px-4 py-6 sm:px-6 lg:py-8">{children}</div>
      </main>
    </div>
  );
}
