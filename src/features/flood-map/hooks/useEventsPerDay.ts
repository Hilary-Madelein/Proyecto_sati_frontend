"use client";

import { useEffect, useState } from "react";
import { satiClientGet } from "@/lib/api/sati-client";
import { DATA_REFRESH_MS } from "../constants";
import type { EventSeverity } from "../types";

/** Eventos por severidad. */
export type SeverityCounts = Partial<Record<EventSeverity, number>>;

/**
 * Eventos de un día como los separa el panel de eventos: los abiertos que
 * muestra (con afectaciones, por severidad), los abiertos sin afectaciones que
 * oculta por defecto y los cerrados, que no muestra.
 */
export interface EventsDay {
  /** Día en Ecuador (AAAA-MM-DD). */
  day: string;
  openBySeverity: SeverityCounts;
  open: number;
  withoutDamage: number;
  closed: number;
  total: number;
}

export interface EventsPerDay {
  /** Del más antiguo a hoy, también los días sin eventos. */
  days: EventsDay[];
  total: number;
  open: number;
  withoutDamage: number;
  closed: number;
}

/** Lo que entrega el backend por día en `byDayStatus`. */
interface DayStatusCounts {
  open: SeverityCounts;
  withoutDamage: number;
  closed: number;
}

// Ecuador continental usa UTC-5 todo el año.
const ECUADOR_OFFSET_MS = -5 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Eventos registrados por la SNGR en cada uno de los últimos `days` días, en
 * los grupos del panel de eventos, del resumen del backend (GET /events/summary,
 * `byDayStatus`): solo las cifras, no la lista de eventos. Se actualiza cada
 * DATA_REFRESH_MS.
 */
export function useEventsPerDay(days: number) {
  const [data, setData] = useState<EventsPerDay | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    const load = () => {
      const today = Date.parse(new Date(Date.now() + ECUADOR_OFFSET_MS).toISOString().slice(0, 10));
      const dayList = Array.from({ length: days }, (_, i) => new Date(today - (days - 1 - i) * DAY_MS).toISOString().slice(0, 10));
      satiClientGet<{ byDayStatus?: Record<string, DayStatusCounts | Record<string, number>> }>(
        "/events/summary",
        { from: `${dayList[0]}T00:00:00-05:00` },
        controller.signal,
      )
        .then(({ byDayStatus }) => {
          // Un backend anterior no trae los grupos por día: no se muestra el gráfico.
          const sample = byDayStatus && Object.values(byDayStatus)[0];
          if (!byDayStatus || (sample && typeof sample.open !== "object")) {
            setData(null);
            return;
          }
          const rows = dayList.map((day): EventsDay => {
            const counts = (byDayStatus[day] as DayStatusCounts | undefined) ?? { open: {}, withoutDamage: 0, closed: 0 };
            const open = Object.values(counts.open).reduce((sum, value) => sum + (value ?? 0), 0);
            return {
              day,
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
