"use client";

import { useEffect, useState } from "react";
import { satiClientGet } from "@/lib/api/sati-client";
import { DATA_REFRESH_MS } from "../constants";
import type { EventSeverity } from "../types";

/** Eventos de un día, por severidad. */
export type DaySeverityCounts = Partial<Record<EventSeverity, number>>;

export interface EventsPerDay {
  /** Días en Ecuador (AAAA-MM-DD), del más antiguo a hoy, también los que no tienen eventos. */
  days: { day: string; counts: DaySeverityCounts; total: number }[];
  total: number;
}

// Ecuador continental usa UTC-5 todo el año.
const ECUADOR_OFFSET_MS = -5 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Eventos registrados por la SNGR (abiertos y cerrados) en cada uno de los
 * últimos `days` días, del resumen del backend (GET /events/summary, `byDay`):
 * solo las cifras, no la lista de eventos. Se actualiza cada DATA_REFRESH_MS.
 */
export function useEventsPerDay(days: number) {
  const [data, setData] = useState<EventsPerDay | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    const load = () => {
      const today = Date.parse(new Date(Date.now() + ECUADOR_OFFSET_MS).toISOString().slice(0, 10));
      const dayList = Array.from({ length: days }, (_, i) => new Date(today - (days - 1 - i) * DAY_MS).toISOString().slice(0, 10));
      satiClientGet<{ byDay?: Record<string, DaySeverityCounts> }>("/events/summary", { from: `${dayList[0]}T00:00:00-05:00` }, controller.signal)
        .then(({ byDay }) => {
          // Un backend anterior no trae los días: no se muestra el gráfico.
          if (!byDay) {
            setData(null);
            return;
          }
          const rows = dayList.map((day) => {
            const counts = byDay[day] ?? {};
            return { day, counts, total: Object.values(counts).reduce((sum, value) => sum + (value ?? 0), 0) };
          });
          setData({ days: rows, total: rows.reduce((sum, row) => sum + row.total, 0) });
          setError(null);
        })
        .catch((reason: Error) => {
          if (reason.name !== "AbortError") setError(reason.message);
        });
    };
    load();
    const interval = setInterval(load, DATA_REFRESH_MS);
    return () => {
      controller.abort();
      clearInterval(interval);
    };
  }, [days]);

  return { data, error };
}
