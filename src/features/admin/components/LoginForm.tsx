"use client";

import { useActionState } from "react";
import { login } from "../actions";
import { FormMessage } from "./FormMessage";
import { PasswordInput } from "./PasswordInput";
import { buttonClass, Field, inputClass } from "./ui";

export function LoginForm() {
  const [state, action, pending] = useActionState(login, undefined);

  return (
    <form action={action} className="space-y-4">
      <Field id="email" label="Correo">
        <input
          id="email"
          name="email"
          type="email"
          autoComplete="username"
          required
          autoFocus
          defaultValue={String(state?.values?.email ?? "")}
          placeholder="nombre@institucion.gob.ec"
          className={inputClass}
        />
      </Field>
      <Field id="password" label="Contraseña">
        <PasswordInput id="password" name="password" autoComplete="current-password" />
      </Field>
      {state && !state.ok && <FormMessage tone="error">{state.message}</FormMessage>}
      <button type="submit" disabled={pending} className={buttonClass("primary", "w-full py-3")}>
        {pending ? "Verificando…" : "Ingresar"}
      </button>
    </form>
  );
}
