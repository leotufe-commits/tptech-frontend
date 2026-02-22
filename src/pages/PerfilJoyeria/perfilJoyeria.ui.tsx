// src/pages/PerfilJoyeria/perfilJoyeria.ui.tsx
import React from "react";

// ✅ Compat: dejamos estos nombres viejos apuntando a los componentes genéricos nuevos
export { TPSectionShell as SectionShell } from "../../components/ui/TPSectionShell";
export { TPInfoCard as InfoCard } from "../../components/ui/TPInfoCard";

// ❌ Field fue deprecado: la app debería usar TPField
// (Si algún archivo aún lo importa, preferimos que falle para migrarlo bien.)
export function Field(): never {
  throw new Error(
    "perfilJoyeria.ui.tsx: Field fue deprecado. Usá TPField desde src/components/ui/TPField.tsx."
  );
}