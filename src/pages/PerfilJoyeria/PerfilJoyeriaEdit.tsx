// src/pages/PerfilJoyeria/PerfilJoyeriaEdit.tsx
import React, { useCallback, useEffect, useMemo, useRef } from "react";

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

  setExistingField: <K extends keyof ExistingBody>(key: K, value: ExistingBody[K]) => void;
  setCompanyField: <K extends keyof CompanyBody>(key: K, value: CompanyBody[K]) => void;

  catIva: CatalogItem[];
  catPrefix: CatalogItem[];
  catCity: CatalogItem[];
  catProvince: CatalogItem[];
  catCountry: CatalogItem[];
  catLoading: Record<string, boolean>;
  ensureCatalog: (type: CatalogType, force?: boolean) => Promise<void>;
  createAndRefresh: (type: CatalogType, label: string) => Promise<void>;

  attInputRef: React.RefObject<HTMLInputElement>;
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
      style={{ color: "color-mix(in oklab, var(--muted) 70%, var(--text))" }}
    >
      {props.children}
    </div>
  );
}

function hasAnyOpenAriaModal() {
  try {
    return Boolean(document.querySelector('[role="dialog"][aria-modal="true"]'));
  } catch {
    return false;
  }
}

const cardStyle: React.CSSProperties = {
  border: "1px solid var(--border)",
  background: "var(--card)",
  boxShadow: "var(--shadow)",
};

const boxStyle: React.CSSProperties = {
  border: "1px solid var(--border)",
};

