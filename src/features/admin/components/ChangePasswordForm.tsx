"use client";

import { useActionState } from "react";
import { changePassword } from "../actions";
import { PASSWORD_MIN_LENGTH } from "../constants";
import { FormMessage } from "./FormMessage";
import { PasswordInput } from "./PasswordInput";
import { buttonClass, Field } from "./ui";

/** Cambio de la propia contraseña (también el obligatorio tras una contraseña temporal). */
export function ChangePasswordForm({ forced }: { forced: boolean }) {
  const [state, action, pending] = useActionState(changePassword, undefined);

  return (
    <form action={action} className="space-y-4">
      <Field id="currentPassword" label={forced ? "Contraseña temporal" : "Contraseña actual"} error={state?.errors?.currentPassword}>
        <PasswordInput
          id="currentPassword"
          name="currentPassword"
          autoComplete="current-password"
          invalid={Boolean(state?.errors?.currentPassword)}
          autoFocus={forced}
        />
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field
          id="newPassword"
          label="Nueva contraseña"
          error={state?.errors?.newPassword}
          hint={`Mínimo ${PASSWORD_MIN_LENGTH} caracteres. Una frase de varias palabras es fácil de recordar y difícil de adivinar.`}
        >
          <PasswordInput id="newPassword" name="newPassword" autoComplete="new-password" invalid={Boolean(state?.errors?.newPassword)} />
        </Field>
        <Field id="confirmPassword" label="Repite la nueva contraseña" error={state?.errors?.confirmPassword}>
          <PasswordInput
            id="confirmPassword"
            name="confirmPassword"
            autoComplete="new-password"
            invalid={Boolean(state?.errors?.confirmPassword)}
          />
        </Field>
      </div>
      {state && !state.errors && <FormMessage tone={state.ok ? "success" : "error"}>{state.message}</FormMessage>}
      <div className="flex justify-end border-t border-slate-100 pt-5">
        <button type="submit" disabled={pending} className={buttonClass("primary")}>
          {pending ? "Guardando…" : forced ? "Guardar y continuar" : "Cambiar contraseña"}
        </button>
      </div>
    </form>
  );
}
