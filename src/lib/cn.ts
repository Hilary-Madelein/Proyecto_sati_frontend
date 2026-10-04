/** Une clases condicionales de Tailwind ignorando valores falsos. */
export function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}
