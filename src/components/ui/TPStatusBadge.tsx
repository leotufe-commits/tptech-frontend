// src/components/ui/TPStatusBadge.tsx
// ============================================================================
// TPStatusBadge — badge unificado para estados de documentos.
//
// Reemplaza los 9 `statusBadge(s)` copiados en las pantallas de Ventas y
// Compras. Usa `DOCUMENT_STATUS_TONE` y `DOCUMENT_STATUS_LABEL` del tipo
// canónico `DocumentStatus` en `src/lib/document-types.ts`.
//
// Acepta:
//   · `status`: una clave canónica de `DocumentStatus` — tone/label auto.
//   · `status`: cualquier string no canónico — tone default `neutral`.
//
// Props de override para cuando una pantalla necesita un label particular
// ("Enviada" en lugar de "Enviado", etc.) o un tone distinto al canónico.
// ============================================================================

import React from "react";
import { TPBadge } from "./TPBadges";
import {
  DOCUMENT_STATUS_TONE,
  DOCUMENT_STATUS_LABEL,
  type DocumentStatus,
  type DocumentTone,
} from "../../lib/document-types";

export type TPStatusBadgeProps = {
  /** Estado canónico del documento. También se acepta un string arbitrario. */
  status: DocumentStatus | string;
  /** Override del label — si se omite, se usa el label canónico. */
  label?: string;
  /** Override del tone — si se omite, se usa el tone canónico. */
  tone?: DocumentTone;
  /** Tamaño del badge. Default: "sm". */
  size?: "sm" | "md";
  /** Clase extra. */
  className?: string;
};

export function TPStatusBadge({
  status,
  label,
  tone,
  size = "sm",
  className,
}: TPStatusBadgeProps) {
  const key = status as DocumentStatus;
  const resolvedTone: DocumentTone =
    tone ?? DOCUMENT_STATUS_TONE[key] ?? "neutral";
  const resolvedLabel: string =
    label ?? DOCUMENT_STATUS_LABEL[key] ?? String(status);

  return (
    <TPBadge tone={resolvedTone} size={size} className={className}>
      {resolvedLabel}
    </TPBadge>
  );
}

export default TPStatusBadge;
