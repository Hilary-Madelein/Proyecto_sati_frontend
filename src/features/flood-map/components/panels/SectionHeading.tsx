import type { ReactNode } from "react";

export function SectionHeading({ children, aside }: { children: ReactNode; aside?: ReactNode }) {
  return (
    <div className="mb-2.5 flex items-center justify-between gap-2">
      <h3 className="text-[11px] font-semibold tracking-wider text-slate-500 uppercase">{children}</h3>
      {aside}
    </div>
  );
}
