// tptech-frontend/src/services/company.ts
import { apiFetch } from "../lib/api";

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
