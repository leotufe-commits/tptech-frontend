// tptech-frontend/src/services/company.ts
import { apiFetch } from "../lib/api";

// ---------------------------------------------------------------------------
// Perfil básico de empresa (nombre + logo)
// ---------------------------------------------------------------------------

export type CompanyProfile = {
  name:     string;
  logoUrl:  string;
};

export async function fetchCompanyProfile(): Promise<CompanyProfile> {
  const data = await apiFetch<{ jewelry: any }>("/company/me", { method: "GET" });
  const j = data.jewelry ?? {};
  return {
    name:    j.name ?? "",
    logoUrl: j.logoUrl ?? "",
  };
}

// ---------------------------------------------------------------------------
// Perfil COMPLETO de empresa (todos los campos que el template puede mostrar
// en el header del documento: razón social, CUIT, dirección, teléfono,
// email, sitio web). Se usa al imprimir un comprobante para alimentar
// los flags del template (`headerShow*`) con datos REALES del tenant.
// ---------------------------------------------------------------------------

export type CompanyFullProfile = {
  name:         string;
  legalName:    string;
  logoUrl:      string;
  cuit:         string;
  ivaCondition: string;
  /** Dirección formateada para mostrar (calle número, ciudad, provincia). */
  addressLine:  string;
  phone:        string;
  email:        string;
  website:      string;
};

function asStr(v: unknown): string {
  return typeof v === "string" ? v : "";
}

function formatAddressLine(j: Record<string, unknown>): string {
  const parts: string[] = [];
  const street = [asStr(j.street), asStr(j.number)].filter(Boolean).join(" ").trim();
  if (street) parts.push(street);
  const floorApt = [asStr(j.floor), asStr(j.apartment)].filter(Boolean).join(" ").trim();
  if (floorApt) parts.push(floorApt);
  const city = asStr(j.city); if (city) parts.push(city);
  const province = asStr(j.province); if (province) parts.push(province);
  return parts.join(", ");
}

function formatPhoneLine(j: Record<string, unknown>): string {
  const cc = asStr(j.phoneCountry).trim();
  const num = asStr(j.phoneNumber).trim();
  if (!cc && !num) return "";
  return [cc, num].filter(Boolean).join(" ");
}

export async function fetchCompanyFullProfile(): Promise<CompanyFullProfile> {
  const data = await apiFetch<{ jewelry: Record<string, unknown> }>("/company/me", { method: "GET" });
  const j = (data.jewelry ?? {}) as Record<string, unknown>;
  const str = (v: unknown): string => typeof v === "string" ? v : "";
  return {
    name:         str(j.name),
    legalName:    str(j.legalName),
    logoUrl:      str(j.logoUrl),
    cuit:         str(j.cuit),
    ivaCondition: str(j.ivaCondition),
    addressLine:  formatAddressLine(j),
    phone:        formatPhoneLine(j),
    email:        str(j.email),
    website:      str(j.website),
  };
}

// ---------------------------------------------------------------------------
// Política de alertas de precio
// ---------------------------------------------------------------------------

export type PricingPolicyConfig = {
  pricingLowMarginWarningPercent:  number | null;
  pricingLowMarginBlockPercent:    number | null;
  pricingBlockLossSale:            boolean;
  pricingBlockZeroOrNegativePrice: boolean;
  pricingBlockPartialData:         boolean;
};

export async function fetchPricingPolicyConfig(): Promise<PricingPolicyConfig> {
  const data = await apiFetch<{ jewelry: any }>("/company/me", { method: "GET" });
  const j = data.jewelry;
  return {
    pricingLowMarginWarningPercent:  j.pricingLowMarginWarningPercent  != null ? parseFloat(j.pricingLowMarginWarningPercent)  : null,
    pricingLowMarginBlockPercent:    j.pricingLowMarginBlockPercent    != null ? parseFloat(j.pricingLowMarginBlockPercent)    : null,
    pricingBlockLossSale:            j.pricingBlockLossSale            ?? false,
    pricingBlockZeroOrNegativePrice: j.pricingBlockZeroOrNegativePrice ?? false,
    pricingBlockPartialData:         j.pricingBlockPartialData         ?? false,
  };
}

