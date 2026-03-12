import React from "react";
import { cn } from "../../../components/ui/tp";
import type { SellerRow, SellerAttachment } from "../../../services/sellers";
import type { TPAttachmentItem } from "../../../components/ui/TPAttachmentList";
import { COL_LS_KEY } from "./vendedor.constants";

export function loadColVis(): Record<string, boolean> {
  try {
    const raw = localStorage.getItem(COL_LS_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

export function formatDate(iso: string): string {
  try {
    return new Intl.DateTimeFormat("es-AR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

export function formatCommission(row: SellerRow): string {
  if (row.commissionType === "NONE") return "Sin comisión";
  if (row.commissionType === "PERCENTAGE") {
    return row.commissionValue ? `${row.commissionValue}%` : "—";
  }
  if (row.commissionType === "FIXED_AMOUNT") {
    return row.commissionValue
      ? `$${parseFloat(row.commissionValue).toLocaleString("es-AR")}`
      : "—";
  }
  return "—";
}

export function attachmentToTP(a: SellerAttachment): TPAttachmentItem {
  return { id: a.id, name: a.filename, url: a.url, mimeType: a.mimeType, size: a.size };
}

export function StatusPill({ active }: { active: boolean }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium",
        active
          ? "bg-green-500/15 text-green-600 dark:text-green-400"
          : "bg-surface2 text-muted"
      )}
    >
      {active ? "Activo" : "Inactivo"}
    </span>
  );
}
