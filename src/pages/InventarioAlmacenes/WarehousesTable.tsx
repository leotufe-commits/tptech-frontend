// src/pages/InventarioAlmacenes/WarehousesTable.tsx
import React from "react";

import { TPTableKit, type TPColDef } from "../../components/ui/TPTableKit";
import { TPStatusPill } from "../../components/ui/TPStatusPill";
import { TPRowActions } from "../../components/ui/TPRowActions";
import { TPTr, TPTd } from "../../components/ui/TPTable";

import { fmtNumberSmart } from "../../lib/format";

import type { SortDir, SortKey, WarehouseRow } from "./types";
import { isRowActive } from "./warehouses.utils";

/* ── Definición de columnas ─────────────────────────────────── */

export const WH_COLUMNS: TPColDef[] = [
  { key: "name",        label: "Nombre",    canHide: false, sortKey: "name" },
  { key: "city",        label: "Ciudad",    width: "140px" },
  { key: "isActive",    label: "Estado",    width: "120px", sortKey: "isActive" },
  { key: "stockGrams",  label: "Stock (g)", width: "140px", align: "right", sortKey: "stockGrams" },
  { key: "stockPieces", label: "Piezas",    width: "120px", align: "right", sortKey: "stockPieces" },
  { key: "actions",     label: "Acciones",  canHide: false, width: "220px", align: "right" },
];

export const WH_COL_LS_KEY = "tptech_col_warehouses";

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

  return (
    <TPTableKit
      rows={rows}
      columns={WH_COLUMNS}
      storageKey={WH_COL_LS_KEY}
      sortKey={sortKey}
      sortDir={sortDir}
      onSort={(k) => onToggleSort(k as SortKey)}
      loading={loading}
      emptyText="No hay almacenes para mostrar."
      countLabel="almacenes"
      onRowClick={(r) => onView(r)}
      renderRow={(r, vis) => {
        const active = isRowActive(r);
        const rowBusy = busyRow === r.id;

        return (
          <TPTr key={r.id} className={!active ? "opacity-70" : undefined}>
            {vis.name && (
              <TPTd className="font-semibold">{r.name}</TPTd>
            )}
            {vis.city && (
              <TPTd>{r.city || "—"}</TPTd>
            )}
            {vis.isActive && (
              <TPTd>
                <TPStatusPill active={active} />
              </TPTd>
            )}
            {vis.stockGrams && (
              <TPTd className="text-right">{fmtNumberSmart(r.stockGrams ?? 0)}</TPTd>
            )}
            {vis.stockPieces && (
              <TPTd className="text-right">{fmtNumberSmart(r.stockPieces ?? 0)}</TPTd>
            )}
            {vis.actions && (
              <TPTd>
                <TPRowActions
                  onFavorite={() => onFavorite(r)}
                  isFavorite={r.isFavorite}
                  busyFavorite={!!busyFav || !active || rowBusy}
                  onView={() => onView(r)}
                  onEdit={() => onEdit(r)}
                  onToggle={rowBusy ? undefined : () => onToggleActive(r)}
                  isActive={active}
                  onDelete={() => onAskDelete(r)}
                />
              </TPTd>
            )}
          </TPTr>
        );
      }}
    />
  );
}
