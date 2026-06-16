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

import React, { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Eye } from "lucide-react";
import { TPSectionShell } from "../../components/ui/TPSectionShell";
import { TPCard } from "../../components/ui/TPCard";
import { TPButton } from "../../components/ui/TPButton";
import { toast } from "../../lib/toast";
import NumericFormatSection, { type NumericFormatSectionHandle } from "./NumericFormatSection";
import FieldFormatsSection, { type FieldFormatsSectionHandle } from "./FieldFormatsSection";
import { useNumberFormat } from "../../context/NumberFormatContext";
import { useFieldFormats } from "../../context/FieldFormatsContext";

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

  // Agrupación VISUAL de los previews (espeja las tabs Números/Campos). Mismos
  // valores, mismos helpers config-aware — solo mejora la jerarquía.
  const numberItems = useMemo(
    () => [
      { label: "Moneda",         value: fmt(1234567.89, "MONEY") },
      { label: "Gramos",         value: `${fmt(12.55, "METAL_GRAMS")} g` },
      { label: "Porcentaje",     value: `${fmt(15.25, "PERCENT")} %` },
      { label: "Cantidad",       value: fmt(125, "QUANTITY") },
      { label: "Tipo de cambio", value: fmt(1250.123456, "FX_RATE") },
    ],
    [fmt],
  );

  const fieldItems = useMemo(
    () => [
      { label: "Documento (CUIT)", value: fmtDoc("20290396728") || "20290396728" },
      { label: "Documento (DNI)",  value: fmtDoc("29039672")    || "29039672"    },
      { label: "Teléfono",         value: fmtPhone("+54", "1112345678") || "1112345678" },
    ],
    [fmtDoc, fmtPhone],
  );

  const renderGroup = (title: string, items: Array<{ label: string; value: string }>) => (
    <div>
      <div className="text-[11px] font-semibold uppercase tracking-wide text-muted mb-1.5">
        {title}
      </div>
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
    </div>
  );

  return (
    <TPCard title="Vista previa global">
      <p className="text-xs text-muted leading-relaxed mb-3">
        Cómo se verá la información en facturas, listados y reportes con la
        configuración actual.
      </p>
      <div className="space-y-4">
        {renderGroup("Números", numberItems)}
        {renderGroup("Campos", fieldItems)}
      </div>
    </TPCard>
  );
}

export default function VisualizacionFormatosPage() {
  const [searchParams] = useSearchParams();
  const numRef = useRef<NumericFormatSectionHandle>(null);
  const fieldRef = useRef<FieldFormatsSectionHandle>(null);
  const [saving, setSaving] = useState(false);

  // Compatibilidad ?tab=numeros|campos → ahora hace scroll suave al bloque
  // correspondiente (ya no hay tabs visibles). El deep-link del hub sigue
  // "aterrizando" en la sección correcta.
  useEffect(() => {
    const tab = searchParams.get("tab");
    const id = tab === "campos" ? "campos" : tab === "numeros" ? "numeros" : null;
    if (!id) return;
    // pequeño defer para asegurar que las secciones ya estén montadas.
    const t = window.setTimeout(() => {
      document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 150);
    return () => window.clearTimeout(t);
  }, [searchParams]);

  // Botón ÚNICO: coordina (U1) los DOS guardados independientes con
  // dirty-tracking. Cada sección conserva su propio PATCH + validación (vía
  // ref imperativa). Si una falla, la otra no pierde lo guardado: cada sección
  // maneja su propio estado. Toda esta coordinación es UI-level — no toca
  // servicios, contextos ni backend.
  async function handleSaveAll() {
    const numDirty = numRef.current?.isDirty() ?? false;
    const fieldDirty = fieldRef.current?.isDirty() ?? false;

    if (!numDirty && !fieldDirty) {
      toast.info("No hay cambios para guardar.");
      return;
    }

    setSaving(true);
    try {
      const results = await Promise.all([
        numDirty   ? numRef.current!.save()   : Promise.resolve(true),
        fieldDirty ? fieldRef.current!.save() : Promise.resolve(true),
      ]);
      if (results.every(Boolean)) {
        toast.success("Cambios guardados.");
      }
      // Falla parcial: la sección que falló ya mostró su toast de error y
      // conservó sus cambios; la otra quedó guardada.
    } finally {
      setSaving(false);
    }
  }

  return (
    <TPSectionShell
      title="Visualización y formatos"
      subtitle="Cómo TPTech muestra y formatea la información en todo el sistema. Los cambios son solo visuales; no afectan cálculos ni lo que se guarda en la base."
      icon={<Eye size={22} />}
    >
      <div className="space-y-6">
        {/* Config (izq, aprovecha el ancho con cards en grilla) + preview global
            sticky (der). En mobile apila: primero la config, el preview al final. */}
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_clamp(320px,26vw,380px)] items-start">
          <div className="min-w-0 space-y-8">
            <section id="numeros" className="scroll-mt-6">
              <NumericFormatSection ref={numRef} embedded />
            </section>
            <section id="campos" className="scroll-mt-6">
              <FieldFormatsSection ref={fieldRef} embedded />
            </section>
          </div>

          {/* Preview sticky en desktop, siempre visible mientras se editan
              decimales / separadores / máscaras. */}
          <aside className="lg:sticky lg:top-4">
            <GlobalPreviewCard />
          </aside>
        </div>

        {/* Botón ÚNICO de guardado (U1). */}
        <div className="flex justify-end border-t border-border/60 pt-4">
          <TPButton variant="primary" onClick={handleSaveAll} loading={saving} disabled={saving}>
            {saving ? "Guardando…" : "Guardar cambios"}
          </TPButton>
        </div>
      </div>
    </TPSectionShell>
  );
}
