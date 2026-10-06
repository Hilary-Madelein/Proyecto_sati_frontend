import Link from "next/link";
import type { ReactNode } from "react";
import { AlertTriangleIcon, MailIcon, SendIcon, UsersIcon } from "@/components/ui/icons";
import { cn } from "@/lib/cn";
import type { NotificationsSummary } from "../types";

/** Indicadores de la cabecera: suscriptores, envíos recientes y estado del correo. */
export function SummaryCards({ summary }: { summary: NotificationsSummary }) {
  const { subscribers, deliveries, emailConfigured } = summary;
  return (
    <div className="grid gap-3 sm:grid-cols-3">
      <Stat icon={<UsersIcon className="size-5" />} tone="blue" label="Reciben alertas">
        <span className="text-2xl font-semibold text-slate-900">{subscribers.active}</span>
        <span className="text-sm text-slate-500"> de {subscribers.total} suscriptores</span>
      </Stat>

      <Stat icon={<SendIcon className="size-5" />} tone={deliveries.failed > 0 ? "red" : "green"} label={`Envíos · últimos ${deliveries.days} días`}>
        <span className="text-2xl font-semibold text-slate-900">{deliveries.sent}</span>
        <span className="text-sm text-slate-500"> enviados</span>
        {deliveries.failed > 0 && (
          <Link href="/admin/historial?estado=failed" className="ml-2 text-sm font-medium text-red-600 hover:underline">
            {deliveries.failed} fallidos
          </Link>
        )}
      </Stat>

      <Stat
        icon={emailConfigured ? <MailIcon className="size-5" /> : <AlertTriangleIcon className="size-5" />}
        tone={emailConfigured ? "green" : "amber"}
        label="Servidor de correo"
      >
        <span className="text-base font-semibold text-slate-900">{emailConfigured ? "Configurado" : "Sin configurar"}</span>
        {!emailConfigured && <p className="mt-0.5 text-xs text-slate-500">Falta SMTP en el backend: los correos solo van a su log.</p>}
      </Stat>
    </div>
  );
}

const TONES = {
  blue: "bg-blue-50 text-blue-600 ring-blue-600/10",
  green: "bg-emerald-50 text-emerald-600 ring-emerald-600/10",
  red: "bg-red-50 text-red-600 ring-red-600/10",
  amber: "bg-amber-50 text-amber-600 ring-amber-600/15",
} as const;

function Stat({ icon, tone, label, children }: { icon: ReactNode; tone: keyof typeof TONES; label: string; children: ReactNode }) {
  return (
    <div className="flex items-start gap-3 rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-900/5">
      <span className={cn("grid size-10 shrink-0 place-items-center rounded-xl ring-1", TONES[tone])}>{icon}</span>
      <div className="min-w-0">
        <p className="text-xs font-medium text-slate-500">{label}</p>
        <div className="mt-0.5">{children}</div>
      </div>
    </div>
  );
}
