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

function StatusPill({ active }: { active: boolean }) {
  return <TPBadge tone={active ? "success" : "danger"}>{active ? "Activa" : "Inactiva"}</TPBadge>;
}

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
}) {
  const busyFav = busyFavoriteId ?? null;
  const busyRow = busyRowId ?? null;

  return (
    <TPTableWrap className="w-full">
      <TPTable className="w-full">
        <TPTableXScroll>
          <TPTableElBase responsive="stack">
            <TPThead>
              <TPTr>
                <TPTh>
                  <button type="button" onClick={() => onToggleSort("name")} className="inline-flex items-center gap-2">
                    Nombre <SortArrows active={sortKey === "name"} dir={sortDir} />
                  </button>
                </TPTh>

                <TPTh className="w-[140px]">
                  <button type="button" onClick={() => onToggleSort("code")} className="inline-flex items-center gap-2">
                    Código <SortArrows active={sortKey === "code"} dir={sortDir} />
                  </button>
                </TPTh>

                <TPTh>
                  <button type="button" onClick={() => onToggleSort("location")} className="inline-flex items-center gap-2">
                    Ubicación <SortArrows active={sortKey === "location"} dir={sortDir} />
                  </button>
                </TPTh>

                <TPTh className="w-[140px]">
                  <button type="button" onClick={() => onToggleSort("isActive")} className="inline-flex items-center gap-2">
                    Estado <SortArrows active={sortKey === "isActive"} dir={sortDir} />
                  </button>
                </TPTh>

                <TPTh className="w-[160px] text-right">
                  <button
                    type="button"
                    onClick={() => onToggleSort("stockGrams")}
                    className="inline-flex items-center gap-2 ml-auto"
                  >
                    Stock (g) <SortArrows active={sortKey === "stockGrams"} dir={sortDir} />
                  </button>
                </TPTh>

                <TPTh className="w-[140px] text-right">
                  <button
                    type="button"
                    onClick={() => onToggleSort("stockPieces")}
                    className="inline-flex items-center gap-2 ml-auto"
                  >
                    Piezas <SortArrows active={sortKey === "stockPieces"} dir={sortDir} />
                  </button>
                </TPTh>

                <TPTh className="w-[240px] text-right">Acciones</TPTh>
              </TPTr>
            </TPThead>

            <TPTbody>
              {loading ? (
                <TPTr>
                  <TPTd colSpan={7}>
                    <div className="flex items-center gap-2 py-8 text-sm text-muted">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Cargando almacenes…
                    </div>
                  </TPTd>
                </TPTr>
              ) : rows.length === 0 ? (
                <TPEmptyRow colSpan={7} text="No hay almacenes para mostrar." />
              ) : (
                rows.map((r) => {
                  const active = isRowActive(r);
                  const favBusy = busyFav === r.id;
                  const rowBusy = busyRow === r.id;

                  return (
                    <TPTr key={r.id} className={cn(!active ? "opacity-70" : "")}>
                      <TPTd label="Nombre" className="font-semibold">
                        {r.name}
                      </TPTd>

                      <TPTd label="Código">{r.code || "—"}</TPTd>

                      <TPTd label="Ubicación">{r.location || "—"}</TPTd>

                      <TPTd label="Estado">
                        <StatusPill active={active} />
                      </TPTd>

                      <TPTd label="Stock (g)" className="text-right">
                        {fmtNumberSmart(r.stockGrams ?? 0)}
                      </TPTd>

                      <TPTd label="Piezas" className="text-right">
                        {fmtNumberSmart(r.stockPieces ?? 0)}
                      </TPTd>

                      <TPTd label="Acciones" className="text-right">
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
                              <Star className={cn("h-4 w-4", r.isFavorite ? "fill-yellow-400 text-yellow-400" : "text-text")} />
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
                            {active ? (
                              <ShieldBan className="h-4 w-4 text-text" />
                            ) : (
                              <ShieldCheck className="h-4 w-4 text-text" />
                            )}
                          </TPIconButton>

                          <TPIconButton title="Eliminar" onClick={() => onAskDelete(r)} disabled={rowBusy}>
                            <Trash2 className="h-4 w-4 text-text" />
                          </TPIconButton>
                        </div>
                      </TPTd>
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