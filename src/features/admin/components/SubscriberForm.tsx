"use client";

import { useActionState, useEffect, useState } from "react";
import { CheckIcon } from "@/components/ui/icons";
import { cn } from "@/lib/cn";
import { saveSubscriber } from "../actions";
import { MIN_SEVERITY_OPTIONS } from "../constants";
import type { Subscriber } from "../types";
import { FormMessage } from "./FormMessage";
import { buttonClass, Field, inputClass } from "./ui";

interface SubscriberFormProps {
  /** Suscriptor a editar; sin él, el formulario crea uno nuevo. */
  subscriber?: Subscriber;
  provinces: readonly string[];
  onDone: (message: string) => void;
  onCancel: () => void;
}

export function SubscriberForm({ subscriber, provinces, onDone, onCancel }: SubscriberFormProps) {
  const [state, action, pending] = useActionState(saveSubscriber, undefined);
  const [selected, setSelected] = useState<string[]>(subscriber?.provinces ?? []);
  const [severity, setSeverity] = useState<string>(subscriber?.minSeverity ?? "high");
  // Tras un error se muestran los valores enviados; si no, los del suscriptor.
  const values = state?.values ?? {
    name: subscriber?.name ?? "",
    email: subscriber?.email ?? "",
    active: subscriber?.active ?? true,
  };

  useEffect(() => {
    if (state?.ok) onDone(state.message);
  }, [state, onDone]);

  const toggleProvince = (province: string) =>
    setSelected((current) => (current.includes(province) ? current.filter((item) => item !== province) : [...current, province]));

  return (
    <form action={action} className="space-y-6">
      {subscriber && <input type="hidden" name="id" value={subscriber.id} />}

      <div className="grid gap-4 sm:grid-cols-2">
        <Field id="name" label="Nombre" error={state?.errors?.name}>
          <input
            id="name"
            name="name"
            defaultValue={String(values.name)}
            required
            maxLength={120}
            autoFocus
            placeholder="Ana Pérez"
            aria-invalid={Boolean(state?.errors?.name) || undefined}
            className={inputClass}
          />
        </Field>
        <Field id="email" label="Correo" error={state?.errors?.email}>
          <input
            id="email"
            name="email"
            type="email"
            defaultValue={String(values.email)}
            required
            maxLength={254}
            placeholder="ana.perez@ejemplo.ec"
            aria-invalid={Boolean(state?.errors?.email) || undefined}
            className={inputClass}
          />
        </Field>
      </div>

      <fieldset>
        <legend className="mb-2 text-sm font-medium text-slate-700">Severidad que recibe</legend>
        <div className="grid gap-2 sm:grid-cols-2">
          {MIN_SEVERITY_OPTIONS.map((option) => (
            <label
              key={option.value}
              className={cn(
                "flex cursor-pointer items-start gap-3 rounded-xl p-3.5 transition",
                severity === option.value ? "bg-blue-50/70 ring-2 ring-blue-500" : "ring-1 ring-slate-200 hover:bg-slate-50",
              )}
            >
              <input
                type="radio"
                name="minSeverity"
                value={option.value}
                checked={severity === option.value}
                onChange={() => setSeverity(option.value)}
                className="mt-0.5 accent-blue-600"
              />
              <span>
                <span className="block text-sm font-medium text-slate-900">{option.label}</span>
                <span className="block text-xs text-slate-500">{option.description}</span>
              </span>
            </label>
          ))}
        </div>
      </fieldset>

      <fieldset>
        <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
          <legend className="text-sm font-medium text-slate-700">Provincias</legend>
          <span className="text-xs text-slate-500">
            {selected.length === 0 ? (
              "Ninguna marcada: recibe alertas de todo el país"
            ) : (
              <>
                {selected.length} seleccionadas ·{" "}
                <button type="button" onClick={() => setSelected([])} className="font-medium text-blue-700 hover:underline">
                  quitar todas
                </button>
              </>
            )}
          </span>
        </div>
        <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-3">
          {provinces.map((province) => {
            const checked = selected.includes(province);
            return (
              <label
                key={province}
                className={cn(
                  "flex cursor-pointer items-center gap-2 rounded-lg px-2.5 py-2 text-sm ring-1 transition-colors",
                  "has-focus-visible:outline-2 has-focus-visible:outline-offset-1 has-focus-visible:outline-blue-600",
                  checked ? "bg-blue-50 font-medium text-blue-800 ring-blue-500" : "text-slate-700 ring-slate-200 hover:bg-slate-50",
                )}
              >
                <input
                  type="checkbox"
                  name="provinces"
                  value={province}
                  checked={checked}
                  onChange={() => toggleProvince(province)}
                  className="sr-only"
                />
                <span
                  aria-hidden="true"
                  className={cn(
                    "grid size-4 shrink-0 place-items-center rounded ring-1",
                    checked ? "bg-blue-600 text-white ring-blue-600" : "bg-white ring-slate-300",
                  )}
                >
                  {checked && <CheckIcon className="size-3" />}
                </span>
                <span className="truncate" title={province}>
                  {province}
                </span>
              </label>
            );
          })}
        </div>
      </fieldset>

      <label className="flex cursor-pointer items-start gap-3 rounded-xl bg-slate-50 p-3.5 ring-1 ring-slate-200">
        <input type="checkbox" name="active" defaultChecked={Boolean(values.active)} className="mt-0.5 accent-blue-600" />
        <span>
          <span className="block text-sm font-medium text-slate-900">Recibir alertas</span>
          <span className="block text-xs text-slate-500">Si lo desmarcas, queda registrado pero en pausa.</span>
        </span>
      </label>

      {state && !state.ok && <FormMessage tone="error">{state.message}</FormMessage>}

      <div className="sticky -bottom-5 -mx-5 -mb-5 flex flex-col-reverse gap-2 border-t border-slate-100 bg-white px-5 py-4 sm:-mx-6 sm:flex-row sm:justify-end sm:px-6">
        <button type="button" onClick={onCancel} className={buttonClass("secondary")}>
          Cancelar
        </button>
        <button type="submit" disabled={pending} className={buttonClass("primary")}>
          {pending ? "Guardando…" : subscriber ? "Guardar cambios" : "Registrar suscriptor"}
        </button>
      </div>
    </form>
  );
}
