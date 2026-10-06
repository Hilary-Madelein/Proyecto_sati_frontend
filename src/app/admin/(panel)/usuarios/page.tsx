import type { Metadata } from "next";
import { AdminUsersManager } from "@/features/admin/components/AdminUsersManager";
import { LoadError } from "@/features/admin/components/ui";
import { AdminApiError, adminRequest } from "@/features/admin/lib/admin-api";
import { requireAdmin } from "@/features/admin/lib/session";
import type { AdminUser } from "@/features/admin/types";

export const metadata: Metadata = { title: "Administradores · Administración · SATI.EC" };

export default async function AdminUsersPage() {
  const admin = await requireAdmin();

  let users: AdminUser[];
  try {
    users = await adminRequest<AdminUser[]>("/admin/users");
  } catch (error) {
    if (!(error instanceof AdminApiError)) throw error;
    return <LoadError message={error.message} />;
  }
  return <AdminUsersManager users={users} currentUserId={admin.id} />;
}
