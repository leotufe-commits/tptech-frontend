export function roleLabel(name: string) {
  const raw = String(name || "").trim();
  const k = raw.toUpperCase();

  const map: Record<string, string> = {
    ADMIN: "Administrador",
    OWNER: "Propietario",
    STAFF: "Empleado",
    READONLY: "Solo Lectura",
  };

  return map[k] ?? raw;
}
