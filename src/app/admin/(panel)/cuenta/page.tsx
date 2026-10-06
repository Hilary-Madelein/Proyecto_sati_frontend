import type { Metadata } from "next";
import { KeyIcon, ShieldIcon } from "@/components/ui/icons";
import { formatDateTime } from "@/lib/format";
import { ChangePasswordForm } from "@/features/admin/components/ChangePasswordForm";
import { Avatar, Card, PageHeader } from "@/features/admin/components/ui";
import { requireAdmin } from "@/features/admin/lib/session";

export const metadata: Metadata = { title: "Mi cuenta · Administración · SATI.EC" };

export default async function AccountPage() {
  const admin = await requireAdmin({ allowPendingPassword: true });

  return (
    <div className="space-y-6">
      <PageHeader title="Mi cuenta" description="Tus datos de acceso al panel." />

      {admin.mustChangePassword && (
        <div role="alert" className="flex items-start gap-3 rounded-2xl bg-amber-50 p-4 ring-1 ring-amber-600/20">
          <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-amber-100 text-amber-700">
            <KeyIcon className="size-4" />
          </span>
          <div>
            <p className="font-semibold text-amber-900">Crea tu propia contraseña para continuar</p>
            <p className="text-sm text-amber-800">
              Entraste con una contraseña temporal que te dio otro administrador. Cámbiala por una que solo tú conozcas.
            </p>
          </div>
        </div>
      )}

      <Card className="flex items-center gap-4 p-5">
        <Avatar name={admin.name} className="size-14 text-lg" />
        <div className="min-w-0">
          <p className="text-lg font-semibold text-slate-900">{admin.name}</p>
          <p className="truncate text-sm text-slate-500">{admin.email}</p>
          <p className="mt-0.5 text-xs text-slate-400">Cuenta creada el {formatDateTime(admin.createdAt)}</p>
        </div>
      </Card>

      <Card className="p-5 sm:p-6">
        <h2 className="flex items-center gap-2 font-semibold text-slate-900">
          <ShieldIcon className="size-4 text-slate-400" />
          Cambiar contraseña
        </h2>
        <p className="mt-1 mb-5 text-sm text-slate-500">Al cambiarla se cierran tus sesiones en otros dispositivos.</p>
        <ChangePasswordForm forced={admin.mustChangePassword} />
      </Card>
    </div>
  );
}
