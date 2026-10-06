import type { Metadata } from "next";
import { SubscribersManager } from "@/features/admin/components/SubscribersManager";
import { SummaryCards } from "@/features/admin/components/SummaryCards";
import { TestEmailForm } from "@/features/admin/components/TestEmailForm";
import { LoadError } from "@/features/admin/components/ui";
import { AdminApiError, adminRequest } from "@/features/admin/lib/admin-api";
import { requireAdmin } from "@/features/admin/lib/session";
import type { NotificationsSummary, Subscriber } from "@/features/admin/types";

export const metadata: Metadata = { title: "Suscriptores · Administración · SATI.EC" };

export default async function SubscribersPage() {
  const admin = await requireAdmin();

  let subscribers: Subscriber[];
  let provinces: string[];
  let summary: NotificationsSummary;
  try {
    [subscribers, provinces, summary] = await Promise.all([
      adminRequest<Subscriber[]>("/notifications/subscribers"),
      adminRequest<string[]>("/notifications/provinces"),
      adminRequest<NotificationsSummary>("/notifications/summary"),
    ]);
  } catch (error) {
    // Solo los errores de la API; los demás (p. ej. la redirección al login) deben seguir su curso.
    if (!(error instanceof AdminApiError)) throw error;
    return <LoadError message={error.message} />;
  }

  return (
    <div className="space-y-6">
      <SubscribersManager subscribers={subscribers} provinces={provinces} summary={<SummaryCards summary={summary} />} />
      <TestEmailForm defaultEmail={admin.email} />
    </div>
  );
}
