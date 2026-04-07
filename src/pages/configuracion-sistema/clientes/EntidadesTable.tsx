// src/pages/configuracion-sistema/clientes/EntidadesTable.tsx
import React, { useState } from "react";
import TPImageLightbox from "../../../components/ui/TPImageLightbox";
import { Plus, Upload, Combine, Link2, Link, Trash2, Clock, RefreshCw, ArrowUpDown } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { TPButton } from "../../../components/ui/TPButton";
import { TPTableKit, type TPColDef, type TPRowSel, type TPSortMenuItem } from "../../../components/ui/TPTableKit";
import { TPStatusPill } from "../../../components/ui/TPStatusPill";
import { TPRowActions } from "../../../components/ui/TPRowActions";
import { TPTr, TPTd } from "../../../components/ui/TPTable";
import { TPBadge } from "../../../components/ui/TPBadges";
import { TPCheckbox } from "../../../components/ui/TPCheckbox";
import ConfirmDeleteDialog from "../../../components/ui/ConfirmDeleteDialog";
import type { EntityRow, CommercialRuleType } from "../../../services/commercial-entities";
import type { SortKey } from "./clientes.types";

const RULE_LABEL: Record<CommercialRuleType, string> = {
  DISCOUNT:  "Desc.",
  BONUS:     "Bonif.",
  SURCHARGE: "Recargo",
};

function formatCommercialRule(row: EntityRow): string | null {
  if (!row.commercialRuleType || !row.commercialValue) return null;
  const type  = RULE_LABEL[row.commercialRuleType] ?? row.commercialRuleType;
  const value = row.commercialValueType === "PERCENTAGE"
    ? `${parseFloat(row.commercialValue).toFixed(1)}%`
    : `$${parseFloat(row.commercialValue).toLocaleString("es-AR")}`;
  return `${type} ${value}`;
}

const SORT_MENU_ITEMS: TPSortMenuItem[] = [
  { key: "displayName", label: "Nombre",              icon: <ArrowUpDown size={14} /> },
  { key: "createdAt",   label: "Hora de creación",    icon: <Clock       size={14} /> },
  { key: "updatedAt",   label: "Última modificación", icon: <RefreshCw   size={14} /> },
];

interface Props {
  rows: EntityRow[];
  total: number;
  loading: boolean;
  q: string;
  onSearchChange: (q: string) => void;
  sortKey: SortKey;
  sortDir: "asc" | "desc";
  onSort: (key: SortKey) => void;
  page: number;
  pageSize: number;
  onPageChange: (p: number) => void;
  onPageSizeChange: (ps: number) => void;
  storageKey: string;
  columns: TPColDef[];
  onEdit: (row: EntityRow) => void;
  onToggle: (row: EntityRow) => void;
  onDelete: (row: EntityRow) => void;
  onBulkDelete: (ids: string[]) => Promise<void>;
  onNew: () => void;
  onCombine?: () => void;
  onRelate?: () => void;
  onBulkImport?: () => void;
  detailBasePath: string;
  newLabel: string;
  countLabel: (n: number) => string;
  searchPlaceholder: string;
  emptyText: string;
  entityLabel: string;
}