export default function PerfilJoyeriaEdit(p: Props) {
  const catLoading = p.catLoading ?? {};

  const busyAttachments = p.readonly || p.uploadingAttachments || Boolean(p.deletingAttId);
  const hasSaved = (p.savedAttachments || []).length > 0;

  const openInNewTab = useCallback((url: string) => {
    try {
      window.open(url, "_blank", "noreferrer");
    } catch {}
  }, []);

  const downloadFile = useCallback(
    async (url: string, filename?: string) => {
      const safeName = String(filename || "archivo").trim() || "archivo";
      try {
        const res = await fetch(url, { credentials: "include" });
        const blob = await res.blob();
        const blobUrl = URL.createObjectURL(blob);

        const a = document.createElement("a");
        a.href = blobUrl;
        a.download = safeName;
        document.body.appendChild(a);
        a.click();
        a.remove();

        window.setTimeout(() => URL.revokeObjectURL(blobUrl), 10_000);
      } catch {
        openInNewTab(url);
      }
    },
    [openInNewTab]
  );

  const attachmentItems: TPAttachmentItem[] = useMemo(() => {
    return (p.savedAttachments || []).map((a: any) => ({
      id: String(a?.id ?? ""),
      name: String(a?.filename ?? a?.name ?? "Archivo"),
      size: typeof a?.size === "number" ? a.size : undefined,
      url: absUrl(String(a?.url ?? "")) || undefined,
      mimeType: String(a?.mimeType ?? a?.mimetype ?? a?.type ?? "") || undefined,
    }));
  }, [p.savedAttachments]);

  // ✅ TAB horizontal
  let t = 1;

  const disabledProps = useMemo(
    () => ({
      readOnly: p.readonly,
      disabled: p.readonly,
    }),
    [p.readonly]
  );

  const comboProps = useCallback(
    (type: CatalogType, items: CatalogItem[]) => {
      return {
        mode: "edit" as const,
        type,
        items,
        loading: !!catLoading?.[String(type)],
        onRefresh: () => p.ensureCatalog(type),
        allowCreate: p.allowCreate,
        onCreate: (label: string) => p.createAndRefresh(type, label),
        disabled: p.readonly,
      };
    },
    [catLoading, p.ensureCatalog, p.allowCreate, p.createAndRefresh, p.readonly]
  );

  // ✅ Autofocus al primer campo (tabIndex 1) sin robar foco si hay modal arriba
  const rootRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (p.readonly) return;

    const id = window.setTimeout(() => {
      if (hasAnyOpenAriaModal()) return;

      const el = rootRef.current;
      if (!el) return;

      const target = el.querySelector('[tabindex="1"]') as HTMLElement | null;
      if (!target) return;

      try {
        target.focus();
      } catch {}
    }, 0);

    return () => window.clearTimeout(id);
  }, [p.readonly]);

  return (
    <div ref={rootRef} className="rounded-2xl p-4 sm:p-6" style={cardStyle}>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-12">
        {/* 1. Nombre de Fantasía */}
        <div className="sm:col-span-6">
          <TPField label="Nombre de Fantasía" required>
            <TPInput
              tabIndex={t++}
              value={p.existing.name}
              onChange={(v) => p.setExistingField("name", v)}
              {...disabledProps}
            />
          </TPField>
        </div>

        {/* 2. Razón social */}
        <div className="sm:col-span-6">
          <TPField label="Razón social">
            <TPInput
              tabIndex={t++}
              value={p.company.legalName}
              onChange={(v) => p.setCompanyField("legalName", v)}
              {...disabledProps}
            />
          </TPField>
        </div>

        {/* 3. Condición de IVA · CUIT · Prefijo · Teléfono */}
        <div className="sm:col-span-3">
          <TPField label="Condición de IVA">
            <TPComboCreatable
              tabIndex={t++}
              {...comboProps("IVA_CONDITION", p.catIva)}
              value={p.company.ivaCondition}
              onChange={(v) => p.setCompanyField("ivaCondition", v)}
            />
          </TPField>
        </div>

        <div className="sm:col-span-3">
          <TPField label="CUIT">
            <TPInput
              tabIndex={t++}
              value={p.company.cuit}
              onChange={(v) => p.setCompanyField("cuit", v)}
              onlyDigits
              {...disabledProps}
            />
          </TPField>
        </div>

        <div className="sm:col-span-2">
          <TPField label="Prefijo">
            <TPComboCreatable
              tabIndex={t++}
              {...comboProps("PHONE_PREFIX", p.catPrefix)}
              value={p.existing.phoneCountry}
              onChange={(v) => p.setExistingField("phoneCountry", v)}
            />
          </TPField>
        </div>

        <div className="sm:col-span-4">
          <TPField label="Teléfono">
            <TPInput
              tabIndex={t++}
              value={p.existing.phoneNumber}
              onChange={(v) => p.setExistingField("phoneNumber", v)}
              {...disabledProps}
            />
          </TPField>
        </div>

        {/* 4. Sitio web */}
        <div className="sm:col-span-6">
          <TPField label="Sitio web">
            <TPInput
              tabIndex={t++}
              value={p.company.website}
              onChange={(v) => p.setCompanyField("website", v)}
              {...disabledProps}
            />
          </TPField>
        </div>

        {/* 5. Correo electrónico */}
        <div className="sm:col-span-6">
          <TPField label="Correo electrónico">
            <TPInput
              tabIndex={t++}
              value={p.company.email}
              onChange={(v) => p.setCompanyField("email", v)}
              {...disabledProps}
            />
          </TPField>
        </div>
      </div>

      {/* =========================
          DOMICILIO
      ========================= */}
      <div className="mt-6 rounded-2xl p-4 sm:p-5" style={boxStyle}>
        <div className="font-semibold text-sm mb-4">Domicilio</div>

        <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
          <div className="md:col-span-8">
            <TPField label="Calle">
              <TPInput
                tabIndex={t++}
                value={p.existing.street}
                onChange={(v) => p.setExistingField("street", v)}
                {...disabledProps}
              />
            </TPField>
          </div>

          <div className="md:col-span-2">
            <TPField label="Número">
              <TPInput
                tabIndex={t++}
                value={p.existing.number}
                onChange={(v) => p.setExistingField("number", v)}
                {...disabledProps}
              />
            </TPField>
          </div>

          <div className="md:col-span-1">
            <TPField label="Piso">
              <TPInput
                tabIndex={t++}
                value={p.existing.floor}
                onChange={(v) => p.setExistingField("floor", v)}
                placeholder="3"
                {...disabledProps}
              />
            </TPField>
          </div>

          <div className="md:col-span-1">
            <TPField label="Dpto.">
              <TPInput
                tabIndex={t++}
                value={p.existing.apartment}
                onChange={(v) => p.setExistingField("apartment", v)}
                placeholder="A"
                {...disabledProps}
              />
            </TPField>
          </div>

          <div className="md:col-span-3">
            <TPField label="Código Postal">
              <TPInput
                tabIndex={t++}
                value={p.existing.postalCode}
                onChange={(v) => p.setExistingField("postalCode", v)}
                {...disabledProps}
              />
            </TPField>
          </div>

          <div className="md:col-span-3">
            <TPField label="Ciudad">
              <TPComboCreatable
                tabIndex={t++}
                {...comboProps("CITY", p.catCity)}
                value={p.existing.city}
                onChange={(v) => p.setExistingField("city", v)}
              />
            </TPField>
          </div>

          <div className="md:col-span-3">
            <TPField label="Provincia">
              <TPComboCreatable
                tabIndex={t++}
                {...comboProps("PROVINCE", p.catProvince)}
                value={p.existing.province}
                onChange={(v) => p.setExistingField("province", v)}
              />
            </TPField>
          </div>

          <div className="md:col-span-3">
            <TPField label="País">
              <TPComboCreatable
                tabIndex={t++}
                {...comboProps("COUNTRY", p.catCountry)}
                value={p.existing.country}
                onChange={(v) => p.setExistingField("country", v)}
              />
            </TPField>
          </div>
        </div>
      </div>

      {/* =========================
          NOTAS + ADJUNTOS
      ========================= */}
      <div className="mt-6 grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="rounded-2xl p-4 sm:p-5" style={boxStyle}>
          <div className="font-semibold text-sm mb-3">Notas</div>

          <TPTextarea
            tabIndex={t++}
            value={p.company.notes}
            onChange={(v) => p.setCompanyField("notes", v)}
            readOnly={p.readonly}
            disabled={p.readonly}
            className="min-h-[160px]"
          />

          <HelpText className="mt-2">Podés dejar aclaraciones internas sobre la empresa.</HelpText>
        </div>

        <div className="rounded-2xl p-4 sm:p-5" style={boxStyle}>
          <div className="font-semibold text-sm mb-3">Adjuntos</div>

          <div className="space-y-3">
            <TPDropzone
              tabIndex={t++}
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