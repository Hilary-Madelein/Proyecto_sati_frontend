"use client";

import { useEffect, useState } from "react";
import { satiClientGet } from "@/lib/api/sati-client";
import type { EventSeverity } from "../types";

/** Eventos por severidad. */
export type SeverityCounts = Partial<Record<EventSeverity, number>>;

/**
 * Eventos de un bloque de 24 h como los separa el panel de eventos: los
 * abiertos que muestra (con afectaciones, por severidad), los abiertos sin
 * afectaciones que oculta por defecto y los cerrados, que no muestra.
 */
export interface EventsDay {
  /** Bloques hacia atrás desde `until`: 0 = las últimas 24 h. */
  index: number;
  /** Inicio y fin del bloque (ISO 8601). */
  start: string;
  end: string;
  openBySeverity: SeverityCounts;
  open: number;
  withoutDamage: number;
  closed: number;
  total: number;
}

export interface EventsPerDay {
  /** Del bloque más antiguo al de las últimas 24 h, también los que no tienen eventos. */
  days: EventsDay[];
  total: number;
  open: number;
  withoutDamage: number;
  closed: number;
}

/** Lo que entrega el backend por bloque en `byLast24h`. */
interface GroupCounts {
  open: SeverityCounts;
  withoutDamage: number;
  closed: number;
}

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Eventos registrados por la SNGR en bloques de 24 h contados hacia atrás desde
 * `until`, en los grupos del panel de eventos (GET /events/summary, `byLast24h`):
 * solo las cifras, no la lista de eventos. Es la misma lógica del panel de
 * eventos: con `until` = su hora de consulta, el último bloque son sus "últimas
 * 24 h", y los últimos 3 y 7 suman sus "últimos 3 y 7 días". Se vuelve a pedir
 * cuando cambia `until` (cada vez que se actualiza el panel).
 */
export function useEventsPerDay(days: number, until: string) {
  const [data, setData] = useState<EventsPerDay | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    const end = Date.parse(until);
    satiClientGet<{ byLast24h?: Record<string, GroupCounts> }>(
      "/events/summary",
      { from: new Date(end - days * DAY_MS).toISOString(), to: until },
      controller.signal,
    )
      .then(({ byLast24h }) => {
        // Un backend anterior no trae los bloques: no se muestra el gráfico.
        if (!byLast24h) {
          setData(null);
          return;
        }
        const rows = Array.from({ length: days }, (_, i): EventsDay => {
          const index = days - 1 - i;
          const counts = byLast24h[String(index)] ?? { open: {}, withoutDamage: 0, closed: 0 };
          const open = Object.values(counts.open).reduce((sum, value) => sum + (value ?? 0), 0);
          return {
            index,
            start: new Date(end - (index + 1) * DAY_MS).toISOString(),
            end: new Date(end - index * DAY_MS).toISOString(),
            openBySeverity: counts.open,
            open,
            withoutDamage: counts.withoutDamage,
            closed: counts.closed,
            total: open + counts.withoutDamage + counts.closed,
          };
        });
        const sum = (key: "total" | "open" | "withoutDamage" | "closed") => rows.reduce((total, row) => total + row[key], 0);
        setData({ days: rows, total: sum("total"), open: sum("open"), withoutDamage: sum("withoutDamage"), closed: sum("closed") });
        setError(null);
      })
      .catch((reason: Error) => {
        if (reason.name !== "AbortError") setError(reason.message);
      });
    return () => controller.abort();
  }, [days, until]);

  return { data, error };
}
