import React from "react";
import { Plus } from "lucide-react";
import { TPButton } from "../../../components/ui/TPButton";
import { TPTableKit, type TPColDef } from "../../../components/ui/TPTableKit";
import { TPStatusPill } from "../../../components/ui/TPStatusPill";
import { TPRowActions } from "../../../components/ui/TPRowActions";
import { TPTr, TPTd } from "../../../components/ui/TPTable";
import type { SellerRow } from "../../../services/sellers";
import type { SortKey } from "./vendedor.types";
import { COL_LS_KEY } from "./vendedor.constants";
import { formatCommission } from "./vendedor.helpers";

const VENDOR_COLS: TPColDef[] = [
  { key: "nombre",    label: "Nombre",           canHide: false, sortKey: "displayName" },
  { key: "documento", label: "Documento" },
  { key: "contacto",  label: "Email / Teléfono", sortKey: "email" },
  { key: "comision",  label: "Comisión" },
  { key: "almacenes", label: "Almacenes" },
  { key: "estado",    label: "Estado" },
  { key: "acciones",  label: "Acciones",          canHide: false, align: "right" },
];

interface Props {
  rows: SellerRow[];
  loading: boolean;
  q: string;
  onSearchChange: (q: string) => void;
  sortKey: SortKey;
  sortDir: "asc" | "desc";
  onSort: (key: SortKey) => void;
  colVis: Record<string, boolean>;
  onColChange: (key: string, visible: boolean) => void;
  busyFavorite: string | null;
  onFavorite: (row: SellerRow) => void;
  onView: (row: SellerRow) => void;
  onEdit: (row: SellerRow) => void;
  onToggle: (row: SellerRow) => void;
  onDelete: (row: SellerRow) => void;
  onNewSeller: () => void;
}

export function VendedoresTable({
  rows,
  loading,
  q,
  onSearchChange,
  sortKey,
  sortDir,
  onSort,
  busyFavorite,
  onFavorite,
  onView,
  onEdit,
  onToggle,
  onDelete,
  onNewSeller,
}: Props) {
  return (
    <TPTableKit
      rows={rows}
      columns={VENDOR_COLS}
      storageKey={COL_LS_KEY}
      search={q}
      onSearchChange={onSearchChange}
      searchPlaceholder="Buscar por nombre, email…"
      sortKey={sortKey}
      sortDir={sortDir}
      onSort={(key) => onSort(key as SortKey)}
      loading={loading}
      emptyText={q ? "No hay resultados para esa búsqueda." : "Todavía no hay vendedores."}
      countLabel={(n) => `${n} ${n === 1 ? "vendedor" : "vendedores"}`}
      responsive="stack"
      actions={
        <TPButton
          variant="primary"
          onClick={onNewSeller}
          iconLeft={<Plus size={16} />}
          className="h-9 whitespace-nowrap shrink-0"
        >
          Nuevo vendedor
        </TPButton>
      }
      renderRow={(row, vis) => (
        <TPTr key={row.id} className={!row.isActive ? "opacity-60" : undefined}>
          {vis.nombre && (
            <TPTd>
              <div className="flex items-center gap-2 min-w-0">
                <div className="h-8 w-8 rounded-full overflow-hidden border border-border bg-surface shrink-0">
                  {row.avatarUrl ? (
                    <img
                      src={row.avatarUrl}
                      alt={row.displayName}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <div className="grid h-full w-full place-items-center text-xs font-bold text-primary bg-primary/10">
                      {row.displayName
                        .split(" ")
                        .slice(0, 2)
                        .map((w) => w[0])
                        .join("")
                        .toUpperCase()}
                    </div>
                  )}
                </div>
                <div className="min-w-0">
                  <span className="text-sm font-medium text-text truncate">
                    {row.displayName}
                  </span>
                </div>
              </div>
            </TPTd>
          )}
          {vis.documento && (
            <TPTd className="hidden md:table-cell">
              <span className="text-sm text-muted">
                {row.documentType || row.documentNumber
                  ? `${row.documentType ? row.documentType + " " : ""}${row.documentNumber}`
                  : "—"}
              </span>
            </TPTd>
          )}
          {vis.contacto && (
            <TPTd className="hidden md:table-cell">
              <div className="text-sm space-y-0.5">
                <div className="text-text">{row.email || "—"}</div>
                {row.phone && (
                  <div className="text-muted text-xs">{row.phone}</div>
                )}
              </div>
            </TPTd>
          )}
          {vis.comision && (
            <TPTd className="hidden md:table-cell">
              <span className="text-sm text-muted">
                {formatCommission(row)}
              </span>
            </TPTd>
          )}
          {vis.almacenes && (
            <TPTd className="hidden md:table-cell">
              <span className="text-sm text-muted">
                {row.warehouses.length === 0
                  ? "Todos"
                  : row.warehouses.length <= 2
                    ? row.warehouses.map((w) => w.warehouse.name).join(", ")
                    : `${row.warehouses.slice(0, 2).map((w) => w.warehouse.name).join(", ")} +${row.warehouses.length - 2}`}
              </span>
            </TPTd>
          )}
          {vis.estado && (
            <TPTd className="hidden md:table-cell">
              <TPStatusPill active={row.isActive} />
            </TPTd>
          )}
          {vis.acciones && (
            <TPTd className="text-right">
              <div className="flex items-center justify-end gap-1.5 flex-wrap">
                <span className="md:hidden">
                  <TPStatusPill active={row.isActive} />
                </span>
                <TPRowActions
                  onFavorite={() => onFavorite(row)}
                  isFavorite={row.isFavorite}
                  busyFavorite={busyFavorite === row.id}
                  onView={() => onView(row)}
                  onEdit={() => onEdit(row)}
                  onToggle={() => onToggle(row)}
                  isActive={row.isActive}
                  onDelete={() => onDelete(row)}
                />
              </div>
            </TPTd>
          )}
        </TPTr>
      )}
    />
  );
}
