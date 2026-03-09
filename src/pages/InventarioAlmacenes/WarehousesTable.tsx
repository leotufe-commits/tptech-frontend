// src/pages/InventarioAlmacenes/WarehousesTable.tsx
import React from "react";
import { Eye, Loader2, Pencil, ShieldBan, ShieldCheck, Star, Trash2 } from "lucide-react";

import { SortArrows } from "../../components/ui/TPSort";
import TPIconButton from "../../components/ui/TPIconButton";
import {
  TPTableWrap,
  TPTable,
  TPTableXScroll,
  TPTableElBase,
  TPThead,
  TPTbody,
  TPTr,
  TPTh,
  TPTd,
  TPEmptyRow,
} from "../../components/ui/TPTable";
import { cn } from "../../components/ui/tp";

import { fmtNumberSmart } from "../../lib/format";

import type { SortDir, SortKey, WarehouseRow } from "./types";
import { isRowActive } from "./warehouses.utils";
import { TPBadge } from "../../components/ui/TPBadges";

/* ── Definición de columnas ─────────────────────────────────── */

type ColDef = {
  key: string;
  label: string;
  width?: string;
  visible: boolean;
  canHide?: boolean;
  align?: "left" | "right";
  sortKey?: SortKey;
};

export const WH_COLUMNS: ColDef[] = [
  { key: "name",        label: "Nombre",    visible: true,  canHide: false, sortKey: "name" },
  { key: "city",        label: "Ciudad",    visible: true,  width: "140px" },
  { key: "isActive",    label: "Estado",    visible: true,  width: "120px", sortKey: "isActive" },
  { key: "stockGrams",  label: "Stock (g)", visible: true,  width: "140px", align: "right", sortKey: "stockGrams" },
  { key: "stockPieces", label: "Piezas",    visible: true,  width: "120px", align: "right", sortKey: "stockPieces" },
  { key: "actions",     label: "Acciones",  visible: true,  canHide: false, width: "220px", align: "right" },
];

export const WH_COL_LS_KEY = "tptech_col_warehouses";

/* ── Helpers ────────────────────────────────────────────────── */

function StatusPill({ active }: { active: boolean }) {
  return <TPBadge tone={active ? "success" : "danger"}>{active ? "Activo" : "Inactivo"}</TPBadge>;
}

/* ── Componente ─────────────────────────────────────────────── */

