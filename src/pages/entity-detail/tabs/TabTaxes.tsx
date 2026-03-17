import React, { useEffect, useState } from "react";
import { Trash2, Pencil } from "lucide-react";
import { TPCard } from "../../../components/ui/TPCard";
import { TPField } from "../../../components/ui/TPField";
import TPSelect from "../../../components/ui/TPSelect";
import TPNumberInput from "../../../components/ui/TPNumberInput";
import TPTextarea from "../../../components/ui/TPTextarea";
import { TPButton } from "../../../components/ui/TPButton";
import { TPIconButton } from "../../../components/ui/TPIconButton";
import { TPBadge } from "../../../components/ui/TPBadges";
import TPAlert from "../../../components/ui/TPAlert";
import { Modal } from "../../../components/ui/Modal";
import ConfirmDeleteDialog from "../../../components/ui/ConfirmDeleteDialog";
import { toast } from "../../../lib/toast";
import {
  commercialEntitiesApi,
  type EntityTaxOverride,
  type TaxOverrideMode,
  type CommercialApplyOn,
} from "../../../services/commercial-entities";
import { taxesApi, type TaxRow } from "../../../services/taxes";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
const OVERRIDE_MODE_LABELS: Record<TaxOverrideMode, string> = {
  INHERIT: "Hereda configuración del sistema",
  EXEMPT: "Exento (no aplica)",
  CUSTOM_RATE: "Tasa personalizada",
};

const OVERRIDE_MODE_TONES: Record<TaxOverrideMode, "neutral" | "success" | "warning"> = {
  INHERIT: "neutral",
  EXEMPT: "success",
  CUSTOM_RATE: "warning",
};

const APPLY_ON_LABELS: Record<string, string> = {
  TOTAL: "sobre total",
  METAL: "sobre precio metal",
  HECHURA: "sobre hechura",
  METAL_Y_HECHURA: "sobre metal y hechura",
};

