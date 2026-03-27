// src/pages/entity-detail/tabs/TabMerma.tsx
// Merma % override por variante de metal — por entidad comercial
import React, { useEffect, useState, useMemo } from "react";
import { Plus, Star, X, Check } from "lucide-react";
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
import {
  commercialEntitiesExtApi,
  type EntityMermaOverride,
  type EntityRole,
} from "../../../services/commercial-entities";
import { getMetals, getVariants, type MetalRow, type MetalVariantRow } from "../../../services/valuation";

// ---------------------------------------------------------------------------
// Table columns
// ---------------------------------------------------------------------------
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
  entityId: string;
  isClient: boolean;
  isSupplier: boolean;
  hasRelations?: boolean;
  disabled?: boolean;
  openAddTrigger?: number;
  /** Ocultar el header completo cuando el padre provee su propio header */
  hideHeader?: boolean;
}

export default function TabMerma({ entityId, isClient, isSupplier, hasRelations = false, disabled = false, openAddTrigger, hideHeader = false }: Props) {
  const canBoth = (isClient && isSupplier) || hasRelations;
  const roleOptions = ALL_ROLE_OPTIONS.filter((o) => {
    if (o.value === "CLIENT"   && !isClient)  return false;
    if (o.value === "SUPPLIER" && !isSupplier) return false;
    if (o.value === "BOTH"     && !canBoth)   return false;
    return true;
  });
  const [overrides, setOverrides] = useState<EntityMermaOverride[]>([]);
  const [loading, setLoading]     = useState(false);
  const [busy, setBusy]           = useState(false);

  useEffect(() => {
    if (openAddTrigger && openAddTrigger > 0 && !disabled) openCreate();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [openAddTrigger]);


  // Variantes para el selector (cargadas desde la API de valuación)
  const [allVariants, setAllVariants] = useState<(MetalVariantRow & { metal: MetalRow })[]>([]);
  const [loadingVariants, setLoadingVariants] = useState(false);

  // Modal
  const [modalOpen, setModalOpen]   = useState(false);
  const [editing, setEditing]       = useState<EntityMermaOverride | null>(null);
  const [form, setForm]             = useState<FormState>(EMPTY_FORM);

  // Delete
  const [delTarget, setDelTarget]   = useState<EntityMermaOverride | null>(null);
  const [delBusy, setDelBusy]       = useState(false);

  async function load() {
    setLoading(true);
    try {
      const data = await commercialEntitiesExtApi.merma.list(entityId);
      setOverrides(data);
    } catch (e: any) {
      toast.error(e?.message || "Error al cargar mermas.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void load(); }, [entityId]);

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
      overrides
        .filter((o) => o.role === form.role && o.id !== editing?.id)
        .map((o) => o.variantId)
    );
    return allVariants.map((v) => ({
      value: v.id,
      label: `${v.metal.name} — ${v.name} (${v.sku})`,
      disabled: usedIds.has(v.id),
    }));
  }, [allVariants, overrides, form.role, editing]);


  function openCreate() {
    setEditing(null);
    setForm({ ...EMPTY_FORM, role: isClient && !isSupplier ? "CLIENT" : isSupplier && !isClient ? "SUPPLIER" : "CLIENT" });
    void loadVariants();
    setModalOpen(true);
  }

  function openEdit(o: EntityMermaOverride) {
    setEditing(o);
    setForm({ variantId: o.variantId, role: o.role, mermaPercent: parseFloat(o.mermaPercent), notes: o.notes });
    void loadVariants();
    setModalOpen(true);
  }

  async function handleSave() {
    if (!form.variantId) { toast.error("Seleccioná una variante."); return; }
    if (form.mermaPercent == null || form.mermaPercent < 0) { toast.error("Ingresá un porcentaje válido."); return; }

    const roles: EntityRole[] = form.role === "BOTH" ? ["CLIENT", "SUPPLIER"] : [form.role as EntityRole];

    setBusy(true);
    try {
      for (const role of roles) {
        await commercialEntitiesExtApi.merma.upsert(entityId, {
          variantId:    form.variantId,
          role,
          mermaPercent: form.mermaPercent,
          notes:        form.notes,
        });
      }
      toast.success(editing ? "Merma actualizada." : "Merma agregada.");
      setModalOpen(false);
      await load();
    } catch (e: any) {
      toast.error(e?.message || "Error al guardar.");
    } finally {
      setBusy(false);
    }
  }

  async function handleDelete() {
    if (!delTarget) return;
    setDelBusy(true);
    try {
      await commercialEntitiesExtApi.merma.remove(entityId, delTarget.id);
      toast.success("Merma eliminada.");
      setDelTarget(null);
      await load();
    } catch (e: any) {
      toast.error(e?.message || "Error al eliminar.");
    } finally {
      setDelBusy(false);
    }
  }

  return (
    <div className="space-y-3">
      {/* Header */}
      {!hideHeader && (
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="text-[11px] text-muted">Fallback: entidad → artículo → categoría → global</span>
          {!disabled && (
            <TPButton variant="primary" onClick={openCreate} iconLeft={<Plus size={14} />}>
              Agregar merma
            </TPButton>
          )}
        </div>
      )}

      {/* Tabla */}
      <TPTableKit
        rows={overrides}
        columns={disabled ? MERMA_COLS.filter((c) => c.key !== "acciones") : MERMA_COLS}
        loading={loading}
        emptyText="No hay overrides de merma definidos para esta entidad."
        countLabel={(n) => `${n} override${n !== 1 ? "s" : ""}`}
        hideColumnPicker
        renderRow={(o, vis) => (
          <TPTr key={o.id}>
            {vis.variante && (
              <TPTd>
                <div className="flex items-center gap-2">
                  {o.variant.isFavorite && <Star size={11} className="fill-primary text-primary shrink-0" />}
                  <div>
                    <div className="font-medium text-text">{o.variant.metal.name} — {o.variant.name}</div>
                    <div className="text-xs text-muted">{o.variant.sku} · pureza {parseFloat(o.variant.purity) * 100}%</div>
                  </div>
                </div>
              </TPTd>
            )}
            {vis.rol    && <TPTd>{roleBadge(o.role)}</TPTd>}
            {vis.merma  && <TPTd className="text-right font-semibold tabular-nums">{parseFloat(o.mermaPercent).toFixed(2)} %</TPTd>}
            {vis.estado && <TPTd><TPStatusPill active={o.isActive} activeLabel="Activo" inactiveLabel="Inactivo" /></TPTd>}
            {vis.notas  && <TPTd className="text-xs text-muted max-w-[200px] truncate">{o.notes || "—"}</TPTd>}
            {vis.acciones && !disabled && (
              <TPTd className="text-right">
                <TPRowActions
                  onEdit={() => openEdit(o)}
                  onDelete={() => setDelTarget(o)}
                />
              </TPTd>
            )}
          </TPTr>
        )}
      />

      {/* Modal crear/editar */}
      <Modal
        open={modalOpen}
        title={editing ? "Editar override de merma" : "Nuevo override de merma"}
        subtitle="Definí el porcentaje de merma para una variante específica."
        maxWidth="xl"
        busy={busy}
        onClose={() => setModalOpen(false)}
        onEnter={handleSave}
        footer={
          <>
            <TPButton variant="secondary" onClick={() => setModalOpen(false)} disabled={busy} iconLeft={<X size={14} />}>Cancelar</TPButton>
            <TPButton variant="primary" onClick={handleSave} loading={busy} iconLeft={editing ? <Check size={14} /> : <Plus size={14} />}>
              {editing ? "Guardar cambios" : "Agregar"}
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
        open={!!delTarget}
        title={`Eliminar merma — ${delTarget?.variant.metal.name} ${delTarget?.variant.name}`}
        description="¿Estás seguro? El override de merma se eliminará y se usará la merma del artículo, categoría o global."
        confirmText="Eliminar"
        busy={delBusy}
        onClose={() => setDelTarget(null)}
        onConfirm={handleDelete}
      />
    </div>
  );
}