export default function WarehousesTable({
  loading,
  rows,
  sortKey,
  sortDir,
  onToggleSort,
  busyFavoriteId,
  busyRowId,
  onFavorite,
  onView,
  onEdit,
  onToggleActive,
  onAskDelete,
  colVis,
}: {
  loading: boolean;
  rows: WarehouseRow[];

  sortKey: SortKey;
  sortDir: SortDir;
  onToggleSort: (k: SortKey) => void;

  busyFavoriteId?: string | null;
  busyRowId?: string | null;

  onFavorite: (r: WarehouseRow) => void | Promise<void>;
  onView: (r: WarehouseRow) => void;
  onEdit: (r: WarehouseRow) => void;
  onToggleActive: (r: WarehouseRow) => void | Promise<void>;
  onAskDelete: (r: WarehouseRow) => void;

  colVis: Record<string, boolean>;
}) {
  const busyFav = busyFavoriteId ?? null;
  const busyRow = busyRowId ?? null;

  const visibleCols = WH_COLUMNS.filter((c) => colVis[c.key] !== false);
  const colSpan = visibleCols.length;

  return (
    <TPTableWrap className="w-full">
      <TPTable className="w-full">
        <TPTableXScroll>
          <TPTableElBase responsive="stack">
            <TPThead>
              <TPTr>
                {visibleCols.map((col) => (
                  <TPTh
                    key={col.key}
                    style={col.width ? { width: col.width } : undefined}
                    className={col.align === "right" ? "text-right" : undefined}
                  >
                    {col.sortKey ? (
                      <button
                        type="button"
                        onClick={() => onToggleSort(col.sortKey!)}
                        className={cn(
                          "inline-flex items-center gap-2",
                          col.align === "right" ? "ml-auto" : ""
                        )}
                      >
                        {col.label}
                        <SortArrows active={sortKey === col.sortKey} dir={sortDir} />
                      </button>
                    ) : (
                      col.label
                    )}
                  </TPTh>
                ))}
              </TPTr>
            </TPThead>

            <TPTbody>
              {loading ? (
                <TPTr>
                  <TPTd colSpan={colSpan}>
                    <div className="flex items-center gap-2 py-8 text-sm text-muted">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Cargando almacenes…
                    </div>
                  </TPTd>
                </TPTr>
              ) : rows.length === 0 ? (
                <TPEmptyRow colSpan={colSpan} text="No hay almacenes para mostrar." />
              ) : (
                rows.map((r) => {
                  const active = isRowActive(r);
                  const favBusy = busyFav === r.id;
                  const rowBusy = busyRow === r.id;

                  return (
                    <TPTr key={r.id} className={cn(!active ? "opacity-70" : "")}>
                      {visibleCols.map((col) => {
                        switch (col.key) {
                          case "name":
                            return (
                              <TPTd key="name" label="Nombre" className="font-semibold">
                                {r.name}
                              </TPTd>
                            );

                          case "city":
                            return (
                              <TPTd key="city" label="Ciudad">
                                {r.city || "—"}
                              </TPTd>
                            );

                          case "isActive":
                            return (
                              <TPTd key="isActive" label="Estado">
                                <StatusPill active={active} />
                              </TPTd>
                            );

                          case "stockGrams":
                            return (
                              <TPTd key="stockGrams" label="Stock (g)" className="text-right">
                                {fmtNumberSmart(r.stockGrams ?? 0)}
                              </TPTd>
                            );

                          case "stockPieces":
                            return (
                              <TPTd key="stockPieces" label="Piezas" className="text-right">
                                {fmtNumberSmart(r.stockPieces ?? 0)}
                              </TPTd>
                            );

                          case "actions":
                            return (
                              <TPTd key="actions" label="Acciones" className="text-right">
                                <div className="inline-flex items-center justify-end gap-2">
                                  <TPIconButton
                                    title={
                                      r.isFavorite
                                        ? "Favorito"
                                        : active
                                        ? "Marcar favorito"
                                        : "Solo se puede marcar favorito si está activo"
                                    }
                                    onClick={() => onFavorite(r)}
                                    disabled={!!busyFav || !active || rowBusy}
                                  >
                                    {favBusy ? (
                                      <Loader2 className="h-4 w-4 animate-spin text-text" />
                                    ) : (
                                      <Star
                                        className={cn(
                                          "h-4 w-4",
                                          r.isFavorite ? "fill-yellow-400 text-yellow-400" : "text-text"
                                        )}
                                      />
                                    )}
                                  </TPIconButton>

                                  <TPIconButton title="Ver" onClick={() => onView(r)} disabled={rowBusy}>
                                    <Eye className="h-4 w-4 text-text" />
                                  </TPIconButton>

                                  <TPIconButton title="Editar" onClick={() => onEdit(r)} disabled={rowBusy}>
                                    <Pencil className="h-4 w-4 text-text" />
                                  </TPIconButton>

                                  <TPIconButton
                                    title={active ? "Desactivar" : "Activar"}
                                    onClick={() => onToggleActive(r)}
                                    disabled={rowBusy}
                                  >
                                    {rowBusy ? (
                                      <Loader2 className="h-4 w-4 animate-spin text-text" />
                                    ) : active ? (
                                      <ShieldBan className="h-4 w-4 text-text" />
                                    ) : (
                                      <ShieldCheck className="h-4 w-4 text-text" />
                                    )}
                                  </TPIconButton>

                                  <TPIconButton
                                    title="Eliminar"
                                    onClick={() => onAskDelete(r)}
                                    disabled={rowBusy}
                                  >
                                    <Trash2 className="h-4 w-4 text-text" />
                                  </TPIconButton>
                                </div>
                              </TPTd>
                            );

                          default:
                            return null;
                        }
                      })}
                    </TPTr>
                  );
                })
              )}
            </TPTbody>
          </TPTableElBase>
        </TPTableXScroll>
      </TPTable>
    </TPTableWrap>
  );
}