export async function updatePricingPolicyConfig(patch: Partial<PricingPolicyConfig>): Promise<PricingPolicyConfig> {
  const data = await apiFetch<{ jewelry: any }>("/company/me", { method: "PATCH", body: patch });
  const j = data.jewelry;
  return {
    pricingLowMarginWarningPercent:  j.pricingLowMarginWarningPercent  != null ? parseFloat(j.pricingLowMarginWarningPercent)  : null,
    pricingLowMarginBlockPercent:    j.pricingLowMarginBlockPercent    != null ? parseFloat(j.pricingLowMarginBlockPercent)    : null,
    pricingBlockLossSale:            j.pricingBlockLossSale            ?? false,
    pricingBlockZeroOrNegativePrice: j.pricingBlockZeroOrNegativePrice ?? false,
    pricingBlockPartialData:         j.pricingBlockPartialData         ?? false,
  };
}

// ---------------------------------------------------------------------------
// Redondeo a nivel comprobante (Etapa 1B — UNIFIED / BREAKDOWN / BOTH)
// ---------------------------------------------------------------------------

export type DocumentRoundingMode      =
  | "NONE" | "INTEGER" | "DECIMAL_1" | "DECIMAL_2" | "TEN" | "HUNDRED";
export type DocumentRoundingDirection = "NEAREST" | "UP" | "DOWN";
export type DocumentRoundingScope     = "UNIFIED" | "BREAKDOWN" | "BOTH";

// ── Etapa D2 — dominio del metal en BREAKDOWN + config física ─────────────
export type DocumentRoundingMetalDomain = "MONETARY" | "PHYSICAL";
export type PhysicalRoundingMode =
  | "NONE" | "INTEGER" | "DECIMAL_1" | "DECIMAL_2" | "HALF" | "QUARTER";
export type PhysicalRoundingDirection = "NEAREST" | "UP" | "DOWN";

export interface PhysicalMetalRoundingConfig {
  mode:      PhysicalRoundingMode;
  direction: PhysicalRoundingDirection;
}

/** Shape canónico de `Jewelry.documentPhysicalRoundingConfig`. */
export interface DocumentPhysicalRoundingConfig {
  /** Config específica por metal padre. Key = `metalParentId`. */
  byMetalParentId: Record<string, PhysicalMetalRoundingConfig>;
  /** Config aplicada cuando un metal padre no tiene entry específica. */
  fallback: PhysicalMetalRoundingConfig;
}

export type DocumentRoundingConfig = {
  /** Activa la política de redondeo a nivel comprobante. */
  documentRoundingEnabled:   boolean;
  /** Scope efectivo: UNIFIED (total final), BREAKDOWN (metal/hechura por
   *  separado), BOTH (cascada BREAKDOWN → UNIFIED). */
  documentRoundingScope:     DocumentRoundingScope;
  /** Granularidad del redondeo UNIFIED (al entero, decena, centena, etc.). */
  documentRoundingMode:      DocumentRoundingMode;
  /** Dirección del redondeo UNIFIED. */
  documentRoundingDirection: DocumentRoundingDirection;
  /** Granularidad del redondeo BREAKDOWN — componente METAL. */
  documentRoundingModeMetal:        DocumentRoundingMode;
  /** Dirección del redondeo BREAKDOWN — componente METAL. */
  documentRoundingDirectionMetal:   DocumentRoundingDirection;
  /** Granularidad del redondeo BREAKDOWN — componente HECHURA / MONETARIO. */
  documentRoundingModeHechura:      DocumentRoundingMode;
  /** Dirección del redondeo BREAKDOWN — componente HECHURA / MONETARIO. */
  documentRoundingDirectionHechura: DocumentRoundingDirection;

  /** Etapa D2 — dominio del metal en BREAKDOWN. Default MONETARY. */
  documentRoundingMetalDomain:    DocumentRoundingMetalDomain;
  /** Etapa D2 — config física por metal padre. `null` cuando el operador
   *  todavía no configuró; el runtime cae en NO_CONFIG silenciosamente. */
  documentPhysicalRoundingConfig: DocumentPhysicalRoundingConfig | null;
};

const PHYSICAL_DEFAULT: PhysicalMetalRoundingConfig = {
  mode: "NONE", direction: "NEAREST",
};

const PHYSICAL_CONFIG_DEFAULT: DocumentPhysicalRoundingConfig = {
  byMetalParentId: {},
  fallback: PHYSICAL_DEFAULT,
};

