// tptech-frontend/src/pages/configuracion-sistema/catalogs.config.ts
import type { CatalogItem, CatalogType } from "../../services/catalogs";

/* =========================
   Types
========================= */
export type CatalogGroup = "Ubicaciones" | "Fiscal" | "Comercial" | "Artículos";

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
  isSystem?: boolean;
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

    case "PAYMENT_TERM":
      return {
        modalSubtitle: "Definí un plazo o condición de pago para usar en clientes y proveedores.",
        nameLabel: "Término de pago",
        namePlaceholder: "Ej: Contado, 30 días, 60 días neto",
        nameHint: "Nombre visible en el combo de término de pago.",
        statusHint: "Desactivá para ocultarlo del selector.",
      };

    case "ARTICLE_BRAND":
      return {
        modalSubtitle: "Definí marcas para clasificar artículos del catálogo.",
        nameLabel: "Marca",
        namePlaceholder: "Ej: Pandora, Swarovski, Genérica",
        nameHint: "Nombre visible en el campo Marca del artículo.",
        statusHint: "Desactivá para ocultarla sin borrar el historial.",
      };

    case "ARTICLE_MANUFACTURER":
      return {
        modalSubtitle: "Definí fabricantes o proveedores de fabricación para los artículos.",
        nameLabel: "Fabricante",
        namePlaceholder: "Ej: Fabricación propia, Importado, Tercero",
        nameHint: "Nombre visible en el campo Fabricante del artículo.",
        statusHint: "Desactivá para ocultarlo sin borrar el historial.",
      };

    case "UNIT_OF_MEASURE":
      return {
        modalSubtitle: "Definí unidades de medida para los artículos del catálogo.",
        nameLabel: "Unidad",
        namePlaceholder: "Ej: UND, KG, GR, MT, PAR",
        nameHint: "Nombre corto visible en el campo Unidad de medida del artículo.",
        statusHint: "Desactivá para ocultarla del selector.",
      };

    case "MULTIPLIER_BASE":
      return {
        modalSubtitle: "Definí bases de cálculo para el modo multiplicador (gramos, kilates, unidades, etc.).",
        nameLabel: "Base",
        namePlaceholder: "Ej: Gramos, Kilates, Unidades",
        nameHint: "Nombre visible en el combo de base del multiplicador.",
        statusHint: "Desactivá para ocultarla del selector.",
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
    isSystem: it.isSystem,
  };
}
