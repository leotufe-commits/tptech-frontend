// tptech-frontend/src/services/company.ts
import { apiFetch } from "../lib/api";

export type CompanySecuritySettings = {
  quickSwitchEnabled: boolean;
  pinLockEnabled: boolean;
  pinLockTimeoutSec: number;
  pinLockRequireOnUserSwitch: boolean;
};

export async function fetchCompanySecuritySettings(): Promise<CompanySecuritySettings> {
  const data = await apiFetch<{ security: CompanySecuritySettings }>("/company/settings/security", {
    method: "GET",
  });
  return data.security;
}

export async function updateCompanySecuritySettings(
  patch: Partial<CompanySecuritySettings>
): Promise<CompanySecuritySettings> {
  const data = await apiFetch<{ ok: boolean; security: CompanySecuritySettings }>(
    "/company/settings/security",
    {
      method: "PATCH",
      body: patch,
    }
  );
  return data.security;
}
