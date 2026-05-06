// src/pages/InventarioAlmacenes/WarehouseEditModal.tsx
import React, { useEffect, useMemo } from "react";
import { Loader2, Save, X } from "lucide-react";

import Modal from "../../components/ui/Modal";
import { TPButton } from "../../components/ui/TPButton";
import { TPField } from "../../components/ui/TPField";
import TPInput from "../../components/ui/TPInput";
import TPTextarea from "../../components/ui/TPTextarea";
import TPAttachmentManager from "../../components/ui/TPAttachmentManager";
import type { TPAttachmentItem } from "../../components/ui/TPAttachmentList";

import TPComboCreatable from "../../components/ui/TPComboCreatable";
import { useCatalog } from "../../hooks/useCatalog";
import type { CatalogType } from "../../services/catalogs";
import { useFieldFormats } from "../../context/FieldFormatsContext";
import { PHONE_FORMAT_PLACEHOLDER } from "../../lib/format";
import { usePhoneInput } from "../../hooks/useFormattedInput";

import type { WarehouseAttachment, WarehouseDraft } from "./types";

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
  savedAttachments = [],
  pendingFiles = [],
  uploadingAttachments = false,
  deletingAttId = null,
  onUpload,
  onDeleteAttachment,
}: {
  open: boolean;
  onClose: () => void;

  draft: WarehouseDraft;
  setDraft: React.Dispatch<React.SetStateAction<WarehouseDraft>>;

  busySave: boolean;
  onSave: () => void | Promise<void>;

  editKey: string;
  onFormKeyDown: (e: React.KeyboardEvent) => void;

  savedAttachments?: WarehouseAttachment[];
  pendingFiles?: File[];
  uploadingAttachments?: boolean;
  deletingAttId?: string | null;
  onUpload?: (files: File[]) => void;
  onDeleteAttachment?: (id: string) => void;
}) {
  const isCreate = !String((draft as any)?.id || "").trim();

  const attachmentItems: TPAttachmentItem[] = useMemo(() => {
    const saved: TPAttachmentItem[] = savedAttachments.map((a) => ({
      id: a.id,
      name: a.filename,
      size: a.size,
      url: a.url,
      mimeType: a.mimeType,
    }));
    // En modo create mostramos los archivos pendientes como items sin URL
    const pending: TPAttachmentItem[] = pendingFiles.map((f, i) => ({
      id: `pending-${i}`,
      name: f.name,
      size: f.size,
      mimeType: f.type,
    }));
    return isCreate ? pending : saved;
  }, [savedAttachments, pendingFiles, isCreate]);

  const { phoneFormat } = useFieldFormats();
  const ph = usePhoneInput(
    (draft as any).phoneNumber ?? "",
    (v) => setDraft((d) => ({ ...(d as any), phoneNumber: v })),
    phoneFormat
  );
  const prefixCat = useCatalog(asCatalogType("PHONE_PREFIX"));
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
      maxWidth="4xl"
      resizable
      maximizable
      maximizedMode="embedded"
      modalKey="inventario-almacenes-editor"
      footer={
        <div className="flex w-full items-center justify-between gap-2">
          <div className="text-xs text-muted">
            {(draft as any).id ? "Editando almacén existente" : "Creando nuevo almacén"}
          </div>

          <div className="flex items-center gap-2">
            <TPButton variant="secondary" onClick={onClose} disabled={busySave} iconLeft={<X size={14} />}>
              Cancelar
            </TPButton>

            <TPButton
              onClick={onSave}
              disabled={busySave}
              iconLeft={busySave ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
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
        {/* Nombre */}
        <TPField label="Nombre del almacén" required>
          <TPInput
            value={(draft as any).name}
            onChange={(v) => setDraft((d) => ({ ...(d as any), name: v }))}
            placeholder="Sucursal Centro"
            autoFocus
            disabled={busySave}
          />
        </TPField>

        {/* Teléfono | Mail */}
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div className="flex gap-2 items-end">
            <div className="w-28 shrink-0">
              <TPField label="Prefijo">
                <TPComboCreatable
                  mode={isCreate ? "create" : "edit"}
                  type="PHONE_PREFIX"
                  items={prefixCat.items}
                  loading={prefixCat.loading}
                  value={(draft as any).phoneCountry}
                  onChange={(v) => setDraft((d) => ({ ...(d as any), phoneCountry: v }))}
                  disabled={busySave}
                  allowCreate
                  onRefresh={() => void prefixCat.refresh()}
                  onCreate={async (label) => {
                    await prefixCat.createItem(label);
                    setDraft((d) => ({ ...(d as any), phoneCountry: label }));
                  }}
                />
              </TPField>
            </div>
            <div className="flex-1">
              <TPField label="Teléfono">
                <TPInput
                  value={ph.displayValue}
                  onChange={ph.handleChange}
                  onKeyDown={ph.handleKeyDown}
                  inputRef={ph.inputRef}
                  placeholder={PHONE_FORMAT_PLACEHOLDER[phoneFormat] ?? "11 1234-5678"}
                  disabled={busySave}
                />
              </TPField>
            </div>
          </div>

          <TPField label="Mail">
            <TPInput
              value={(draft as any).email}
              onChange={(v) => setDraft((d) => ({ ...(d as any), email: v }))}
              placeholder="ventas@sucursal.com"
              disabled={busySave}
            />
          </TPField>
        </div>

        {/* Domicilio */}
        <div className="rounded-2xl border border-border p-4">
          <div className="text-sm font-semibold text-text mb-4">Domicilio</div>

          <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
            <div className="md:col-span-8">
              <TPField label="Calle">
                <TPInput
                  value={(draft as any).street}
                  onChange={(v) => setDraft((d) => ({ ...(d as any), street: v }))}
                  placeholder="Av. Corrientes"
                  disabled={busySave}
                />
              </TPField>
            </div>

            <div className="md:col-span-2">
              <TPField label="Número">
                <TPInput
                  value={(draft as any).number}
                  onChange={(v) => setDraft((d) => ({ ...(d as any), number: v }))}
                  placeholder="1234"
                  disabled={busySave}
                />
              </TPField>
            </div>

            <div className="md:col-span-1">
              <TPField label="Piso">
                <TPInput
                  value={(draft as any).floor}
                  onChange={(v) => setDraft((d) => ({ ...(d as any), floor: v }))}
                  placeholder="3"
                  disabled={busySave}
                />
              </TPField>
            </div>

            <div className="md:col-span-1">
              <TPField label="Dpto.">
                <TPInput
                  value={(draft as any).apartment}
                  onChange={(v) => setDraft((d) => ({ ...(d as any), apartment: v }))}
                  placeholder="A"
                  disabled={busySave}
                />
              </TPField>
            </div>

            <div className="md:col-span-3">
              <TPField label="Código Postal">
                <TPInput
                  value={(draft as any).postalCode}
                  onChange={(v) => setDraft((d) => ({ ...(d as any), postalCode: v }))}
                  placeholder="C1043AAZ"
                  disabled={busySave}
                />
              </TPField>
            </div>

            <div className="md:col-span-3">
              <TPField label="Ciudad">
                <TPComboCreatable
                  mode={isCreate ? "create" : "edit"}
                  type="CITY"
                  items={cityCat.items}
                  loading={cityCat.loading}
                  value={(draft as any).city}
                  onChange={(v) => setDraft((d) => ({ ...(d as any), city: v }))}
                  placeholder="Seleccionar ciudad"
                  disabled={busySave}
                  allowCreate
                  onRefresh={() => void cityCat.refresh()}
                  onCreate={async (label) => {
                    await cityCat.createItem(label);
                    setDraft((d) => ({ ...(d as any), city: label }));
                  }}
                />
              </TPField>
            </div>

            <div className="md:col-span-3">
              <TPField label="Provincia">
                <TPComboCreatable
                  mode={isCreate ? "create" : "edit"}
                  type="PROVINCE"
                  items={provCat.items}
                  loading={provCat.loading}
                  value={(draft as any).province}
                  onChange={(v) => setDraft((d) => ({ ...(d as any), province: v }))}
                  placeholder="Seleccionar provincia"
                  disabled={busySave}
                  allowCreate
                  onRefresh={() => void provCat.refresh()}
                  onCreate={async (label) => {
                    await provCat.createItem(label);
                    setDraft((d) => ({ ...(d as any), province: label }));
                  }}
                />
              </TPField>
            </div>

            <div className="md:col-span-3">
              <TPField label="País">
                <TPComboCreatable
                  mode={isCreate ? "create" : "edit"}
                  type="COUNTRY"
                  items={countryCat.items}
                  loading={countryCat.loading}
                  value={(draft as any).country}
                  onChange={(v) => setDraft((d) => ({ ...(d as any), country: v }))}
                  placeholder="Seleccionar país"
                  disabled={busySave}
                  allowCreate
                  onRefresh={() => void countryCat.refresh()}
                  onCreate={async (label) => {
                    await countryCat.createItem(label);
                    setDraft((d) => ({ ...(d as any), country: label }));
                  }}
                />
              </TPField>
            </div>
          </div>
        </div>

        {/* Notas */}
        <TPField label="Notas">
          <TPTextarea
            value={(draft as any).notes}
            onChange={(v) => setDraft((d) => ({ ...(d as any), notes: v }))}
            placeholder="Observaciones internas del almacén"
            maxLen={500}
            disabled={busySave}
          />
        </TPField>

        {/* Adjuntos */}
        <div className="rounded-2xl border border-border p-4">
          <div className="text-sm font-semibold text-text mb-3">Adjuntos</div>
          <TPAttachmentManager
            items={attachmentItems}
            onUpload={onUpload}
            uploadVariant="dropzone"
            onDelete={
              isCreate
                ? undefined
                : onDeleteAttachment
                  ? (item) => onDeleteAttachment(item.id)
                  : undefined
            }
            deletingId={deletingAttId}
            loading={uploadingAttachments}
            disabled={busySave || uploadingAttachments}
            emptyText="Todavía no hay adjuntos."
          />
          {isCreate && pendingFiles.length > 0 && (
            <p className="mt-2 text-xs text-muted">
              {pendingFiles.length} archivo(s) se subirán al guardar.
            </p>
          )}
        </div>

      </form>
    </Modal>
  );
}
