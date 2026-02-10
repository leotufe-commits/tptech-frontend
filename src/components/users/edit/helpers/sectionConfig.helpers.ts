// tptech-frontend/src/components/users/edit/helpers/sectionConfig.helpers.ts

// ===============================
// VALIDACIONES PIN
// ===============================
export function isValidPinDraft(p1: string, p2: string) {
  const a = String(p1 || "").trim();
  const b = String(p2 || "").trim();

  if (!a || !b) return false;
  if (a !== b) return false;

  return /^\d{4}$/.test(a);
}

export function isPin4(v: string) {
  return /^\d{4}$/.test(String(v || "").trim());
}

export function only4Digits(v: string) {
  return String(v || "").replace(/\D/g, "").slice(0, 4);
}

// ===============================
// ASYNC UI HELPERS
// ===============================
export function nextTick() {
  return new Promise<void>((resolve) => queueMicrotask(resolve));
}
