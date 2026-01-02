// src/components/ui/tp.ts

export function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

/** Inputs / Selects */
export const TP_INPUT =
  "mt-1 w-full rounded-xl border border-border bg-surface px-3 py-2 text-sm " +
  "text-text placeholder:text-muted outline-none " +
  "focus:border-primary/40 focus:ring-4 focus:ring-primary/20";

export const TP_SELECT =
  "mt-1 w-full rounded-xl border border-border bg-surface px-3 py-2 text-sm " +
  "text-text outline-none " +
  "focus:border-primary/40 focus:ring-4 focus:ring-primary/20";

/** Buttons */
export const TP_BTN_PRIMARY =
  "rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-white transition " +
  "hover:opacity-90 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary/30 disabled:opacity-40";

export const TP_BTN_SECONDARY =
  "rounded-xl border border-border bg-card px-4 py-2 text-sm font-semibold text-text transition " +
  "hover:bg-surface2 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary/20 disabled:opacity-40";

/** Link-like button (para acciones dentro de tabla) */
export const TP_BTN_LINK_PRIMARY =
  "rounded-lg px-3 py-2 text-sm font-semibold text-primary transition " +
  "hover:bg-primary/10 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary/20 disabled:opacity-40";

/** Ghost button (neutral, para acciones secundarias tipo “Stock”, “Cerrar”, etc.) */
export const TP_BTN_GHOST =
  "rounded-lg px-3 py-2 text-sm font-semibold text-text transition " +
  "hover:bg-surface2 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary/20 disabled:opacity-40";

/** Danger button (para eliminar/acciones destructivas) */
export const TP_BTN_DANGER =
  "rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-2 text-sm font-semibold text-red-400 transition " +
  "hover:bg-red-500/15 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-red-500/20 disabled:opacity-40";
