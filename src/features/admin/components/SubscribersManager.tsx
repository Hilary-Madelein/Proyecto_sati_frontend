"use client";

import { useCallback, useMemo, useState, useTransition, type ReactNode } from "react";
import { MailIcon, MapPinIcon, PencilIcon, PlusIcon, SearchIcon, TrashIcon, UsersIcon } from "@/components/ui/icons";
import { Toggle } from "@/components/ui/Toggle";
import { cn } from "@/lib/cn";
import { deleteSubscriber, setSubscriberActive } from "../actions";
import { MIN_SEVERITY_LABELS } from "../constants";
import type { ActionState, Subscriber } from "../types";
import { FormMessage } from "./FormMessage";
import { Modal } from "./Modal";
import { SubscriberForm } from "./SubscriberForm";
import { Avatar, Badge, buttonClass, Card, EmptyState, iconButtonClass, inputClass, PageHeader } from "./ui";

interface SubscribersManagerProps {
  subscribers: Subscriber[];
  provinces: readonly string[];
  /** Indicadores que van bajo el título (se generan en el servidor). */
  summary: ReactNode;
}

type StatusFilter = "all" | "active" | "paused";

const FILTERS: readonly { value: StatusFilter; label: string }[] = [
  { value: "all", label: "Todos" },
  { value: "active", label: "Activos" },
  { value: "paused", label: "En pausa" },
];

/** Sin tildes ni mayúsculas, para buscar «rios» y encontrar «Los Ríos». */
const normalize = (text: string) => text.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();

/** Lista de suscriptores con búsqueda, alta, edición, pausa y baja. */
export function SubscribersManager({ subscribers, provinces, summary }: SubscribersManagerProps) {
  /** null = sin formulario; "new" = alta; un id = edición. */
  const [editing, setEditing] = useState<string | null>(null);
  const [notice, setNotice] = useState<ActionState>(undefined);
  const [confirmingDelete, setConfirmingDelete] = useState<string | null>(null);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<StatusFilter>("all");
  const [, startTransition] = useTransition();

  const closeForm = useCallback((message: string) => {
    setEditing(null);
    setNotice({ ok: true, message });
  }, []);

  const run = (id: string, action: () => Promise<ActionState>) => {
    setPendingId(id);
    startTransition(async () => {
      setNotice(await action());
      setPendingId(null);
      setConfirmingDelete(null);
    });
  };

  const openForm = (id: string) => {
    setNotice(undefined);
    setEditing(id);
  };

  const visible = useMemo(() => {
    const needle = normalize(query.trim());
    return subscribers.filter(
      (subscriber) =>
        (status === "all" || subscriber.active === (status === "active")) &&
        (!needle || normalize([subscriber.name, subscriber.email, ...subscriber.provinces].join(" ")).includes(needle)),
    );
  }, [subscribers, query, status]);

  const editingSubscriber = subscribers.find((subscriber) => subscriber.id === editing);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Suscriptores"
        description="Personas que reciben un correo cuando se registra un evento grave en sus provincias."
        actions={
          <button type="button" onClick={() => openForm("new")} className={buttonClass("primary")}>
            <PlusIcon className="size-4" />
            Nuevo suscriptor
          </button>
        }
      />

      {summary}

      {notice && <FormMessage tone={notice.ok ? "success" : "error"}>{notice.message}</FormMessage>}

      {subscribers.length === 0 ? (
        <EmptyState icon={<UsersIcon className="size-6" />} title="Nadie recibe alertas todavía">
          Registra a la primera persona con <strong>Nuevo suscriptor</strong>. Puedes elegir sus provincias y desde qué severidad
          recibe avisos.
        </EmptyState>
      ) : (
        <Card className="overflow-hidden">
          <div className="flex flex-col gap-3 border-b border-slate-100 p-3 sm:flex-row sm:items-center">
            <div className="relative flex-1">
              <SearchIcon className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-slate-400" />
              <input
                type="search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Buscar por nombre, correo o provincia"
                aria-label="Buscar suscriptores"
                className={cn(inputClass, "py-2 pl-9")}
              />
            </div>
            <div role="group" aria-label="Filtrar por estado" className="flex shrink-0 rounded-xl bg-slate-100 p-1">
              {FILTERS.map((filter) => (
                <button
                  key={filter.value}
                  type="button"
                  onClick={() => setStatus(filter.value)}
                  aria-pressed={status === filter.value}
                  className={cn(
                    "flex-1 rounded-lg px-3 py-1.5 text-xs font-semibold whitespace-nowrap transition",
                    status === filter.value ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-800",
                  )}
                >
                  {filter.label}
                </button>
              ))}
            </div>
          </div>

          {visible.length === 0 ? (
            <p className="px-4 py-10 text-center text-sm text-slate-500">Ningún suscriptor coincide con la búsqueda.</p>
          ) : (
            <ul className="divide-y divide-slate-100">
              {visible.map((subscriber) => (
                <SubscriberRow
                  key={subscriber.id}
                  subscriber={subscriber}
                  busy={pendingId === subscriber.id}
                  confirmingDelete={confirmingDelete === subscriber.id}
                  onToggle={(active) => run(subscriber.id, () => setSubscriberActive(subscriber.id, active))}
                  onEdit={() => openForm(subscriber.id)}
                  onAskDelete={() => setConfirmingDelete(subscriber.id)}
                  onCancelDelete={() => setConfirmingDelete(null)}
                  onDelete={() => run(subscriber.id, () => deleteSubscriber(subscriber.id))}
                />
              ))}
            </ul>
          )}
          <p className="border-t border-slate-100 bg-slate-50/60 px-4 py-2.5 text-xs text-slate-500">
            {visible.length === subscribers.length
              ? `${subscribers.length} suscriptores`
              : `${visible.length} de ${subscribers.length} suscriptores`}
          </p>
        </Card>
      )}

      <Modal
        open={editing !== null}
        onClose={() => setEditing(null)}
        title={editingSubscriber ? "Editar suscriptor" : "Nuevo suscriptor"}
        description={editingSubscriber ? editingSubscriber.email : "Recibirá un correo por cada evento grave que le corresponda."}
      >
        <SubscriberForm
          key={editing ?? ""}
          subscriber={editingSubscriber}
          provinces={provinces}
          onDone={closeForm}
          onCancel={() => setEditing(null)}
        />
      </Modal>
    </div>
  );
}

