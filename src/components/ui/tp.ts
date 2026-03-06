// src/components/ui/tp.ts

export function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

/* =========================================================
   Inputs / Selects (alineados)
   - Unificamos TODO con las clases globales del theme:
     .tp-input y .tp-select (definidas en index.css)
========================================================= */

/**
 * ✅ Base unificada
 * IMPORTANTE:
 * - Ya no usamos bg-surface acá (que te lo volvía gris).
 * - Todo queda gobernado por index.css (var(--card), etc).
 */
export const TP_FIELD_BASE = "tp-input";

// ✅ Input
export const TP_INPUT = "tp-input";

// ✅ Select
export const TP_SELECT = "tp-select";

/* =========================================================
   Buttons (alineados)
   (estos siguen igual, son utilidades Tailwind)
========================================================= */

export const TP_BTN_PRIMARY =
  "h-[42px] rounded-xl bg-primary px-4 text-sm font-semibold text-white transition " +
  "inline-flex items-center justify-center gap-2 " +
  "hover:opacity-90 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary/30 disabled:opacity-40";

export const TP_BTN_SECONDARY =
  "h-[42px] rounded-xl border border-border bg-card px-4 text-sm font-semibold text-text transition " +
  "inline-flex items-center justify-center gap-2 " +
  "hover:bg-surface2 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary/20 disabled:opacity-40";

export const TP_BTN_LINK_PRIMARY =
  "rounded-lg px-3 py-2 text-sm font-semibold text-primary transition " +
  "inline-flex items-center justify-center gap-2 " +
  "hover:bg-primary/10 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary/20 disabled:opacity-40";

export const TP_BTN_GHOST =
  "rounded-lg px-3 py-2 text-sm font-semibold text-text transition " +
  "inline-flex items-center justify-center gap-2 " +
  "hover:bg-surface2 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary/20 disabled:opacity-40";

export const TP_BTN_DANGER =
  "h-[42px] rounded-xl border border-red-500/20 bg-red-500/10 px-4 text-sm font-semibold text-red-400 transition " +
  "inline-flex items-center justify-center gap-2 " +
  "hover:bg-red-500/15 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-red-500/20 disabled:opacity-40";