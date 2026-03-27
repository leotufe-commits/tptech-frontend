// src/pages/configuracion-sistema/clientes/MergeModal.tsx
import React, { useState, useEffect } from "react";
import { Combine, Loader2 } from "lucide-react";
import { Modal } from "../../../components/ui/Modal";
import { TPButton } from "../../../components/ui/TPButton";
import { TPField } from "../../../components/ui/TPField";
import { TPAlert } from "../../../components/ui/TPAlert";
import TPComboFixed from "../../../components/ui/TPComboFixed";
import { toast } from "../../../lib/toast";
import {
  commercialEntitiesApi,
  commercialEntitiesExtApi,
  type EntityRow,
  type MergePreview,
} from "../../../services/commercial-entities";

interface Props {
  open: boolean;
  role: "client" | "supplier";
  onClose: () => void;
  onMerged: () => void;
}

function impactSummary(impact: MergePreview["impact"]): string {
  const parts: string[] = [];
  if (impact.addresses)     parts.push(`${impact.addresses} dirección${impact.addresses !== 1 ? "es" : ""}`);
  if (impact.contacts)      parts.push(`${impact.contacts} contacto${impact.contacts !== 1 ? "s" : ""}`);
  if (impact.attachments)   parts.push(`${impact.attachments} adjunto${impact.attachments !== 1 ? "s" : ""}`);
  if (impact.rules)         parts.push(`${impact.rules} regla${impact.rules !== 1 ? "s" : ""} comercial${impact.rules !== 1 ? "es" : ""}`);
  if (impact.balanceEntries) parts.push(`${impact.balanceEntries} mov. de saldo`);
  return parts.length > 0 ? parts.join(", ") : "Sin datos para mover";
}

export default function MergeModal({ open, role, onClose, onMerged }: Props) {
  const [entities, setEntities]               = useState<EntityRow[]>([]);
  const [loadingEntities, setLoadingEntities] = useState(false);
  const [sourceId, setSourceId]               = useState("");
  const [targetId, setTargetId]               = useState("");
  const [preview, setPreview]                 = useState<MergePreview | null>(null);
  const [loadingPreview, setLoadingPreview]   = useState(false);
  const [confirmed, setConfirmed]             = useState(false);
  const [busy, setBusy]                       = useState(false);

  const label    = role === "client" ? "clientes" : "proveedores";
  const labelCap = role === "client" ? "Clientes" : "Proveedores";

  useEffect(() => {
    if (!open) {
      setSourceId(""); setTargetId(""); setPreview(null); setConfirmed(false);
      return;
    }
    setLoadingEntities(true);
    commercialEntitiesApi.list({ role, take: 200 })
      .then((r) => setEntities(r.rows.filter((e) => e.isActive && !e.mergedIntoEntityId)))
      .catch(() => {})
      .finally(() => setLoadingEntities(false));
  }, [open, role]);

  useEffect(() => {
    setSourceId(""); setPreview(null); setConfirmed(false);
  }, [targetId]);

  useEffect(() => {
    if (!sourceId || !targetId) { setPreview(null); setConfirmed(false); return; }
    setLoadingPreview(true);
    setConfirmed(false);
    commercialEntitiesExtApi.merge.preview(sourceId, targetId)
      .then(setPreview)
      .catch((e: any) => toast.error(e?.message || "No se pudo calcular el impacto."))
      .finally(() => setLoadingPreview(false));
  }, [sourceId, targetId]);

  async function handleMerge() {
    if (!sourceId || !targetId || !preview || !confirmed) return;
    setBusy(true);
    try {
      await commercialEntitiesExtApi.merge.execute(sourceId, targetId);
      toast.success(`"${preview.source.displayName}" fue combinado con "${preview.target.displayName}".`);
      onMerged();
      onClose();
    } catch (e: any) {
      toast.error(e?.message || "No se pudo completar la combinación.");
    } finally {
      setBusy(false);
    }
  }

  const targetOptions = entities.map((e) => ({
    value: e.id,
    label: e.displayName,
  }));
  const sourceOptions = entities
    .filter((e) => e.id !== targetId)
    .map((e) => ({
      value: e.id,
      label: e.displayName,
    }));

  const canExecute = !!preview && confirmed && !busy;

  return (
    <Modal
      open={open}
      title={`Combinar ${labelCap}`}
      maxWidth="sm"
      busy={busy}
      onClose={onClose}
      footer={
        <>
          <TPButton variant="secondary" onClick={onClose} disabled={busy}>Cancelar</TPButton>
          <TPButton
            variant="primary"
            onClick={handleMerge}
            disabled={!canExecute}
            loading={busy}
            iconLeft={<Combine size={15} />}
          >
            Combinar {label}
          </TPButton>
        </>
      }
    >
      <div className="space-y-4">

        <p className="text-sm text-muted">
          Vas a unificar dos fichas en una sola. La ficha origen dejará de estar operativa
          y su información útil pasará a la ficha destino.
        </p>

        <TPField label="Ficha destino" hint="La que se conserva con todos los datos.">
          <TPComboFixed
            value={targetId}
            onChange={setTargetId}
            disabled={busy || loadingEntities}
            searchable
            searchPlaceholder="Buscar…"
            options={[
              { value: "", label: loadingEntities ? "Cargando…" : "— Elegí la ficha destino —" },
              ...targetOptions,
            ]}
          />
        </TPField>

        <TPField
          label="Ficha origen"
          hint={
            loadingPreview
              ? "Calculando impacto…"
              : preview
              ? `Se moverán: ${impactSummary(preview.impact)}.`
              : "La que dejará de estar operativa."
          }
        >
          <TPComboFixed
            value={sourceId}
            onChange={setSourceId}
            disabled={busy || !targetId}
            searchable
            searchPlaceholder="Buscar…"
            options={[
              { value: "", label: !targetId ? "Elegí el destino primero" : "— Elegí la ficha origen —" },
              ...sourceOptions,
            ]}
          />
          {loadingPreview && (
            <div className="flex items-center gap-1.5 mt-1.5 text-xs text-muted">
              <Loader2 size={12} className="animate-spin shrink-0" />
              Calculando el impacto de la combinación…
            </div>
          )}
        </TPField>

        {preview && !loadingPreview && (
          <>
            <TPAlert tone="warning">
              La ficha origen <strong>no se elimina</strong> pero dejará de estar operativa.
              Esta acción <strong>no se puede deshacer</strong>.
            </TPAlert>

            <label className="flex items-start gap-2.5 cursor-pointer rounded-xl border border-border bg-surface2 p-3 hover:bg-surface transition-colors">
              <input
                type="checkbox"
                checked={confirmed}
                onChange={(e) => setConfirmed(e.target.checked)}
                disabled={busy}
                className="mt-0.5 shrink-0"
              />
              <span className="text-sm text-text leading-snug">
                Entiendo que la ficha origen dejará de estar operativa y confirmo que quiero continuar.
              </span>
            </label>
          </>
        )}

      </div>
    </Modal>
  );
}