interface SubscriberRowProps {
  subscriber: Subscriber;
  busy: boolean;
  confirmingDelete: boolean;
  onToggle: (active: boolean) => void;
  onEdit: () => void;
  onAskDelete: () => void;
  onCancelDelete: () => void;
  onDelete: () => void;
}

function SubscriberRow({ subscriber, busy, confirmingDelete, onToggle, onEdit, onAskDelete, onCancelDelete, onDelete }: SubscriberRowProps) {
  return (
    <li className={cn("flex flex-col gap-3 px-4 py-4 transition sm:flex-row sm:items-center", busy && "opacity-60")}>
      <div className="flex min-w-0 flex-1 items-start gap-3">
        <Avatar name={subscriber.name} muted={!subscriber.active} />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className={cn("font-medium", subscriber.active ? "text-slate-900" : "text-slate-500")}>{subscriber.name}</p>
            {!subscriber.active && <Badge>En pausa</Badge>}
          </div>
          <p className="flex items-center gap-1.5 text-sm text-slate-500">
            <MailIcon className="size-3.5 shrink-0" />
            <span className="truncate">{subscriber.email}</span>
          </p>
          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            <Badge tone="orange">{MIN_SEVERITY_LABELS[subscriber.minSeverity]}</Badge>
            {subscriber.provinces.length === 0 ? (
              <Badge tone="blue">
                <MapPinIcon className="size-3" />
                Todo el país
              </Badge>
            ) : (
              subscriber.provinces.map((province) => <Badge key={province}>{province}</Badge>)
            )}
          </div>
        </div>
      </div>

      <div className="flex items-center gap-1 pl-13 sm:shrink-0 sm:pl-0">
        {confirmingDelete ? (
          <div className="flex items-center gap-2 rounded-xl bg-red-50 py-1 pr-1 pl-3 ring-1 ring-red-600/15">
            <span className="text-sm font-medium text-red-700">¿Eliminar?</span>
            <button type="button" disabled={busy} onClick={onDelete} className={buttonClass("danger", "px-3 py-1.5")}>
              Eliminar
            </button>
            <button type="button" onClick={onCancelDelete} className={buttonClass("ghost", "px-3 py-1.5")}>
              No
            </button>
          </div>
        ) : (
          <>
            <span className="mr-2 flex items-center gap-2 text-xs font-medium text-slate-500">
              {subscriber.active ? "Activo" : "Pausado"}
              <Toggle
                checked={subscriber.active}
                onChange={onToggle}
                label={`${subscriber.active ? "Pausar" : "Activar"} alertas de ${subscriber.name}`}
              />
            </span>
            <button type="button" onClick={onEdit} aria-label={`Editar a ${subscriber.name}`} title="Editar" className={iconButtonClass()}>
              <PencilIcon className="size-4" />
            </button>
            <button
              type="button"
              onClick={onAskDelete}
              aria-label={`Eliminar a ${subscriber.name}`}
              title="Eliminar"
              className={iconButtonClass("danger")}
            >
              <TrashIcon className="size-4" />
            </button>
          </>
        )}
      </div>
    </li>
  );
}
