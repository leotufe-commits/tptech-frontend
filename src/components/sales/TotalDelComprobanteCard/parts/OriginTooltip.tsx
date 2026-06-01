// src/components/sales/TotalDelComprobanteCard/parts/OriginTooltip.tsx
// =============================================================================
// Etapa UX.30 (2026-05-30) — Tooltip reutilizable de "Origen" para filas
// del detalle financiero del card "Total del comprobante".
//
// Render un ícono ⓘ al costado del label. Hover o click → popover flotante
// con el contexto del importe (de dónde sale, fórmula, fuente).
//
// Display-only. Cero matemática. Cero cálculos. Solo presentación.
// Usa TPPopover existente para anclaje + portal (soporta scroll/overflow).
//
// Patrón de uso:
//   <OriginTooltip title="Hechura" body={<>...</>} />
//
// El caller arma el `body` con los datos contextuales que ya tiene en mano.
// =============================================================================

import { useRef, useState, type ReactElement, type ReactNode } from "react";
import { TPPopover } from "../../../ui/TPPopover";

export interface OriginTooltipProps {
  /** Título del popover (ej. "HECHURA", "IVA"). */
  title: string;
  /** Cuerpo del popover (JSX libre — el caller arma el desglose). */
  body:  ReactNode;
  /** Etiqueta accesible para screen readers ("Ver origen de hechura"). */
  ariaLabel?: string;
}

export function OriginTooltip({
  title,
  body,
  ariaLabel,
}: OriginTooltipProps): ReactElement {
  const anchorRef = useRef<HTMLButtonElement>(null);
  const [open, setOpen]   = useState(false);
  const [hover, setHover] = useState(false);

  // Hover-driven: al entrar/salir del ícono se muestra/oculta. Click también
  // toggle (pinning en mobile). Esc cierra desde el popover.
  const show = hover || open;

  return (
    <>
      <button
        ref={anchorRef}
        type="button"
        aria-label={ariaLabel ?? `Ver origen de ${title.toLowerCase()}`}
        aria-expanded={show}
        onMouseEnter={() => setHover(true)}
        onMouseLeave={() => setHover(false)}
        onClick={() => setOpen((v) => !v)}
        onFocus={() => setHover(true)}
        onBlur={() => setHover(false)}
        className="ml-1 inline-flex h-3.5 w-3.5 items-center justify-center rounded-full text-[9px] font-bold text-muted/50 ring-1 ring-muted/30 transition-colors hover:bg-muted/15 hover:text-muted/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
        data-testid={`origin-tooltip-trigger-${title.toLowerCase().replace(/\s+/g, "-")}`}
      >
        ⓘ
      </button>
      <TPPopover
        open={show}
        onClose={() => { setOpen(false); setHover(false); }}
        anchorRef={anchorRef}
        width={280}
        offset={6}
      >
        <div
          className="px-3 py-2 text-[11px] leading-snug"
          data-testid={`origin-tooltip-content-${title.toLowerCase().replace(/\s+/g, "-")}`}
          onMouseEnter={() => setHover(true)}
          onMouseLeave={() => setHover(false)}
        >
          <div className="mb-1 text-[10px] font-bold uppercase tracking-wider text-text">
            {title}
          </div>
          <div className="text-muted">
            {body}
          </div>
        </div>
      </TPPopover>
    </>
  );
}

export default OriginTooltip;
