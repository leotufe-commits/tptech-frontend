// src/pages/configuracion-sistema/documentos/NumeracionSeriesModal.tsx
// =============================================================================
// Modal Crear/Editar serie de numeración (Etapa B — 2026-05-29).
//
// Modos:
//   · Crear → todos los campos editables incluido `type` y `direction`.
//   · Editar → `type` y `direction` se muestran como badges informativos
//             (no editables) porque el backend los marca inmutables.
//             Si se necesita cambiar la naturaleza fiscal de la serie,
//             el operador debe crear OTRA serie y soft-deletear esta.
//
// Validaciones inline (espejo del backend):
//   · name        → requerido, max 120
//   · prefix      → /^[A-Z]{0,3}$/ (transformado a mayúsculas on-blur)
//   · pointOfSale → /^\d{4}$/      (transformado a 4 dígitos pad-left on-blur)
//   · nextNumber  → entero ≥ 1
//
// El componente NO hace la request — emite onSubmit con el payload limpio.
// El padre (`NumeracionAdmin`) maneja la llamada al servicio y los toasts.
// =============================================================================

import React, { useEffect, useMemo, useState } from "react";
import { Save, X } from "lucide-react";
import { Modal } from "../../../components/ui/Modal";
import { TPButton } from "../../../components/ui/TPButton";
import { TPField } from "../../../components/ui/TPField";
import TPInput from "../../../components/ui/TPInput";
import TPNumberInput from "../../../components/ui/TPNumberInput";
import TPComboFixed from "../../../components/ui/TPComboFixed";
import { TPCheckbox } from "../../../components/ui/TPCheckbox";
import { TPBadge } from "../../../components/ui/TPBadges";
import {
  RECEIPT_SERIES_TYPE_LABELS,
  RECEIPT_SERIES_DIRECTION_LABELS,
  type ReceiptSeries,
  type ReceiptSeriesType,
  type ReceiptSeriesDirection,
  type CreateReceiptSeriesPayload,
  type UpdateReceiptSeriesPayload,
} from "../../../services/receipt-series";

// Regex espejo del backend.
const PREFIX_RX = /^[A-Z]{0,3}$/;
const POS_RX    = /^\d{4}$/;

export type NumeracionSeriesModalProps = {
  open: boolean;
  /** Si está presente → modo editar. Si no → modo crear. */
  editTarget?: ReceiptSeries | null;
  /** Loading mientras la request del padre está en vuelo. Deshabilita el form. */
  saving?: boolean;
  onClose(): void;
  /** Crear → emite payload completo. */
  onCreate?(payload: CreateReceiptSeriesPayload): Promise<void> | void;
  /** Editar → emite SOLO los campos que se pueden modificar. */
  onUpdate?(id: string, payload: UpdateReceiptSeriesPayload): Promise<void> | void;
};

const TYPE_OPTIONS = (Object.entries(RECEIPT_SERIES_TYPE_LABELS) as [ReceiptSeriesType, string][])
  .map(([value, label]) => ({ value, label }));

const DIRECTION_OPTIONS = (Object.entries(RECEIPT_SERIES_DIRECTION_LABELS) as [ReceiptSeriesDirection, string][])
  .map(([value, label]) => ({ value, label }));

type FormState = {
  name:        string;
  type:        ReceiptSeriesType;
  direction:   ReceiptSeriesDirection;
  prefix:      string;
  pointOfSale: string;
  nextNumber:  number;
  isActive:    boolean;
};

const EMPTY_FORM: FormState = {
  name:        "",
  type:        "INVOICE",
  direction:   "OUTBOUND",
  prefix:      "",
  pointOfSale: "0001",
  nextNumber:  1,
  isActive:    true,
};

