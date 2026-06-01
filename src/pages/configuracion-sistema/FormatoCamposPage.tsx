// src/pages/configuracion-sistema/FormatoCamposPage.tsx
// ============================================================================
// Pantalla legacy de formato de campos — thin wrapper alrededor de la sección
// reusable `FieldFormatsSection`.
//
// La página vive en el router como ruta directa (`/formato-campos`); el
// dispatcher de Configuración del sistema en cambio dirige al contenedor
// unificado `VisualizacionFormatosPage` con tabs. Esta página sigue
// existiendo para que cualquier link viejo (favoritos, docs) siga abriendo
// la pantalla equivalente.
// ============================================================================

import React from "react";
import { Sliders } from "lucide-react";
import { TPSectionShell } from "../../components/ui/TPSectionShell";
import FieldFormatsSection from "./FieldFormatsSection";

export default function FormatoCamposPage() {
  return (
    <TPSectionShell
      title="Formato de campos"
      subtitle="Definí cómo se muestran teléfonos y documentos en los listados y fichas del sistema. No afecta el valor guardado."
      icon={<Sliders size={22} />}
    >
      <FieldFormatsSection />
    </TPSectionShell>
  );
}
