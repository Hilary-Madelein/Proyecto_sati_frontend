import type { ReactNode } from "react";
import { AlertTriangleIcon, CheckIcon } from "@/components/ui/icons";
import { cn } from "@/lib/cn";

/** Mensaje de resultado de un formulario (éxito o error), anunciado a lectores de pantalla. */
export function FormMessage({ tone, children }: { tone: "success" | "error"; children: ReactNode }) {
  const Icon = tone === "error" ? AlertTriangleIcon : CheckIcon;
  return (
    <p
      role={tone === "error" ? "alert" : "status"}
      className={cn(
        "flex items-start gap-2 rounded-xl px-3.5 py-2.5 text-sm ring-1",
        tone === "error" ? "bg-red-50 text-red-700 ring-red-600/15" : "bg-emerald-50 text-emerald-800 ring-emerald-600/15",
      )}
    >
      <Icon className="mt-0.5 size-4 shrink-0" />
      <span>{children}</span>
    </p>
  );
}