export function NumeracionSeriesModal(props: NumeracionSeriesModalProps): React.ReactElement {
  const { open, editTarget, saving, onClose, onCreate, onUpdate } = props;
  const isEdit = !!editTarget;

  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [touched, setTouched] = useState<{ name?: boolean; prefix?: boolean; pointOfSale?: boolean; nextNumber?: boolean }>({});

  // Reset al ABRIR: si hay target → cargo sus valores; si no → defaults.
  useEffect(() => {
    if (!open) return;
    if (editTarget) {
      setForm({
        name:        editTarget.name,
        type:        editTarget.type,
        direction:   editTarget.direction,
        prefix:      editTarget.prefix,
        pointOfSale: editTarget.pointOfSale,
        nextNumber:  editTarget.nextNumber,
        isActive:    editTarget.isActive,
      });
    } else {
      setForm(EMPTY_FORM);
    }
    setTouched({});
  }, [open, editTarget]);

  // Normalización on-blur: pad-left pointOfSale a 4 dígitos.
  function normalizePos(raw: string): string {
    const digits = raw.replace(/\D/g, "");
    if (digits.length === 0) return "";
    if (digits.length >= 4) return digits.slice(-4);
    return digits.padStart(4, "0");
  }

  const errors = useMemo(() => {
    const e: { name?: string; prefix?: string; pointOfSale?: string; nextNumber?: string } = {};
    if (!form.name.trim())            e.name = "El nombre es obligatorio.";
    if (!PREFIX_RX.test(form.prefix)) e.prefix = "0 a 3 letras mayúsculas. Ej: A, B, FA.";
    if (!POS_RX.test(form.pointOfSale)) e.pointOfSale = "4 dígitos. Ej: 0001.";
    if (!Number.isInteger(form.nextNumber) || form.nextNumber < 1) {
      e.nextNumber = "Debe ser un entero ≥ 1.";
    }
    return e;
  }, [form]);

  const hasErrors = !!(errors.name || errors.prefix || errors.pointOfSale || errors.nextNumber);

  async function handleSubmit(): Promise<void> {
    // Forzar touched para mostrar todos los errores al intentar guardar.
    setTouched({ name: true, prefix: true, pointOfSale: true, nextNumber: true });
    if (hasErrors || saving) return;

    if (isEdit && editTarget && onUpdate) {
      // En edit, mandamos SOLO los campos editables (excluye type/direction).
      await onUpdate(editTarget.id, {
        name:        form.name.trim(),
        prefix:      form.prefix,
        pointOfSale: form.pointOfSale,
        nextNumber:  form.nextNumber,
        isActive:    form.isActive,
      });
    } else if (!isEdit && onCreate) {
      await onCreate({
        name:        form.name.trim(),
        type:        form.type,
        direction:   form.direction,
        prefix:      form.prefix,
        pointOfSale: form.pointOfSale,
        nextNumber:  form.nextNumber,
        isActive:    form.isActive,
      });
    }
  }

  const title = isEdit ? "Editar serie" : "Nueva serie de numeración";

  return (
    <Modal
      open={open}
      onClose={saving ? () => undefined : onClose}
      title={title}
      subtitle={
        isEdit
          ? "Tipo y dirección son inmutables. Para cambiarlos, creá una serie nueva."
          : "Configurá una nueva serie para emitir comprobantes."
      }
      maxWidth="lg"
      footer={
        <div className="flex items-center justify-end gap-2">
          <TPButton
            variant="secondary"
            onClick={onClose}
            disabled={saving}
            iconLeft={<X size={14} />}
          >
            Cancelar
          </TPButton>
          <TPButton
            variant="primary"
            onClick={handleSubmit}
            disabled={hasErrors || saving}
            loading={saving}
            iconLeft={<Save size={14} />}
          >
            {isEdit ? "Guardar cambios" : "Crear serie"}
          </TPButton>
        </div>
      }
    >
      <div className="space-y-4">
        {/* Nombre — siempre editable */}
        <TPField label="Nombre" required>
          <TPInput
            value={form.name}
            onChange={(v) => { setForm((f) => ({ ...f, name: v })); setTouched((t) => ({ ...t, name: true })); }}
            placeholder='Ej: "Factura A — Punto de venta 0001"'
            error={touched.name ? errors.name ?? null : null}
            disabled={saving}
            autoFocus
          />
        </TPField>

        {/* Tipo + Dirección — editables solo en crear */}
        <div className="grid grid-cols-2 gap-3">
          <TPField label="Tipo de comprobante" required>
            {isEdit ? (
              <div data-testid="type-readonly" className="flex h-[42px] items-center rounded-xl border border-border bg-surface2 px-3">
                <TPBadge tone="neutral">{RECEIPT_SERIES_TYPE_LABELS[form.type]}</TPBadge>
              </div>
            ) : (
              <TPComboFixed
                value={form.type}
                onChange={(v) => setForm((f) => ({ ...f, type: v as ReceiptSeriesType }))}
                options={TYPE_OPTIONS}
                disabled={saving}
              />
            )}
          </TPField>
          <TPField label="Dirección" required>
            {isEdit ? (
              <div data-testid="direction-readonly" className="flex h-[42px] items-center rounded-xl border border-border bg-surface2 px-3">
                <TPBadge tone="neutral">{RECEIPT_SERIES_DIRECTION_LABELS[form.direction]}</TPBadge>
              </div>
            ) : (
              <TPComboFixed
                value={form.direction}
                onChange={(v) => setForm((f) => ({ ...f, direction: v as ReceiptSeriesDirection }))}
                options={DIRECTION_OPTIONS}
                disabled={saving}
              />
            )}
          </TPField>
        </div>

        {/* Prefijo + Punto de venta */}
        <div className="grid grid-cols-2 gap-3">
          <TPField label="Prefijo" hint="0 a 3 letras mayúsculas. Ej: A, B, FA.">
            <TPInput
              value={form.prefix}
              onChange={(v) => {
                // Normalización inmediata: a mayúsculas.
                const next = v.toUpperCase().replace(/[^A-Z]/g, "").slice(0, 3);
                setForm((f) => ({ ...f, prefix: next }));
                setTouched((t) => ({ ...t, prefix: true }));
              }}
              placeholder="A"
              error={touched.prefix ? errors.prefix ?? null : null}
              disabled={saving}
              maxLength={3}
            />
          </TPField>
          <TPField label="Punto de venta" hint="4 dígitos. Ej: 0001.">
            <TPInput
              value={form.pointOfSale}
              onChange={(v) => {
                const digitsOnly = v.replace(/\D/g, "").slice(0, 4);
                setForm((f) => ({ ...f, pointOfSale: digitsOnly }));
                setTouched((t) => ({ ...t, pointOfSale: true }));
              }}
              onBlur={() => {
                // Pad-left a 4 dígitos solo si hay valor parcial válido.
                setForm((f) => ({ ...f, pointOfSale: normalizePos(f.pointOfSale) }));
              }}
              placeholder="0001"
              error={touched.pointOfSale ? errors.pointOfSale ?? null : null}
              disabled={saving}
              inputMode="numeric"
              maxLength={4}
            />
          </TPField>
        </div>

        {/* Próximo número + Estado */}
        <div className="grid grid-cols-2 gap-3">
          <TPField label="Próximo número" hint="Número del próximo comprobante a emitir (≥ 1).">
            <TPNumberInput
              value={form.nextNumber}
              onChange={(v) => {
                setForm((f) => ({ ...f, nextNumber: v ?? 1 }));
                setTouched((t) => ({ ...t, nextNumber: true }));
              }}
              formatType="INTEGER"
              decimals={0}
              min={1}
              disabled={saving}
              wrapClassName="w-full"
            />
          </TPField>
          <TPField label="Estado">
            <label className="flex h-[42px] items-center gap-2 rounded-xl border border-border bg-card px-3">
              <TPCheckbox
                checked={form.isActive}
                onChange={(v) => setForm((f) => ({ ...f, isActive: v }))}
                disabled={saving}
              />
              <span className="text-sm">{form.isActive ? "Activa" : "Inactiva"}</span>
            </label>
          </TPField>
        </div>

        {/* Hint del bloqueo backend */}
        {isEdit && (
          <p className="text-xs text-muted">
            Recordá: el próximo número no puede ser menor o igual al último comprobante emitido.
          </p>
        )}
      </div>
    </Modal>
  );
}

export default NumeracionSeriesModal;
