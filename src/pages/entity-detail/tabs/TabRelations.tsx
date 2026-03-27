// src/pages/entity-detail/tabs/TabRelations.tsx
import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Plus, Trash2, ExternalLink, X, Check } from "lucide-react";
import { TPButton } from "../../../components/ui/TPButton";
import { TPIconButton } from "../../../components/ui/TPIconButton";
import { TPField } from "../../../components/ui/TPField";
import TPComboFixed from "../../../components/ui/TPComboFixed";
import TPTextarea from "../../../components/ui/TPTextarea";
import { Modal } from "../../../components/ui/Modal";
import ConfirmDeleteDialog from "../../../components/ui/ConfirmDeleteDialog";
import { toast } from "../../../lib/toast";
import {
  commercialEntitiesApi,
  commercialEntitiesExtApi,
  type EntityRelationRow,
  type EntityRow,
} from "../../../services/commercial-entities";
import { cn } from "../../../components/ui/tp";

interface Props {
  entityId: string;
  isClient?: boolean;
  isSupplier?: boolean;
  disabled?: boolean;
  openAddTrigger?: number;
  /** Ocultar el título/subtítulo cuando el padre ya provee el header */
  hideTitle?: boolean;
}

export default function TabRelations({ entityId, isClient, isSupplier, disabled = false, openAddTrigger, hideTitle = false }: Props) {
  const navigate = useNavigate();
  const [relations, setRelations] = useState<EntityRelationRow[]>([]);
  const [loading, setLoading]     = useState(false);
  const [busy, setBusy]           = useState(false);

  const [allEntities, setAllEntities]         = useState<EntityRow[]>([]);
  const [loadingEntities, setLoadingEntities] = useState(false);

  useEffect(() => {
    if (openAddTrigger && openAddTrigger > 0 && !disabled) openCreate();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [openAddTrigger]);

  const [modalOpen, setModalOpen] = useState(false);
  const [targetEntityId, setTargetEntityId] = useState("");
  const [notes, setNotes]                   = useState("");

  const [delTarget, setDelTarget] = useState<EntityRelationRow | null>(null);
  const [delBusy, setDelBusy]     = useState(false);

  async function load() {
    setLoading(true);
    try {
      const data = await commercialEntitiesExtApi.relations.list(entityId);
      setRelations(data);
    } catch (e: any) {
      toast.error(e?.message || "Error al cargar relaciones.");
    } finally {
      setLoading(false);
    }
  }

  async function loadEntities() {
    if (allEntities.length > 0) return;
    setLoadingEntities(true);
    try {
      const res = await commercialEntitiesApi.list({ role: "all", take: 200 });
      setAllEntities(res.rows.filter((r) => r.id !== entityId && r.isActive && !r.mergedIntoEntityId));
    } catch {}
    finally { setLoadingEntities(false); }
  }

  useEffect(() => { void load(); }, [entityId]);

  function openCreate() {
    setTargetEntityId(""); setNotes("");
    void loadEntities();
    setModalOpen(true);
  }

  async function handleSave() {
    if (!targetEntityId) { toast.error("Seleccioná la entidad relacionada."); return; }
    setBusy(true);
    try {
      await commercialEntitiesExtApi.relations.add(entityId, {
        targetEntityId,
        notes: notes.trim() || undefined,
      });
      toast.success("Relación agregada.");
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
      await commercialEntitiesExtApi.relations.remove(entityId, delTarget.id);
      toast.success("Relación eliminada.");
      setDelTarget(null);
      await load();
    } catch (e: any) {
      toast.error(e?.message || "Error al eliminar.");
    } finally {
      setDelBusy(false);
    }
  }

  const entityOptions = (() => {
    const relatedIds = new Set(
      relations.map((r) => r.fromEntity.id === entityId ? r.toEntity.id : r.fromEntity.id)
    );
    const toOption = (e: EntityRow) => ({
      value:    e.id,
      label:    relatedIds.has(e.id) ? `${e.displayName} (ya relacionado)` : e.displayName,
      disabled: relatedIds.has(e.id),
    });
    // Mostrar solo la contraparte: si soy cliente → proveedores, si soy proveedor → clientes
    const onlyClient   = isClient && !isSupplier;
    const onlySupplier = isSupplier && !isClient;
    const filtered = onlyClient
      ? allEntities.filter((e) => e.isSupplier)
      : onlySupplier
        ? allEntities.filter((e) => e.isClient)
        : allEntities;
    const clients   = filtered.filter((e) => e.isClient && !e.isSupplier);
    const suppliers = filtered.filter((e) => e.isSupplier && !e.isClient);
    const both      = filtered.filter((e) => e.isClient && e.isSupplier);
    const result = [];
    if (clients.length)   { result.push(...clients.map(toOption)); }
    if (suppliers.length) { result.push(...suppliers.map(toOption)); }
    if (both.length)      { result.push(...both.map(toOption)); }
    return result;
  })();

  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        {!hideTitle && (
          <div>
            <div className="text-sm font-semibold text-text">Relaciones con otras entidades</div>
            <div className="text-xs text-muted mt-0.5">
              Entidades vinculadas comercial o estructuralmente con esta ficha.
            </div>
          </div>
        )}
        {!hideTitle && !disabled && (
          <div className="flex gap-2">
            <TPButton variant="primary" onClick={openCreate} iconLeft={<Plus size={14} />}>
              Agregar relación
            </TPButton>
          </div>
        )}
      </div>

      {/* Lista */}
      {loading ? (
        <div className="text-sm text-muted">Cargando…</div>
      ) : relations.length === 0 ? (
        <div className="py-5 text-center text-xs text-muted">
          No hay relaciones definidas.
        </div>
      ) : (
        <div className="space-y-1.5">
          {relations.map((r) => {
            // La "otra" entidad es siempre la que no soy yo
            const other = r.fromEntityId === entityId ? r.toEntity : r.fromEntity;
            return (
              <div
                key={r.id}
                className="flex items-center gap-3 rounded-lg border border-border/50 bg-card px-3 py-2"
              >
                {/* Avatar */}
                <div className="h-8 w-8 rounded-full overflow-hidden border border-border bg-surface shrink-0">
                  {other.avatarUrl ? (
                    <img src={other.avatarUrl} alt={other.displayName} className="h-full w-full object-cover" />
                  ) : (
                    <div className="grid h-full w-full place-items-center text-xs font-bold text-primary bg-primary/10">
                      {other.displayName.split(/[\s,]+/).slice(0, 2).map((w) => w[0]).join("").toUpperCase() || "?"}
                    </div>
                  )}
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-text truncate">
                    Relacionado con <span className="font-semibold">{other.displayName}</span>
                  </div>
                  {(other.code || r.notes) && (
                    <div className="text-xs text-muted mt-0.5 truncate">
                      {other.code && <span>{other.code}</span>}
                      {other.code && r.notes && <span className="mx-1">·</span>}
                      {r.notes && <span className="italic">"{r.notes}"</span>}
                    </div>
                  )}
                </div>

                {/* Acciones */}
                <div className="flex gap-1 shrink-0">
                  <TPIconButton
                    title="Ver ficha"
                    onClick={() => {
                      const base = other.isClient ? "/clientes" : "/proveedores";
                      navigate(`${base}/${other.id}`);
                    }}
                  >
                    <ExternalLink size={13} />
                  </TPIconButton>
                  {!disabled && (
                    <TPIconButton title="Eliminar" onClick={() => setDelTarget(r)}>
                      <Trash2 size={13} />
                    </TPIconButton>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modal agregar */}
      <Modal
        open={modalOpen}
        title="Agregar relación"
        maxWidth="sm"
        busy={busy}
        onClose={() => setModalOpen(false)}
        onEnter={handleSave}
        footer={
          <>
            <TPButton variant="secondary" onClick={() => setModalOpen(false)} disabled={busy} iconLeft={<X size={14} />}>Cancelar</TPButton>
            <TPButton variant="primary" onClick={handleSave} loading={busy} disabled={!targetEntityId} iconLeft={<Check size={14} />}>
              Guardar
            </TPButton>
          </>
        }
      >
        <div className="space-y-4">
          <TPField label="Entidad relacionada">
            <TPComboFixed
              value={targetEntityId}
              onChange={setTargetEntityId}
              disabled={busy || loadingEntities}
              searchable
              searchPlaceholder="Buscar por nombre o código…"
              options={[
                { value: "", label: loadingEntities ? "Cargando…" : "— Seleccioná —" },
                ...entityOptions,
              ]}
            />
          </TPField>
          <TPField label="Notas" hint="Opcional.">
            <TPTextarea
              value={notes}
              onChange={setNotes}
              disabled={busy}
              placeholder="Ej: Son parte del mismo grupo empresarial."
            />
          </TPField>
        </div>
      </Modal>

      <ConfirmDeleteDialog
        open={!!delTarget}
        title="Eliminar relación"
        description={`¿Estás seguro de que querés eliminar la relación con "${delTarget ? (delTarget.fromEntityId === entityId ? delTarget.toEntity.displayName : delTarget.fromEntity.displayName) : ""}"?`}
        confirmText="Eliminar"
        busy={delBusy}
        onClose={() => setDelTarget(null)}
        onConfirm={handleDelete}
      />
    </div>
  );
}
