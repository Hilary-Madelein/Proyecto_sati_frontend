export interface SegmentedOption<T extends string> {
  value: T;
  label: string;
  /** Opción visible pero no seleccionable (p. ej. dato aún no disponible). */
  disabled?: boolean;
  /** Explica por qué está deshabilitada (tooltip). */
  hint?: string;
}

interface SegmentedControlProps<T extends string> {
  /** Nombre del grupo de radios (único en la página). */
  name: string;
  /** Texto accesible del grupo. */
  label: string;
  value: T;
  options: readonly SegmentedOption<T>[];
  onChange: (value: T) => void;
}

/**
 * Grupo de opciones tipo "píldora". Usa radios nativos ocultos, así funcionan
 * las flechas del teclado y los lectores de pantalla sin código extra.
 */
export function SegmentedControl<T extends string>({
  name,
  label,
  value,
  options,
  onChange,
}: SegmentedControlProps<T>) {
  return (
    <fieldset className="grid auto-cols-fr grid-flow-col gap-1 rounded-xl bg-slate-100 p-1 ring-1 ring-slate-900/5 ring-inset">
      <legend className="sr-only">{label}</legend>
      {options.map((option) => (
        <label key={option.value} className="relative" title={option.hint}>
          <input
            type="radio"
            name={name}
            value={option.value}
            checked={option.value === value}
            disabled={option.disabled}
            onChange={() => onChange(option.value)}
            className="peer sr-only"
          />
          <span className="block cursor-pointer rounded-lg py-1.5 text-center text-xs font-semibold text-slate-500 transition peer-checked:bg-white peer-checked:text-blue-700 peer-checked:shadow-sm peer-checked:ring-1 peer-checked:ring-slate-900/5 peer-focus-visible:outline-2 peer-focus-visible:outline-blue-600 peer-disabled:cursor-not-allowed peer-disabled:text-slate-300 peer-enabled:hover:text-slate-800">
            {option.label}
          </span>
        </label>
      ))}
    </fieldset>
  );
}
