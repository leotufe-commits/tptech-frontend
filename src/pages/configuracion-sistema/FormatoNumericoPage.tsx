// src/pages/configuracion-sistema/FormatoNumericoPage.tsx
// ============================================================================
// Pantalla legacy de formato numérico — thin wrapper alrededor de la sección
// reusable `NumericFormatSection`.
//
// La página vive en el router como ruta directa (`/formato-numerico`); el
// dispatcher de Configuración del sistema en cambio dirige al contenedor
// unificado `VisualizacionFormatosPage` con tabs. Esta página sigue
// existiendo para que cualquier link viejo (favoritos, docs) siga abriendo
// la pantalla equivalente.
// ============================================================================

import React from "react";
import { Hash } from "lucide-react";
import { TPSectionShell } from "../../components/ui/TPSectionShell";
import NumericFormatSection from "./NumericFormatSection";

export default function FormatoNumericoPage() {
  return (
    <TPSectionShell
      title="Formato numérico"
      subtitle="Definí cómo se muestran los números en todo el sistema (factura, simulador, comparador, composición del costo, KPIs). Solo es visual: no cambia ningún cálculo ni lo que se guarda."
      icon={<Hash size={22} />}
    >
      <NumericFormatSection />
    </TPSectionShell>
  );
}
