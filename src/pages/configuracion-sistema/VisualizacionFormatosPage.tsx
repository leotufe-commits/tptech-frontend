// src/pages/configuracion-sistema/VisualizacionFormatosPage.tsx
// ============================================================================
// Pantalla unificada "Visualización y formatos" — tabs Números/Campos.
//
// Reemplaza la navegación fragmentada entre /formato-numerico y
// /formato-campos por un único entry-point con tabs:
//
//   ┌─────────────────────────────────────────────────────────────┐
//   │  Visualización y formatos                                   │
//   │  Cómo TPTech muestra y formatea la información              │
//   │                                                              │
//   │  [ Números ] [ Campos ]                                     │
//   │                                                              │
//   │  ┌───────────────────────────┐  ┌────────────────────────┐ │
//   │  │ Tab activo (Numérico /    │  │ Vista previa global    │ │
//   │  │ Campos) — sección         │  │ — moneda, gramos,      │ │
//   │  │ reusable, sin shell.      │  │ porcentaje, documento, │ │
//   │  │                            │  │ teléfono. Se actualiza │ │
//   │  │                            │  │ en vivo al guardar.    │ │
//   │  └───────────────────────────┘  └────────────────────────┘ │
//   └─────────────────────────────────────────────────────────────┘
//
// La tab activa se sincroniza con el query param `?tab=numeros|campos`
// para deep-linking — el dispatcher de Configuración del sistema usa
// estos URLs para que cada sub-chip abra su tab correspondiente.
//
// Las rutas legacy /formato-numerico y /formato-campos redirigen acá
// (ver router.tsx). El backend NO se toca: cada sección sigue
// haciendo su propio fetch/save independiente. Pricing-engine intacto.
// ============================================================================

import React, { useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import { Eye } from "lucide-react";
import { TPSectionShell } from "../../components/ui/TPSectionShell";
import { TPCard } from "../../components/ui/TPCard";
import TPTabs from "../../components/ui/TPTabs";
import NumericFormatSection from "./NumericFormatSection";
import FieldFormatsSection from "./FieldFormatsSection";
import { useNumberFormat } from "../../context/NumberFormatContext";
import { useFieldFormats } from "../../context/FieldFormatsContext";

type TabValue = "numeros" | "campos";

const TAB_OPTIONS: Array<{ value: TabValue; label: string }> = [
  { value: "numeros", label: "Números" },
  { value: "campos",  label: "Campos"  },
];

const VALID_TABS = new Set<TabValue>(["numeros", "campos"]);

function normalizeTab(raw: string | null): TabValue {
  if (raw && VALID_TABS.has(raw as TabValue)) return raw as TabValue;
  return "numeros";
}

/** Bloque de vista previa global — siempre visible junto a la sección
 *  activa. Lee los contextos globales (`useNumberFormat`/`useFieldFormats`)
 *  → se actualiza automáticamente cuando el operador guarda cualquiera de
 *  las dos tabs (la sección llama `reload()` tras guardar).
 *
 *  IMPORTANTE — los formatos visuales se obtienen siempre de los helpers
 *  centrales config-aware del tenant. Cero `toFixed/toLocaleString`
 *  (respeta los guards de formato global). */
function GlobalPreviewCard(): React.ReactElement {
  const { fmt } = useNumberFormat();
  const { fmtDoc, fmtPhone } = useFieldFormats();

  const items = useMemo(
    () => [
      { label: "Moneda",           value: fmt(1234567.89, "MONEY") },
      { label: "Gramos",           value: `${fmt(12.55, "METAL_GRAMS")} g` },
      { label: "Porcentaje",       value: `${fmt(15.25, "PERCENT")} %` },
      { label: "Cantidad",         value: fmt(125, "QUANTITY") },
      { label: "Tipo de cambio",   value: fmt(1250.123456, "FX_RATE") },
      { label: "Documento (CUIT)", value: fmtDoc("20290396728") || "20290396728" },
      { label: "Documento (DNI)",  value: fmtDoc("29039672")    || "29039672"    },
      { label: "Teléfono",         value: fmtPhone("+54", "1112345678") || "1112345678" },
    ],
    [fmt, fmtDoc, fmtPhone],
  );

  return (
    <TPCard title="Vista previa global">
      <p className="text-xs text-muted leading-relaxed mb-3">
        Cómo se verá la información en facturas, listados y reportes con la
        configuración actual.
      </p>
      <ul className="space-y-1.5">
        {items.map(({ label, value }) => (
          <li
            key={label}
            className="grid grid-cols-[auto_1fr] items-baseline gap-3 py-1 border-b border-border/40 last:border-0"
          >
            <span className="text-xs text-muted">{label}</span>
            <span className="text-sm font-mono text-text tabular-nums text-right truncate">
              {value || "—"}
            </span>
          </li>
        ))}
      </ul>
    </TPCard>
  );
}

export default function VisualizacionFormatosPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab = normalizeTab(searchParams.get("tab"));

  function changeTab(next: string) {
    if (!VALID_TABS.has(next as TabValue)) return;
    // `replace: true` para que el cambio de tab no acumule entradas en el
    // history del browser (al volver atrás esperamos volver a Configuración,
    // no rebotar entre tabs).
    setSearchParams({ tab: next }, { replace: true });
  }

  return (
    <TPSectionShell
      title="Visualización y formatos"
      subtitle="Cómo TPTech muestra y formatea la información en todo el sistema. Los cambios son solo visuales; no afectan cálculos ni lo que se guarda en la base."
      icon={<Eye size={22} />}
    >
      <div className="space-y-5">
        {/* Tabs — pill-style, alineadas a la izquierda. */}
        <TPTabs
          options={TAB_OPTIONS}
          value={activeTab}
          onChange={changeTab}
        />

        {/* Grid: sección editora (izq) + preview global (der).
            En mobile/tablet apilamos. */}
        <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_320px] items-start">
          <div className="min-w-0">
            {activeTab === "numeros" && <NumericFormatSection />}
            {activeTab === "campos"  && <FieldFormatsSection />}
          </div>

          {/* Preview sticky en desktop para que siempre esté visible
              mientras el operador toca decimales/separadores/máscaras. */}
          <aside className="lg:sticky lg:top-4">
            <GlobalPreviewCard />
          </aside>
        </div>
      </div>
    </TPSectionShell>
  );
}
