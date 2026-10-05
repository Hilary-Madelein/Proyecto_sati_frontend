"use client";

import L from "leaflet";
import { Marker, Tooltip } from "react-leaflet";
import { formatCalendarDate } from "@/lib/format";
import type { AlertLevel, RiverAlert, RiverAlertsSnapshot, SelectedRiver } from "../../types";
import { alertLevelForDay, alertLevelStyle } from "../../utils";
import { triangleSymbolHtml } from "../map-symbols";

const iconCache = new Map<string, L.DivIcon>();

/** Triángulo de alerta del color del nivel; más grande cuanto más grave. */
function alertIcon(level: AlertLevel, selected: boolean): L.DivIcon {
  const key = `${level}-${selected}`;
  let icon = iconCache.get(key);
  if (!icon) {
    const size = (level >= 25 ? 22 : level >= 5 ? 19 : 16) + (selected ? 6 : 0);
    const { color } = alertLevelStyle(level);
    icon = L.divIcon({
      className: "river-alert-marker",
      html: triangleSymbolHtml(color, size, selected ? 2.2 : 1.4),
      iconSize: [size, size],
      iconAnchor: [size / 2, size * 0.85],
    });
    iconCache.set(key, icon);
  }
  return icon;
}

interface RiverAlertsLayerProps {
  snapshot: RiverAlertsSnapshot;
  dayIndex: number;
  selectedRiverId: number | null;
  onSelect: (river: SelectedRiver) => void;
}

export function RiverAlertsLayer({ snapshot, dayIndex, selectedRiverId, onSelect }: RiverAlertsLayerProps) {
  const visible = snapshot.alerts
    .map((alert) => ({ alert, level: alertLevelForDay(alert, dayIndex) }))
    .filter(({ level }) => level > 0);

  return visible.map(({ alert, level }) => (
    <AlertMarker
      key={alert.riverId}
      alert={alert}
      level={level}
      day={snapshot.days[dayIndex]}
      selected={alert.riverId === selectedRiverId}
      onSelect={onSelect}
    />
  ));
}

function AlertMarker({
  alert,
  level,
  day,
  selected,
  onSelect,
}: {
  alert: RiverAlert;
  level: AlertLevel;
  day: string | undefined;
  selected: boolean;
  onSelect: (river: SelectedRiver) => void;
}) {
  const place = [alert.canton, alert.province].filter(Boolean).join(", ");
  return (
    <Marker
      position={[alert.latitude, alert.longitude]}
      icon={alertIcon(level, selected)}
      zIndexOffset={selected ? 2000 : level * 10}
      keyboard
      title={`Alerta: supera ${alertLevelStyle(level).label}`}
      eventHandlers={{ click: () => onSelect({ riverId: alert.riverId, alert }) }}
    >
      <Tooltip direction="top" offset={[0, -14]}>
        <span className="text-xs">
          <strong>Supera {alertLevelStyle(level).label}</strong>
          {day && ` · ${formatCalendarDate(day)}`}
          {place && <><br />{alert.river ?? "Río"} · {place}</>}
        </span>
      </Tooltip>
    </Marker>
  );
}
