// src/pages/importaciones/ImportBatchDetailPage.tsx
// Detalle de una importación: resumen + tabla de filas con filtros.
import React, { useCallback, useEffect, useRef, useState } from "react";
import { ArrowLeft, Download, Filter, RefreshCw } from "lucide-react";
import { useNavigate, useParams } from "react-router-dom";

import TPSectionShell from "../../components/ui/TPSectionShell";
import { TPCard } from "../../components/ui/TPCard";
import { TPButton } from "../../components/ui/TPButton";
import { TPIconButton } from "../../components/ui/TPIconButton";
import { TPBadge } from "../../components/ui/TPBadges";
import { TPTableKit, type TPColDef } from "../../components/ui/TPTableKit";
import { TPFilterPopover, type TPFilterOption } from "../../components/ui/TPFilterPopover";
import { TPTd } from "../../components/ui/TPTable";
import { type SortDir } from "../../components/ui/TPSort";
import { cn } from "../../components/ui/tp";
import { toast } from "../../lib/toast";
import {
  importBatchesApi,
  type ImportBatchDetail,
  type ImportBatchRowDetail,
  type ActionResult,
  type BatchStatus,
} from "../../services/import-batches";

/* ─── Helpers ───────────────────────────────────────────────────────────────── */
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

function batchStatusBadge(status: BatchStatus) {
  switch (status) {
    case "SUCCESS": return <TPBadge tone="success">Exitosa</TPBadge>;
    case "PARTIAL": return <TPBadge tone="warning">Parcial</TPBadge>;
    case "FAILED":  return <TPBadge tone="danger">Fallida</TPBadge>;
  }
}

function actionResultBadge(ar: ActionResult) {
  switch (ar) {
    case "CREATED":  return <TPBadge tone="success">Creado</TPBadge>;
    case "UPDATED":  return <TPBadge tone="info">Actualizado</TPBadge>;
    case "SKIPPED":  return <TPBadge tone="neutral">Omitido</TPBadge>;
    case "FAILED":   return <TPBadge tone="danger">Error</TPBadge>;
    case "CONFLICT": return <TPBadge tone="warning">Conflicto</TPBadge>;
  }
}

function entityTypeLabel(t: string) {
  return t === "ARTICLE" ? "Artículos" : "Entidades";
}

function conflictLabel(mode: string) {
  switch (mode) {
    case "skip":   return "Omitir existentes";
    case "update": return "Actualizar existentes";
    case "upsert": return "Crear o actualizar";
    case "create": return "Solo crear nuevos";
    default:       return mode;
  }
}

/* ─── Columnas de la tabla de filas ─────────────────────────────────────────── */
const ROWS_COL_KEY = "tptech_col_import_batch_rows";

const ROWS_COLS: TPColDef[] = [
  { key: "index",      label: "#",           width: "56px"                },
  { key: "identifier", label: "Identificador"                             },
  { key: "name",       label: "Descripción",  canHide: true               },
  { key: "result",     label: "Resultado"                                  },
  { key: "message",    label: "Mensaje",      canHide: true               },
];

/* ─── Opciones filtro resultado ──────────────────────────────────────────────── */
const RESULT_OPTIONS: TPFilterOption<ActionResult | "">[] = [
  { value: "",          label: "Todos los resultados" },
  { value: "CREATED",   label: "Creados"              },
  { value: "UPDATED",   label: "Actualizados"         },
  { value: "SKIPPED",   label: "Omitidos"             },
  { value: "FAILED",    label: "Con error"            },
  { value: "CONFLICT",  label: "Con conflicto"        },
];

/* ─── Stat card ─────────────────────────────────────────────────────────────── */
function StatBubble({
  label, value, tone,
}: { label: string; value: number; tone: "success" | "info" | "neutral" | "danger" }) {
  const colorMap = {
    success: "text-green-600 dark:text-green-400",
    info:    "text-blue-600 dark:text-blue-400",
    neutral: "text-muted",
    danger:  "text-red-500 dark:text-red-400",
  } as const;
  return (
    <div className="flex flex-col items-center gap-0.5">
      <span className={cn("text-2xl font-bold tabular-nums", colorMap[tone])}>{value}</span>
      <span className="text-xs text-muted">{label}</span>
    </div>
  );
}

