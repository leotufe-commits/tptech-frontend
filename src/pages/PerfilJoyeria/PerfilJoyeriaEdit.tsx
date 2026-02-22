// src/pages/PerfilJoyeria/PerfilJoyeriaEdit.tsx
import React from "react";

import TPComboCreatable from "../../components/ui/TPComboCreatable";
import TPInput from "../../components/ui/TPInput";
import TPTextarea from "../../components/ui/TPTextarea";
import TPDropzone from "../../components/ui/TPDropzone";
import TPAttachmentList, { type TPAttachmentItem } from "../../components/ui/TPAttachmentList";
import { TPField } from "../../components/ui/TPField";

import { absUrl, cn } from "./perfilJoyeria.utils";

import type { CatalogItem, CatalogType } from "../../services/catalogs";
import type { ExistingBody, CompanyBody, JewelryAttachment } from "./perfilJoyeria.types";

type Props = {
  existing: ExistingBody;
  company: CompanyBody;
  readonly: boolean;

  allowCreate: boolean;

  // setters
  setExistingField: <K extends keyof ExistingBody>(key: K, value: ExistingBody[K]) => void;
  setCompanyField: <K extends keyof CompanyBody>(key: K, value: CompanyBody[K]) => void;

  // catalogs
  catIva: CatalogItem[];
  catPrefix: CatalogItem[];
  catCity: CatalogItem[];
  catProvince: CatalogItem[];
  catCountry: CatalogItem[];
  catLoading: Record<string, boolean>;
  ensureCatalog: (type: CatalogType, force?: boolean) => Promise<void>;
  createAndRefresh: (type: CatalogType, label: string) => Promise<void>;

  // attachments
  attInputRef: React.RefObject<HTMLInputElement>; // (ya no se usa acá, lo dejamos por compat)
  uploadingAttachments: boolean;
  deletingAttId: string | null;
  uploadAttachmentsInstant: (files: File[]) => Promise<void>;
  deleteSavedAttachment: (id: string) => Promise<void>;
  savedAttachments: JewelryAttachment[];
};

function HelpText(props: { className?: string; children: React.ReactNode }) {
  return (
    <div
      className={cn("text-[11px] leading-snug", props.className)}
      style={{
        color: "color-mix(in oklab, var(--muted) 70%, var(--text))",
      }}
    >
      {props.children}
    </div>
  );
}

