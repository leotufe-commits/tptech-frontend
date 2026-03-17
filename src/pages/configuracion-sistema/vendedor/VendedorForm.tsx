import React, { useMemo, useState } from "react";

import TPInput from "../../../components/ui/TPInput";
import { TPField } from "../../../components/ui/TPField";
import TPComboCreatable from "../../../components/ui/TPComboCreatable";
import TPComboCreatableMulti from "../../../components/ui/TPComboCreatableMulti";
import { useCatalog } from "../../../hooks/useCatalog";
import type { CatalogType } from "../../../services/catalogs";
import TPTextarea from "../../../components/ui/TPTextarea";
import TPComboFixed from "../../../components/ui/TPComboFixed";
import TPNumberInput from "../../../components/ui/TPNumberInput";
import { TPCard } from "../../../components/ui/TPCard";
import TPAvatarUploader from "../../../components/ui/TPAvatarUploader";
import type { TPAttachmentItem } from "../../../components/ui/TPAttachmentList";
import TPAttachmentManager from "../../../components/ui/TPAttachmentManager";
import { TPButton } from "../../../components/ui/TPButton";

import type {
  SellerRow,
  CommissionBase,
  CommissionType,
} from "../../../services/sellers";
import type { UserListItem } from "../../../services/users";

import type { SellerDraft, WarehouseOption } from "./vendedor.types";
import { attachmentToTP } from "./vendedor.helpers";
import { useValuation } from "../../../hooks/useValuation";

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
  users: UserListItem[];
  usedUserIds: string[];
  busyAvatar: boolean;
  onAvatarUpload: (file: File) => void;
  onApplyUserAvatar: (url: string) => void;
  deletingAttachmentId: string | null;
  onAddAttachment: (file: File) => void;
  onDeleteAttachment: (item: TPAttachmentItem) => void;
  stagedFiles: File[];
  onStagedFilesChange: (files: File[]) => void;
  firstInputRef: React.RefObject<HTMLInputElement | null>;
}

function applyFields(
  user: UserListItem,
  draft: SellerDraft,
  set: <K extends keyof SellerDraft>(key: K, value: SellerDraft[K]) => void,
  overwrite: boolean
) {
  const fill = <K extends keyof SellerDraft>(
    key: K,
    value: SellerDraft[K] | undefined
  ) => {
    if (!value) return;
    if (!overwrite && String(draft[key] ?? "").trim()) return;
    set(key, value);
  };

  fill("firstName", user.firstName as any);
  fill("lastName", user.lastName as any);
  fill("email", user.email as any);

  const fullName = user.name || [user.firstName, user.lastName].filter(Boolean).join(" ");
  fill("displayName", fullName as any);

  fill("documentType", user.documentType as any);
  fill("documentNumber", user.documentNumber as any);
  fill("phoneCountry", user.phoneCountry as any);
  fill("phoneNumber", user.phoneNumber as any);
  fill("street", user.street as any);
  fill("streetNumber", user.number as any);
  fill("city", user.city as any);
  fill("province", user.province as any);
  fill("postalCode", user.postalCode as any);
  fill("country", user.country as any);
}

function hasConflict(user: UserListItem, draft: SellerDraft): boolean {
  const pairs: [string | undefined, string][] = [
    [user.firstName, draft.firstName],
    [user.lastName, draft.lastName],
    [user.email, draft.email],
    [user.documentType, draft.documentType],
    [user.documentNumber, draft.documentNumber],
    [user.phoneCountry, draft.phoneCountry],
    [user.phoneNumber, draft.phoneNumber],
    [user.street, draft.street],
    [user.number, draft.streetNumber],
    [user.city, draft.city],
    [user.province, draft.province],
    [user.postalCode, draft.postalCode],
    [user.country, draft.country],
  ];
  return pairs.some(([uVal, dVal]) => {
    const u = uVal?.trim() || "";
    const d = dVal?.trim() || "";
    return u && d && u !== d;
  });
}