/* ─── Componente ────────────────────────────────────────────────────────────── */
export default function ImportBatchDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [loading,     setLoading]     = useState(false);
  const [loadingRows, setLoadingRows] = useState(false);
  const [batch, setBatch]             = useState<ImportBatchDetail | null>(null);
  const [batchRows, setBatchRows]     = useState<ImportBatchRowDetail[]>([]);
  const [rowsTotal, setRowsTotal]     = useState(0);

  const [page,     setPage]     = useState(1);
  const [pageSize, setPageSize] = useState(50);
  const [actionResult, setActionResult] = useState<ActionResult | "">("");

  const [filterOpen, setFilterOpen] = useState(false);
  const filterBtnRef = useRef<HTMLButtonElement>(null);

  const [busyDownload, setBusyDownload] = useState(false);
  const [busyRetry,    setBusyRetry]    = useState(false);

  /* ─── Carga del batch ─────────────────────────────────────────────────────── */
  useEffect(() => {
    if (!id) return;
    setLoading(true);
    importBatchesApi.get(id)
      .then(setBatch)
      .catch(e => { toast.error(e?.message || "No se pudo cargar la importación."); })
      .finally(() => setLoading(false));
  }, [id]);

  /* ─── Carga de filas ──────────────────────────────────────────────────────── */
  const refreshRows = useCallback(async () => {
    if (!id) return;
    setLoadingRows(true);
    try {
      const data = await importBatchesApi.rows(id, {
        actionResult: actionResult || undefined,
        page,
        pageSize,
      });
      setBatchRows(data.rows);
      setRowsTotal(data.total);
    } catch (e: any) {
      toast.error(e?.message || "Error al cargar las filas.");
    } finally {
      setLoadingRows(false);
    }
  }, [id, actionResult, page, pageSize]);

  useEffect(() => { refreshRows(); }, [refreshRows]);

  /* ─── Descarga de errores ─────────────────────────────────────────────────── */
  function handleDownload() {
    if (!id) return;
    setBusyDownload(true);
    try {
      importBatchesApi.downloadErrors(id);
    } finally {
      setBusyDownload(false);
    }
  }

  /* ─── Reintento de errores ────────────────────────────────────────────────── */
  async function handleRetry() {
    if (!id) return;
    setBusyRetry(true);
    try {
      const result = await importBatchesApi.retry(id);
      toast.success("Se creó una nueva importación con los registros fallidos.");
      navigate(`/importaciones/${result.batchId}`);
    } catch (e: any) {
      toast.error(e?.message || "No se pudo reintentar la importación.");
    } finally {
      setBusyRetry(false);
    }
  }

  /* ─── Header ──────────────────────────────────────────────────────────────── */
  const batchTitle = batch
    ? (s(batch.fileName) || "Importación sin nombre")
    : (loading ? "Cargando…" : "Importación");

  /* ─── Render ──────────────────────────────────────────────────────────────── */
  return (
    <TPSectionShell
      title={batchTitle}
      subtitle="Detalle de importación masiva"
      icon={
        <TPButton
          variant="ghost"
          onClick={() => navigate("/importaciones")}
          title="Volver al historial"
          className="mr-1"
        >
          <ArrowLeft size={16} />
        </TPButton>
      }
      right={
        batch?.errors && batch.errors > 0 ? (
          <div className="flex items-center gap-2">
            <TPButton
              variant="primary"
              iconLeft={<RefreshCw size={14} />}
              onClick={handleRetry}
              loading={busyRetry}
            >
              Reintentar errores
            </TPButton>
            <TPButton
              variant="secondary"
              iconLeft={<Download size={15} />}
              onClick={handleDownload}
              loading={busyDownload}
            >
              Descargar CSV
            </TPButton>
          </div>
        ) : null
      }
    >
      {/* ── Resumen ───────────────────────────────────────────────────────────── */}
      {batch && (
        <TPCard
          title="Resumen de la importación"
          className="mb-4"
        >
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Columna izquierda: metadata */}
            <div className="flex flex-col gap-3 text-sm">
              <div className="flex justify-between items-center border-b border-border pb-2">
                <span className="text-muted">Estado</span>
                <span>{batchStatusBadge(batch.status)}</span>
              </div>
              <div className="flex justify-between items-center border-b border-border pb-2">
                <span className="text-muted">Tipo</span>
                <span className="text-text font-medium">{entityTypeLabel(batch.entityType)}</span>
              </div>
              <div className="flex justify-between items-center border-b border-border pb-2">
                <span className="text-muted">Modo de conflicto</span>
                <span className="text-text">{conflictLabel(batch.onConflict)}</span>
              </div>
              <div className="flex justify-between items-center border-b border-border pb-2">
                <span className="text-muted">Fecha</span>
                <span className="text-text whitespace-nowrap">{fmtDateTime(batch.importedAt)}</span>
              </div>
              <div className="flex justify-between items-center border-b border-border pb-2">
                <span className="text-muted">Usuario</span>
                <span className="text-text">
                  {s(batch.createdBy?.name ?? batch.createdBy?.email) || "—"}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-muted">Archivo</span>
                <span className="text-text font-mono text-xs truncate max-w-[180px]" title={s(batch.fileName)}>
                  {s(batch.fileName) || "—"}
                </span>
              </div>
            </div>

            {/* Columna derecha: métricas numéricas */}
            <div className="flex flex-wrap items-center justify-around gap-6 sm:border-l sm:border-border sm:pl-6">
              <StatBubble label="Total filas" value={batch.totalRows} tone="neutral" />
              <StatBubble label="Creados"     value={batch.created}   tone="success" />
              <StatBubble label="Actualizados" value={batch.updated}  tone="info"    />
              <StatBubble label="Omitidos"    value={batch.skipped}   tone="neutral" />
              <StatBubble label="Errores"     value={batch.errors}    tone="danger"  />
            </div>
          </div>

          {/* Alerta si no hubo errores */}
          {batch.errors === 0 && (
            <div className="mt-4 rounded-md bg-green-500/10 border border-green-500/20 px-4 py-2.5 text-sm text-green-700 dark:text-green-400">
              No hubo errores en esta importación.
            </div>
          )}

          {/* Alerta si fue FAILED completo */}
          {batch.status === "FAILED" && (
            <div className="mt-4 rounded-md bg-red-500/10 border border-red-500/20 px-4 py-2.5 text-sm text-red-700 dark:text-red-400">
              La importación falló completamente. Ninguna fila fue procesada correctamente.
            </div>
          )}
        </TPCard>
      )}

      {/* ── Tabla de filas ────────────────────────────────────────────────────── */}
      <TPTableKit
        rows={batchRows}
        columns={ROWS_COLS}
        storageKey={ROWS_COL_KEY}
        loading={loadingRows}
        emptyText={
          actionResult === "FAILED"
            ? "No hay filas con error en esta importación."
            : "No hay filas para mostrar."
        }
        countLabel={n => `${n} fila${n !== 1 ? "s" : ""}`}
        pagination={{
          page,
          pageSize,
          totalItems: rowsTotal,
          onPageChange: setPage,
          onPageSizeChange: sz => { setPageSize(sz); setPage(1); },
          pageSizeOptions: [25, 50, 100, 200],
        }}
        headerLeft={
          <div className="flex items-center gap-1.5">
            {/* Filtro por resultado */}
            <div className="relative shrink-0">
              <TPIconButton
                ref={filterBtnRef}
                onClick={() => setFilterOpen(o => !o)}
                active={filterOpen || !!actionResult}
                title="Filtrar por resultado"
              >
                <Filter size={15} />
              </TPIconButton>
              {!!actionResult && (
                <span className="pointer-events-none absolute -top-1.5 -right-1.5 min-w-[16px] h-4 rounded-full bg-primary text-white text-[9px] font-bold leading-none flex items-center justify-center px-1">
                  1
                </span>
              )}
              <TPFilterPopover
                open={filterOpen}
                options={RESULT_OPTIONS}
                value={actionResult}
                onChange={v => {
                  setActionResult(v as ActionResult | "");
                  setPage(1);
                  setFilterOpen(false);
                }}
                onClose={() => setFilterOpen(false)}
                anchorRef={filterBtnRef}
              />
            </div>

            {/* Acceso rápido: solo errores */}
            {actionResult !== "FAILED" && batch && batch.errors > 0 && (
              <button
                className="text-xs text-red-500 dark:text-red-400 underline underline-offset-2 hover:opacity-80 transition-opacity"
                onClick={() => { setActionResult("FAILED"); setPage(1); }}
              >
                Ver solo errores ({batch.errors})
              </button>
            )}
            {actionResult === "FAILED" && (
              <button
                className="text-xs text-muted underline underline-offset-2 hover:text-text transition-colors"
                onClick={() => { setActionResult(""); setPage(1); }}
              >
                Ver todas
              </button>
            )}
          </div>
        }
        renderRow={(row, vis) => {
          const isFailed   = row.actionResult === "FAILED";
          const isConflict = row.actionResult === "CONFLICT";

          return (
            <tr
              key={row.id}
              className={cn(
                "border-b border-border transition-colors",
                isFailed   && "bg-red-500/5 hover:bg-red-500/10",
                isConflict && "bg-amber-500/5 hover:bg-amber-500/10",
                !isFailed && !isConflict && "hover:bg-surface2/40"
              )}
            >
              {vis.index && (
                <TPTd>
                  <span className="text-xs text-muted tabular-nums">{row.rowIndex}</span>
                </TPTd>
              )}
              {vis.identifier && (
                <TPTd>
                  <span className="text-xs font-mono text-text">
                    {s(row.identifier) || <span className="text-muted">—</span>}
                  </span>
                </TPTd>
              )}
              {vis.name && (
                <TPTd>
                  <span className="text-xs text-text truncate max-w-[200px]" title={row.displayName}>
                    {s(row.displayName) || "—"}
                  </span>
                </TPTd>
              )}
              {vis.result && (
                <TPTd>{actionResultBadge(row.actionResult)}</TPTd>
              )}
              {vis.message && (
                <TPTd>
                  {row.errors && row.errors.length > 1 ? (
                    <div className="flex flex-col gap-0.5">
                      {row.errors.map((err, i) => (
                        <span key={i} className="text-xs text-red-600 dark:text-red-400">
                          {err}
                        </span>
                      ))}
                    </div>
                  ) : (
                    <span className={cn(
                      "text-xs",
                      isFailed ? "text-red-600 dark:text-red-400" :
                      isConflict ? "text-amber-700 dark:text-amber-400" :
                      "text-muted"
                    )}>
                      {s(row.message) || "—"}
                    </span>
                  )}
                </TPTd>
              )}
            </tr>
          );
        }}
      />
    </TPSectionShell>
  );
}
