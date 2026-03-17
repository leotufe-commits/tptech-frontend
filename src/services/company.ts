// tptech-frontend/src/services/company.ts
import { apiFetch } from "../lib/api";

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
