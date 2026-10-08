"use client";

import { useActionState, useEffect, useState, useTransition } from "react";
import { KeyIcon, PlusIcon, TrashIcon } from "@/components/ui/icons";
import { cn } from "@/lib/cn";
import { formatTimeAgo } from "@/lib/format";
import { createAdminUser, deleteAdminUser, resetAdminPassword, setAdminUserActive } from "../actions";
import { PASSWORD_MIN_LENGTH } from "../constants";
import type { ActionState, AdminUser } from "../types";
import { FormMessage } from "./FormMessage";
import { Modal } from "./Modal";
import { PasswordInput } from "./PasswordInput";
import { Avatar, Badge, buttonClass, Card, Field, iconButtonClass, inputClass, PageHeader } from "./ui";

interface AdminUsersManagerProps {
  users: AdminUser[];
  currentUserId: string;
}

/** Modal abierto: alta de cuenta o contraseña temporal para una cuenta. */
type Dialog = { kind: "create" } | { kind: "reset"; user: AdminUser } | null;

/** Cuentas de administración: alta, desactivación, contraseña temporal y baja. */
export function AdminUsersManager({ users, currentUserId }: AdminUsersManagerProps) {
  const [dialog, setDialog] = useState<Dialog>(null);
  const [notice, setNotice] = useState<ActionState>(undefined);
  const [confirmingDelete, setConfirmingDelete] = useState<string | null>(null);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  const run = (id: string, action: () => Promise<ActionState>) => {
    setPendingId(id);
    startTransition(async () => {
      setNotice(await action());
      setPendingId(null);
      setConfirmingDelete(null);
    });
  };

  const finish = (message: string) => {
    setDialog(null);
    setNotice({ ok: true, message });
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Administradores"
        description="Cada persona entra con su propio correo y contraseña. Las contraseñas se guardan cifradas (hash) y nadie puede verlas."
        actions={
          <button
            type="button"
            onClick={() => {
              setNotice(undefined);
              setDialog({ kind: "create" });
            }}
            className={buttonClass("primary")}
          >
            <PlusIcon className="size-4" />
            Nueva cuenta
          </button>
        }
      />

      {notice && <FormMessage tone={notice.ok ? "success" : "error"}>{notice.message}</FormMessage>}

      <Card className="overflow-hidden">
        <ul className="divide-y divide-slate-100">
          {users.map((user) => {
            const isSelf = user.id === currentUserId;
            const busy = pendingId === user.id;
            return (
              <li key={user.id} className={cn("flex flex-col gap-3 px-4 py-4 sm:flex-row sm:items-center", busy && "opacity-60")}>
                <div className="flex min-w-0 flex-1 items-start gap-3">
                  <Avatar name={user.name} muted={!user.active} />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className={cn("font-medium", user.active ? "text-slate-900" : "text-slate-500")}>{user.name}</p>
                      {isSelf && <Badge tone="blue">Tú</Badge>}
                      {!user.active && <Badge>Desactivada</Badge>}
                      {user.active && user.mustChangePassword && <Badge tone="amber">Contraseña temporal</Badge>}
                    </div>
                    <p className="truncate text-sm text-slate-500">{user.email}</p>
                    <p className="mt-0.5 text-xs text-slate-400">
                      {user.lastLoginAt ? `Último ingreso ${formatTimeAgo(user.lastLoginAt)}` : "Nunca ha ingresado"}
                    </p>
                  </div>
                </div>

                {!isSelf && (
                  <div className="flex items-center gap-1 pl-13 sm:shrink-0 sm:pl-0">
                    {confirmingDelete === user.id ? (
                      <div className="flex items-center gap-2 rounded-xl bg-red-50 py-1 pr-1 pl-3 ring-1 ring-red-600/15">
                        <span className="text-sm font-medium text-red-700">¿Eliminar la cuenta?</span>
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => run(user.id, () => deleteAdminUser(user.id))}
                          className={buttonClass("danger", "px-3 py-1.5")}
                        >
                          Eliminar
                        </button>
                        <button type="button" onClick={() => setConfirmingDelete(null)} className={buttonClass("ghost", "px-3 py-1.5")}>
                          No
                        </button>
                      </div>
                    ) : (
                      <>
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => run(user.id, () => setAdminUserActive(user.id, !user.active))}
                          className={buttonClass("secondary", "px-3 py-1.5 text-xs")}
                        >
                          {user.active ? "Desactivar" : "Activar"}
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setNotice(undefined);
                            setDialog({ kind: "reset", user });
                          }}
                          aria-label={`Contraseña temporal para ${user.name}`}
                          title="Poner contraseña temporal"
                          className={iconButtonClass()}
                        >
                          <KeyIcon className="size-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => setConfirmingDelete(user.id)}
                          aria-label={`Eliminar la cuenta de ${user.name}`}
                          title="Eliminar"
                          className={iconButtonClass("danger")}
                        >
                          <TrashIcon className="size-4" />
                        </button>
                      </>
                    )}
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      </Card>

      <Modal
        open={dialog?.kind === "create"}
        onClose={() => setDialog(null)}
        title="Nueva cuenta de administración"
        description="Define una contraseña temporal y compártela por un medio seguro: se pedirá cambiarla al entrar."
      >
        <CreateUserForm onDone={finish} onCancel={() => setDialog(null)} />
      </Modal>

      <Modal
        open={dialog?.kind === "reset"}
        onClose={() => setDialog(null)}
        title="Contraseña temporal"
        description={dialog?.kind === "reset" ? `Para ${dialog.user.name} (${dialog.user.email}). Se cerrarán sus sesiones abiertas.` : undefined}
      >
        {dialog?.kind === "reset" && <ResetPasswordForm user={dialog.user} onDone={finish} onCancel={() => setDialog(null)} />}
      </Modal>
    </div>
  );
}

function useCloseOnSuccess(state: ActionState, onDone: (message: string) => void) {
  useEffect(() => {
    if (state?.ok) onDone(state.message);
  }, [state, onDone]);
}

const TEMPORARY_HINT = `Mínimo ${PASSWORD_MIN_LENGTH} caracteres. Usa «Generar» para crear una segura.`;

function CreateUserForm({ onDone, onCancel }: { onDone: (message: string) => void; onCancel: () => void }) {
  const [state, action, pending] = useActionState(createAdminUser, undefined);
  useCloseOnSuccess(state, onDone);

  return (
    <form action={action} className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field id="admin-name" label="Nombre" error={state?.errors?.name}>
          <input
            id="admin-name"
            name="name"
            required
            maxLength={120}
            autoFocus
            defaultValue={String(state?.values?.name ?? "")}
            aria-invalid={Boolean(state?.errors?.name) || undefined}
            className={inputClass}
          />
        </Field>
        <Field id="admin-email" label="Correo" error={state?.errors?.email}>
          <input
            id="admin-email"
            name="email"
            type="email"
            required
            maxLength={254}
            autoComplete="off"
            defaultValue={String(state?.values?.email ?? "")}
            aria-invalid={Boolean(state?.errors?.email) || undefined}
            className={inputClass}
          />
        </Field>
      </div>
      <Field id="admin-password" label="Contraseña temporal" error={state?.errors?.password} hint={TEMPORARY_HINT}>
        <PasswordInput id="admin-password" name="password" autoComplete="new-password" invalid={Boolean(state?.errors?.password)} generator />
      </Field>
      {state && !state.ok && !state.errors && <FormMessage tone="error">{state.message}</FormMessage>}
      <FormActions pending={pending} label="Crear cuenta" onCancel={onCancel} />
    </form>
  );
}

function ResetPasswordForm({ user, onDone, onCancel }: { user: AdminUser; onDone: (message: string) => void; onCancel: () => void }) {
  const [state, action, pending] = useActionState(resetAdminPassword, undefined);
  useCloseOnSuccess(state, onDone);

  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="id" value={user.id} />
      <Field id="reset-password" label="Nueva contraseña temporal" error={state?.errors?.password} hint={TEMPORARY_HINT}>
        <PasswordInput
          id="reset-password"
          name="password"
          autoComplete="new-password"
          invalid={Boolean(state?.errors?.password)}
          autoFocus
          generator
        />
      </Field>
      {state && !state.ok && !state.errors && <FormMessage tone="error">{state.message}</FormMessage>}
      <FormActions pending={pending} label="Asignar contraseña" onCancel={onCancel} />
    </form>
  );
}

function FormActions({ pending, label, onCancel }: { pending: boolean; label: string; onCancel: () => void }) {
  return (
    <div className="flex flex-col-reverse gap-2 border-t border-slate-100 pt-5 sm:flex-row sm:justify-end">
      <button type="button" onClick={onCancel} className={buttonClass("secondary")}>
        Cancelar
      </button>
      <button type="submit" disabled={pending} className={buttonClass("primary")}>
        {pending ? "Guardando…" : label}
      </button>
    </div>
  );
}