const TAX_TYPE_LABELS: Record<string, string> = {
  IVA: "IVA",
  INTERNAL: "Impuesto interno",
  PERCEPTION: "Percepción",
  RETENTION: "Retención",
  OTHER: "Otro",
};

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------
interface Props {
  entityId: string;
  data: EntityTaxOverride[];
  loading: boolean;
  onReload: () => void;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------
export function TabTaxes({ entityId, data, loading, onReload }: Props) {
  const [taxes, setTaxes] = useState<TaxRow[]>([]);
  const [taxesLoading, setTaxesLoading] = useState(true);

  const [modalOpen, setModalOpen] = useState(false);
  const [editingTax, setEditingTax] = useState<TaxRow | null>(null);
  const [draftMode, setDraftMode] = useState<TaxOverrideMode>("INHERIT");
  const [draftRate, setDraftRate] = useState<number | null>(null);
  const [draftApplyOn, setDraftApplyOn] = useState<CommercialApplyOn>("TOTAL");
  const [draftNotes, setDraftNotes] = useState("");
  const [busySave, setBusySave] = useState(false);

  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<EntityTaxOverride | null>(null);
  const [busyDelete, setBusyDelete] = useState(false);

  // Load system taxes once
  useEffect(() => {
    setTaxesLoading(true);
    taxesApi.list()
      .then((rows) => setTaxes(rows.filter((t) => t.isActive && !t.deletedAt)))
      .catch(() => toast.error("Error al cargar impuestos del sistema."))
      .finally(() => setTaxesLoading(false));
  }, []);

  // Map taxId → override
  const overrideMap = new Map(data.map((o) => [o.taxId, o]));

  function openEdit(tax: TaxRow) {
    const existing = overrideMap.get(tax.id);
    setEditingTax(tax);
    setDraftMode(existing?.overrideMode ?? "INHERIT");
    setDraftRate(existing?.customRate != null ? parseFloat(existing.customRate) : null);
    setDraftApplyOn((existing?.applyOn as CommercialApplyOn | null) ?? "TOTAL");
    setDraftNotes(existing?.notes ?? "");
    setModalOpen(true);
  }

  async function handleSave() {
    if (!editingTax) return;
    setBusySave(true);
    try {
      if (draftMode === "INHERIT") {
        const existing = overrideMap.get(editingTax.id);
        if (existing) {
          await commercialEntitiesApi.taxOverrides.remove(entityId, existing.id);
        }
      } else {
        await commercialEntitiesApi.taxOverrides.upsert(entityId, {
          taxId: editingTax.id,
          overrideMode: draftMode,
          customRate: draftMode === "CUSTOM_RATE" && draftRate != null ? String(draftRate) : null,
          applyOn: draftMode === "CUSTOM_RATE" ? draftApplyOn : null,
          notes: draftNotes,
        });
      }
      toast.success("Configuración de impuesto actualizada.");
      setModalOpen(false);
      onReload();
    } catch (e: any) {
      toast.error(e?.message || "Error al guardar.");
    } finally {
      setBusySave(false);
    }
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    setBusyDelete(true);
    try {
      await commercialEntitiesApi.taxOverrides.remove(entityId, deleteTarget.id);
      toast.success("Excepción eliminada. El impuesto vuelve a heredar la configuración del sistema.");
      setDeleteOpen(false);
      setDeleteTarget(null);
      onReload();
    } catch (e: any) {
      toast.error(e?.message || "Error al eliminar.");
    } finally {
      setBusyDelete(false);
    }
  }

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------
  if (loading || taxesLoading) {
    return <div className="py-12 text-center text-sm text-muted">Cargando impuestos…</div>;
  }

  if (taxes.length === 0) {
    return (
      <div className="py-12 text-center text-sm text-muted">
        No hay impuestos activos configurados en el sistema.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <TPAlert tone="neutral">
        Por defecto, esta entidad hereda la configuración de impuestos del sistema. Podés configurar
        excepciones individuales (exento o tasa personalizada) para cada impuesto.
      </TPAlert>

      {taxes.map((tax) => {
        const override = overrideMap.get(tax.id);
        const mode: TaxOverrideMode = override?.overrideMode ?? "INHERIT";

        return (
          <TPCard key={tax.id} className="p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap mb-1">
                  <span className="text-sm font-medium text-text">{tax.name}</span>
                  {tax.code && (
                    <span className="text-xs font-mono px-1.5 py-0.5 rounded border border-border text-muted">{tax.code}</span>
                  )}
                  <span className="text-xs text-muted">{TAX_TYPE_LABELS[tax.taxType] ?? tax.taxType}</span>
                </div>

                <div className="flex items-center gap-2 flex-wrap">
                  <TPBadge tone={OVERRIDE_MODE_TONES[mode]}>
                    {OVERRIDE_MODE_LABELS[mode]}
                  </TPBadge>
                  {mode === "CUSTOM_RATE" && override?.customRate != null && (
                    <span className="text-xs font-medium text-text">
                      {parseFloat(override.customRate)}%
                      {override.applyOn && (
                        <span className="font-normal text-muted ml-1">
                          {APPLY_ON_LABELS[override.applyOn] ?? override.applyOn}
                        </span>
                      )}
                    </span>
                  )}
                </div>

                {override?.notes && (
                  <div className="text-xs text-muted mt-1 italic">{override.notes}</div>
                )}
              </div>

              {/* Actions */}
              <div className="flex items-center gap-1 shrink-0">
                <TPIconButton title="Configurar excepción" onClick={() => openEdit(tax)}>
                  <Pencil size={14} />
                </TPIconButton>
                {override && mode !== "INHERIT" && (
                  <TPIconButton
                    title="Eliminar excepción (vuelve a heredar)"
                    onClick={() => { setDeleteTarget(override); setDeleteOpen(true); }}
                  >
                    <Trash2 size={14} />
                  </TPIconButton>
                )}
              </div>
            </div>
          </TPCard>
        );
      })}

      {/* Edit modal */}
      <Modal
        open={modalOpen}
        onClose={() => !busySave && setModalOpen(false)}
        title={`Configurar excepción: ${editingTax?.name ?? ""}`}
        maxWidth="md"
      >
        <div className="space-y-4 p-1">
          <TPField label="Comportamiento para esta entidad">
            <TPSelect
              value={draftMode}
              onChange={(v) => setDraftMode(v as TaxOverrideMode)}
              disabled={busySave}
              options={[
                { value: "INHERIT", label: "Hereda configuración del sistema" },
                { value: "EXEMPT", label: "Exento (no aplica este impuesto)" },
                { value: "CUSTOM_RATE", label: "Tasa personalizada" },
              ]}
            />
          </TPField>

          {draftMode === "CUSTOM_RATE" && (
            <>
              <TPField label="Tasa personalizada (%)">
                <TPNumberInput
                  value={draftRate}
                  onChange={(v) => setDraftRate(v)}
                  decimals={4}
                  min={0}
                  disabled={busySave}
                />
              </TPField>
              <TPField label="Aplicar sobre">
                <TPSelect
                  value={draftApplyOn}
                  onChange={(v) => setDraftApplyOn(v as CommercialApplyOn)}
                  disabled={busySave}
                  options={[
                    { value: "TOTAL", label: "Total" },
                    { value: "METAL", label: "Precio metal" },
                    { value: "HECHURA", label: "Solo hechura" },
                    { value: "METAL_Y_HECHURA", label: "Metal y hechura" },
                  ]}
                />
              </TPField>
            </>
          )}

          <TPField label="Notas">
            <TPTextarea
              value={draftNotes}
              onChange={(v) => setDraftNotes(v)}
              disabled={busySave}
              minH={64}
              placeholder="Motivo de la excepción (opcional)…"
            />
          </TPField>

          <div className="flex justify-end gap-2 pt-2">
            <TPButton variant="secondary" onClick={() => setModalOpen(false)} disabled={busySave}>
              Cancelar
            </TPButton>
            <TPButton variant="primary" onClick={handleSave} disabled={busySave}>
              {busySave ? "Guardando…" : "Guardar"}
            </TPButton>
          </div>
        </div>
      </Modal>

      {/* Delete confirm */}
      <ConfirmDeleteDialog
        open={deleteOpen}
        title="Eliminar excepción fiscal"
        description="El impuesto volverá a heredar la configuración del sistema para esta entidad."
        confirmText="Eliminar"
        busy={busyDelete}
        onClose={() => { if (!busyDelete) { setDeleteOpen(false); setDeleteTarget(null); } }}
        onConfirm={handleDelete}
      />
    </div>
  );
}
