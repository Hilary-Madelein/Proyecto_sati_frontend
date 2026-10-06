"use client";

import { useState, type ChangeEvent } from "react";
import { CheckIcon, CopyIcon, EyeIcon, EyeOffIcon, RefreshIcon } from "@/components/ui/icons";
import { cn } from "@/lib/cn";
import { inputClass } from "./ui";

interface PasswordInputProps {
  id: string;
  name: string;
  autoComplete: "current-password" | "new-password";
  invalid?: boolean;
  autoFocus?: boolean;
  /** Muestra «Generar» y «Copiar»: para contraseñas temporales que se comparten. */
  generator?: boolean;
}

/** Sin caracteres que se confunden al dictarlos o copiarlos (0/O, 1/l/I). */
const ALPHABET = "abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789";

/** Contraseña al azar de 14 caracteres (unos 80 bits), generada en el navegador. */
function randomPassword(length = 14): string {
  const bytes = crypto.getRandomValues(new Uint32Array(length));
  return Array.from(bytes, (value) => ALPHABET[value % ALPHABET.length]).join("");
}

/** Campo de contraseña con botón para mostrarla u ocultarla. */
export function PasswordInput({ id, name, autoComplete, invalid, autoFocus, generator = false }: PasswordInputProps) {
  const [visible, setVisible] = useState(false);
  const [value, setValue] = useState("");
  const [copied, setCopied] = useState(false);

  const generate = () => {
    setValue(randomPassword());
    setVisible(true);
    setCopied(false);
  };

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value);
    } catch {
      // Sin permiso para el portapapeles (o sin HTTPS): se deja visible para copiarla a mano.
      setVisible(true);
      return;
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2_000);
  };

  return (
    <div className="flex gap-2">
      <div className="relative min-w-0 flex-1">
        <input
          id={id}
          name={name}
          type={visible ? "text" : "password"}
          autoComplete={autoComplete}
          autoFocus={autoFocus}
          required
          // Solo con generador se controla el valor (para poder generarlo y copiarlo); si no,
          // React vacía el campo al terminar la acción, como debe pasar con una contraseña.
          {...(generator && {
            value,
            onChange: (event: ChangeEvent<HTMLInputElement>) => {
              setValue(event.target.value);
              setCopied(false);
            },
          })}
          aria-invalid={invalid || undefined}
          aria-describedby={invalid ? `${id}-error` : undefined}
          spellCheck={false}
          className={cn(inputClass, "pr-11", visible && "font-mono tracking-wide")}
        />
        <button
          type="button"
          onClick={() => setVisible((current) => !current)}
          aria-label={visible ? "Ocultar contraseña" : "Mostrar contraseña"}
          aria-pressed={visible}
          className="absolute inset-y-0 right-0 grid w-11 place-items-center rounded-r-xl text-slate-400 hover:text-slate-700"
        >
          {visible ? <EyeOffIcon className="size-4" /> : <EyeIcon className="size-4" />}
        </button>
      </div>
      {generator && (
        <>
          <button
            type="button"
            onClick={generate}
            title="Generar una contraseña segura"
            className="flex shrink-0 items-center gap-1.5 rounded-xl px-3 text-sm font-medium text-slate-700 ring-1 ring-slate-300 hover:bg-slate-50"
          >
            <RefreshIcon className="size-4" />
            <span className="hidden sm:inline">Generar</span>
          </button>
          <button
            type="button"
            onClick={copy}
            disabled={!value}
            aria-label="Copiar contraseña"
            title="Copiar"
            className="grid w-10 shrink-0 place-items-center rounded-xl text-slate-600 ring-1 ring-slate-300 hover:bg-slate-50 disabled:opacity-40"
          >
            {copied ? <CheckIcon className="size-4 text-emerald-600" /> : <CopyIcon className="size-4" />}
          </button>
        </>
      )}
    </div>
  );
}
