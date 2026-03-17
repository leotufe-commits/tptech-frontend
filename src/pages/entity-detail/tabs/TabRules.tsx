import React, { useState } from "react";
import { Plus, Pencil, Trash2, ToggleLeft, ToggleRight } from "lucide-react";
import { TPButton } from "../../../components/ui/TPButton";
import { TPCard } from "../../../components/ui/TPCard";
import { TPField } from "../../../components/ui/TPField";
import TPInput from "../../../components/ui/TPInput";
import TPTextarea from "../../../components/ui/TPTextarea";
import TPSelect from "../../../components/ui/TPSelect";
import TPNumberInput from "../../../components/ui/TPNumberInput";
import { TPIconButton } from "../../../components/ui/TPIconButton";
import { TPBadge } from "../../../components/ui/TPBadges";
import TPAlert from "../../../components/ui/TPAlert";
import { Modal } from "../../../components/ui/Modal";
import ConfirmDeleteDialog from "../../../components/ui/ConfirmDeleteDialog";
import { toast } from "../../../lib/toast";
import {
  commercialEntitiesApi,
  COMMERCIAL_RULE_TYPE_LABELS,
  COMMERCIAL_APPLY_ON_LABELS,
  type EntityCommercialRule,
  type EntityCommercialRulePayload,
  type CommercialRuleScope,
  type CommercialRuleType,
  type CommercialValueType,
  type CommercialApplyOn,
} from "../../../services/commercial-entities";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
const SCOPE_LABELS: Record<CommercialRuleScope, string> = {
  GLOBAL: "Global",
  METAL: "Metal",
  VARIANT: "Variante",
  CATEGORY: "Categoría",
};

const SCOPE_TONES: Record<CommercialRuleScope, "primary" | "warning" | "neutral"> = {
  GLOBAL: "primary",
  METAL: "warning",
  VARIANT: "warning",
  CATEGORY: "primary",
};

const RULE_TYPE_TONES: Record<CommercialRuleType, "success" | "danger" | "warning"> = {
  DISCOUNT: "success",
  BONUS: "success",
  SURCHARGE: "danger",
};

function formatValue(rule: EntityCommercialRule) {
  const v = parseFloat(rule.value);
  if (rule.valueType === "PERCENTAGE") return `${v}%`;
  return `$${v.toFixed(2)}`;
}

function formatDate(iso: string | null) {
  if (!iso) return null;
  return new Date(iso).toLocaleDateString("es-AR", { day: "2-digit", month: "2-digit", year: "numeric" });
}

// ---------------------------------------------------------------------------
// Draft
// ---------------------------------------------------------------------------
type RuleDraft = {
  scope: CommercialRuleScope;
  metalId: string;
  variantId: string;
  categoryId: string;
  ruleType: CommercialRuleType;
  valueType: CommercialValueType;
  value: number | null;
  applyOn: CommercialApplyOn;
  minQuantity: number | null;
  validFrom: string;
  validTo: string;
  notes: string;
  sortOrder: number | null;
};