export function VendedorForm({
  draft,
  set,
  toggleWarehouse,
  submitted,
  busySave,
  editTarget,
  warehouses,
  users,
  usedUserIds,
  busyAvatar,
  onAvatarUpload,
  onApplyUserAvatar,
  deletingAttachmentId,
  onAddAttachment,
  onDeleteAttachment,
  stagedFiles,
  onStagedFilesChange,
  firstInputRef,
}: Props) {
  const [pendingUser, setPendingUser] = useState<UserListItem | null>(null);

  const { baseCurrency } = useValuation();
  const currencySymbol = (baseCurrency as any)?.symbol || "$";

  const userOptions = useMemo(() => {
    // usedUserIds ya excluye el userId del vendedor que se está editando
    const usedSet = new Set(usedUserIds);
    const opts = users.map((u) => {
      const alreadyUsed = usedSet.has(u.id);
      const name = [u.firstName, u.lastName].filter(Boolean).join(" ");
      return {
        value: u.id,
        label: alreadyUsed
          ? `${name || u.email} (ya vinculado)`
          : name
            ? `${name} (${u.email})`
            : u.email,
        disabled: alreadyUsed,
      };
    });
    return [{ value: "", label: "Sin usuario vinculado" }, ...opts];
  }, [users, usedUserIds]);

  const docTypeCat = useCatalog(asCatalogType("DOCUMENT_TYPE"));
  const prefixCat = useCatalog(asCatalogType("PHONE_PREFIX"));
  const cityCat = useCatalog(asCatalogType("CITY"));
  const provCat = useCatalog(asCatalogType("PROVINCE"));
  const countryCat = useCatalog(asCatalogType("COUNTRY"));

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

  const warehouseMultiItems = useMemo(
    () =>
      warehouses.map((wh) => ({
        id: wh.id,
        label: wh.isActive ? wh.name : `${wh.name} (inactivo)`,
        value: wh.id,
        isActive: true,
        isFavorite: false,
      })),
    [warehouses]
  );

  function handleUserChange(v: string) {
    const uid = v || null;
    set("userId", uid);

    if (!uid) return;

    const user = users.find((u) => u.id === uid);
    if (!user) return;

    if (hasConflict(user, draft)) {
      setPendingUser(user);
      return;
    }

    applyFields(user, draft, set, false);
    if (user.avatarUrl) onApplyUserAvatar(user.avatarUrl);
  }

  function handleApplyOverwrite() {
    if (!pendingUser) return;
    applyFields(pendingUser, draft, set, true);
    if (pendingUser.avatarUrl) onApplyUserAvatar(pendingUser.avatarUrl);
    setPendingUser(null);
  }

  function handleApplyEmptyOnly() {
    if (!pendingUser) return;
    applyFields(pendingUser, draft, set, false);
    if (pendingUser.avatarUrl && !editTarget?.avatarUrl) onApplyUserAvatar(pendingUser.avatarUrl);
    setPendingUser(null);
  }

  return (
    <div className="space-y-4">
      {/* Diálogo de confirmación */}
      {pendingUser && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center">
          <div
            className="absolute inset-0 bg-black/50"
            onClick={() => setPendingUser(null)}
          />
          <div className="relative z-10 w-[92vw] max-w-md rounded-2xl border border-border bg-card p-5 shadow-soft">
            <div className="text-base font-semibold text-text mb-1">
              El vendedor ya tiene datos cargados
            </div>
            <div className="text-sm text-muted mb-4">
              ¿Querés sobreescribir todos los campos con los datos de{" "}
              <b>
                {[pendingUser.firstName, pendingUser.lastName]
                  .filter(Boolean)
                  .join(" ") || pendingUser.email}
              </b>
              , o solo completar los que están vacíos?
            </div>
            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <TPButton
                variant="secondary"
                onClick={() => setPendingUser(null)}
              >
                Cancelar
              </TPButton>
              <TPButton
                variant="secondary"
                onClick={handleApplyEmptyOnly}
              >
                Solo completar vacíos
              </TPButton>
              <TPButton
                variant="primary"
                onClick={handleApplyOverwrite}
              >
                Sobreescribir todo
              </TPButton>
            </div>
          </div>
        </div>
      )}

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

      {!editTarget && (
        <TPCard className="p-4 space-y-4">
          <div className="text-sm font-semibold">Acceso al sistema</div>
          <TPField
            label="Usuario vinculado"
            hint="Opcional. Permite que este vendedor opere en el sistema con su cuenta."
          >
            <TPComboFixed
              value={draft.userId ?? ""}
              onChange={handleUserChange}
              disabled={busySave}
              options={userOptions}
            />
          </TPField>
        </TPCard>
      )}

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
          <div className="md:col-span-2">
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

          <div className="md:col-span-4">
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
              value={draft.phoneCountry}
              onChange={(v) => set("phoneCountry", v)}
              placeholder="+54"
              disabled={busySave}
              allowCreate
              onRefresh={() => void prefixCat.refresh()}
              onCreate={async (label) => {
                await prefixCat.createItem(label);
                set("phoneCountry", label);
              }}
              mode={editTarget ? "edit" : "create"}
            />
          </div>

          <div className="md:col-span-4">
            <TPInput
              label="Teléfono"
              value={draft.phoneNumber}
              onChange={(v) => set("phoneNumber", v)}
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
                suffix={draft.commissionType === "PERCENTAGE" ? "%" : undefined}
                leftIcon={draft.commissionType === "FIXED_AMOUNT" ? <span className="text-sm font-semibold">{currencySymbol}</span> : undefined}
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
        <div className="text-sm font-semibold">Almacenes asignados</div>

        {warehouses.length === 0 ? (
          <div className="text-sm italic text-muted">No hay almacenes disponibles.</div>
        ) : (
          <TPComboCreatableMulti
            label="Almacenes"
            type="CITY"
            items={warehouseMultiItems}
            values={draft.warehouseIds}
            onChange={(ids) => set("warehouseIds", ids)}
            placeholder="Seleccionar almacenes..."
            disabled={busySave}
            mode={editTarget ? "edit" : "create"}
            noLabelSpace
          />
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
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
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
        </div>
      </TPCard>

      <TPCard className="p-4 space-y-3">
        <div className="text-sm font-semibold">Notas</div>
        <TPTextarea
          value={draft.notes}
          onChange={(v) => set("notes", v)}
          minH={80}
          disabled={busySave}
          placeholder="Observaciones internas..."
        />
      </TPCard>

      <TPCard className="p-4 space-y-3">
        <div className="text-sm font-semibold">Archivos adjuntos</div>

        {editTarget ? (
          <TPAttachmentManager
            items={(editTarget.attachments ?? []).map(attachmentToTP)}
            onUpload={(files) => { for (const f of files) onAddAttachment(f); }}
            onDelete={onDeleteAttachment}
            deletingId={deletingAttachmentId}
            disabled={busySave}
          />
        ) : (
          <TPAttachmentManager
            items={stagedFiles.map((f, i) => ({
              id: `staged-${i}`,
              name: f.name,
              size: f.size,
              mimeType: f.type,
            }))}
            onUpload={(files) => onStagedFilesChange([...stagedFiles, ...files])}
            onDelete={(item) => {
              const idx = parseInt(item.id.replace("staged-", ""), 10);
              onStagedFilesChange(stagedFiles.filter((_, i) => i !== idx));
            }}
            disabled={busySave}
          />
        )}
      </TPCard>
    </div>
  );
}
