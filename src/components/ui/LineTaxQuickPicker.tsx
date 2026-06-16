// src/components/ui/LineTaxQuickPicker.tsx
// =============================================================================
// LineTaxQuickPicker — el label "IMPUESTOS" de la línea de factura, clickeable,
// que abre un dropdown chico con los impuestos PORCENTUALES existentes del
// tenant (`salesTaxes`, ya cargados en VentasFacturas).
//
// MULTI-SELECCIÓN VISUAL (no es multi-impuesto real de backend): el operador
// marca/desmarca varios impuestos porcentuales; el componente SUMA sus tasas y
// carga el resultado en el ÚNICO `taxOverride` PERCENT que el contrato soporta.
// Ej.: IVA 21% + Percepción 3% + Interno 5% → input 29%.
//
// El backend sigue recibiendo EXACTAMENTE el mismo contrato: un solo
// `{ mode: "PERCENT", value: suma }`. No hay `taxIds[]` por línea, no se tocan
// montos fijos (solo se ofrecen tasas porcentuales) ni reglas de aplicación.
//
// Display-only / UX — cero cálculo comercial (solo suma de % seleccionados, que
// el backend re-evalúa). El operador puede seguir editando el % a mano. Sin
// impuestos disponibles o `disabled`, renderiza el label plano (cero regresión).
// =============================================================================

import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronDown, Check } from "lucide-react";
import { cn } from "./tp";
import { formatByType } from "../../lib/pricing/format";

export type AvailableLineTax = {
  id:   string;
  name: string;
  /** Tasa porcentual del impuesto (ej. 21 para IVA 21%). */
  rate: number;
};

const round2 = (n: number) => Math.round(n * 100) / 100;

export function LineTaxQuickPicker({
  taxes,
  onApply,
  disabled,
  label = "Impuestos",
}: {
  taxes:    AvailableLineTax[];
  /** Suma de las tasas seleccionadas (PERCENT). 0 cuando no hay seleccionados. */
  onApply:  (sumPercent: number) => void;
  disabled?: boolean;
  label?:   string;
}) {
  const [open, setOpen]               = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const rootRef = useRef<HTMLDivElement>(null);

  // Cerrar al click-fuera y con Escape — MISMO patrón que el popover `?`
  // (TPPopover): mousedown en FASE DE CAPTURA (3er arg = true). Necesario porque
  // controles hermanos del card (TPNumberInput, etc.) hacen `stopPropagation()`
  // en mousedown para no perder foco; en fase burbuja el listener global nunca
  // recibe el evento y el dropdown "no siempre cerraba". En captura corre ANTES
  // de que el hijo detenga la propagación → cierre confiable. Click DENTRO del
  // root (toggle + menú) no cierra; seleccionar/deseleccionar mantiene abierto.
  useEffect(() => {
    if (!open) return;
    function onDocMouseDown(e: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onDocMouseDown, true);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDocMouseDown, true);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const totalPercent = useMemo(
    () => round2(taxes.reduce((s, t) => s + (selectedIds.has(t.id) ? t.rate : 0), 0)),
    [taxes, selectedIds],
  );

  // Toggle de un impuesto → recalcula la suma y la aplica al override (auto).
  function toggle(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      const sum = round2(taxes.reduce((s, t) => s + (next.has(t.id) ? t.rate : 0), 0));
      onApply(sum);
      return next;
    });
  }

  const interactive = !disabled && taxes.length > 0;

  // Sin impuestos disponibles / deshabilitado → label plano (idéntico al previo).
  if (!interactive) {
    return (
      <div className="text-[9px] font-semibold uppercase tracking-wide text-muted">
        {label}
      </div>
    );
  }

  return (
    <div ref={rootRef} className="relative inline-flex">
      <button
        type="button"
        data-tp-tax-quick-toggle
        data-tp-enter="ignore"
        tabIndex={-1}
        aria-haspopup="menu"
        aria-expanded={open}
        onMouseDown={(e) => e.preventDefault()}
        onClick={() => setOpen((o) => !o)}
        title="Elegir uno o varios impuestos existentes (suma sus tasas)"
        className={cn(
          "inline-flex items-center gap-0.5 text-[9px] font-semibold uppercase tracking-wide text-muted",
          "cursor-pointer rounded hover:text-text",
        )}
      >
        {label}
        <ChevronDown size={9} className={cn("transition-transform", open && "rotate-180")} />
      </button>
      {open && (
        <div
          role="menu"
          data-tp-tax-quick-menu
          className="absolute left-0 top-full z-50 mt-1 max-h-60 min-w-[180px] overflow-auto rounded-md border border-border bg-card py-1 shadow-xl ring-1 ring-black/10"
        >
          {taxes.map((t) => {
            const checked = selectedIds.has(t.id);
            return (
              <button
                key={t.id}
                type="button"
                role="menuitemcheckbox"
                aria-checked={checked}
                data-tp-tax-quick-item
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => toggle(t.id)}
                className="flex w-full items-center gap-2 px-2.5 py-1.5 text-left text-[11px] text-text/85 hover:bg-primary/10"
              >
                <span
                  className={cn(
                    "flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded border",
                    checked ? "border-primary bg-primary text-white" : "border-border",
                  )}
                >
                  {checked && <Check size={10} strokeWidth={3} />}
                </span>
                <span className="min-w-0 flex-1 truncate">{t.name}</span>
                <span className="shrink-0 tabular-nums font-semibold text-muted">
                  {formatByType(t.rate, "TAX_PERCENT", { bare: true })}%
                </span>
              </button>
            );
          })}
          {/* Total seleccionado — pie del dropdown. Se aplica en vivo al input. */}
          <div
            data-tp-tax-quick-total
            className="mt-1 flex items-center justify-between gap-2 border-t border-border/40 px-2.5 pt-1.5 text-[11px]"
          >
            <span className="font-semibold uppercase tracking-wide text-muted/80">Total</span>
            <span className="tabular-nums font-bold text-primary">
              {formatByType(totalPercent, "TAX_PERCENT", { bare: true })}%
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
