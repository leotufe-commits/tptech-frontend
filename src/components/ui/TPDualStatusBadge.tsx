// src/components/ui/TPDualStatusBadge.tsx
// ============================================================================
// TPDualStatusBadge — dos badges de estado apilados o en línea.
//
// Pensado para órdenes de venta/compra que avanzan en dos ejes independientes:
//   · entrega (parcial / completa)
//   · facturación (parcial / completa)
//
// Cada eje se representa con un `TPStatusBadge` (tones y labels del módulo
// canónico `document-types.ts`). Se aceptan overrides por eje.
//
// Layout:
//   · "stacked" (default): dos badges apilados verticalmente con gap pequeño
//   · "inline":            dos badges en fila con separador opcional
// ============================================================================

import React from "react";
import { cn } from "./tp";
import { TPStatusBadge } from "./TPStatusBadge";
import type { DocumentStatus, DocumentTone } from "../../lib/document-types";

export type TPDualStatusBadgeEntry = {
  status: DocumentStatus | string;
  label?: string;
  tone?: DocumentTone;
};

export type TPDualStatusBadgeProps = {
  /** Primer eje (arriba en stacked / izquierda en inline). Ej: estado de entrega. */
  primary: TPDualStatusBadgeEntry;
  /** Segundo eje (abajo en stacked / derecha en inline). Ej: estado de facturación. */
  secondary: TPDualStatusBadgeEntry;
  /** Dirección del apilado. Default: "stacked". */
  orientation?: "stacked" | "inline";
  /** Tamaño de cada badge. Default: "sm". */
  size?: "sm" | "md";
  /** Label opcional arriba del badge primario ("Entrega" / "Facturación" etc.). */
  primaryHint?: string;
  /** Label opcional arriba del badge secundario. */
  secondaryHint?: string;
  className?: string;
};

export function TPDualStatusBadge({
  primary,
  secondary,
  orientation = "stacked",
  size = "sm",
  primaryHint,
  secondaryHint,
  className,
}: TPDualStatusBadgeProps) {
  const containerCls =
    orientation === "inline"
      ? "inline-flex items-center gap-1.5 flex-wrap"
      : "inline-flex flex-col items-start gap-1";

  return (
    <div className={cn(containerCls, className)}>
      <BadgeWithHint entry={primary} hint={primaryHint} size={size} />
      <BadgeWithHint entry={secondary} hint={secondaryHint} size={size} />
    </div>
  );
}

function BadgeWithHint({
  entry,
  hint,
  size,
}: {
  entry: TPDualStatusBadgeEntry;
  hint?: string;
  size: "sm" | "md";
}) {
  if (hint) {
    return (
      <div className="flex items-center gap-1">
        <span className="text-[10px] uppercase tracking-wide text-muted">{hint}</span>
        <TPStatusBadge status={entry.status} label={entry.label} tone={entry.tone} size={size} />
      </div>
    );
  }
  return <TPStatusBadge status={entry.status} label={entry.label} tone={entry.tone} size={size} />;
}

export default TPDualStatusBadge;
