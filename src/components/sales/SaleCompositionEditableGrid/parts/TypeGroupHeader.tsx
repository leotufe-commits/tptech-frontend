// src/components/sales/SaleCompositionEditableGrid/parts/TypeGroupHeader.tsx
// =============================================================================
// FASE 12.9 — Header de grupo por tipo de componente. Pure display:
// muestra el nombre del grupo, conteo de líneas y subtotal (sum trivial
// de `lineCost` ya emitidos — NO matemática comercial nueva).
// FASE 12.11 — totales del grupo INLINE junto al nombre (no a la derecha).
// FASE F18 — removidas las líneas divisorias horizontales superiores.
// La separación entre grupos ahora descansa en spacing + background
// suave por tipo. Look moderno, sin ruido tipo "tabla vieja".
// FASE 12.13 — background muy suave por tipo (≈5% del color semántico) y
// label coloreado: refuerza la identificación visual del grupo sin saturar
// el contraste de las filas editables. Color tomado de la fuente única
// `COMPONENT_TYPE_TEXT` / `COMPONENT_TYPE_BADGE` (no se hardcodean tonos).
// FASE F10 — el adjetivo "puro/pura" del header de METALES fue eliminado.
// El header ahora muestra solo el nombre del metal padre seguido de los
// gramos (ej. "Oro: 3,76 gr · Plata: 5,00 gr"). La agrupación por metal
// padre se mantiene tal cual (FASE F5).
// =============================================================================

import { cn } from "../../../ui/tp";
import {
  COMPONENT_TYPE_TEXT,
  type ComponentTypeKey,
} from "../../../../lib/pricing/component-type-colors";
import { formatGrams } from "../../../../lib/pricing/format";
import { GROUP_HEADER_BG } from "../constants";

export function TypeGroupHeader({
  label, count, subtotal, currency, type, equivGramsByMetal,
  commercialRoundingActive,
}: {
  label:    string;
  count:    number;
  subtotal: number | null;
  currency: string;
  /** Tipo de componente — define el color semántico del label y del bg. */
  type:     ComponentTypeKey;
  /** Gramos FINALES por metal PADRE (pureza × merma × margen de venta) ×
   *  cantidad de la línea — consolidado por padre, formato "Padre: N g".
   *  Único chip de METAL en el header (las variantes con "=" se eliminaron).
   *  Vacío/undefined → no se renderea. */
  equivGramsByMetal?: Array<{ name: string; grams: number }>;
  /** Etapa D' — true cuando los gramos del chip ya vienen POST-redondeo
   *  comercial del snapshot canónico. Agrega un sufijo "(red. comercial)"
   *  para que el operador sepa que el valor mostrado no es el bruto. */
  commercialRoundingActive?: boolean;
}) {
  // FASE F15 — subtotal y currency aceptados para compat de callers, pero
  // ya no se renderean en el header.
  void subtotal; void currency;
  return (
    <div
      data-group-type={type}
      className={cn(
        // FASE F18 — removido `border-t border-border/40` que dibujaba una
        // línea divisoria fuerte arriba de cada grupo. La separación visual
        // ahora descansa en `mt-3` (16px) + `GROUP_HEADER_BG` (tono suave
        // por tipo). Look más liviano, sin ruido tipo "tabla vieja".
        "mt-3 mb-1.5 flex items-baseline gap-2 rounded-t px-2 py-1.5 first:mt-0",
        GROUP_HEADER_BG[type],
      )}
    >
      <span className={cn("text-[11px] font-semibold uppercase tracking-wide", COMPONENT_TYPE_TEXT[type])}>
        {label}
      </span>
      <span className="text-[10px] text-muted/55">
        · {count} {count === 1 ? "línea" : "líneas"}
      </span>
      {/* FASE F15 — el importe monetario se removió del header de grupo.
          El total queda únicamente en la fila inferior `Total <grupo>`
          (TypeGroupFooter). El header conserva: nombre, count y, en
          METAL, los gramos agrupados por metal padre. Las props
          `subtotal` y `currency` siguen aceptándose en el contrato para
          no romper callers, pero ya no se renderean. */}
      {type === "METAL" && Array.isArray(equivGramsByMetal) && equivGramsByMetal.length > 0 && (
        <>
          {equivGramsByMetal.map((g, i) => (
            <span
              key={`${g.name}-${i}`}
              className="text-[11px] text-slate-500 dark:text-slate-400"
              title={
                commercialRoundingActive
                  ? "Gramos POST-redondeo comercial (snapshot canónico del documento)"
                  : "Gramos FINALES del metal padre (pureza × merma × margen de venta) × cantidad de la línea"
              }
            >
              · {g.name}:{" "}
              <span className="tabular-nums">
                {formatGrams(g.grams, 2)} g
              </span>
            </span>
          ))}
          {commercialRoundingActive && (
            <span
              className="text-[10px] italic text-slate-500/80 dark:text-slate-400/80"
              data-tp-commercial-rounding-flag
              title="Los gramos mostrados ya tienen aplicado el redondeo comercial canónico del snapshot del documento."
            >
              · red. comercial
            </span>
          )}
        </>
      )}
    </div>
  );
}
