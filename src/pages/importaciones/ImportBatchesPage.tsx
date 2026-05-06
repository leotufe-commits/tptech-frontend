// src/pages/importaciones/ImportBatchesPage.tsx
// Historial de importaciones masivas — lista paginada con filtros.
import React, { useCallback, useEffect, useRef, useState } from "react";
import { Boxes, Calendar, Download, Eye, Filter, Upload, Users } from "lucide-react";
import { useNavigate } from "react-router-dom";

import TPSectionShell from "../../components/ui/TPSectionShell";
import { TPButton } from "../../components/ui/TPButton";
import { TPIconButton } from "../../components/ui/TPIconButton";
import { TPBadge } from "../../components/ui/TPBadges";
import { TPTableKit, type TPColDef } from "../../components/ui/TPTableKit";
import { TPFilterPopover, type TPFilterOption } from "../../components/ui/TPFilterPopover";
import { TPTd } from "../../components/ui/TPTable";
import { type SortDir } from "../../components/ui/TPSort";
import TPDateRangeInline, { type TPDateRangeValue } from "../../components/ui/TPDateRangeInline";
import { cn } from "../../components/ui/tp";
import { toast } from "../../lib/toast";
import {
  importBatchesApi,
  type ImportBatchRow,
  type BatchStatus,
  type BatchEntityType,
} from "../../services/import-batches";

/* ─── Columnas ──────────────────────────────────────────────────────────────── */
const COL_KEY = "tptech_col_import_batches";

const COLS: TPColDef[] = [
  { key: "date",       label: "Fecha",       sortKey: "date" },
  { key: "file",       label: "Archivo",     sortKey: "file" },
  { key: "type",       label: "Tipo",        sortKey: "type",  canHide: true },
  { key: "user",       label: "Usuario",     sortKey: "user",  canHide: true },
  { key: "created",    label: "Creados",                       canHide: true, align: "right" },
  { key: "updated",    label: "Actualizados",                  canHide: true, align: "right" },
  { key: "errors",     label: "Errores",                       canHide: true, align: "right" },
  { key: "status",     label: "Estado",                        canHide: false },
  { key: "actions",    label: "",            canHide: false,   align: "right", width: "56px" },
];

/* ─── Helpers de estilo ─────────────────────────────────────────────────────── */
function batchStatusBadge(status: BatchStatus) {
  switch (status) {
    case "SUCCESS": return <TPBadge tone="success">Exitosa</TPBadge>;
    case "PARTIAL": return <TPBadge tone="warning">Parcial</TPBadge>;
    case "FAILED":  return <TPBadge tone="danger">Fallida</TPBadge>;
  }
}

function entityTypeLabel(t: BatchEntityType) {
  return t === "ARTICLE" ? "Artículos" : "Clientes / Proveedores";
}

function EntityTypeChip({ type }: { type: BatchEntityType }) {
  const Icon = type === "ARTICLE" ? Boxes : Users;
  return (
    <span className="inline-flex items-center gap-1.5 text-xs text-text">
      <Icon size={12} className="shrink-0 text-muted" />
      {entityTypeLabel(type)}
    </span>
  );
}

