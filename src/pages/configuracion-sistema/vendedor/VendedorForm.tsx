import React, { useRef } from "react";
import { Paperclip } from "lucide-react";

import TPInput from "../../../components/ui/TPInput";
import { TPField } from "../../../components/ui/TPField";
import TPComboCreatable from "../../../components/ui/TPComboCreatable";
import { useCatalog } from "../../../hooks/useCatalog";
import type { CatalogType } from "../../../services/catalogs";
import { TPCheckbox } from "../../../components/ui/TPCheckbox";
import TPTextarea from "../../../components/ui/TPTextarea";
import TPComboFixed from "../../../components/ui/TPComboFixed";
import TPNumberInput from "../../../components/ui/TPNumberInput";
import { TPCard } from "../../../components/ui/TPCard";
import TPAvatarUploader from "../../../components/ui/TPAvatarUploader";
import {
  TPAttachmentList,
  type TPAttachmentItem,
} from "../../../components/ui/TPAttachmentList";

import type {
  SellerRow,
  CommissionBase,
  CommissionType,
} from "../../../services/sellers";

import type { SellerDraft, WarehouseOption } from "./vendedor.types";
import { attachmentToTP } from "./vendedor.helpers";

function asCatalogType(t: CatalogType): CatalogType {
  return t;
}

interface Props {
  draft: SellerDraft;
  set: <K extends keyof SellerDraft>(key: K, value: SellerDraft[K]) => void;
  toggleWarehouse: (id: string) => void;
  submitted: boolean;
  busySave: boolean;
  editTarget: SellerRow | null;
  warehouses: WarehouseOption[];
  busyAvatar: boolean;
  onAvatarUpload: (file: File) => void;
  deletingAttachmentId: string | null;
  onAddAttachment: (file: File) => void;
  onDeleteAttachment: (item: TPAttachmentItem) => void;
  firstInputRef: React.RefObject<HTMLInputElement | null>;
}

