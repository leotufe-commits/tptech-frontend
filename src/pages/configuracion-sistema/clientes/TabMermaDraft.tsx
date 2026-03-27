// src/pages/configuracion-sistema/clientes/TabMermaDraft.tsx
// Versión "draft" de TabMerma para el modo CREATE del modal.
// Gestiona overrides de merma en estado local (sin entityId, sin API calls de CRUD).
// Los datos se persisten una vez guardada la entidad desde EntityEditModal.
import React, { useEffect, useState, useMemo } from "react";
import { Plus, Star } from "lucide-react";
import { TPButton } from "../../../components/ui/TPButton";
import { TPField } from "../../../components/ui/TPField";
import TPNumberInput from "../../../components/ui/TPNumberInput";
import TPComboFixed from "../../../components/ui/TPComboFixed";
import TPTextarea from "../../../components/ui/TPTextarea";
import { TPStatusPill } from "../../../components/ui/TPStatusPill";
import { TPTableKit, type TPColDef } from "../../../components/ui/TPTableKit";
import { TPTr, TPTd } from "../../../components/ui/TPTable";
import { TPRowActions } from "../../../components/ui/TPRowActions";
import { Modal } from "../../../components/ui/Modal";
import ConfirmDeleteDialog from "../../../components/ui/ConfirmDeleteDialog";
import { toast } from "../../../lib/toast";
import type { EntityRole } from "../../../services/commercial-entities";
import { getMetals, getVariants, type MetalRow, type MetalVariantRow } from "../../../services/valuation";
import type { MermaOverrideDraft } from "./clientes.types";

