// src/pages/PerfilJoyeria/PerfilJoyeriaView.tsx
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

import { TPSectionShell } from "../../components/ui/TPSectionShell";
import { TPInfoCard } from "../../components/ui/TPInfoCard";
import TPAttachmentList, { type TPAttachmentItem } from "../../components/ui/TPAttachmentList";

import { absUrl } from "./perfilJoyeria.utils";
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

function dash(v: any) {
  const s = String(v ?? "").trim();
  return s ? s : "—";
}

export default function PerfilJoyeriaView(props: Props) {
  const {
    existingName,
    company,
    phone,
    addressLine,
    addressMeta,
    savedAttachments,
  } = props;

  const items: TPAttachmentItem[] = (savedAttachments || []).map((a: any) => ({
    id: String(a?.id ?? ""),
    name: String(a?.filename ?? "Archivo"),
    size: typeof a?.size === "number" ? a.size : undefined,
    url: absUrl(String(a?.url ?? "")) || undefined,
    mimeType: String(a?.mimeType ?? "") || undefined,
  }));

  const ivaLine =
    [dash(company.ivaCondition), dash(company.cuit)]
      .filter((x) => x !== "—")
      .join(" • ") || "—";

  return (
    <div className="space-y-4">
      <TPSectionShell
        title="Datos de la empresa"
        icon={<Building2 className="h-4 w-4" />}
      >
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
          <TPInfoCard
            icon={<Building2 className="h-3.5 w-3.5" />}
            label="Razón social"
            value={company.legalName}
          />
          <TPInfoCard
            icon={<Tag className="h-3.5 w-3.5" />}
            label="Nombre de fantasía"
            value={existingName}
          />

          <TPInfoCard
            icon={<Receipt className="h-3.5 w-3.5" />}
            label="Condición de IVA"
            value={ivaLine}
          />
          <TPInfoCard
            icon={<Phone className="h-3.5 w-3.5" />}
            label="Teléfono"
            value={phone}
          />

          <TPInfoCard
            icon={<Globe className="h-3.5 w-3.5" />}
            label="Sitio web"
            value={company.website}
          />
          <TPInfoCard
            icon={<Mail className="h-3.5 w-3.5" />}
            label="Correo"
            value={company.email}
          />
        </div>
      </TPSectionShell>

      <TPSectionShell
        title="Domicilio"
        icon={<MapPin className="h-4 w-4" />}
      >
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <TPInfoCard
            icon={<MapPin className="h-3.5 w-3.5" />}
            label="Dirección"
            value={addressLine}
          />
          <TPInfoCard
            icon={<MapPin className="h-3.5 w-3.5" />}
            label="Detalle"
            value={addressMeta}
          />
        </div>
      </TPSectionShell>

      <TPSectionShell
        title="Notas"
        icon={<StickyNote className="h-4 w-4" />}
      >
        <TPInfoCard
          icon={<StickyNote className="h-3.5 w-3.5" />}
          label="Notas"
          value={company.notes}
        />
      </TPSectionShell>

      <TPSectionShell
        title="Adjuntos"
        icon={<Paperclip className="h-4 w-4" />}
      >
        <TPAttachmentList
          items={items}
          emptyText="Todavía no hay adjuntos."
          onDownload={(it) => {
            if (!it.url) return;
            window.location.href = it.url;
          }}
          onView={(it) => {
            if (!it.url) return;
            window.open(it.url, "_blank", "noreferrer");
          }}
        />

        <div className="mt-3 text-[11px] text-muted">
          * Esta vista es <b>solo lectura</b>. Para subir/eliminar adjuntos, usá{" "}
          <b>Editar</b>.
        </div>
      </TPSectionShell>
    </div>
  );
}