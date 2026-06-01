// src/pages/configuracion-sistema/documentos/NumeracionAdmin.tsx
// =============================================================================
// Pantalla admin de Numeración de comprobantes — Etapa B (2026-05-29).
//
// Reemplaza al placeholder "Módulo en preparación" dentro de la tab
// `numeracion` de `DocumentosComprobantesPage`. CRUD completo contra
// `/api/receipt-series`:
//   · Listar series del tenant ordenadas por tipo / dirección / prefijo / PV.
//   · Crear / editar / activar-inactivar / soft-delete.
//   · Estado vacío con CTA "Crear primera serie".
//
// Patrón visual: TPTableKit + TPRowActions (idéntico a Cupones / Canales /
// Categorías). Modal de crear/editar delegado a `NumeracionSeriesModal`.
//
// Manejo de errores: toast con el mensaje del backend (que ya viene
// accionable — ej. "No se puede establecer un próximo número menor al
// último comprobante emitido."). El error 409 al borrar (serie con
// receipts emitidos) también muestra el mensaje del backend.
// =============================================================================

import React, { useEffect, useState } from "react";
import { Hash, Plus } from "lucide-react";
import { toast } from "../../../lib/toast";
import { useConfirmDelete } from "../../../hooks/useConfirmDelete";
import ConfirmDeleteDialog from "../../../components/ui/ConfirmDeleteDialog";
import { TPButton } from "../../../components/ui/TPButton";
import { TPTr, TPTd } from "../../../components/ui/TPTable";
import { TPTableKit, type TPColDef } from "../../../components/ui/TPTableKit";
import { TPStatusPill } from "../../../components/ui/TPStatusPill";
import { TPRowActions } from "../../../components/ui/TPRowActions";
import { TPBadge } from "../../../components/ui/TPBadges";
import {
  receiptSeriesApi,
  RECEIPT_SERIES_TYPE_LABELS,
  RECEIPT_SERIES_DIRECTION_LABELS,
  type ReceiptSeries,
  type CreateReceiptSeriesPayload,
  type UpdateReceiptSeriesPayload,
} from "../../../services/receipt-series";
import { NumeracionSeriesModal } from "./NumeracionSeriesModal";

const COL_DEFS: TPColDef[] = [
  { key: "type",        label: "Tipo",            canHide: false },
  { key: "direction",   label: "Dirección",       canHide: false },
  { key: "prefix",      label: "Serie",           canHide: false },
  { key: "pointOfSale", label: "Punto de venta",  canHide: false },
  { key: "nextNumber",  label: "Próximo número",  canHide: false, align: "right" },
  { key: "isActive",    label: "Estado",          canHide: false },
  { key: "actions",     label: "",                canHide: false, align: "right" },
];

