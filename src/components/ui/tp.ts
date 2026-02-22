// src/components/ui/tp.ts

export function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

/* =========================================================
   Inputs / Selects (alineados)
========================================================= */

// Base unificada para que TPInput y TPSelect queden SIEMPRE iguales.
export const TP_FIELD_BASE =
  "mt-1 w-full h-[42px] rounded-xl border border-border bg-surface px-3 text-sm " +
  // texto/placeholder desde theme
  "text-[color:var(--input-text)] placeholder:text-[color:var(--placeholder)] placeholder:opacity-100 outline-none " +
  "focus:border-primary/40 focus:ring-4 focus:ring-primary/20";

// ✅ Input
export const TP_INPUT = TP_FIELD_BASE;

// ✅ Select (le damos padding right extra por la flecha nativa)
export const TP_SELECT = TP_FIELD_BASE + " pr-10";

/* =========================================================
   Buttons (alineados)
========================================================= */

export const TP_BTN_PRIMARY =
  "h-[42px] rounded-xl bg-primary px-4 text-sm font-semibold text-white transition " +
  "inline-flex items-center justify-center gap-2 " +
  "hover:opacity-90 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary/30 disabled:opacity-40";

export const TP_BTN_SECONDARY =
  "h-[42px] rounded-xl border border-border bg-card px-4 text-sm font-semibold text-text transition " +
  "inline-flex items-center justify-center gap-2 " +
  "hover:bg-surface2 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary/20 disabled:opacity-40";

/** Link-like button (para acciones dentro de tabla) */
export const TP_BTN_LINK_PRIMARY =
  "rounded-lg px-3 py-2 text-sm font-semibold text-primary transition " +
  "inline-flex items-center justify-center gap-2 " +
  "hover:bg-primary/10 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary/20 disabled:opacity-40";

/** Ghost button (neutral, para acciones secundarias tipo “Stock”, “Cerrar”, etc.) */
export const TP_BTN_GHOST =
  "rounded-lg px-3 py-2 text-sm font-semibold text-text transition " +
  "inline-flex items-center justify-center gap-2 " +
  "hover:bg-surface2 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary/20 disabled:opacity-40";

/** Danger button (para eliminar/acciones destructivas) */
export const TP_BTN_DANGER =
  "h-[42px] rounded-xl border border-red-500/20 bg-red-500/10 px-4 text-sm font-semibold text-red-400 transition " +
  "inline-flex items-center justify-center gap-2 " +
  "hover:bg-red-500/15 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-red-500/20 disabled:opacity-40";