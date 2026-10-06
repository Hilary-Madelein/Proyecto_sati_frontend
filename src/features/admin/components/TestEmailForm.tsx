"use client";

import { useActionState } from "react";
import { SendIcon } from "@/components/ui/icons";
import { sendTestEmail } from "../actions";
import { FormMessage } from "./FormMessage";
import { buttonClass, Card, inputClass } from "./ui";

/** Envía un correo de prueba para comprobar que el servidor de correo (SMTP) funciona. */
export function TestEmailForm({ defaultEmail }: { defaultEmail?: string }) {
  const [state, action, pending] = useActionState(sendTestEmail, undefined);

  return (
    <Card className="p-5">
      <div className="flex items-start gap-3">
        <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-slate-100 text-slate-600 ring-1 ring-slate-900/5">
          <SendIcon className="size-4" />
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="font-semibold text-slate-900">Correo de prueba</h2>
          <p className="text-sm text-slate-500">Comprueba que el envío de alertas funciona antes de que ocurra un evento.</p>
          <form action={action} className="mt-3 flex flex-col gap-2 sm:flex-row">
            <label htmlFor="test-email" className="sr-only">
              Correo de destino
            </label>
            <input
              id="test-email"
              name="email"
              type="email"
              required
              defaultValue={String(state?.values?.email ?? defaultEmail ?? "")}
              placeholder="correo@ejemplo.ec"
              className={inputClass}
            />
            <button type="submit" disabled={pending} className={buttonClass("dark", "shrink-0")}>
              {pending ? "Enviando…" : "Enviar prueba"}
            </button>
          </form>
          {state && (
            <div className="mt-3">
              <FormMessage tone={state.ok ? "success" : "error"}>{state.message}</FormMessage>
            </div>
          )}
        </div>
      </div>
    </Card>
  );
}