const EMPTY_DRAFT: RuleDraft = {
  scope: "GLOBAL",
  metalId: "",
  variantId: "",
  categoryId: "",
  ruleType: "DISCOUNT",
  valueType: "PERCENTAGE",
  value: null,
  applyOn: "TOTAL",
  minQuantity: null,
  validFrom: "",
  validTo: "",
  notes: "",
  sortOrder: null,
};

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------
interface Props {
  entityId: string;
  data: EntityCommercialRule[];
  loading: boolean;
  onReload: () => void;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------
export function TabRules({ entityId, data, loading, onReload }: Props) {
  const [modalOpen, setModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<"create" | "edit">("create");
  const [editingRule, setEditingRule] = useState<EntityCommercialRule | null>(null);
  const [draft, setDraft] = useState<RuleDraft>(EMPTY_DRAFT);
  const [submitted, setSubmitted] = useState(false);
  const [busySave, setBusySave] = useState(false);

  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<EntityCommercialRule | null>(null);
  const [busyDelete, setBusyDelete] = useState(false);
  const [busyToggle, setBusyToggle] = useState<string | null>(null);

  function set<K extends keyof RuleDraft>(key: K, val: RuleDraft[K]) {
    setDraft((p) => ({ ...p, [key]: val }));
  }

  function openCreate() {
    setDraft({ ...EMPTY_DRAFT });
    setSubmitted(false);
    setModalMode("create");
    setEditingRule(null);
    setModalOpen(true);
  }

  function openEdit(r: EntityCommercialRule) {
    setDraft({
      scope: r.scope,
      metalId: r.metalId ?? "",
      variantId: r.variantId ?? "",
      categoryId: r.categoryId ?? "",
      ruleType: r.ruleType,
      valueType: r.valueType,
      value: parseFloat(r.value),
      applyOn: r.applyOn,
      minQuantity: r.minQuantity != null ? parseFloat(r.minQuantity) : null,
      validFrom: r.validFrom ? r.validFrom.slice(0, 10) : "",
      validTo: r.validTo ? r.validTo.slice(0, 10) : "",
      notes: r.notes,
      sortOrder: r.sortOrder,
    });
    setSubmitted(false);
    setModalMode("edit");
    setEditingRule(r);
    setModalOpen(true);
  }

  function buildPayload(): EntityCommercialRulePayload {
    return {
      scope: draft.scope,
      metalId: draft.scope === "METAL" ? (draft.metalId.trim() || null) : null,
      variantId: draft.scope === "VARIANT" ? (draft.variantId.trim() || null) : null,
      categoryId: draft.scope === "CATEGORY" ? (draft.categoryId.trim() || null) : null,
      ruleType: draft.ruleType,
      valueType: draft.valueType,
      value: String(draft.value ?? 0),
      applyOn: draft.applyOn,
      minQuantity: draft.minQuantity != null ? String(draft.minQuantity) : null,
      validFrom: draft.validFrom || null,
      validTo: draft.validTo || null,
      notes: draft.notes,
      sortOrder: draft.sortOrder ?? 0,
    };
  }

  async function handleSave() {
    setSubmitted(true);
    if (draft.value == null) return;

    setBusySave(true);
    try {
      if (modalMode === "create") {
        await commercialEntitiesApi.rules.create(entityId, buildPayload());
        toast.success("Regla agregada.");
      } else {
        await commercialEntitiesApi.rules.update(entityId, editingRule!.id, buildPayload());
        toast.success("Regla actualizada.");
      }
      setModalOpen(false);
      onReload();
    } catch (e: any) {
      toast.error(e?.message || "Error al guardar.");
    } finally {
      setBusySave(false);
    }
  }

  async function handleToggle(r: EntityCommercialRule) {
    setBusyToggle(r.id);
    try {
      await commercialEntitiesApi.rules.toggle(entityId, r.id);
      onReload();
    } catch (e: any) {
      toast.error(e?.message || "Error al cambiar estado.");
    } finally {
      setBusyToggle(null);
    }
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    setBusyDelete(true);
    try {
      await commercialEntitiesApi.rules.remove(entityId, deleteTarget.id);
      toast.success("Regla eliminada.");
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
  if (loading) {
    return <div className="py-12 text-center text-sm text-muted">Cargando reglas…</div>;
  }

  const activeCount   = data.filter((r) => r.isActive).length;
  const inactiveCount = data.length - activeCount;

  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 flex-wrap">
          {data.length === 0 ? (
            <span className="text-sm text-muted">Sin reglas</span>
          ) : (
            <>
              <span className="text-sm text-muted">
                {activeCount} {activeCount === 1 ? "activa" : "activas"}
              </span>
              {inactiveCount > 0 && (
                <span className="text-xs text-muted/60">
                  · {inactiveCount} inactiva{inactiveCount !== 1 ? "s" : ""}
                </span>
              )}
            </>
          )}
        </div>
        <TPButton variant="primary" onClick={openCreate} iconLeft={<Plus size={15} />} className="h-8">
          Agregar regla
        </TPButton>
      </div>

      <TPAlert tone="neutral">
        Las reglas se aplican en orden de prioridad (sortOrder ASC). Para el mismo scope, se usa la
        primera regla activa que aplique.
      </TPAlert>

      {/* Empty state */}
      {data.length === 0 && (
        <div className="py-12 text-center text-sm text-muted">No hay reglas comerciales configuradas.</div>
      )}

      {/* List */}
      {data.map((r) => (
        <TPCard key={r.id} className={`p-4 ${!r.isActive ? "opacity-60" : ""}`}>
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              {/* Badges row */}
              <div className="flex items-center gap-1.5 flex-wrap mb-1.5">
                <TPBadge tone={SCOPE_TONES[r.scope]}>
                  {SCOPE_LABELS[r.scope]}
                </TPBadge>
                <TPBadge tone={RULE_TYPE_TONES[r.ruleType]}>
                  {COMMERCIAL_RULE_TYPE_LABELS[r.ruleType]}
                </TPBadge>
                <span className="text-sm font-semibold text-text">{formatValue(r)}</span>
                <span className="text-xs text-muted">sobre {COMMERCIAL_APPLY_ON_LABELS[r.applyOn]}</span>
              </div>

              {/* Scope detail — label genérico hasta que haya lookup real */}
              {r.scope === "METAL"    && <div className="text-xs text-muted mb-1">Metal específico</div>}
              {r.scope === "VARIANT"  && <div className="text-xs text-muted mb-1">Variante específica</div>}
              {r.scope === "CATEGORY" && <div className="text-xs text-muted mb-1">Categoría específica</div>}

              {/* Validity + quantity */}
              <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-muted">
                {r.minQuantity && <span>Desde {r.minQuantity} u.</span>}
                {r.validFrom && <span>Desde {formatDate(r.validFrom)}</span>}
                {r.validTo && <span>Hasta {formatDate(r.validTo)}</span>}
                <span className="text-muted/60">Orden: {r.sortOrder}</span>
              </div>

              {r.notes && (
                <div className="text-xs text-muted mt-1 italic">{r.notes}</div>
              )}
            </div>

            {/* Actions */}
            <div className="flex items-center gap-1 shrink-0">
              <TPIconButton
                title={r.isActive ? "Desactivar" : "Activar"}
                disabled={busyToggle === r.id}
                onClick={() => handleToggle(r)}
                active={r.isActive}
              >
                {r.isActive ? <ToggleRight size={16} /> : <ToggleLeft size={16} />}
              </TPIconButton>
              <TPIconButton title="Editar" onClick={() => openEdit(r)}>
                <Pencil size={14} />
              </TPIconButton>
              <TPIconButton
                title="Eliminar"
                onClick={() => { setDeleteTarget(r); setDeleteOpen(true); }}
              >
                <Trash2 size={14} />
              </TPIconButton>
            </div>
          </div>
        </TPCard>
      ))}

      {/* Modal */}
      <Modal
        open={modalOpen}
        onClose={() => !busySave && setModalOpen(false)}
        title={modalMode === "create" ? "Agregar regla comercial" : "Editar regla comercial"}
        maxWidth="lg"
      >
        <div className="space-y-4 p-1">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <TPField label="Alcance (scope)">
              <TPSelect
                value={draft.scope}
                onChange={(v) => set("scope", v as CommercialRuleScope)}
                disabled={busySave}
                options={[
                  { value: "GLOBAL", label: "Global" },
                  { value: "METAL", label: "Metal" },
                  { value: "VARIANT", label: "Variante de metal" },
                  { value: "CATEGORY", label: "Categoría" },
                ]}
              />
            </TPField>
            <TPField label="Tipo de regla">
              <TPSelect
                value={draft.ruleType}
                onChange={(v) => set("ruleType", v as CommercialRuleType)}
                disabled={busySave}
                options={[
                  { value: "DISCOUNT", label: "Descuento" },
                  { value: "BONUS", label: "Bonificación" },
                  { value: "SURCHARGE", label: "Recargo" },
                ]}
              />
            </TPField>
          </div>

          {/* Scope-specific ID */}
          {draft.scope === "METAL" && (
            <TPField label="ID del metal">
              <TPInput value={draft.metalId} onChange={(v) => set("metalId", v)} disabled={busySave} placeholder="ID del metal" />
            </TPField>
          )}
          {draft.scope === "VARIANT" && (
            <TPField label="ID de la variante">
              <TPInput value={draft.variantId} onChange={(v) => set("variantId", v)} disabled={busySave} placeholder="ID de la variante" />
            </TPField>
          )}
          {draft.scope === "CATEGORY" && (
            <TPField label="ID de la categoría">
              <TPInput value={draft.categoryId} onChange={(v) => set("categoryId", v)} disabled={busySave} placeholder="ID de la categoría" />
            </TPField>
          )}

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <TPField label="Tipo de valor">
              <TPSelect
                value={draft.valueType}
                onChange={(v) => set("valueType", v as CommercialValueType)}
                disabled={busySave}
                options={[
                  { value: "PERCENTAGE", label: "Porcentaje (%)" },
                  { value: "FIXED_AMOUNT", label: "Monto fijo ($)" },
                ]}
              />
            </TPField>
            <TPField
              label={draft.valueType === "PERCENTAGE" ? "Valor (%)" : "Valor ($)"}
              error={submitted && draft.value == null ? "Requerido." : null}
            >
              <TPNumberInput
                value={draft.value}
                onChange={(v) => set("value", v)}
                decimals={draft.valueType === "PERCENTAGE" ? 2 : 4}
                min={0}
                disabled={busySave}
              />
            </TPField>
            <TPField label="Aplicar sobre">
              <TPSelect
                value={draft.applyOn}
                onChange={(v) => set("applyOn", v as CommercialApplyOn)}
                disabled={busySave}
                options={[
                  { value: "TOTAL", label: "Total" },
                  { value: "METAL", label: "Precio metal" },
                  { value: "HECHURA", label: "Solo hechura" },
                  { value: "METAL_Y_HECHURA", label: "Metal y hechura" },
                ]}
              />
            </TPField>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <TPField label="Cantidad mínima" hint="Vacío = sin mínimo">
              <TPNumberInput value={draft.minQuantity} onChange={(v) => set("minQuantity", v)} decimals={0} min={0} disabled={busySave} />
            </TPField>
            <TPField label="Válido desde" hint="Vacío = siempre">
              <TPInput type="date" value={draft.validFrom} onChange={(v) => set("validFrom", v)} disabled={busySave} />
            </TPField>
            <TPField label="Válido hasta" hint="Vacío = indefinido">
              <TPInput type="date" value={draft.validTo} onChange={(v) => set("validTo", v)} disabled={busySave} />
            </TPField>
          </div>

          <TPField label="Orden de prioridad" hint="Menor valor = mayor prioridad. Empates se rompen por fecha de creación.">
            <TPNumberInput value={draft.sortOrder} onChange={(v) => set("sortOrder", v)} decimals={0} min={0} disabled={busySave} />
          </TPField>

          <TPField label="Notas">
            <TPTextarea
              value={draft.notes}
              onChange={(v) => set("notes", v)}
              disabled={busySave}
              minH={64}
              placeholder="Descripción o condiciones adicionales de esta regla…"
            />
          </TPField>

          <div className="flex justify-end gap-2 pt-2">
            <TPButton variant="secondary" onClick={() => setModalOpen(false)} disabled={busySave}>
              Cancelar
            </TPButton>
            <TPButton variant="primary" onClick={handleSave} disabled={busySave}>
              {busySave ? "Guardando…" : modalMode === "create" ? "Agregar" : "Guardar"}
            </TPButton>
          </div>
        </div>
      </Modal>

      {/* Delete confirm */}
      <ConfirmDeleteDialog
        open={deleteOpen}
        title="Eliminar regla comercial"
        description="¿Estás seguro? Esta acción no se puede deshacer."
        confirmText="Eliminar"
        busy={busyDelete}
        onClose={() => { if (!busyDelete) { setDeleteOpen(false); setDeleteTarget(null); } }}
        onConfirm={handleDelete}
      />
    </div>
  );
}