function fmtDateTime(v?: string | null): string {
  if (!v) return "—";
  const d = new Date(v);
  if (isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("es-AR", {
    day: "2-digit", month: "2-digit", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

function s(v: any) { return String(v ?? "").trim(); }

/* ─── Opciones de filtros ───────────────────────────────────────────────────── */
const STATUS_OPTIONS: TPFilterOption<BatchStatus | "">[] = [
  { value: "", label: "Todos los estados" },
  { value: "SUCCESS", label: "Exitosa" },
  { value: "PARTIAL", label: "Parcial" },
  { value: "FAILED",  label: "Fallida" },
];

const TYPE_OPTIONS: TPFilterOption<BatchEntityType | "">[] = [
  { value: "",                  label: "Todos los tipos" },
  { value: "ARTICLE",           label: "Artículos" },
  { value: "COMMERCIAL_ENTITY", label: "Clientes / Proveedores" },
];

/* ─── Componente ────────────────────────────────────────────────────────────── */
export default function ImportBatchesPage() {
  const navigate = useNavigate();

  const [loading, setLoading]   = useState(false);
  const [rows, setRows]         = useState<ImportBatchRow[]>([]);
  const [total, setTotal]       = useState(0);
  const [page, setPage]         = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [q, setQ]               = useState("");

  const [status, setStatus]     = useState<BatchStatus | "">("");
  const [type, setType]         = useState<BatchEntityType | "">("");
  const [dateRange, setDateRange] = useState<TPDateRangeValue>({ from: null, to: null });
  const [dateOpen, setDateOpen] = useState(false);

  const [statusOpen, setStatusOpen] = useState(false);
  const [typeOpen,   setTypeOpen]   = useState(false);
  const statusBtnRef = useRef<HTMLButtonElement>(null);
  const typeBtnRef   = useRef<HTMLButtonElement>(null);

  /* ─── Carga de datos ──────────────────────────────────────────────────────── */
  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const data = await importBatchesApi.list({
        status:   status || undefined,
        entityType: type || undefined,
        from:     dateRange.from?.toISOString(),
        to:       dateRange.to?.toISOString(),
        page,
        pageSize,
      });
      setRows(data.rows);
      setTotal(data.total);
    } catch (e: any) {
      toast.error(e?.message || "Error al cargar el historial.");
    } finally {
      setLoading(false);
    }
  }, [status, type, dateRange, page, pageSize]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  /* ─── Reset de página al cambiar filtros ──────────────────────────────────── */
  function applyStatus(v: BatchStatus | "") { setStatus(v); setPage(1); }
  function applyType(v: BatchEntityType | "") { setType(v); setPage(1); }
  function applyDate(v: TPDateRangeValue) { setDateRange(v); setPage(1); }

  const activeDateFilter = Boolean(dateRange.from || dateRange.to);
  const activeFilters    = Number(!!status) + Number(!!type) + Number(activeDateFilter);

  /* ─── Render ──────────────────────────────────────────────────────────────── */
  return (
    <TPSectionShell
      title="Importaciones"
      subtitle="Historial de cargas masivas de artículos, clientes y proveedores."
      icon={<Upload size={20} />}
    >
      <TPTableKit
        rows={rows}
        columns={COLS}
        storageKey={COL_KEY}
        search={q}
        onSearchChange={v => { setQ(v); setPage(1); }}
        searchPlaceholder="Buscar por archivo…"
        loading={loading}
        emptyText="No hay importaciones registradas."
        countLabel={n => `${n} importación${n !== 1 ? "es" : ""}`}
        pagination={{
          page,
          pageSize,
          totalItems: total,
          onPageChange: setPage,
          onPageSizeChange: sz => { setPageSize(sz); setPage(1); },
          pageSizeOptions: [10, 25, 50],
        }}
        headerLeft={
          <div className="flex items-center gap-1.5">
            {/* Filtro estado */}
            <div className="relative shrink-0">
              <TPIconButton
                ref={statusBtnRef}
                onClick={() => setStatusOpen(o => !o)}
                active={statusOpen || !!status}
                title="Filtrar por estado"
              >
                <Filter size={15} />
              </TPIconButton>
              {!!status && (
                <span className="pointer-events-none absolute -top-1.5 -right-1.5 min-w-[16px] h-4 rounded-full bg-primary text-white text-[9px] font-bold leading-none flex items-center justify-center px-1">
                  1
                </span>
              )}
              <TPFilterPopover
                open={statusOpen}
                options={STATUS_OPTIONS}
                value={status}
                onChange={v => { applyStatus(v as BatchStatus | ""); setStatusOpen(false); }}
                onClose={() => setStatusOpen(false)}
                anchorRef={statusBtnRef}
              />
            </div>

            {/* Filtro tipo */}
            <div className="relative shrink-0">
              <TPIconButton
                ref={typeBtnRef}
                onClick={() => setTypeOpen(o => !o)}
                active={typeOpen || !!type}
                title="Filtrar por tipo"
              >
                <Upload size={15} />
              </TPIconButton>
              {!!type && (
                <span className="pointer-events-none absolute -top-1.5 -right-1.5 min-w-[16px] h-4 rounded-full bg-primary text-white text-[9px] font-bold leading-none flex items-center justify-center px-1">
                  1
                </span>
              )}
              <TPFilterPopover
                open={typeOpen}
                options={TYPE_OPTIONS}
                value={type}
                onChange={v => { applyType(v as BatchEntityType | ""); setTypeOpen(false); }}
                onClose={() => setTypeOpen(false)}
                anchorRef={typeBtnRef}
              />
            </div>

            {/* Filtro fecha */}
            <div className="flex items-center shrink-0">
              <div className="relative shrink-0">
                <TPIconButton
                  onClick={() => setDateOpen(o => !o)}
                  active={dateOpen || activeDateFilter}
                  title="Filtrar por fecha"
                >
                  <Calendar size={15} />
                </TPIconButton>
                {activeDateFilter && (
                  <span className="pointer-events-none absolute -top-1.5 -right-1.5 min-w-[16px] h-4 rounded-full bg-primary text-white text-[9px] font-bold leading-none flex items-center justify-center px-1">
                    1
                  </span>
                )}
              </div>
              {dateOpen && (
                <div className="ml-1.5 shrink-0">
                  <TPDateRangeInline
                    value={dateRange}
                    onChange={applyDate}
                    showPresets
                    defaultPresetDays={0}
                  />
                </div>
              )}
            </div>

            {/* Chip: limpiar filtros activos */}
            {activeFilters > 0 && (
              <button
                className="ml-1 text-xs text-muted underline underline-offset-2 hover:text-text transition-colors"
                onClick={() => { applyStatus(""); applyType(""); applyDate({ from: null, to: null }); }}
              >
                Limpiar filtros
              </button>
            )}
          </div>
        }
        renderRow={(row, vis) => {
          const fileName  = s(row.fileName) || "Sin nombre";
          const shortName = fileName.length > 32 ? fileName.slice(0, 30) + "…" : fileName;

          return (
            <tr
              key={row.id}
              className="border-b border-border hover:bg-surface2/40 transition-colors cursor-pointer"
              onClick={() => navigate(`/importaciones/${row.id}`)}
            >
              {vis.date && (
                <TPTd>
                  <span className="text-xs text-text whitespace-nowrap">{fmtDateTime(row.importedAt)}</span>
                </TPTd>
              )}
              {vis.file && (
                <TPTd>
                  <span className="text-xs text-text font-mono" title={fileName}>{shortName}</span>
                </TPTd>
              )}
              {vis.type && (
                <TPTd>
                  <EntityTypeChip type={row.entityType} />
                </TPTd>
              )}
              {vis.user && (
                <TPTd>
                  <span className="text-xs text-muted">
                    {s(row.createdBy?.name ?? row.createdBy?.email) || "—"}
                  </span>
                </TPTd>
              )}
              {vis.created && (
                <TPTd className="text-right">
                  <span className={cn("text-xs font-semibold tabular-nums", row.created > 0 ? "text-green-600 dark:text-green-400" : "text-muted")}>
                    {row.created}
                  </span>
                </TPTd>
              )}
              {vis.updated && (
                <TPTd className="text-right">
                  <span className={cn("text-xs font-semibold tabular-nums", row.updated > 0 ? "text-blue-600 dark:text-blue-400" : "text-muted")}>
                    {row.updated}
                  </span>
                </TPTd>
              )}
              {vis.errors && (
                <TPTd className="text-right">
                  <span className={cn("text-xs font-semibold tabular-nums", row.errors > 0 ? "text-red-500 dark:text-red-400" : "text-muted")}>
                    {row.errors}
                  </span>
                </TPTd>
              )}
              {vis.status && (
                <TPTd>{batchStatusBadge(row.status)}</TPTd>
              )}
              {vis.actions && (
                <TPTd className="text-right" onClick={e => e.stopPropagation()}>
                  <TPButton
                    variant="ghost"
                    onClick={() => navigate(`/importaciones/${row.id}`)}
                    title="Ver detalle"
                  >
                    <Eye size={14} />
                  </TPButton>
                </TPTd>
              )}
            </tr>
          );
        }}
      />
    </TPSectionShell>
  );
}
