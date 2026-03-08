// src/pages/InventarioAlmacenes/WarehouseEditModal.tsx
import React, { useEffect } from "react";
import { Loader2 } from "lucide-react";

import Modal from "../../components/ui/Modal";
import { TPButton } from "../../components/ui/TPButton";
import TPInput from "../../components/ui/TPInput";
import TPTextarea from "../../components/ui/TPTextarea";
import TPCheckbox from "../../components/ui/TPCheckbox";
import TPAlert from "../../components/ui/TPAlert";

import TPComboCreatable from "../../components/ui/TPComboCreatable";
import { useCatalog } from "../../hooks/useCatalog";
import type { CatalogType } from "../../services/catalogs";

import type { WarehouseDraft } from "./types";

function asCatalogType(t: CatalogType): CatalogType {
  return t;
}

export default function WarehouseEditModal({
  open,
  onClose,
  draft,
  setDraft,
  busySave,
  onSave,
  editKey,
  onFormKeyDown,
}: {
  open: boolean;
  onClose: () => void;

  draft: WarehouseDraft;
  setDraft: React.Dispatch<React.SetStateAction<WarehouseDraft>>;

  busySave: boolean;
  onSave: () => void | Promise<void>;

  editKey: string;
  onFormKeyDown: (e: React.KeyboardEvent) => void;
}) {
  const isCreate = !String((draft as any)?.id || "").trim();

  const cityCat = useCatalog(asCatalogType("CITY"));
  const provCat = useCatalog(asCatalogType("PROVINCE"));
  const countryCat = useCatalog(asCatalogType("COUNTRY"));

  useEffect(() => {
    if (!open) return;
    if (!isCreate) return;
    if ((draft as any).isActive) return;
    setDraft((d) => ({ ...(d as any), isActive: true }));
  }, [open, isCreate, (draft as any).isActive, setDraft]);

  return (
    <Modal
      open={open}
      onClose={() => (busySave ? null : onClose())}
      title={(draft as any).id ? "Editar almacén" : "Nuevo almacén"}
      subtitle="Completá los datos del almacén."
      busy={busySave}
      maxWidth="xl"
      footer={
        <div className="flex w-full items-center justify-between gap-2">
          <div className="text-xs text-muted">
            {(draft as any).id ? "Editando almacén existente" : "Creando nuevo almacén"}
          </div>

          <div className="flex items-center gap-2">
            <TPButton variant="ghost" onClick={onClose} disabled={busySave}>
              Cancelar
            </TPButton>

            <TPButton
              onClick={onSave}
              disabled={busySave}
              iconLeft={busySave ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            >
              Guardar
            </TPButton>
          </div>
        </div>
      }
    >
      <form
        key={editKey}
        onSubmit={(e) => (e.preventDefault(), void onSave())}
        onKeyDown={onFormKeyDown}
        className="space-y-4"
      >
        {/* Fila 1: Nombre */}
        <TPInput
          label="Nombre del almacén *"
          value={(draft as any).name}
          onChange={(v) => setDraft((d) => ({ ...(d as any), name: v }))}
          placeholder="Ej: Depósito Central"
          autoFocus
          disabled={busySave}
        />

        {/* Fila 2: Teléfono | Mail */}
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <TPInput
            label="Teléfono"
            value={(draft as any).phoneNumber}
            onChange={(v) => setDraft((d) => ({ ...(d as any), phoneNumber: v }))}
            placeholder="Ej: +54 11 1234-5678"
            disabled={busySave}
          />

          <TPInput
            label="Mail"
            value={(draft as any).email}
            onChange={(v) => setDraft((d) => ({ ...(d as any), email: v }))}
            placeholder="Ej: deposito@empresa.com"
            disabled={busySave}
          />
        </div>

        {/* Fila 3: Dirección | Ciudad */}
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <TPInput
            label="Dirección"
            value={(draft as any).street}
            onChange={(v) => setDraft((d) => ({ ...(d as any), street: v }))}
            placeholder="Ej: Av. Corrientes 1234"
            disabled={busySave}
          />

          <TPComboCreatable
            label="Ciudad"
            mode={isCreate ? "create" : "edit"}
            type="CITY"
            items={cityCat.items}
            loading={cityCat.loading}
            value={(draft as any).city}
            onChange={(v) => setDraft((d) => ({ ...(d as any), city: v }))}
            placeholder="Ciudad"
            disabled={busySave}
            allowCreate
            onRefresh={() => void cityCat.refresh()}
            onCreate={async (label) => {
              await cityCat.createItem(label);
              setDraft((d) => ({ ...(d as any), city: label }));
            }}
          />
        </div>

        {/* Fila 4: Provincia | País */}
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <TPComboCreatable
            label="Provincia"
            mode={isCreate ? "create" : "edit"}
            type="PROVINCE"
            items={provCat.items}
            loading={provCat.loading}
            value={(draft as any).province}
            onChange={(v) => setDraft((d) => ({ ...(d as any), province: v }))}
            placeholder="Provincia"
            disabled={busySave}
            allowCreate
            onRefresh={() => void provCat.refresh()}
            onCreate={async (label) => {
              await provCat.createItem(label);
              setDraft((d) => ({ ...(d as any), province: label }));
            }}
          />

          <TPComboCreatable
            label="País"
            mode={isCreate ? "create" : "edit"}
            type="COUNTRY"
            items={countryCat.items}
            loading={countryCat.loading}
            value={(draft as any).country}
            onChange={(v) => setDraft((d) => ({ ...(d as any), country: v }))}
            placeholder="País"
            disabled={busySave}
            allowCreate
            onRefresh={() => void countryCat.refresh()}
            onCreate={async (label) => {
              await countryCat.createItem(label);
              setDraft((d) => ({ ...(d as any), country: label }));
            }}
          />
        </div>

        {/* Fila 5: Notas */}
        <TPTextarea
          label="Notas"
          value={(draft as any).notes}
          onChange={(v) => setDraft((d) => ({ ...(d as any), notes: v }))}
          maxLen={500}
          disabled={busySave}
        />

        {!isCreate ? (
          <>
            <TPCheckbox
              checked={!!(draft as any).isActive}
              onChange={(v) => setDraft((d) => ({ ...(d as any), isActive: !!v }))}
              label="Almacén activo"
              disabled={busySave}
            />

            {!(draft as any).isActive ? (
              <TPAlert tone="warning" title="Almacén inactivo">
                No se podrá usar para movimientos hasta reactivarlo.
              </TPAlert>
            ) : null}
          </>
        ) : null}
      </form>
    </Modal>
  );
}
