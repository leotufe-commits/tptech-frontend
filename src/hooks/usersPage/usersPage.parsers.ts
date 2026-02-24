import type { TabKey } from "../../components/users/users.ui";

export function parseTabParam(v: string | null): TabKey | null {
  const s = String(v || "").trim().toUpperCase();
  if (s === "DATA") return "DATA";
  if (s === "CONFIG") return "CONFIG";
  return null;
}

export function parsePinAction(v: string | null): "create" | null {
  const s = String(v || "").trim().toLowerCase();
  if (s === "create" || s === "new" || s === "set" || s === "setup" || s === "1" || s === "true")
    return "create";
  return null;
}