const DOC_ROUNDING_DEFAULTS: DocumentRoundingConfig = {
  documentRoundingEnabled:   false,
  documentRoundingScope:     "UNIFIED",
  documentRoundingMode:      "NONE",
  documentRoundingDirection: "NEAREST",
  documentRoundingModeMetal:        "NONE",
  documentRoundingDirectionMetal:   "NEAREST",
  documentRoundingModeHechura:      "NONE",
  documentRoundingDirectionHechura: "NEAREST",
  documentRoundingMetalDomain:    "MONETARY",
  documentPhysicalRoundingConfig: null,
};

const VALID_PHYSICAL_MODES: readonly PhysicalRoundingMode[] = [
  "NONE", "INTEGER", "DECIMAL_1", "DECIMAL_2", "HALF", "QUARTER",
];
const VALID_PHYSICAL_DIRECTIONS: readonly PhysicalRoundingDirection[] = [
  "NEAREST", "UP", "DOWN",
];

function parsePhysicalConfig(raw: any): PhysicalMetalRoundingConfig | null {
  if (!raw || typeof raw !== "object") return null;
  const mode = VALID_PHYSICAL_MODES.includes(raw.mode) ? raw.mode : null;
  const dir  = VALID_PHYSICAL_DIRECTIONS.includes(raw.direction) ? raw.direction : null;
  if (mode == null || dir == null) return null;
  return { mode, direction: dir };
}

function toPhysicalRoundingConfig(raw: any): DocumentPhysicalRoundingConfig | null {
  if (raw == null) return null;
  if (typeof raw !== "object") return null;
  const byId: Record<string, PhysicalMetalRoundingConfig> = {};
  if (raw.byMetalParentId && typeof raw.byMetalParentId === "object") {
    for (const key of Object.keys(raw.byMetalParentId)) {
      const cfg = parsePhysicalConfig((raw.byMetalParentId as any)[key]);
      if (cfg && key.trim().length > 0) byId[key] = cfg;
    }
  }
  const fallback = parsePhysicalConfig(raw.fallback) ?? PHYSICAL_DEFAULT;
  return { byMetalParentId: byId, fallback };
}

function toDocumentRoundingConfig(j: any): DocumentRoundingConfig {
  return {
    documentRoundingEnabled:   j?.documentRoundingEnabled   ?? false,
    documentRoundingScope:     (j?.documentRoundingScope     ?? "UNIFIED")  as DocumentRoundingScope,
    documentRoundingMode:      (j?.documentRoundingMode      ?? "NONE")    as DocumentRoundingMode,
    documentRoundingDirection: (j?.documentRoundingDirection ?? "NEAREST") as DocumentRoundingDirection,
    documentRoundingModeMetal:        (j?.documentRoundingModeMetal        ?? "NONE")    as DocumentRoundingMode,
    documentRoundingDirectionMetal:   (j?.documentRoundingDirectionMetal   ?? "NEAREST") as DocumentRoundingDirection,
    documentRoundingModeHechura:      (j?.documentRoundingModeHechura      ?? "NONE")    as DocumentRoundingMode,
    documentRoundingDirectionHechura: (j?.documentRoundingDirectionHechura ?? "NEAREST") as DocumentRoundingDirection,
    documentRoundingMetalDomain:    (j?.documentRoundingMetalDomain ?? "MONETARY") as DocumentRoundingMetalDomain,
    documentPhysicalRoundingConfig: toPhysicalRoundingConfig(j?.documentPhysicalRoundingConfig ?? null),
  };
}

/** Lista de metales padre del tenant (para alimentar la tabla de la UI). */
export interface MetalParentOption {
  id:   string;
  name: string;
}

/** Llama a `/api/valuation/metals` y devuelve los metales padre del tenant. */
export async function fetchMetalParents(): Promise<MetalParentOption[]> {
  const data = await apiFetch<{ metals?: Array<{ id: string; name: string }> } | Array<{ id: string; name: string }>>(
    "/valuation/metals", { method: "GET" },
  );
  const arr = Array.isArray(data) ? data : (data?.metals ?? []);
  return arr.map((m) => ({ id: m.id, name: m.name }));
}

