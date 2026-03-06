// tptech-frontend/src/pages/configuracion-sistema/catalogs.config.ts
import type { CatalogItem, CatalogType } from "../../services/catalogs";

/* =========================
   Types
========================= */
export type CatalogGroup = "Ubicaciones" | "Fiscal";

export type Catalog = {
  key: CatalogType;
  title: string;
  desc: string;
  group: CatalogGroup;
  icon: React.ReactNode;
};

export type RowStatus = "Activo" | "Inactivo";

export type Row = {
  id: string;
  label: string;
  status: RowStatus;
  sortOrder: number;
  updatedAt?: string;
  favorite?: boolean;
};

export type SortCol = "LABEL" | "STATUS";
export type SortDir = "asc" | "desc";

/* =========================
   Helpers: hints dinámicos por catálogo
========================= */
export function catalogHints(key: CatalogType) {
  switch (key) {
    case "IVA_CONDITION":
      return {
        modalSubtitle: "Definí una condición impositiva para usar en facturación y perfiles.",
        nameLabel: "Condición",
        namePlaceholder: "Ej: Responsable Inscripto",
        nameHint: "Se verá en el sistema como opción del combo.",
        statusHint: "Desactivá para ocultar la opción sin borrar historial.",
      };

    case "PHONE_PREFIX":
      return {
        modalSubtitle: "Definí un prefijo para teléfonos.",
        nameLabel: "Prefijo",
        namePlaceholder: "Ej: +54",
        nameHint: "Recomendado: incluye el "+".",
        statusHint: "Desactivá para ocultarlo del selector.",
      };

    case "COUNTRY":
      return {
        modalSubtitle: "Definí un país para direcciones y datos fiscales.",
        nameLabel: "País",
        namePlaceholder: "Ej: Argentina",
        nameHint: "Nombre visible en el combo de país.",
        statusHint: "Desactivá para ocultarlo del selector.",
      };

    case "PROVINCE":
      return {
        modalSubtitle: "Definí una provincia/estado para direcciones.",
        nameLabel: "Provincia / Estado",
        namePlaceholder: "Ej: Buenos Aires",
        nameHint: "Nombre visible en el combo de provincia/estado.",
        statusHint: "Desactivá para ocultarla del selector.",
      };

    case "CITY":
      return {
        modalSubtitle: "Definí una ciudad/localidad para direcciones y contacto.",
        nameLabel: "Ciudad / Localidad",
        namePlaceholder: "Ej: La Plata",
        nameHint: "Nombre visible en el combo de ciudad.",
        statusHint: "Desactivá para ocultarla del selector.",
      };

    case "DOCUMENT_TYPE":
      return {
        modalSubtitle: "Definí tipos de documento para usuarios/clientes.",
        nameLabel: "Tipo de documento",
        namePlaceholder: "Ej: DNI",
        nameHint: "Nombre visible en el combo.",
        statusHint: "Desactivá para ocultarlo del selector.",
      };

    default:
      return {
        modalSubtitle: "Completá los campos y guardá.",
        nameLabel: "Nombre",
        namePlaceholder: "Ej: Nombre",
        nameHint: "Nombre visible en el sistema.",
        statusHint: "Podés desactivar sin borrar.",
      };
  }
}

/* =========================
   Sort helpers
========================= */
export function norm(s: any) {
  return String(s ?? "").trim().toLowerCase();
}

export function statusRank(s: RowStatus) {
  return s === "Activo" ? 0 : 1;
}

export function itemToRow(it: CatalogItem): Row {
  return {
    id: it.id,
    label: it.label,
    status: it.isActive ? "Activo" : "Inactivo",
    sortOrder: it.sortOrder ?? 0,
    updatedAt: it.updatedAt,
    favorite: Boolean((it as any).isFavorite),
  };
}