const MERMA_COLS: TPColDef[] = [
  { key: "variante",  label: "Metal / Variante", canHide: false },
  { key: "rol",       label: "Rol",               width: "120px" },
  { key: "merma",     label: "Merma %",            width: "100px", align: "right" },
  { key: "estado",    label: "Estado",             width: "100px" },
  { key: "notas",     label: "Notas" },
  { key: "acciones",  label: "Acciones",           width: "120px", canHide: false, align: "right" },
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
const ALL_ROLE_OPTIONS = [
  { value: "CLIENT",   label: "Como cliente" },
  { value: "SUPPLIER", label: "Como proveedor" },
  { value: "BOTH",     label: "Ambos (Cliente / Proveedor)" },
];

function roleBadge(role: EntityRole) {
  return role === "CLIENT"
    ? <span className="inline-flex items-center rounded-full bg-blue-500/15 px-2 py-0.5 text-[11px] font-medium text-blue-600 dark:text-blue-400">Cliente</span>
    : <span className="inline-flex items-center rounded-full bg-amber-500/15 px-2 py-0.5 text-[11px] font-medium text-amber-700 dark:text-amber-400">Proveedor</span>;
}

type FormState = {
  variantId: string;
  role: EntityRole | "BOTH";
  mermaPercent: number | null;
  notes: string;
};

const EMPTY_FORM: FormState = { variantId: "", role: "CLIENT", mermaPercent: null, notes: "" };

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------
interface Props {
  value: MermaOverrideDraft[];
  onChange: (drafts: MermaOverrideDraft[]) => void;
  isClient: boolean;
  isSupplier: boolean;
}

export default function TabMermaDraft({ value, onChange, isClient, isSupplier }: Props) {
  const [busy, setBusy] = useState(false);
  const roleOptions = ALL_ROLE_OPTIONS.filter((o) => {
    if (o.value === "CLIENT"   && !isClient)   return false;
    if (o.value === "SUPPLIER" && !isSupplier) return false;
    if (o.value === "BOTH" && !(isClient && isSupplier)) return false;
    return true;
  });

  // Variantes del sistema (cargadas una vez)
  const [allVariants, setAllVariants] = useState<(MetalVariantRow & { metal: MetalRow })[]>([]);
  const [loadingVariants, setLoadingVariants] = useState(false);

  // Modal add/edit
  const [modalOpen, setModalOpen]   = useState(false);
  const [editingId, setEditingId]   = useState<string | null>(null);
  const [form, setForm]             = useState<FormState>(EMPTY_FORM);

  // Delete
  const [delLocalId, setDelLocalId] = useState<string | null>(null);

  async function loadVariants() {
    if (allVariants.length > 0) return;
    setLoadingVariants(true);
    try {
      const metalsResp = await getMetals();
      const metals: MetalRow[] = metalsResp?.rows ?? metalsResp ?? [];
      const active = metals.filter((m) => m.isActive);
      const results = await Promise.all(
        active.map(async (m) => {
          const resp = await getVariants(m.id, { isActive: true });
          const vs: MetalVariantRow[] = resp?.rows ?? resp ?? [];
          return vs.map((v) => ({ ...v, metal: m }));
        })
      );
      setAllVariants(results.flat());
    } catch {
      toast.error("No se pudieron cargar las variantes de metal.");
    } finally {
      setLoadingVariants(false);
    }
  }

  const variantOptions = useMemo(() => {
    const usedIds = new Set(
      value
        .filter((d) => d.role === form.role && d._localId !== editingId)
        .map((d) => d.variantId)
    );
    return allVariants.map((v) => ({
      value: v.id,
      label: `${v.metal.name} — ${v.name} (${v.sku})`,
      disabled: usedIds.has(v.id),
    }));
  }, [allVariants, value, form.role, editingId]);

  function openCreate() {
    setEditingId(null);
    setForm({
      ...EMPTY_FORM,
      role: isClient && !isSupplier ? "CLIENT" : isSupplier && !isClient ? "SUPPLIER" : "CLIENT",
    });
    void loadVariants();
    setModalOpen(true);
  }

  function openEdit(draft: MermaOverrideDraft) {
    setEditingId(draft._localId);
    setForm({
      variantId:    draft.variantId,
      role:         draft.role,
      mermaPercent: draft.mermaPercent,
      notes:        draft.notes,
    });
    void loadVariants();
    setModalOpen(true);
  }

  function handleSave() {
    if (!form.variantId) { toast.error("Seleccioná una variante."); return; }
    if (form.mermaPercent == null || form.mermaPercent < 0) { toast.error("Ingresá un porcentaje válido."); return; }

    const roles: EntityRole[] = form.role === "BOTH" ? ["CLIENT", "SUPPLIER"] : [form.role as EntityRole];

    // Verificar duplicados
    for (const role of roles) {
      const duplicate = value.find(
        (d) => d.variantId === form.variantId && d.role === role && d._localId !== editingId
      );
      if (duplicate) {
        toast.error(`Ya existe un override para esa variante (${role === "CLIENT" ? "cliente" : "proveedor"}).`);
        return;
      }
    }

    const selected = allVariants.find((v) => v.id === form.variantId);
    if (!selected) { toast.error("Variante no encontrada."); return; }

    setBusy(true);
    try {
      if (editingId) {
        onChange(value.map((d) =>
          d._localId === editingId
            ? {
                ...d,
                variantId:    form.variantId,
                role:         roles[0],
                mermaPercent: form.mermaPercent!,
                notes:        form.notes,
                _metalName:   selected.metal.name,
                _variantName: selected.name,
                _sku:         selected.sku,
                _purity:      String(selected.purity),
                _isFavorite:  selected.isFavorite,
              }
            : d
        ));
      } else {
        const newDrafts: MermaOverrideDraft[] = roles.map((role) => ({
          _localId:     String(Date.now() + Math.random()),
          variantId:    form.variantId,
          role,
          mermaPercent: form.mermaPercent!,
          notes:        form.notes,
          isActive:     true,
          _metalName:   selected.metal.name,
          _variantName: selected.name,
          _sku:         selected.sku,
          _purity:      String(selected.purity),
          _isFavorite:  selected.isFavorite,
        }));
        onChange([...value, ...newDrafts]);
      }
      setModalOpen(false);
    } finally {
      setBusy(false);
    }
  }

  function handleDelete() {
    if (!delLocalId) return;
    onChange(value.filter((d) => d._localId !== delLocalId));
    setDelLocalId(null);
  }

  function toggleActive(localId: string) {
    onChange(value.map((d) =>
      d._localId === localId ? { ...d, isActive: !d.isActive } : d
    ));
  }

  const delTarget = value.find((d) => d._localId === delLocalId);

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-end">
        <TPButton variant="primary" onClick={openCreate} iconLeft={<Plus size={14} />}>
          Agregar merma
        </TPButton>
      </div>

      {/* Tabla */}
      <TPTableKit
        rows={value}
        columns={MERMA_COLS}
        hideColumnPicker
        emptyText="No hay overrides configurados. Se usará la merma global de la joyería."
        countLabel={(n) => `${n} override${n !== 1 ? "s" : ""}`}
        renderRow={(d, vis) => (
          <TPTr key={d._localId}>
            {vis.variante && (
              <TPTd>
                <div className="flex items-center gap-2">
                  {d._isFavorite && <Star size={11} className="fill-primary text-primary shrink-0" />}
                  <div>
                    <div className="font-medium text-text">{d._metalName} — {d._variantName}</div>
                    <div className="text-xs text-muted">{d._sku} · pureza {(parseFloat(d._purity) * 100).toFixed(0)}%</div>
                  </div>
                </div>
              </TPTd>
            )}
            {vis.rol      && <TPTd>{roleBadge(d.role)}</TPTd>}
            {vis.merma    && <TPTd className="text-right font-semibold tabular-nums">{d.mermaPercent.toFixed(2)} %</TPTd>}
            {vis.estado   && (
              <TPTd>
                <button type="button" onClick={() => toggleActive(d._localId)} className="hover:opacity-80 transition-opacity">
                  <TPStatusPill active={d.isActive} activeLabel="Activo" inactiveLabel="Inactivo" />
                </button>
              </TPTd>
            )}
            {vis.notas    && <TPTd className="text-xs text-muted max-w-[200px] truncate">{d.notes || "—"}</TPTd>}
            {vis.acciones && (
              <TPTd className="text-right">
                <TPRowActions
                  onEdit={() => openEdit(d)}
                  onDelete={() => setDelLocalId(d._localId)}
                />
              </TPTd>
            )}
          </TPTr>
        )}
      />

      {/* Modal add/edit */}
      <Modal
        open={modalOpen}
        title={editingId ? "Editar override de merma" : "Nuevo override de merma"}
        subtitle="Definí el porcentaje de merma para una variante específica."
        maxWidth="xl"
        busy={busy}
        onClose={() => setModalOpen(false)}
        onEnter={handleSave}
        footer={
          <>
            <TPButton variant="secondary" onClick={() => setModalOpen(false)} disabled={busy}>Cancelar</TPButton>
            <TPButton variant="primary" onClick={handleSave} loading={busy}>
              {editingId ? "Guardar cambios" : "Agregar"}
            </TPButton>
          </>
        }
      >
        <div className="space-y-5">
          <TPField label="Variante de metal" hint="Seleccioná el metal y acabado al que aplica esta merma.">
            <TPComboFixed
              value={form.variantId}
              onChange={(v) => setForm((p) => ({ ...p, variantId: v }))}
              disabled={busy || loadingVariants}
              searchable
              searchPlaceholder={loadingVariants ? "Cargando variantes…" : "Buscar por nombre, SKU…"}
              options={[
                { value: "", label: loadingVariants ? "Cargando variantes…" : "— Seleccioná una variante —" },
                ...variantOptions,
              ]}
            />
          </TPField>

          <div className="grid grid-cols-2 gap-4">
            <TPField label="Rol de la entidad" hint="¿Actúa como cliente o como proveedor?">
              <TPComboFixed
                value={form.role}
                onChange={(v) => setForm((p) => ({ ...p, role: v as EntityRole | "BOTH" }))}
                disabled={busy}
                options={roleOptions}
              />
            </TPField>
            <TPField label="Merma %" hint="Valor entre 0 y 100.">
              <TPNumberInput
                value={form.mermaPercent}
                onChange={(v) => setForm((p) => ({ ...p, mermaPercent: v }))}
                disabled={busy}
                decimals={2}
                min={0}
                max={100}
                suffix="%"
                placeholder="Ej: 2.50"
              />
            </TPField>
          </div>

          <TPField label="Notas" hint="Opcional — razón del acuerdo o excepción.">
            <TPTextarea
              value={form.notes}
              onChange={(v) => setForm((p) => ({ ...p, notes: v }))}
              disabled={busy}
              minH={96}
              placeholder="Ej: Acuerdo especial con proveedor por volumen."
            />
          </TPField>
        </div>
      </Modal>

      <ConfirmDeleteDialog
        open={!!delLocalId}
        title={`Eliminar merma — ${delTarget?._metalName ?? ""} ${delTarget?._variantName ?? ""}`}
        description="¿Estás seguro? El override de merma se quitará de la configuración."
        confirmText="Eliminar"
        busy={false}
        onClose={() => setDelLocalId(null)}
        onConfirm={handleDelete}
      />
    </div>
  );
}
