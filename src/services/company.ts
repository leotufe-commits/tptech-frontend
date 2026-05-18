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
// Redondeo a nivel comprobante (modo UNIFIED)
// ---------------------------------------------------------------------------

export type DocumentRoundingMode      =
  | "NONE" | "INTEGER" | "DECIMAL_1" | "DECIMAL_2" | "TEN" | "HUNDRED";
export type DocumentRoundingDirection = "NEAREST" | "UP" | "DOWN";

export type DocumentRoundingConfig = {
  /** Activa la política de redondeo a nivel comprobante. */
  documentRoundingEnabled:   boolean;
  /** Granularidad del redondeo (al entero, decena, centena, etc.). */
  documentRoundingMode:      DocumentRoundingMode;
  /** Dirección del redondeo. */
  documentRoundingDirection: DocumentRoundingDirection;
};

const DOC_ROUNDING_DEFAULTS: DocumentRoundingConfig = {
  documentRoundingEnabled:   false,
  documentRoundingMode:      "NONE",
  documentRoundingDirection: "NEAREST",
};

function toDocumentRoundingConfig(j: any): DocumentRoundingConfig {
  return {
    documentRoundingEnabled:   j?.documentRoundingEnabled   ?? false,
    documentRoundingMode:      (j?.documentRoundingMode      ?? "NONE")    as DocumentRoundingMode,
    documentRoundingDirection: (j?.documentRoundingDirection ?? "NEAREST") as DocumentRoundingDirection,
  };
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
