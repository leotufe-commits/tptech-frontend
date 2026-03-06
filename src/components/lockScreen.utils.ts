// tptech-frontend/src/components/lockScreen.utils.ts

export type QuickUser = {
  id: string;
  email: string;
  name?: string | null;
  avatarUrl?: string | null;

  hasQuickPin?: boolean;
  pinEnabled?: boolean;

  hasPin?: boolean;

  roles?: Array<{ id?: string; name?: string }> | string[];
  roleNames?: string[];
  roleLabel?: string;
  role?: string;
  roleName?: string;
};

export function friendlyPinError(rawMsg?: string) {
  const m = String(rawMsg || "").toLowerCase();
  if (!m) return "PIN incorrecto.";
  if (m.includes("expired") || m.includes("expirad")) return "PIN incorrecto.";
  if (m.includes("invalid") || m.includes("incorrect") || m.includes("wrong")) return "PIN incorrecto.";
  if (m.includes("locked") || m.includes("bloquead")) return "Demasiados intentos. Esperá unos minutos.";
  return rawMsg || "PIN incorrecto.";
}

export function safeGet(key: string) {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

export function safeSet(key: string, value: string) {
  try {
    localStorage.setItem(key, value);
  } catch {
    // ignore
  }
}

export function prettyRoleName(raw: string): string {
  const s = String(raw || "").trim();
  if (!s) return "";

  const MAP: Record<string, string> = {
    OWNER: "Propietario",
    ADMIN: "Administrador",
    STAFF: "Empleado",
  };

  const upper = s.toUpperCase();
  if (MAP[upper]) return MAP[upper];

  if (/^[A-Z0-9_]+$/.test(s)) {
    return s
      .toLowerCase()
      .split("_")
      .filter(Boolean)
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
      .join(" ");
  }

  return s;
}

export function getUserRoleLabel(u: any): string {
  if (!u) return "";

  if (Array.isArray(u.roleNames) && u.roleNames.length) {
    const arr = u.roleNames
      .filter((x: any) => typeof x === "string" && x.trim())
      .map((x: string) => x.trim())
      .map(prettyRoleName)
      .filter(Boolean);
    if (arr.length) return arr.join(" \u2022 ");
  }

  if (Array.isArray(u.roles) && u.roles.length) {
    if (u.roles.every((x: any) => typeof x === "string")) {
      const arr = (u.roles as string[])
        .map((x) => String(x || "").trim())
        .filter(Boolean)
        .map(prettyRoleName)
        .filter(Boolean);
      if (arr.length) return arr.join(" \u2022 ");
    }

    const names = (u.roles as any[])
      .map((r) => (typeof r?.name === "string" ? r.name.trim() : ""))
      .filter(Boolean)
      .map(prettyRoleName)
      .filter(Boolean);
    if (names.length) return names.join(" \u2022 ");
  }

  if (typeof u.roleLabel === "string" && u.roleLabel.trim()) return prettyRoleName(u.roleLabel.trim());

  const direct =
    (typeof u.role === "string" ? u.role : "") ||
    (typeof u.roleName === "string" ? u.roleName : "") ||
    (typeof u?.role?.name === "string" ? u.role.name : "") ||
    "";

  return prettyRoleName(String(direct || "").trim());
}

export function normalizeQuickUser(u: any, opts?: { currentUserId?: string; currentUserRoles?: any[] }): QuickUser {
  const currentUserId = opts?.currentUserId ? String(opts.currentUserId) : "";
  const sameAsCurrent = currentUserId && String(u?.id ?? "") === currentUserId;

  const baseRoles = u?.roles;
  const baseRoleNames = Array.isArray(u?.roleNames) ? u.roleNames : undefined;

  const injectedRoles =
    sameAsCurrent &&
    (!Array.isArray(baseRoles) || baseRoles.length === 0) &&
    Array.isArray(opts?.currentUserRoles)
      ? opts!.currentUserRoles
      : baseRoles;

  const roleNames =
    Array.isArray(baseRoleNames) && baseRoleNames.length
      ? baseRoleNames
          .filter((x: any) => typeof x === "string" && x.trim())
          .map((x: string) => x.trim())
      : Array.isArray(injectedRoles)
      ? injectedRoles
          .map((r: any) => (typeof r === "string" ? r : r?.name))
          .filter((x: any) => typeof x === "string" && x.trim())
          .map((x: string) => x.trim())
      : [];

  const roleLabel =
    (typeof u?.roleLabel === "string" && u.roleLabel.trim() ? u.roleLabel.trim() : "") ||
    (roleNames.length ? roleNames.join(" \u2022 ") : "") ||
    (typeof u?.roleName === "string" ? u.roleName : "") ||
    (typeof u?.role === "string" ? u.role : "") ||
    "";

  const has = Boolean(u?.hasQuickPin ?? u?.hasPin);
  const enabled =
    typeof u?.pinEnabled === "boolean"
      ? u.pinEnabled
      : typeof u?.quickPinEnabled === "boolean"
      ? u.quickPinEnabled
      : has;

  return {
    id: String(u?.id ?? ""),
    email: String(u?.email ?? ""),
    name: u?.name ?? null,
    avatarUrl: u?.avatarUrl ?? null,

    hasQuickPin: has,
    pinEnabled: enabled,
    hasPin: Boolean(u?.hasPin),

    roles: injectedRoles,
    roleNames,
    roleLabel,
    role: u?.role,
    roleName: u?.roleName,
  };
}