export default function PerfilJoyeriaEdit(p: Props) {
  const busyAttachments = p.readonly || p.uploadingAttachments || Boolean(p.deletingAttId);
  const hasSaved = (p.savedAttachments || []).length > 0;

  function openInNewTab(url: string) {
    try {
      window.open(url, "_blank", "noreferrer");
    } catch {
      // no-op
    }
  }

  async function downloadFile(url: string, filename?: string) {
    const safeName = String(filename || "archivo").trim() || "archivo";

    try {
      const res = await fetch(url, { credentials: "include" });
      if (!res.ok) throw new Error("HTTP " + res.status);

      const blob = await res.blob();
      const blobUrl = URL.createObjectURL(blob);

      const a = document.createElement("a");
      a.href = blobUrl;
      a.download = safeName;
      document.body.appendChild(a);
      a.click();
      a.remove();

      setTimeout(() => URL.revokeObjectURL(blobUrl), 10_000);
    } catch {
      openInNewTab(url);
    }
  }

  const attachmentItems: TPAttachmentItem[] = (p.savedAttachments || []).map((a: any) => ({
    id: String(a?.id ?? ""),
    name: String(a?.filename ?? a?.name ?? "Archivo"),
    size: typeof a?.size === "number" ? a.size : undefined,
    url: absUrl(String(a?.url ?? "")) || undefined,
    mimeType: String(a?.mimeType ?? a?.mimetype ?? a?.type ?? "") || undefined,
  }));

  return (
    <div
      className="rounded-2xl p-4 sm:p-6"
      style={{
        border: "1px solid var(--border)",
        background: "var(--card)",
        boxShadow: "var(--shadow)",
      }}
    >
      {/* COLUMNAS */}
      <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
        {/* IZQUIERDA */}
        <div className="space-y-4">
          <TPField label="Razón social">
            <TPInput
              value={p.company.legalName}
              onChange={(v) => p.setCompanyField("legalName", v)}
              readOnly={p.readonly}
              disabled={p.readonly}
            />
          </TPField>

          <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
            <div className="sm:col-span-5">
              <TPField label="Condición de IVA">
                <TPComboCreatable
                  mode="edit"
                  type="IVA_CONDITION"
                  items={p.catIva}
                  loading={!!p.catLoading["IVA_CONDITION"]}
                  onRefresh={() => p.ensureCatalog("IVA_CONDITION")}
                  value={p.company.ivaCondition}
                  onChange={(v) => p.setCompanyField("ivaCondition", v)}
                  allowCreate={p.allowCreate}
                  onCreate={(label) => p.createAndRefresh("IVA_CONDITION", label)}
                  disabled={p.readonly}
                  placeholder="Condición de IVA…"
                />
              </TPField>
            </div>

            <div className="sm:col-span-7">
              <TPField label="CUIT">
                <TPInput
                  value={p.company.cuit}
                  onChange={(v) => p.setCompanyField("cuit", v)}
                  onlyDigits
                  readOnly={p.readonly}
                  disabled={p.readonly}
                />
              </TPField>
            </div>
          </div>

          <TPField label="Sitio web">
            <TPInput
              value={p.company.website}
              onChange={(v) => p.setCompanyField("website", v)}
              readOnly={p.readonly}
              disabled={p.readonly}
            />
          </TPField>
        </div>

        {/* DERECHA */}
        <div className="space-y-4">
          <TPField label="Nombre de Fantasía">
            <TPInput
              value={p.existing.name}
              onChange={(v) => p.setExistingField("name", v)}
              readOnly={p.readonly}
              disabled={p.readonly}
            />
          </TPField>

          <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
            <div className="sm:col-span-4">
              <TPField label="Prefijo">
                <TPComboCreatable
                  mode="edit"
                  type="PHONE_PREFIX"
                  items={p.catPrefix}
                  loading={!!p.catLoading["PHONE_PREFIX"]}
                  onRefresh={() => p.ensureCatalog("PHONE_PREFIX")}
                  value={p.existing.phoneCountry}
                  onChange={(v) => p.setExistingField("phoneCountry", v)}
                  allowCreate={p.allowCreate}
                  onCreate={(label) => p.createAndRefresh("PHONE_PREFIX", label)}
                  disabled={p.readonly}
                  placeholder="Ej: AR +54"
                />
              </TPField>
            </div>

            <div className="sm:col-span-8">
              <TPField label="Teléfono">
                <TPInput
                  value={p.existing.phoneNumber}
                  onChange={(v) => p.setExistingField("phoneNumber", v)}
                  readOnly={p.readonly}
                  disabled={p.readonly}
                />
              </TPField>
            </div>
          </div>

          <TPField label="Correo electrónico">
            <TPInput
              value={p.company.email}
              onChange={(v) => p.setCompanyField("email", v)}
              readOnly={p.readonly}
              disabled={p.readonly}
            />
          </TPField>
        </div>
      </div>

      {/* DOMICILIO */}
      <div className="mt-6 rounded-2xl p-4 sm:p-5" style={{ border: "1px solid var(--border)" }}>
        <div className="font-semibold text-sm mb-4">Domicilio</div>

        <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
          <div className="md:col-span-5">
            <TPField label="Calle">
              <TPInput
                value={p.existing.street}
                onChange={(v) => p.setExistingField("street", v)}
                readOnly={p.readonly}
                disabled={p.readonly}
              />
            </TPField>
          </div>

          <div className="md:col-span-2">
            <TPField label="Número">
              <TPInput
                value={p.existing.number}
                onChange={(v) => p.setExistingField("number", v)}
                readOnly={p.readonly}
                disabled={p.readonly}
              />
            </TPField>
          </div>

          <div className="md:col-span-5">
            <TPField label="Ciudad">
              <TPComboCreatable
                mode="edit"
                type="CITY"
                items={p.catCity}
                loading={!!p.catLoading["CITY"]}
                onRefresh={() => p.ensureCatalog("CITY")}
                value={p.existing.city}
                onChange={(v) => p.setExistingField("city", v)}
                allowCreate={p.allowCreate}
                onCreate={(label) => p.createAndRefresh("CITY", label)}
                disabled={p.readonly}
                placeholder="Ciudad"
              />
            </TPField>
          </div>

          <div className="md:col-span-4">
            <TPField label="Provincia">
              <TPComboCreatable
                mode="edit"
                type="PROVINCE"
                items={p.catProvince}
                loading={!!p.catLoading["PROVINCE"]}
                onRefresh={() => p.ensureCatalog("PROVINCE")}
                value={p.existing.province}
                onChange={(v) => p.setExistingField("province", v)}
                allowCreate={p.allowCreate}
                onCreate={(label) => p.createAndRefresh("PROVINCE", label)}
                disabled={p.readonly}
                placeholder="Provincia"
              />
            </TPField>
          </div>

          <div className="md:col-span-3">
            <TPField label="Código Postal">
              <TPInput
                value={p.existing.postalCode}
                onChange={(v) => p.setExistingField("postalCode", v)}
                readOnly={p.readonly}
                disabled={p.readonly}
              />
            </TPField>
          </div>

          <div className="md:col-span-5">
            <TPField label="País">
              <TPComboCreatable
                mode="edit"
                type="COUNTRY"
                items={p.catCountry}
                loading={!!p.catLoading["COUNTRY"]}
                onRefresh={() => p.ensureCatalog("COUNTRY")}
                value={p.existing.country}
                onChange={(v) => p.setExistingField("country", v)}
                allowCreate={p.allowCreate}
                onCreate={(label) => p.createAndRefresh("COUNTRY", label)}
                disabled={p.readonly}
                placeholder="País"
              />
            </TPField>
          </div>
        </div>
      </div>

      {/* NOTAS + ADJUNTOS */}
      <div className="mt-6 grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="rounded-2xl p-4 sm:p-5" style={{ border: "1px solid var(--border)" }}>
          <div className="font-semibold text-sm mb-3">Notas</div>

          <TPTextarea
            value={p.company.notes}
            onChange={(v) => p.setCompanyField("notes", v)}
            readOnly={p.readonly}
            disabled={p.readonly}
            className="min-h-[160px]"
          />

          <HelpText className="mt-2">Podés dejar aclaraciones internas sobre la empresa.</HelpText>
        </div>

        <div className="rounded-2xl p-4 sm:p-5" style={{ border: "1px solid var(--border)" }}>
          <div className="font-semibold text-sm mb-3">Adjuntos</div>

          <div className="space-y-3">
            <TPDropzone
              multiple
              disabled={busyAttachments}
              loading={p.uploadingAttachments}
              title="Click para agregar archivos +"
              subtitle="También podés arrastrar y soltar acá"
              onFiles={async (files) => {
                if (busyAttachments) return;
                await p.uploadAttachmentsInstant(files);
              }}
            />

            <HelpText>Podés agregar o eliminar adjuntos cuando quieras.</HelpText>

            {hasSaved ? (
              <TPAttachmentList
                items={attachmentItems}
                loading={p.uploadingAttachments}
                deletingId={p.deletingAttId}
                onView={(it) => it.url && openInNewTab(it.url)}
                onDownload={(it) => it.url && downloadFile(it.url, it.name)}
                onDelete={(it) => it.id && p.deleteSavedAttachment(it.id)}
                emptyText="Todavía no hay adjuntos."
              />
            ) : (
              !p.uploadingAttachments && <HelpText>Todavía no hay adjuntos.</HelpText>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}