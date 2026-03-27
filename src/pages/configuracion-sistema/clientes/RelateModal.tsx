// src/pages/configuracion-sistema/clientes/RelateModal.tsx
import React, { useState, useEffect } from "react";
import { Modal } from "../../../components/ui/Modal";
import { TPButton } from "../../../components/ui/TPButton";
import { TPField } from "../../../components/ui/TPField";
import TPComboFixed from "../../../components/ui/TPComboFixed";
import TPTextarea from "../../../components/ui/TPTextarea";
import { toast } from "../../../lib/toast";
import {
  commercialEntitiesApi,
  commercialEntitiesExtApi,
  type EntityRow,
} from "../../../services/commercial-entities";

interface Props {
  open: boolean;
  role: "client" | "supplier";
  onClose: () => void;
  onRelated: () => void;
}

export default function RelateModal({ open, role, onClose, onRelated }: Props) {
  const [entities, setEntities]               = useState<EntityRow[]>([]);
  const [loadingEntities, setLoadingEntities] = useState(false);
  const [busy, setBusy]                       = useState(false);
  const [entityAId, setEntityAId]             = useState("");
  const [entityBId, setEntityBId]             = useState("");
  const [notes, setNotes]                     = useState("");

  const labelA = role === "client" ? "Cliente" : "Proveedor";
  const labelB = role === "client" ? "proveedor" : "cliente";

  useEffect(() => {
    if (!open) {
      setEntityAId(""); setEntityBId(""); setNotes("");
      return;
    }
    setLoadingEntities(true);
    commercialEntitiesApi.list({ role: "all", take: 200 })
      .then((r) => setEntities(r.rows.filter((e) => e.isActive && !e.mergedIntoEntityId)))
      .catch(() => {})
      .finally(() => setLoadingEntities(false));
  }, [open]);

  useEffect(() => { setEntityBId(""); }, [entityAId]);

  async function handleSave() {
    if (!entityAId) { toast.error("Seleccioná la primera entidad."); return; }
    if (!entityBId) { toast.error("Seleccioná la segunda entidad."); return; }
    setBusy(true);
    try {
      await commercialEntitiesExtApi.relations.add(entityAId, {
        targetEntityId: entityBId,
        notes: notes.trim() || undefined,
      });
      toast.success("Relación creada correctamente.");
      onRelated();
      onClose();
    } catch (e: any) {
      toast.error(e?.message || "No se pudo crear la relación.");
    } finally {
      setBusy(false);
    }
  }

  function buildGroupedOptions(list: EntityRow[]) {
    const toOption = (e: EntityRow) => ({
      value: e.id,
      label: e.displayName,
    });
    const clients   = list.filter((e) => e.isClient && !e.isSupplier);
    const suppliers = list.filter((e) => e.isSupplier && !e.isClient);
    const both      = list.filter((e) => e.isClient && e.isSupplier);
    const result = [];
    if (clients.length)   { result.push(...clients.map(toOption)); }
    if (suppliers.length) { result.push(...suppliers.map(toOption)); }
    if (both.length)      { result.push(...both.map(toOption)); }
    return result;
  }

  // A = entidades del rol actual; B = contraparte (rol opuesto)
  const entitiesA = role === "client"
    ? entities.filter((e) => e.isClient)
    : entities.filter((e) => e.isSupplier);
  const entitiesB = role === "client"
    ? entities.filter((e) => e.isSupplier && e.id !== entityAId)
    : entities.filter((e) => e.isClient && e.id !== entityAId);
  const optionsA = buildGroupedOptions(entitiesA);
  const optionsB = buildGroupedOptions(entitiesB);

  return (
    <Modal
      open={open}
      title={`Relacionar ${labelA} con ${labelB}`}
      maxWidth="sm"
      busy={busy}
      onClose={onClose}
      onEnter={handleSave}
      footer={
        <>
          <TPButton variant="secondary" onClick={onClose} disabled={busy}>Cancelar</TPButton>
          <TPButton
            variant="primary"
            onClick={handleSave}
            loading={busy}
            disabled={!entityAId || !entityBId}
          >
            Crear relación
          </TPButton>
        </>
      }
    >
      <div className="space-y-4">
        <p className="text-sm text-muted">
          Vinculá dos fichas para indicar que tienen una relación comercial o estructural.
        </p>

        <TPField label={labelA} hint="Primera entidad de la relación.">
          <TPComboFixed
            value={entityAId}
            onChange={setEntityAId}
            disabled={busy || loadingEntities}
            searchable
            searchPlaceholder="Buscar…"
            options={[
              { value: "", label: loadingEntities ? "Cargando…" : `— Elegí el ${labelA.toLowerCase()} —` },
              ...optionsA,
            ]}
          />
        </TPField>

        <TPField label={`${role === "client" ? "Proveedor" : "Cliente"} relacionado`} hint="Segunda entidad de la relación.">
          <TPComboFixed
            value={entityBId}
            onChange={setEntityBId}
            disabled={busy || !entityAId}
            searchable
            searchPlaceholder="Buscar…"
            options={[
              { value: "", label: !entityAId ? "Elegí la primera entidad primero" : `— Elegí el ${labelB} —` },
              ...optionsB,
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
  );
}