export function EntidadesTable({
  rows,
  total,
  loading,
  q,
  onSearchChange,
  sortKey,
  sortDir,
  onSort,
  page,
  pageSize,
  onPageChange,
  onPageSizeChange,
  columns,
  storageKey,
  onEdit,
  onToggle,
  onDelete,
  onBulkDelete,
  onNew,
  onCombine,
  onRelate,
  onBulkImport,
  detailBasePath,
  newLabel,
  countLabel,
  searchPlaceholder,
  emptyText,
  entityLabel,
}: Props) {
  const navigate = useNavigate();

  // ── Selección masiva ──────────────────────────────────────────────────────
  const [lightboxSrc, setLightboxSrc]         = useState<string | null>(null);
  const [selectionMode, setSelectionMode]     = useState(false);
  const [selectedIds, setSelectedIds]         = useState<Set<string>>(new Set());
  const [bulkConfirmOpen, setBulkConfirmOpen] = useState(false);
  const [bulkBusy, setBulkBusy]               = useState(false);

  function enterSelectionMode() { setSelectionMode(true);  setSelectedIds(new Set()); }
  function exitSelectionMode()  { setSelectionMode(false); setSelectedIds(new Set()); }

  async function confirmBulkDelete() {
    const ids = Array.from(selectedIds).slice(0, 100);
    setBulkBusy(true);
    try {
      await onBulkDelete(ids);
      setBulkConfirmOpen(false);
      exitSelectionMode();
    } finally {
      setBulkBusy(false);
    }
  }

  const nSelected   = selectedIds.size;
  const cappedCount = Math.min(nSelected, 100);

  // ── Ítems de menú específicos de entidades ────────────────────────────────
  const entityMenuItems = [
    ...(onCombine    ? [{ label: `Combinar ${entityLabel}`,           icon: <Combine size={14} />, onClick: onCombine }]    : []),
    ...(onRelate     ? [{ label: `Relacionar con ${entityLabel === "clientes" ? "proveedor" : "cliente"}`, icon: <Link2 size={14} />, onClick: onRelate }] : []),
    ...((onCombine || onRelate) && onBulkImport ? [{ type: "separator" as const }] : []),
    ...(onBulkImport ? [{ label: `Importar / Exportar ${entityLabel}`, icon: <Upload size={14} />, onClick: onBulkImport }] : []),
  ];

  return (
    <>
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
        // ── Menú integrado ──────────────────────────────────────────────────
        sortMenuItems={SORT_MENU_ITEMS}
        onToggleSelectable={() => selectionMode ? exitSelectionMode() : enterSelectionMode()}
        menuItems={entityMenuItems.length > 0 ? entityMenuItems : undefined}
        // ── Selección masiva ────────────────────────────────────────────────
        selectable={selectionMode}
        getRowId={(row) => row.id}
        onSelectionChange={setSelectedIds}
        bulkActions={
          nSelected > 0 ? (
            <TPButton
              variant="danger"
              iconLeft={<Trash2 size={14} />}
              onClick={() => setBulkConfirmOpen(true)}
              className="h-8 text-sm"
            >
              Eliminar
            </TPButton>
          ) : undefined
        }
        // ── Acciones cabecera ───────────────────────────────────────────────
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
        // ── Paginación server-side ──────────────────────────────────────────
        pagination={{ page, pageSize, totalItems: total, onPageChange, onPageSizeChange }}
        onRowClick={selectionMode ? undefined : (row) => navigate(`/${detailBasePath}/${row.id}`)}
        renderRow={(row, vis, sel?: TPRowSel) => (
          <TPTr key={row.id} className={!row.isActive ? "opacity-60" : undefined}>
            {/* Checkbox de selección */}
            {sel && (
              <TPTd className="w-10 px-3" onClick={(e) => e.stopPropagation()}>
                <TPCheckbox checked={sel.checked} onChange={sel.onCheck} />
              </TPTd>
            )}

            {/* Nombre + avatar + tipo + código */}
            {vis.nombre && (
              <TPTd>
                <div className="flex items-center gap-2 min-w-0">
                  <div className="h-8 w-8 rounded-full overflow-hidden border border-border bg-surface shrink-0">
                    {row.avatarUrl ? (
                      <button
                        type="button"
                        className="h-full w-full cursor-zoom-in"
                        onClick={(e) => { e.stopPropagation(); setLightboxSrc(row.avatarUrl); }}
                        title="Ver imagen"
                      >
                        <img src={row.avatarUrl} alt={row.displayName} className="h-full w-full object-cover" />
                      </button>
                    ) : (
                      <div className="grid h-full w-full place-items-center text-xs font-bold text-primary bg-primary/10">
                        {row.displayName.split(/[\s,]+/).slice(0, 2).map((w) => w[0]).join("").toUpperCase() || "?"}
                      </div>
                    )}
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="text-sm font-medium text-text truncate">{row.displayName}</span>
                      {row.hasRelations && (
                        <span title="Tiene relaciones">
                          <Link size={12} className="shrink-0 text-primary/70" />
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <span className="text-xs text-muted">
                        {row.entityType === "COMPANY" ? "Empresa" : "Persona"}
                      </span>
                      {row.code && (
                        <span className="text-xs text-muted opacity-60">· {row.code}</span>
                      )}
                    </div>
                  </div>
                </div>
              </TPTd>
            )}

            {/* Rol */}
            {vis.roles && (
              <TPTd className="hidden md:table-cell">
                <div className="flex flex-wrap gap-1">
                  {row.isClient   && <TPBadge tone="primary" size="sm">Cliente</TPBadge>}
                  {row.isSupplier && <TPBadge tone="warning" size="sm">Proveedor</TPBadge>}
                </div>
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

            {/* Contacto: Email / Teléfono */}
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

            {/* Término de pago */}
            {vis.termino && (
              <TPTd className="hidden lg:table-cell">
                <span className="text-sm text-muted">{row.paymentTerm || "—"}</span>
              </TPTd>
            )}

            {/* Regla comercial */}
            {vis.regla && (
              <TPTd className="hidden lg:table-cell">
                {(() => {
                  const label = formatCommercialRule(row);
                  return label
                    ? <TPBadge tone="primary" size="sm">{label}</TPBadge>
                    : <span className="text-sm text-muted/40">—</span>;
                })()}
              </TPTd>
            )}

            {/* Exento IVA */}
            {vis.exento && (
              <TPTd className="hidden lg:table-cell">
                {row.taxExempt
                  ? <TPBadge tone="warning" size="sm">Exento</TPBadge>
                  : <span className="text-sm text-muted/40">—</span>}
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
                {selectionMode ? (
                  <span className="md:hidden"><TPStatusPill active={row.isActive} /></span>
                ) : (
                  <div className="flex items-center justify-end gap-1.5">
                    <span className="md:hidden"><TPStatusPill active={row.isActive} /></span>
                    <TPRowActions
                      onView={() => navigate(`/${detailBasePath}/${row.id}`)}
                      onEdit={() => onEdit(row)}
                      onToggle={() => onToggle(row)}
                      isActive={row.isActive}
                      onDelete={() => onDelete(row)}
                    />
                  </div>
                )}
              </TPTd>
            )}
          </TPTr>
        )}
      />

      <ConfirmDeleteDialog
        open={bulkConfirmOpen}
        title={`Eliminar ${cappedCount} ${entityLabel}`}
        description={`Se eliminarán ${cappedCount} registros seleccionados. Los que tengan movimientos asociados no se eliminarán. Esta acción no se puede deshacer.`}
        confirmText="Eliminar"
        busy={bulkBusy}
        onClose={() => { if (!bulkBusy) setBulkConfirmOpen(false); }}
        onConfirm={confirmBulkDelete}
      />
      <TPImageLightbox src={lightboxSrc} onClose={() => setLightboxSrc(null)} />
    </>
  );
}