export function VendedorForm({
  draft,
  set,
  toggleWarehouse,
  submitted,
  busySave,
  editTarget,
  warehouses,
  busyAvatar,
  onAvatarUpload,
  deletingAttachmentId,
  onAddAttachment,
  onDeleteAttachment,
  firstInputRef,
}: Props) {
  const docTypeCat = useCatalog(asCatalogType("DOCUMENT_TYPE"));
  const prefixCat = useCatalog(asCatalogType("PHONE_PREFIX"));
  const cityCat = useCatalog(asCatalogType("CITY"));
  const provCat = useCatalog(asCatalogType("PROVINCE"));
  const countryCat = useCatalog(asCatalogType("COUNTRY"));

  const attachmentInputRef = useRef<HTMLInputElement>(null);

  const firstNameError =
    submitted && !draft.firstName.trim()
      ? "El nombre es obligatorio."
      : null;

  const lastNameError =
    submitted && !draft.lastName.trim()
      ? "El apellido es obligatorio."
      : null;

  const commissionValueError =
    submitted &&
    draft.commissionType !== "NONE" &&
    (draft.commissionValue === null || draft.commissionValue <= 0)
      ? "El valor debe ser mayor a 0."
      : null;

  const phoneParts = String(draft.phone || "")
    .trim()
    .split(/\s+/)
    .filter(Boolean);

  const phoneCountry = phoneParts[0]?.startsWith("+") ? phoneParts[0] : "";
  const phoneNumber = phoneCountry
    ? phoneParts.slice(1).join(" ")
    : phoneParts.join(" ");

  function setPhoneCountry(v: string) {
    const next = [v.trim(), phoneNumber].filter(Boolean).join(" ").trim();
    set("phone", next);
  }

  function setPhoneNumber(v: string) {
    const next = [phoneCountry, v.trim()].filter(Boolean).join(" ").trim();
    set("phone", next);
  }

  return (
    <div className="space-y-4">
      <TPCard className="p-4">
        <div className="flex items-center gap-4">
          <TPAvatarUploader
            src={editTarget?.avatarUrl || null}
            name={draft.displayName || draft.firstName}
            size={64}
            rounded="xl"
            loading={busyAvatar}
            disabled={busySave}
            onUpload={onAvatarUpload}
          />

          <div>
            <div className="text-sm font-semibold">Imagen de perfil</div>
            <div className="text-xs text-muted">
              {editTarget
                ? "Elegí una nueva imagen para actualizar."
                : "Podrás agregar una imagen después de crear el vendedor."}
            </div>
          </div>
        </div>
      </TPCard>

      <TPCard className="p-4 space-y-4">
        <div className="text-sm font-semibold">Datos personales</div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <TPField label="Nombre *" error={firstNameError}>
            <TPInput
              inputRef={firstInputRef}
              value={draft.firstName}
              onChange={(v) => set("firstName", v)}
              placeholder="Ej: Juan"
              disabled={busySave}
            />
          </TPField>

          <TPField label="Apellido *" error={lastNameError}>
            <TPInput
              value={draft.lastName}
              onChange={(v) => set("lastName", v)}
              placeholder="Ej: Pérez"
              disabled={busySave}
            />
          </TPField>
        </div>

        <TPField label="Nombre para mostrar" hint="Por defecto: Nombre + Apellido">
          <TPInput
            value={draft.displayName}
            onChange={(v) => set("displayName", v)}
            placeholder="Ej: Juan Pérez"
            disabled={busySave}
          />
        </TPField>

        <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
          <div className="md:col-span-3">
            <TPComboCreatable
              label="Tipo doc."
              type="DOCUMENT_TYPE"
              items={docTypeCat.items}
              loading={docTypeCat.loading}
              value={draft.documentType}
              onChange={(v) => set("documentType", v)}
              placeholder="DNI / PAS / CUIT"
              disabled={busySave}
              allowCreate
              onRefresh={() => void docTypeCat.refresh()}
              onCreate={async (label) => {
                await docTypeCat.createItem(label);
                set("documentType", label);
              }}
              mode={editTarget ? "edit" : "create"}
            />
          </div>

          <div className="md:col-span-3">
            <TPInput
              label="Nro. doc."
              value={draft.documentNumber}
              onChange={(v) => set("documentNumber", v)}
              placeholder="12345678"
              disabled={busySave}
            />
          </div>

          <div className="md:col-span-2">
            <TPComboCreatable
              label="Tel. país"
              type="PHONE_PREFIX"
              items={prefixCat.items}
              loading={prefixCat.loading}
              value={phoneCountry}
              onChange={setPhoneCountry}
              placeholder="+54"
              disabled={busySave}
              allowCreate
              onRefresh={() => void prefixCat.refresh()}
              onCreate={async (label) => {
                await prefixCat.createItem(label);
                setPhoneCountry(label);
              }}
              mode={editTarget ? "edit" : "create"}
            />
          </div>

          <div className="md:col-span-4">
            <TPInput
              label="Teléfono"
              value={phoneNumber}
              onChange={setPhoneNumber}
              placeholder="11 1234 5678"
              disabled={busySave}
            />
          </div>
        </div>

        <TPField label="Email">
          <TPInput
            value={draft.email}
            onChange={(v) => set("email", v)}
            placeholder="juan@email.com"
            disabled={busySave}
          />
        </TPField>

        <div>
          <div className="text-sm font-semibold mb-3">Domicilio</div>

          <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
            <div className="md:col-span-5">
              <TPInput
                label="Calle"
                value={draft.street}
                onChange={(v) => set("street", v)}
                disabled={busySave}
              />
            </div>

            <div className="md:col-span-2">
              <TPInput
                label="Número"
                value={draft.streetNumber}
                onChange={(v) => set("streetNumber", v)}
                disabled={busySave}
              />
            </div>

            <div className="md:col-span-5">
              <TPComboCreatable
                label="Ciudad"
                type="CITY"
                items={cityCat.items}
                loading={cityCat.loading}
                value={draft.city}
                onChange={(v) => set("city", v)}
                allowCreate
                onCreate={async (label) => {
                  await cityCat.createItem(label);
                  set("city", label);
                }}
                mode={editTarget ? "edit" : "create"}
                disabled={busySave}
              />
            </div>

            <div className="md:col-span-4">
              <TPComboCreatable
                label="Provincia"
                type="PROVINCE"
                items={provCat.items}
                loading={provCat.loading}
                value={draft.province}
                onChange={(v) => set("province", v)}
                allowCreate
                onCreate={async (label) => {
                  await provCat.createItem(label);
                  set("province", label);
                }}
                mode={editTarget ? "edit" : "create"}
                disabled={busySave}
              />
            </div>

            <div className="md:col-span-4">
              <TPInput
                label="Código postal"
                value={draft.postalCode}
                onChange={(v) => set("postalCode", v)}
                disabled={busySave}
              />
            </div>

            <div className="md:col-span-4">
              <TPComboCreatable
                label="País"
                type="COUNTRY"
                items={countryCat.items}
                loading={countryCat.loading}
                value={draft.country}
                onChange={(v) => set("country", v)}
                allowCreate
                onCreate={async (label) => {
                  await countryCat.createItem(label);
                  set("country", label);
                }}
                mode={editTarget ? "edit" : "create"}
                disabled={busySave}
              />
            </div>
          </div>
        </div>
      </TPCard>

      <TPCard className="p-4 space-y-4">
        <div className="text-sm font-semibold">Comisión</div>

        <TPField label="Tipo de comisión">
          <TPComboFixed
            value={draft.commissionType}
            onChange={(v) => set("commissionType", v as CommissionType)}
            disabled={busySave}
            options={[
              { value: "NONE", label: "Sin comisión" },
              { value: "PERCENTAGE", label: "Porcentaje (%)" },
              { value: "FIXED_AMOUNT", label: "Monto fijo ($)" },
            ]}
          />
        </TPField>

        {draft.commissionType !== "NONE" && (
          <>
            <TPField
              label={draft.commissionType === "PERCENTAGE" ? "Porcentaje *" : "Monto fijo *"}
              error={commissionValueError}
            >
              <TPNumberInput
                value={draft.commissionValue}
                onChange={(v) => set("commissionValue", v)}
                decimals={2}
                min={0}
                disabled={busySave}
              />
            </TPField>

            <TPField label="Base de cálculo">
              <TPComboFixed
                value={draft.commissionBase}
                onChange={(v) => set("commissionBase", v as CommissionBase)}
                disabled={busySave}
                options={[
                  { value: "GROSS", label: "Venta bruta" },
                  { value: "NET", label: "Venta neta (sin impuestos)" },
                  { value: "MARGIN", label: "Ganancia" },
                ]}
              />
            </TPField>
          </>
        )}
      </TPCard>

      <TPCard className="p-4 space-y-4">
        <div className="text-sm font-semibold">Persona de contacto</div>

        <TPField label="Nombre">
          <TPInput
            value={draft.contactName}
            onChange={(v) => set("contactName", v)}
            placeholder="Ej: María García"
            disabled={busySave}
          />
        </TPField>

        <TPField label="Teléfono">
          <TPInput
            value={draft.contactPhone}
            onChange={(v) => set("contactPhone", v)}
            placeholder="Ej: +54 11 1234 5678"
            disabled={busySave}
          />
        </TPField>

        <TPField label="Email">
          <TPInput
            value={draft.contactEmail}
            onChange={(v) => set("contactEmail", v)}
            placeholder="contacto@email.com"
            disabled={busySave}
          />
        </TPField>
      </TPCard>

      <TPCard className="p-4">
        <div className="text-sm font-semibold mb-3">Almacenes asignados</div>

        {warehouses.length === 0 ? (
          <div className="text-sm italic text-muted">No hay almacenes disponibles.</div>
        ) : (
          <div className="space-y-2 max-h-44 overflow-y-auto">
            {warehouses.map((wh) => (
              <TPCheckbox
                key={wh.id}
                checked={draft.warehouseIds.includes(wh.id)}
                onChange={() => toggleWarehouse(wh.id)}
                disabled={busySave}
                label={
                  <span className="text-sm text-text">
                    {wh.name}
                    {!wh.isActive && (
                      <span className="ml-1 text-xs text-muted">(inactivo)</span>
                    )}
                  </span>
                }
              />
            ))}
          </div>
        )}
      </TPCard>

      {editTarget && (
        <TPCard className="p-4">
          <div className="flex justify-between items-center mb-3">
            <div className="text-sm font-semibold">Archivos adjuntos</div>

            <button
              type="button"
              onClick={() => attachmentInputRef.current?.click()}
              className="text-xs text-primary flex items-center gap-1"
            >
              <Paperclip size={13} />
              Agregar
            </button>
          </div>

          <input
            ref={attachmentInputRef}
            type="file"
            hidden
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void onAddAttachment(f);
              e.currentTarget.value = "";
            }}
          />

          <TPAttachmentList
            items={(editTarget.attachments ?? []).map(attachmentToTP)}
            deletingId={deletingAttachmentId}
            onView={(item) => item.url && window.open(item.url, "_blank")}
            onDelete={onDeleteAttachment}
          />
        </TPCard>
      )}

      {editTarget && (
        <TPCard className="p-4 space-y-3">
          <div className="text-sm font-semibold">General</div>

          <TPCheckbox
            checked={draft.isFavorite}
            onChange={(v) => set("isFavorite", v)}
            disabled={busySave}
            label="Marcar como favorito"
          />

          <TPCheckbox
            checked={draft.isActive}
            onChange={(v) => set("isActive", v)}
            disabled={busySave}
            label="Vendedor activo"
          />

          <TPTextarea
            label="Notas"
            value={draft.notes}
            onChange={(v) => set("notes", v)}
            minH={80}
            disabled={busySave}
          />
        </TPCard>
      )}
    </div>
  );
}