export async function fetchDocumentRoundingConfig(): Promise<DocumentRoundingConfig> {
  const data = await apiFetch<{ jewelry: any }>("/company/me", { method: "GET" });
  return toDocumentRoundingConfig(data.jewelry ?? DOC_ROUNDING_DEFAULTS);
}

export async function updateDocumentRoundingConfig(
  patch: Partial<DocumentRoundingConfig>,
): Promise<DocumentRoundingConfig> {
  const data = await apiFetch<{ jewelry: any }>("/company/me", { method: "PATCH", body: patch });
  return toDocumentRoundingConfig(data.jewelry);
}

export type CompanySecuritySettings = {
  quickSwitchEnabled: boolean;
  pinLockEnabled: boolean;
  pinLockTimeoutSec: number;
  pinLockRequireOnUserSwitch: boolean;
};

export async function fetchCompanySecuritySettings(): Promise<CompanySecuritySettings> {
  const data = await apiFetch<{ jewelry: CompanySecuritySettings }>("/auth/me", {
    method: "GET",
    cache: "no-store",
  });
  return data.jewelry;
}

export async function updateCompanySecuritySettings(
  patch: Partial<CompanySecuritySettings>
): Promise<CompanySecuritySettings> {
  const data = await apiFetch<{ ok: boolean } & CompanySecuritySettings>(
    "/auth/company/security/pin-lock",
    {
      method: "PATCH",
      body: patch,
    }
  );
  return data;
}

export async function toggleJewelryQuickSwitch(enabled: boolean): Promise<void> {
  await apiFetch("/auth/me/jewelry/quick-switch", { method: "POST", body: { enabled } });
}

// ---------------------------------------------------------------------------
// Formato de campos
// ---------------------------------------------------------------------------

export type FieldFormatsConfig = {
  phoneFormat:    string;
  documentFormat: string;
};

export async function fetchFieldFormats(): Promise<FieldFormatsConfig> {
  const data = await apiFetch<{ jewelry: any }>("/company/me", { method: "GET" });
  return {
    phoneFormat:    data.jewelry.phoneFormat    ?? "raw",
    documentFormat: data.jewelry.documentFormat ?? "raw",
  };
}

export async function updateFieldFormats(patch: Partial<FieldFormatsConfig>): Promise<FieldFormatsConfig> {
  const data = await apiFetch<{ jewelry: any }>("/company/me", { method: "PATCH", body: patch });
  return {
    phoneFormat:    data.jewelry.phoneFormat    ?? "raw",
    documentFormat: data.jewelry.documentFormat ?? "raw",
  };
}

// ---------------------------------------------------------------------------
// Formato numérico (config visual por tenant — JSON en Jewelry.numberFormat)
// ---------------------------------------------------------------------------

import type { NumberFormatConfig } from "../lib/number-format";
import { DEFAULT_NUMBER_FORMAT_CONFIG } from "../lib/number-format";

function coerceNumberFormat(raw: any): NumberFormatConfig {
  if (
    raw && typeof raw === "object" && !Array.isArray(raw) &&
    ["AR", "US", "CUSTOM"].includes(String(raw.region))
  ) {
    return {
      region: raw.region,
      custom: {
        thousands: typeof raw.custom?.thousands === "string" ? raw.custom.thousands : DEFAULT_NUMBER_FORMAT_CONFIG.custom.thousands,
        decimal:   typeof raw.custom?.decimal   === "string" ? raw.custom.decimal   : DEFAULT_NUMBER_FORMAT_CONFIG.custom.decimal,
      },
      presets: (raw.presets && typeof raw.presets === "object" && !Array.isArray(raw.presets)) ? raw.presets : {},
    };
  }
  return DEFAULT_NUMBER_FORMAT_CONFIG;
}

export async function fetchNumberFormat(): Promise<NumberFormatConfig> {
  const data = await apiFetch<{ jewelry: any }>("/company/me", { method: "GET" });
  return coerceNumberFormat(data.jewelry?.numberFormat);
}

export async function updateNumberFormat(config: NumberFormatConfig): Promise<NumberFormatConfig> {
  const data = await apiFetch<{ jewelry: any }>("/company/me", {
    method: "PATCH",
    body: { numberFormat: config },
  });
  return coerceNumberFormat(data.jewelry?.numberFormat);
}
