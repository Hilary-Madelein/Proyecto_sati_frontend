import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { MailIcon, ShieldIcon, UsersIcon } from "@/components/ui/icons";
import { LoginForm } from "@/features/admin/components/LoginForm";
import { getCurrentAdmin } from "@/features/admin/lib/session";

export const metadata: Metadata = { title: "Ingresar · Administración · SATI.EC" };

const FEATURES = [
  { icon: UsersIcon, text: "Quién recibe las alertas y de qué provincias" },
  { icon: MailIcon, text: "Historial de cada correo enviado" },
  { icon: ShieldIcon, text: "Cuentas personales para cada administrador" },
] as const;

export default async function AdminLoginPage() {
  // Si el backend no responde, se muestra igual el formulario (el error aparecerá al ingresar).
  if (await getCurrentAdmin().catch(() => null)) redirect("/admin");

  return (
    <main className="grid min-h-0 flex-1 place-items-center overflow-y-auto bg-slate-100 p-4 sm:p-8">
      <div className="grid w-full max-w-4xl overflow-hidden rounded-3xl bg-white shadow-2xl ring-1 shadow-slate-900/10 ring-slate-900/5 md:grid-cols-[1fr_1.1fr]">
        <section className="relative hidden overflow-hidden bg-brand-950 p-10 text-white md:block">
          <div
            aria-hidden="true"
            className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_left,rgb(56_189_248/0.25),transparent_60%),radial-gradient(ellipse_at_bottom_right,rgb(37_99_235/0.3),transparent_55%)]"
          />
          <div aria-hidden="true" className="header-ripples absolute inset-0 opacity-60" />
          <div className="relative flex h-full flex-col">
            <p className="text-[11px] font-bold tracking-[0.25em] text-sky-300 uppercase">SATI.EC</p>
            <h2 className="mt-3 text-2xl leading-snug font-semibold">Panel de administración de alertas</h2>
            <p className="mt-2 text-sm leading-relaxed text-slate-300">
              Gestiona los avisos por correo que se envían cuando se registra un evento grave.
            </p>
            <ul className="mt-8 space-y-4">
              {FEATURES.map(({ icon: Icon, text }) => (
                <li key={text} className="flex items-center gap-3 text-sm text-slate-200">
                  <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-white/10 ring-1 ring-white/15">
                    <Icon className="size-4 text-sky-300" />
                  </span>
                  {text}
                </li>
              ))}
            </ul>
            <div aria-hidden="true" className="mt-auto flex h-1 overflow-hidden rounded-full pt-10">
              <span className="h-1 flex-2 bg-ec-yellow" />
              <span className="h-1 flex-1 bg-ec-blue" />
              <span className="h-1 flex-1 bg-ec-red" />
            </div>
          </div>
        </section>

        <section className="p-6 sm:p-10">
          <span className="grid size-11 place-items-center rounded-2xl bg-blue-50 text-blue-600 ring-1 ring-blue-600/10">
            <ShieldIcon className="size-5" />
          </span>
          <h1 className="mt-5 text-2xl font-semibold tracking-tight text-slate-900">Iniciar sesión</h1>
          <p className="mt-1 mb-6 text-sm text-slate-500">Entra con tu cuenta de administrador.</p>
          <LoginForm />
          <p className="mt-6 text-xs leading-relaxed text-slate-500">
            ¿No tienes cuenta u olvidaste tu contraseña? Pídela a otro administrador del sistema.
          </p>
        </section>
      </div>
    </main>
  );
}
