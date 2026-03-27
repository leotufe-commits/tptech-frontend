// src/pages/configuracion-sistema/clientes/MermaBlock.tsx
// Bloque de resumen de merma para el card Comercial del modal de entidades.
// En modo CREATE gestiona drafts locales via TabMermaDraft.
// En modo EDIT muestra el estado actual y permite abrir el panel de configuración.
import React, { useEffect, useState } from "react";
import { Percent } from "lucide-react";
import { Modal } from "../../../components/ui/Modal";
import { TPButton } from "../../../components/ui/TPButton";
import { commercialEntitiesExtApi } from "../../../services/commercial-entities";
import TabMerma from "../../entity-detail/tabs/TabMerma";
import TabMermaDraft from "./TabMermaDraft";
import type { MermaOverrideDraft } from "./clientes.types";

interface Props {
  /** null = modo CREATE (entidad aún no guardada). */
  entityId: string | null;
  isClient: boolean;
  isSupplier: boolean;
  hasRelations?: boolean;
  /** Deshabilita el botón de edición (ej: mientras el modal padre está guardando). */
  disabled?: boolean;
  // CREATE mode draft support
  drafts?: MermaOverrideDraft[];
  onDraftsChange?: (drafts: MermaOverrideDraft[]) => void;
}

export function MermaBlock({ entityId, isClient, isSupplier, hasRelations = false, disabled = false, drafts, onDraftsChange }: Props) {
  const [count, setCount]   = useState<number | null>(null);
  const [panelOpen, setPanelOpen] = useState(false);

  // Carga el conteo de overrides activos (EDIT mode only)
  async function fetchCount() {
    if (!entityId) return;
    try {
      const data = await commercialEntitiesExtApi.merma.list(entityId);
      setCount(data.filter((o) => o.isActive).length);
    } catch {
      // silencioso
    }
  }

  useEffect(() => {
    void fetchCount();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entityId]);

  function handleClose() {
    setPanelOpen(false);
    if (entityId) void fetchCount();
  }

  // ── Modo CREATE ────────────────────────────────────────────────────────────
  if (!entityId) {
    const draftCount = drafts?.length ?? 0;
    const activeCount = drafts?.filter((d) => d.isActive).length ?? 0;
    const statusText =
      draftCount === 0
        ? "Sin configuración — se usará la merma global."
        : `${draftCount} override${draftCount !== 1 ? "s" : ""} (${activeCount} activo${activeCount !== 1 ? "s" : ""})`;

    return (
      <>
        <div className="flex items-center justify-between gap-3 rounded-xl border border-border/50 bg-surface/30 px-3.5 py-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <Percent
              size={15}
              className={`shrink-0 ${draftCount > 0 ? "text-primary" : "text-muted"}`}
            />
            <div className="min-w-0">
              <div className="text-xs font-medium text-text">Merma por variante</div>
              <div className="text-[11px] text-muted mt-0.5">{statusText}</div>
            </div>
          </div>
          {!disabled && onDraftsChange && (
            <TPButton
              variant="secondary"
              onClick={() => setPanelOpen(true)}
              className="shrink-0 h-7 px-2.5 text-xs"
            >
              {draftCount === 0 ? "Configurar merma" : "Editar merma"}
            </TPButton>
          )}
        </div>

        <Modal
          open={panelOpen}
          title="Merma por variante"
          subtitle="Configuración preliminar — se guardará al crear la entidad."
          maxWidth="4xl"
          className="min-h-[70vh]"
          onClose={() => setPanelOpen(false)}
          footer={
            <TPButton variant="secondary" onClick={() => setPanelOpen(false)}>
              Cerrar
            </TPButton>
          }
        >
          <TabMermaDraft
            value={drafts ?? []}
            onChange={onDraftsChange ?? (() => {})}
            isClient={isClient}
            isSupplier={isSupplier}
          />
        </Modal>
      </>
    );
  }

  // ── Modo EDIT ─────────────────────────────────────────────────────────────
  const statusText =
    count === null
      ? "Cargando…"
      : count === 0
      ? "Sin configuración personalizada — usa merma heredada"
      : `${count} override${count !== 1 ? "s" : ""} activo${count !== 1 ? "s" : ""}`;

  return (
    <>
      <div className="flex items-center justify-between gap-3 rounded-xl border border-border/50 bg-surface/30 px-3.5 py-3">
        <div className="flex items-center gap-2.5 min-w-0">
          <Percent
            size={15}
            className={`shrink-0 ${count && count > 0 ? "text-primary" : "text-muted"}`}
          />
          <div className="min-w-0">
            <div className="text-xs font-medium text-text">Merma por variante</div>
            <div className="text-[11px] text-muted mt-0.5">{statusText}</div>
          </div>
        </div>
        {!disabled && (
          <TPButton
            variant="secondary"
            onClick={() => setPanelOpen(true)}
            className="shrink-0 h-7 px-2.5 text-xs"
          >
            {count === 0 ? "Configurar merma" : "Editar merma"}
          </TPButton>
        )}
      </div>

      <Modal
        open={panelOpen}
        title="Merma por variante"
        subtitle="Overrides de merma configurados para esta entidad."
        maxWidth="4xl"
        className="min-h-[70vh]"
        onClose={handleClose}
        footer={
          <TPButton variant="secondary" onClick={handleClose}>
            Cerrar
          </TPButton>
        }
      >
        <TabMerma
          entityId={entityId}
          isClient={isClient}
          isSupplier={isSupplier}
          hasRelations={hasRelations}
        />
      </Modal>
    </>
  );
}