export default function NumeracionAdmin(): React.ReactElement {
  const [rows, setRows] = useState<ReceiptSeries[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Modal state
  const [modalOpen, setModalOpen] = useState<boolean>(false);
  const [editTarget, setEditTarget] = useState<ReceiptSeries | null>(null);
  const [saving, setSaving] = useState<boolean>(false);

  // Confirmación de delete (igual patrón que Cupones).
  const { askDelete, dialogProps } = useConfirmDelete();

  async function load(): Promise<void> {
    setLoading(true);
    setError(null);
    try {
      const data = await receiptSeriesApi.list();
      setRows(data);
    } catch (err: any) {
      const msg = err?.message || "No se pudieron cargar las series.";
      setError(msg);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  function openCreate(): void {
    setEditTarget(null);
    setModalOpen(true);
  }

  function openEdit(row: ReceiptSeries): void {
    setEditTarget(row);
    setModalOpen(true);
  }

  async function handleCreate(payload: CreateReceiptSeriesPayload): Promise<void> {
    setSaving(true);
    try {
      await receiptSeriesApi.create(payload);
      toast.success("Serie creada correctamente.");
      setModalOpen(false);
      await load();
    } catch (err: any) {
      toast.error(err?.message || "No se pudo crear la serie.");
    } finally {
      setSaving(false);
    }
  }

  async function handleUpdate(id: string, payload: UpdateReceiptSeriesPayload): Promise<void> {
    setSaving(true);
    try {
      await receiptSeriesApi.update(id, payload);
      toast.success("Serie actualizada.");
      setModalOpen(false);
      await load();
    } catch (err: any) {
      toast.error(err?.message || "No se pudo actualizar la serie.");
    } finally {
      setSaving(false);
    }
  }

  async function handleToggle(row: ReceiptSeries): Promise<void> {
    try {
      await receiptSeriesApi.update(row.id, { isActive: !row.isActive });
      toast.success(row.isActive ? "Serie desactivada." : "Serie activada.");
      await load();
    } catch (err: any) {
      toast.error(err?.message || "No se pudo cambiar el estado.");
    }
  }

  function describeSeries(row: ReceiptSeries): string {
    const prefixPart = row.prefix ? row.prefix : "Sin prefijo";
    return `${RECEIPT_SERIES_TYPE_LABELS[row.type]} · ${prefixPart} · ${row.pointOfSale}`;
  }

  // ─── Estado vacío ───────────────────────────────────────────────────────
  // Mostramos el CTA de "Crear primera serie" cuando no hay rows y no se
  // está cargando ni hubo error.
  const isEmpty = !loading && !error && rows.length === 0;

  if (isEmpty) {
    return (
      <>
        <NumeracionHeader onCreate={openCreate} hideCreateButton />
        <div
          data-testid="numeracion-empty-state"
          className="rounded-2xl border border-dashed border-border bg-card/40 p-8 max-w-2xl"
        >
          <div className="flex items-start gap-3">
            <div className="grid h-11 w-11 shrink-0 place-items-center rounded-xl border border-border bg-surface2 text-muted">
              <Hash size={20} aria-hidden />
            </div>
            <div className="min-w-0">
              <h3 className="text-base font-semibold text-text">Todavía no hay series configuradas.</h3>
              <p className="text-sm text-muted mt-1 leading-relaxed">
                Creá una serie para definir el prefijo, punto de venta y próximo número de tus comprobantes.
              </p>
              <div className="mt-4">
                <TPButton variant="primary" iconLeft={<Plus size={16} />} onClick={openCreate}>
                  Crear primera serie
                </TPButton>
              </div>
            </div>
          </div>
        </div>

        <NumeracionSeriesModal
          open={modalOpen}
          editTarget={editTarget}
          saving={saving}
          onClose={() => !saving && setModalOpen(false)}
          onCreate={handleCreate}
          onUpdate={handleUpdate}
        />
      </>
    );
  }

  // ─── Tabla principal ────────────────────────────────────────────────────
  return (
    <>
      <NumeracionHeader onCreate={openCreate} />
      <TPTableKit
        rows={rows}
        columns={COL_DEFS}
        loading={loading}
        error={error ?? undefined}
        emptyText="No hay series configuradas todavía."
        getRowId={(row: ReceiptSeries) => row.id}
        actions={
          <TPButton variant="primary" iconLeft={<Plus size={16} />} onClick={openCreate}>
            Nueva serie
          </TPButton>
        }
        renderRow={(row: ReceiptSeries, vis) => (
          <TPTr key={row.id} className={!row.isActive ? "opacity-60" : undefined}>
            {vis.type && (
              <TPTd>
                <TPBadge tone="neutral">{RECEIPT_SERIES_TYPE_LABELS[row.type]}</TPBadge>
              </TPTd>
            )}
            {vis.direction && (
              <TPTd>
                <TPBadge tone={row.direction === "OUTBOUND" ? "primary" : "info"}>
                  {RECEIPT_SERIES_DIRECTION_LABELS[row.direction]}
                </TPBadge>
              </TPTd>
            )}
            {vis.prefix && (
              <TPTd>
                <div className="flex flex-col">
                  <span className="font-mono text-sm font-semibold">
                    {row.prefix || <span className="italic text-muted">Sin prefijo</span>}
                  </span>
                  <span className="text-[11px] text-muted">{row.name}</span>
                </div>
              </TPTd>
            )}
            {vis.pointOfSale && (
              <TPTd>
                <span className="font-mono text-sm tabular-nums">{row.pointOfSale}</span>
              </TPTd>
            )}
            {vis.nextNumber && (
              <TPTd className="text-right">
                <span className="font-mono text-sm font-semibold tabular-nums text-primary">
                  {row.nextNumber}
                </span>
              </TPTd>
            )}
            {vis.isActive && (
              <TPTd>
                <TPStatusPill active={row.isActive} />
              </TPTd>
            )}
            {vis.actions && (
              <TPTd className="text-right">
                <TPRowActions
                  onEdit={() => openEdit(row)}
                  onToggle={() => void handleToggle(row)}
                  isActive={row.isActive}
                  onDelete={() => askDelete({
                    entityName: "serie de numeración",
                    entityLabel: describeSeries(row),
                    onDelete: () => receiptSeriesApi.remove(row.id),
                    onAfterSuccess: load,
                  })}
                />
              </TPTd>
            )}
          </TPTr>
        )}
      />

      <NumeracionSeriesModal
        open={modalOpen}
        editTarget={editTarget}
        saving={saving}
        onClose={() => !saving && setModalOpen(false)}
        onCreate={handleCreate}
        onUpdate={handleUpdate}
      />

      <ConfirmDeleteDialog {...dialogProps} />
    </>
  );
}

// ─── Subcomponente — Header de la pantalla ─────────────────────────────────

function NumeracionHeader({ onCreate, hideCreateButton }: { onCreate: () => void; hideCreateButton?: boolean }): React.ReactElement {
  return (
    <div className="mb-4 flex items-start justify-between gap-3">
      <div>
        <h2 className="text-base font-semibold text-text">Numeración de comprobantes</h2>
        <p className="text-sm text-muted mt-1 max-w-2xl">
          Configurá las series, prefijos, puntos de venta y próximos números de tus comprobantes.
        </p>
      </div>
      {!hideCreateButton && (
        <TPButton variant="primary" iconLeft={<Plus size={16} />} onClick={onCreate}>
          Nueva serie
        </TPButton>
      )}
    </div>
  );
}
