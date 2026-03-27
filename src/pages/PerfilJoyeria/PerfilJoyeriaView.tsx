// src/pages/PerfilJoyeria/PerfilJoyeriaView.tsx
import React, { useCallback, useMemo, useRef } from "react";
import { Building2, Globe, Loader2, Mail, MapPin, Paperclip, Phone, Plus, Receipt, StickyNote, Tag } from "lucide-react";

import { TPSectionShell } from "../../components/ui/TPSectionShell";
import { TPInfoCard } from "../../components/ui/TPInfoCard";
import TPAttachmentList, { type TPAttachmentItem } from "../../components/ui/TPAttachmentList";

import { absUrl, valueOrDash } from "./perfilJoyeria.utils";
import type { JewelryAttachment } from "./perfilJoyeria.types";

type Props = {
  existingName: string;
  company: {
    legalName: string;
    ivaCondition: string;
    cuit: string;
    website: string;
    email: string;
    notes: string;
  };
  phone: string;
  addressLine: string;
  addressMeta: string;
  savedAttachments: JewelryAttachment[];
  onUploadAttachments?: (files: File[]) => Promise<void>;
  uploadingAttachments?: boolean;
  onDeleteAttachment?: (id: string) => Promise<void>;
  deletingAttId?: string | null;
};

export default function PerfilJoyeriaView(props: Props) {
  const { existingName, company, phone, addressLine, addressMeta, savedAttachments, onUploadAttachments, uploadingAttachments, onDeleteAttachment, deletingAttId } = props;
  const fileInputRef = useRef<HTMLInputElement>(null);

  const items: TPAttachmentItem[] = useMemo(() => {
    return (savedAttachments || []).map((a: any) => ({
      id: String(a?.id ?? ""),
      name: String(a?.filename ?? "Archivo"),
      size: typeof a?.size === "number" ? a.size : undefined,
      url: absUrl(String(a?.url ?? "")) || undefined,
      mimeType: String(a?.mimeType ?? "") || undefined,
    }));
  }, [savedAttachments]);

  const ivaLine = useMemo(() => {
    const parts = [valueOrDash(company.ivaCondition), valueOrDash(company.cuit)].filter((x) => x !== "—");
    return parts.join(" • ") || "—";
  }, [company.ivaCondition, company.cuit]);

  const openInNewTab = useCallback((url: string) => {
    try {
      window.open(url, "_blank", "noreferrer");
    } catch {}
  }, []);

  const download = useCallback((url: string) => {
    // simple y consistente: abre el link (el navegador descarga si corresponde)
    try {
      window.location.assign(url);
    } catch {
      openInNewTab(url);
    }
  }, [openInNewTab]);

  return (
    <div className="space-y-4">
      <TPSectionShell title="Datos de la empresa" icon={<Building2 className="h-4 w-4" />}>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
          <TPInfoCard icon={<Tag className="h-3.5 w-3.5" />} label="Nombre de fantasía" value={existingName} />
          <TPInfoCard icon={<Building2 className="h-3.5 w-3.5" />} label="Razón social" value={company.legalName} />

          <TPInfoCard icon={<Receipt className="h-3.5 w-3.5" />} label="Condición de IVA" value={ivaLine} />
          <TPInfoCard icon={<Phone className="h-3.5 w-3.5" />} label="Teléfono" value={phone} />

          <TPInfoCard icon={<Globe className="h-3.5 w-3.5" />} label="Sitio web" value={company.website} />
          <TPInfoCard icon={<Mail className="h-3.5 w-3.5" />} label="Correo" value={company.email} />

          <TPInfoCard icon={<MapPin className="h-3.5 w-3.5" />} label="Dirección" value={addressLine} />
          <TPInfoCard icon={<MapPin className="h-3.5 w-3.5" />} label="Detalle" value={addressMeta} />

          <div className="md:col-span-2">
            <TPInfoCard icon={<StickyNote className="h-3.5 w-3.5" />} label="Notas" value={company.notes} />
          </div>
        </div>
      </TPSectionShell>

      <TPSectionShell
        title="Adjuntos"
        icon={<Paperclip className="h-4 w-4" />}
        right={
          onUploadAttachments ? (
            <>
              <input
                ref={fileInputRef}
                type="file"
                multiple
                className="hidden"
                onChange={(e) => {
                  const files = Array.from(e.target.files || []);
                  if (files.length) onUploadAttachments(files);
                  e.target.value = "";
                }}
              />
              <button
                type="button"
                disabled={uploadingAttachments}
                onClick={() => fileInputRef.current?.click()}
                className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-1.5 text-xs font-medium text-text hover:bg-surface2 disabled:opacity-50 transition-colors"
              >
                {uploadingAttachments ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Plus className="h-3.5 w-3.5" />
                )}
                {uploadingAttachments ? "Subiendo..." : "Agregar"}
              </button>
            </>
          ) : undefined
        }
      >
        <TPAttachmentList
          items={items}
          loading={uploadingAttachments}
          deletingId={deletingAttId}
          emptyText="Todavía no hay adjuntos."
          onDownload={(it) => {
            if (!it.url) return;
            download(it.url);
          }}
          onView={(it) => {
            if (!it.url) return;
            openInNewTab(it.url);
          }}
          onDelete={onDeleteAttachment ? (it) => onDeleteAttachment(it.id) : undefined}
        />
      </TPSectionShell>
    </div>
  );
}