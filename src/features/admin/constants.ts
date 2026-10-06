import type { MinSeverity } from "./types";

export const MIN_SEVERITY_OPTIONS: readonly { value: MinSeverity; label: string; description: string }[] = [
  { value: "high", label: "Alto y crítico", description: "Recibe los eventos de severidad alta y crítica." },
  { value: "critical", label: "Solo crítico", description: "Recibe únicamente los eventos críticos." },
];

export const MIN_SEVERITY_LABELS: Record<MinSeverity, string> = { high: "Alto y crítico", critical: "Solo crítico" };

export const DELIVERIES_PAGE_SIZE = 25;

/** Igual que en el backend (password-hasher.ts). */
export const PASSWORD_MIN_LENGTH = 10;
