import { cn } from "@/lib/cn";
import { SEVERITY_STYLES } from "../constants";
import type { EventSeverity } from "../types";

export function SeverityPill({ severity }: { severity: EventSeverity }) {
  const style = SEVERITY_STYLES[severity];
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center rounded-full px-2 py-0.5 text-[10px] font-semibold tracking-wide uppercase ring-1 ring-inset",
        style.pillClass,
      )}
    >
      {style.label}
    </span>
  );
}
