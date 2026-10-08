"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { CloseIcon } from "@/components/ui/icons";

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: ReactNode;
}

/**
 * Ventana modal con el `<dialog>` nativo: el navegador se encarga del foco,
 * de la tecla Esc y de bloquear el resto de la página. El contenido solo se
 * monta mientras está abierta, así los formularios empiezan limpios.
 */
export function Modal({ open, onClose, title, description, children }: ModalProps) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      onClose={onClose}
      // Clic en el fondo oscuro (fuera del contenido) = cerrar.
      onClick={(event) => event.target === ref.current && onClose()}
      aria-labelledby="modal-title"
      className="m-auto max-h-[calc(100dvh-2rem)] w-[calc(100%-2rem)] max-w-2xl flex-col overflow-hidden rounded-2xl bg-white p-0 shadow-2xl ring-1 ring-slate-900/10 backdrop:bg-slate-950/50 backdrop:backdrop-blur-[2px] open:flex"
    >
      {open && (
        <>
          <div className="flex items-start gap-4 border-b border-slate-100 px-5 py-4 sm:px-6">
            <div className="min-w-0 flex-1">
              <h2 id="modal-title" className="text-lg font-semibold text-slate-900">
                {title}
              </h2>
              {description && <p className="mt-0.5 text-sm text-slate-500">{description}</p>}
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label="Cerrar"
              className="-mr-1 grid size-9 shrink-0 place-items-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-700"
            >
              <CloseIcon className="size-4" />
            </button>
          </div>
          <div className="overflow-y-auto px-5 py-5 sm:px-6">{children}</div>
        </>
      )}
    </dialog>
  );
}
