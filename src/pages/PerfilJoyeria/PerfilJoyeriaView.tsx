// src/pages/perfilJoyeria/PerfilJoyeriaView.tsx
import React from "react";
import {
  Building2,
  Globe,
  Mail,
  MapPin,
  Paperclip,
  Phone,
  Receipt,
  StickyNote,
  Tag,
} from "lucide-react";

import { SectionShell, InfoCard } from "./perfilJoyeria.ui";
import { absUrl, cardBase, cn, formatBytes, safeFileLabel, valueOrDash } from "./perfilJoyeria.utils";

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
};

export default function PerfilJoyeriaView(props: Props) {
  const { existingName, company, phone, addressLine, addressMeta, savedAttachments } = props;

  function downloadUrl(attId: string) {
    const id = String(attId || "").trim();
    if (!id) return "";
    return absUrl(`/company/attachments/${encodeURIComponent(id)}/download`);
  }

  return (
    <div className="space-y-4">
      <SectionShell title="Datos de la empresa" icon={<Building2 className="h-4 w-4" />}>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
          <InfoCard icon={<Building2 className="h-3.5 w-3.5" />} label="Razón social" value={company.legalName} />
          <InfoCard icon={<Tag className="h-3.5 w-3.5" />} label="Nombre de fantasía" value={existingName} />

          <InfoCard
            icon={<Receipt className="h-3.5 w-3.5" />}
            label="Condición de IVA"
            value={`${valueOrDash(company.ivaCondition)} • ${valueOrDash(company.cuit)}`}
          />

          <InfoCard icon={<Phone className="h-3.5 w-3.5" />} label="Teléfono" value={phone} />

          <InfoCard icon={<Globe className="h-3.5 w-3.5" />} label="Sitio web" value={company.website} />
          <InfoCard icon={<Mail className="h-3.5 w-3.5" />} label="Correo" value={company.email} />
        </div>
      </SectionShell>

      <SectionShell title="Domicilio" icon={<MapPin className="h-4 w-4" />}>
        <div className={cn(cardBase("p-3"))}>
          <div className="text-xs text-muted mb-1 flex items-center gap-2">
            <MapPin className="h-3.5 w-3.5" />
            Dirección
          </div>
          <div className="font-semibold whitespace-pre-wrap break-words">{valueOrDash(addressLine)}</div>
          <div className="mt-1 text-xs text-muted whitespace-pre-wrap break-words">{valueOrDash(addressMeta)}</div>
        </div>
      </SectionShell>

      <SectionShell title="Notas" icon={<StickyNote className="h-4 w-4" />}>
        <div className={cn(cardBase("p-3"))}>
          <div className="text-xs text-muted mb-1">Notas</div>
          <div className="font-semibold whitespace-pre-wrap break-words">
            {String(company.notes || "").trim() || "—"}
          </div>
        </div>
      </SectionShell>

      <SectionShell title="Adjuntos" icon={<Paperclip className="h-4 w-4" />}>
        {savedAttachments.length === 0 ? (
          <div className="text-sm text-muted">Todavía no hay adjuntos.</div>
        ) : (
          <div className="divide-y divide-border rounded-xl border border-border overflow-hidden">
            {savedAttachments.map((a) => {
              const fname = safeFileLabel(a.filename);
              const meta = [formatBytes(a.size), String(a.mimeType || "")].filter(Boolean).join(" • ");
              const url = downloadUrl(a.id);

              return (
                <div key={a.id} className="p-3 flex items-center justify-between gap-3 bg-card">
                  <div className="min-w-0">
                    <div className="text-sm font-semibold truncate">{fname}</div>
                    <div className="text-xs text-muted truncate">{meta || "Archivo"}</div>
                  </div>

                  {url ? (
                    <a href={url} className={cn("tp-btn", "shrink-0")} title="Descargar">
                      Descargar
                    </a>
                  ) : null}
                </div>
              );
            })}
          </div>
        )}

        <div className="mt-3 text-[11px] text-muted">
          * Esta vista es <b>solo lectura</b>. Para subir/eliminar adjuntos, usá <b>Editar</b>.
        </div>
      </SectionShell>
    </div>
  );
}
