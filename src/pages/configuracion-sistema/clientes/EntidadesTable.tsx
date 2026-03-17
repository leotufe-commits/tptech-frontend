import React from "react";
import { Plus } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { TPButton } from "../../../components/ui/TPButton";
import { TPTableKit, type TPColDef } from "../../../components/ui/TPTableKit";
import { TPStatusPill } from "../../../components/ui/TPStatusPill";
import { TPRowActions } from "../../../components/ui/TPRowActions";
import { TPTr, TPTd } from "../../../components/ui/TPTable";
import { TPBadge } from "../../../components/ui/TPBadges";
import type { EntityRow } from "../../../services/commercial-entities";
import type { SortKey } from "./clientes.types";

interface Props {
  rows: EntityRow[];
  loading: boolean;
  q: string;
  onSearchChange: (q: string) => void;
  sortKey: SortKey;
  sortDir: "asc" | "desc";
  onSort: (key: SortKey) => void;
  storageKey: string;
  columns: TPColDef[];
  onEdit: (row: EntityRow) => void;
  onToggle: (row: EntityRow) => void;
  onDelete: (row: EntityRow) => void;
  onNew: () => void;
  detailBasePath: string;
  newLabel: string;
  countLabel: (n: number) => string;
  searchPlaceholder: string;
  emptyText: string;
}

export function EntidadesTable({
  rows,
  loading,
  q,
  onSearchChange,
  sortKey,
  sortDir,
  onSort,
  columns,
  storageKey,
  onEdit,
  onToggle,
  onDelete,
  onNew,
  detailBasePath,
  newLabel,
  countLabel,
  searchPlaceholder,
  emptyText,
}: Props) {
  const navigate = useNavigate();

  return (
    <TPTableKit
      rows={rows}
      columns={columns}
      storageKey={storageKey}
      search={q}
      onSearchChange={onSearchChange}
      searchPlaceholder={searchPlaceholder}
      sortKey={sortKey}
      sortDir={sortDir}
      onSort={(key) => onSort(key as SortKey)}
      loading={loading}
      emptyText={q ? "No hay resultados para esa búsqueda." : emptyText}
      countLabel={countLabel}
      responsive="stack"
      actions={
        <TPButton
          variant="primary"
          onClick={onNew}
          iconLeft={<Plus size={16} />}
          className="h-9 whitespace-nowrap shrink-0"
        >
          {newLabel}
        </TPButton>
      }
      onRowClick={(row) => navigate(`/${detailBasePath}/${row.id}`)}
      renderRow={(row, vis) => (
        <TPTr key={row.id} className={!row.isActive ? "opacity-60" : undefined}>
          {/* Nombre + avatar */}
          {vis.nombre && (
            <TPTd>
              <div className="flex items-center gap-2 min-w-0">
                <div className="h-8 w-8 rounded-full overflow-hidden border border-border bg-surface shrink-0">
                  {row.avatarUrl ? (
                    <img src={row.avatarUrl} alt={row.displayName} className="h-full w-full object-cover" />
                  ) : (
                    <div className="grid h-full w-full place-items-center text-xs font-bold text-primary bg-primary/10">
                      {row.displayName.split(/[\s,]+/).slice(0, 2).map((w) => w[0]).join("").toUpperCase() || "?"}
                    </div>
                  )}
                </div>
                <div className="min-w-0">
                  <div className="text-sm font-medium text-text truncate">{row.displayName}</div>
                  <div className="text-xs text-muted font-mono">{row.code}</div>
                </div>
              </div>
            </TPTd>
          )}

          {/* Rol: Cliente / Proveedor */}
          {vis.roles && (
            <TPTd className="hidden md:table-cell">
              <div className="flex flex-wrap gap-1">
                {row.isClient   && <TPBadge tone="primary" size="sm">Cliente</TPBadge>}
                {row.isSupplier && <TPBadge tone="warning" size="sm">Proveedor</TPBadge>}
              </div>
            </TPTd>
          )}

          {/* Tipo: Empresa / Persona */}
          {vis.tipo && (
            <TPTd className="hidden md:table-cell">
              <TPBadge tone="neutral" size="sm">
                {row.entityType === "COMPANY" ? "Empresa" : "Persona"}
              </TPBadge>
            </TPTd>
          )}

          {/* Documento */}
          {vis.documento && (
            <TPTd className="hidden md:table-cell">
              <span className="text-sm text-muted">
                {row.documentType || row.documentNumber
                  ? `${row.documentType ? row.documentType + " " : ""}${row.documentNumber}`
                  : "—"}
              </span>
            </TPTd>
          )}

          {/* Email / Teléfono */}
          {vis.contacto && (
            <TPTd className="hidden md:table-cell">
              <div className="text-sm space-y-0.5">
                <div className="text-text">{row.email || "—"}</div>
                {row.phone && <div className="text-xs text-muted">{row.phone}</div>}
              </div>
            </TPTd>
          )}

          {/* Condición IVA */}
          {vis.iva && (
            <TPTd className="hidden lg:table-cell">
              <span className="text-sm text-muted">{row.ivaCondition || "—"}</span>
            </TPTd>
          )}

          {/* Estado */}
          {vis.estado && (
            <TPTd className="hidden md:table-cell">
              <TPStatusPill active={row.isActive} />
            </TPTd>
          )}

          {/* Acciones */}
          {vis.acciones && (
            <TPTd className="text-right">
              <div className="flex items-center justify-end gap-1.5 flex-wrap">
                <span className="md:hidden">
                  <TPStatusPill active={row.isActive} />
                </span>
                <TPRowActions
                  onView={() => navigate(`/${detailBasePath}/${row.id}`)}
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
