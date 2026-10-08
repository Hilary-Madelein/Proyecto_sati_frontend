import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";
import { HistoryIcon } from "@/components/ui/icons";
import { cn } from "@/lib/cn";
import { formatDateTime } from "@/lib/format";
import { DELIVERIES_PAGE_SIZE } from "@/features/admin/constants";
import { Badge, Card, EmptyState, LoadError, PageHeader } from "@/features/admin/components/ui";
import { AdminApiError, adminRequest } from "@/features/admin/lib/admin-api";
import { requireAdmin } from "@/features/admin/lib/session";
import type { DeliveriesPage, Delivery, DeliveryStatus } from "@/features/admin/types";

export const metadata: Metadata = { title: "Historial de envíos · Administración · SATI.EC" };

const FILTERS: readonly { value: DeliveryStatus | null; label: string }[] = [
  { value: null, label: "Todos" },
  { value: "sent", label: "Enviados" },
  { value: "failed", label: "Fallidos" },
];

function historyHref(status: DeliveryStatus | null, page = 1): string {
  const params = new URLSearchParams();
  if (status) params.set("estado", status);
  if (page > 1) params.set("page", String(page));
  const query = params.toString();
  return query ? `/admin/historial?${query}` : "/admin/historial";
}

export default async function DeliveriesHistoryPage({ searchParams }: PageProps<"/admin/historial">) {
  await requireAdmin();
  const { page: pageParam, estado } = await searchParams;
  const page = Math.max(1, Number.parseInt(String(pageParam ?? "1"), 10) || 1);
  const status = FILTERS.find((filter) => filter.value === estado)?.value ?? null;

  let data: DeliveriesPage;
  try {
    const query = new URLSearchParams({ limit: String(DELIVERIES_PAGE_SIZE), offset: String((page - 1) * DELIVERIES_PAGE_SIZE) });
    if (status) query.set("status", status);
    data = await adminRequest<DeliveriesPage>(`/notifications/deliveries?${query}`);
  } catch (error) {
    if (!(error instanceof AdminApiError)) throw error;
    return <LoadError message={error.message} />;
  }

  const pages = Math.max(1, Math.ceil(data.total / DELIVERIES_PAGE_SIZE));

  return (
    <div className="space-y-6">
      <PageHeader title="Historial de envíos" description="Cada correo de alerta o de prueba, del más reciente al más antiguo." />

      <nav aria-label="Filtrar por resultado" className="flex w-fit rounded-xl bg-slate-200/60 p-1">
        {FILTERS.map((filter) => {
          const active = filter.value === status;
          return (
            <Link
              key={filter.label}
              href={historyHref(filter.value)}
              aria-current={active ? "page" : undefined}
              className={cn(
                "rounded-lg px-3.5 py-1.5 text-sm font-semibold transition",
                active ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-800",
              )}
            >
              {filter.label}
            </Link>
          );
        })}
      </nav>

      {data.items.length === 0 ? (
        <EmptyState icon={<HistoryIcon className="size-6" />} title={status ? "No hay envíos con este resultado" : "Todavía no hay envíos"}>
          {!status && "Aquí aparecerá cada alerta enviada por correo. Puedes probar con «Correo de prueba» en Suscriptores."}
        </EmptyState>
      ) : (
        <Card className="overflow-hidden">
          <div className="hidden grid-cols-[9rem_1fr_7rem] gap-4 border-b border-slate-100 bg-slate-50/60 px-4 py-2.5 text-xs font-semibold tracking-wide text-slate-500 uppercase sm:grid">
            <span>Fecha</span>
            <span>Aviso y destinatario</span>
            <span className="text-right">Resultado</span>
          </div>
          <ul className="divide-y divide-slate-100">
            {data.items.map((delivery) => (
              <DeliveryRow key={delivery.id} delivery={delivery} />
            ))}
          </ul>
          <div className="flex items-center justify-between gap-2 border-t border-slate-100 bg-slate-50/60 px-4 py-2.5 text-sm">
            <span className="text-xs text-slate-500">
              {data.total} envíos{pages > 1 && ` · página ${page} de ${pages}`}
            </span>
            {pages > 1 && (
              <nav aria-label="Páginas del historial" className="flex gap-1">
                <PageLink href={historyHref(status, page - 1)} disabled={page <= 1}>
                  ← Anteriores
                </PageLink>
                <PageLink href={historyHref(status, page + 1)} disabled={page >= pages}>
                  Siguientes →
                </PageLink>
              </nav>
            )}
          </div>
        </Card>
      )}
    </div>
  );
}

function DeliveryRow({ delivery }: { delivery: Delivery }) {
  const failed = delivery.status === "failed";
  const isTest = delivery.alertKey.startsWith("test:");
  return (
    <li className="grid gap-1.5 px-4 py-3.5 sm:grid-cols-[9rem_1fr_7rem] sm:items-center sm:gap-4">
      <time dateTime={delivery.createdAt} className="order-2 text-xs text-slate-500 sm:order-0 sm:text-sm">
        {formatDateTime(delivery.createdAt)}
      </time>
      <div className="min-w-0">
        <p className="flex flex-wrap items-center gap-1.5 text-sm font-medium text-slate-900">
          {isTest && <Badge>Prueba</Badge>}
          <span className="min-w-0">{delivery.subject}</span>
        </p>
        <p className="truncate text-sm text-slate-500">
          Para {delivery.recipient} · por {delivery.channel === "email" ? "correo" : delivery.channel}
        </p>
        {failed && delivery.error && <p className="mt-1 text-xs text-red-600">{delivery.error}</p>}
      </div>
      <div className="order-first sm:order-0 sm:text-right">
        <Badge tone={failed ? "red" : "green"}>{failed ? "Falló" : "Enviado"}</Badge>
      </div>
    </li>
  );
}

function PageLink({ href, disabled, children }: { href: string; disabled: boolean; children: ReactNode }) {
  if (disabled) return <span className="rounded-lg px-3 py-1.5 font-medium text-slate-300">{children}</span>;
  return (
    <Link href={href} className="rounded-lg px-3 py-1.5 font-medium text-blue-700 hover:bg-blue-50">
      {children}
    </Link>
  );
}
