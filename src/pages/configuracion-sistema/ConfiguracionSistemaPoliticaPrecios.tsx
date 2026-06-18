// src/pages/configuracion-sistema/ConfiguracionSistemaPoliticaPrecios.tsx
// Configuración de alertas y política de bloqueo del motor de pricing
import React, { useCallback, useEffect, useRef, useState } from "react";
import { ShieldAlert, Coins } from "lucide-react";
import { TPSectionShell } from "../../components/ui/TPSectionShell";
import { TPCard } from "../../components/ui/TPCard";
import { TPField } from "../../components/ui/TPField";
import TPNumberInput from "../../components/ui/TPNumberInput";
import TPCheckbox from "../../components/ui/TPCheckbox";
import TPSwitch from "../../components/ui/TPSwitch";
import TPSelect from "../../components/ui/TPSelect";
import { cn } from "../../components/ui/tp";
import { toast } from "../../lib/toast";
import { ApiError } from "../../lib/api";
import {
  fetchPricingPolicyConfig,
  updatePricingPolicyConfig,
  fetchDocumentRoundingConfig,
  updateDocumentRoundingConfig,
  fetchMetalParents,
  type PricingPolicyConfig,
  type DocumentRoundingConfig,
  type DocumentRoundingMode,
  type DocumentRoundingDirection,
  type DocumentPhysicalRoundingConfig,
  type PhysicalRoundingMode,
  type PhysicalRoundingDirection,
  type PhysicalMetalRoundingConfig,
  type MetalParentOption,
} from "../../services/company";

const DOC_ROUNDING_MODE_OPTIONS: Array<{ value: DocumentRoundingMode; label: string }> = [
  { value: "NONE",      label: "Sin redondeo" },
  { value: "DECIMAL_2", label: "Al centavo (0,01)" },
  { value: "DECIMAL_1", label: "Al décimo (0,10)" },
  { value: "INTEGER",   label: "Al entero (1)" },
  { value: "TEN",       label: "A la decena (10)" },
  { value: "HUNDRED",   label: "A la centena (100)" },
];

const DOC_ROUNDING_DIRECTION_OPTIONS: Array<{ value: DocumentRoundingDirection; label: string }> = [
  { value: "NEAREST", label: "Más cercano" },
  { value: "UP",      label: "Hacia arriba" },
  { value: "DOWN",    label: "Hacia abajo" },
];

// Simplificación 2026-06-17: el redondeo financiero ya no expone un selector de
// modo. Funciona SIEMPRE en automático (scope = BOTH): cada comprobante usa el
// redondeo que le corresponde (desglosado si va desglosado, unificado si va
// unificado) — el único modo que un usuario necesita. Los valores legacy
// (UNIFIED/BREAKDOWN) se coercionan a BOTH al cargar (ver useEffect).

// ── Etapa D4 — Opciones del redondeo físico de metales ─────────────────────
// El selector de "Dominio del metal" se eliminó de la UI: el dominio queda fijo
// en PHYSICAL (por gramos). Por eso ya no existe METAL_DOMAIN_OPTIONS.
const PHYSICAL_MODE_OPTIONS: Array<{ value: PhysicalRoundingMode; label: string }> = [
  { value: "NONE",      label: "Sin redondeo" },
  { value: "INTEGER",   label: "Al gramo (1)" },
  { value: "DECIMAL_1", label: "Al décimo (0,1)" },
  { value: "DECIMAL_2", label: "Al centésimo (0,01)" },
  { value: "HALF",      label: "Al medio gramo (0,5)" },
  { value: "QUARTER",   label: "Al cuarto de gramo (0,25)" },
];

const PHYSICAL_DIRECTION_OPTIONS: Array<{ value: PhysicalRoundingDirection; label: string }> = [
  { value: "NEAREST", label: "Más cercano" },
  { value: "UP",      label: "Hacia arriba" },
  { value: "DOWN",    label: "Hacia abajo" },
];

const PHYSICAL_CONFIG_DEFAULTS: DocumentPhysicalRoundingConfig = {
  byMetalParentId: {},
  fallback: { mode: "NONE", direction: "NEAREST" },
};

const DOC_ROUNDING_DEFAULTS: DocumentRoundingConfig = {
  documentRoundingEnabled:   false,
  documentRoundingScope:     "BOTH",
  documentRoundingMode:      "NONE",
  documentRoundingDirection: "NEAREST",
  documentRoundingModeMetal:        "NONE",
  documentRoundingDirectionMetal:   "NEAREST",
  documentRoundingModeHechura:      "NONE",
  documentRoundingDirectionHechura: "NEAREST",
  // El dominio del metal quedó fijo en PHYSICAL (por gramos). El selector se
  // ocultó de la UI; los valores legacy MONETARY se coercionan al cargar.
  documentRoundingMetalDomain:    "PHYSICAL",
  documentPhysicalRoundingConfig: null,
};

// Defaults alineados con `prisma/schema.prisma:41-47` (modelo Jewelry).
// Solo se usan durante el loading inicial — apenas responde GET /company/me
// el estado se sobrescribe con los valores reales del tenant.
const DEFAULTS: PricingPolicyConfig = {
  // null = sin advertencia de margen (ya no hay default 15% en el motor).
  pricingLowMarginWarningPercent:  null,
  pricingLowMarginBlockPercent:    null,
  pricingBlockLossSale:            false,
  pricingBlockZeroOrNegativePrice: true,
  pricingBlockPartialData:         false,
};

export default function ConfiguracionSistemaPoliticaPrecios() {
  const [config, setConfig] = useState<PricingPolicyConfig>(DEFAULTS);
  const [docRounding, setDocRounding] = useState<DocumentRoundingConfig>(DOC_ROUNDING_DEFAULTS);
  const [metalParents, setMetalParents] = useState<MetalParentOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving,  setSaving]  = useState(false);

  useEffect(() => {
    Promise.all([
      fetchPricingPolicyConfig(),
      fetchDocumentRoundingConfig(),
      // Etapa D4 — metales padre del tenant para la tabla del dominio PHYSICAL.
      // Si falla, dejamos lista vacía (la UI degrada: solo expone el fallback).
      fetchMetalParents().catch(() => [] as MetalParentOption[]),
    ])
      .then(([pol, dr, metals]) => {
        setConfig(pol);
        // Simplificación: scope siempre "Automático" (BOTH) y dominio del metal
        // siempre PHYSICAL (por gramos). Tenants con valores legacy
        // (UNIFIED/BREAKDOWN, o MONETARY) se coercionan acá. PHYSICAL con
        // fallback "Sin redondeo" (default) no redondea nada hasta que el
        // operador lo configure — sin sorpresas.
        setDocRounding({ ...dr, documentRoundingScope: "BOTH", documentRoundingMetalDomain: "PHYSICAL" });
        setMetalParents(metals);
      })
      .catch((err) => {
        if (err instanceof ApiError && err.status === 403) return;
        toast.error("Error al cargar la configuración de precios.");
      })
      .finally(() => setLoading(false));
  }, []);

  // Persiste la config en el backend. La UI simplificada solo expone "Margen
  // mínimo recomendado" (warning); el umbral crítico legacy
  // (`pricingLowMarginBlockPercent`) se neutraliza en cada save (queda null en
  // DB). NO re-aplica la respuesta al estado local (evita un loop con el
  // autoguardado): el estado del form ya es la fuente de verdad de lo editado.
  const saveConfig = useCallback(async () => {
    setSaving(true);
    try {
      const patch = { ...config, pricingLowMarginBlockPercent: null };
      await Promise.all([
        updatePricingPolicyConfig(patch),
        updateDocumentRoundingConfig(docRounding),
      ]);
      // Notificar a otras pantallas abiertas (ej: Factura de ventas) que la
      // política del tenant cambió, para que invaliden su caché de preview.
      window.dispatchEvent(new Event("tptech:pricing-policy-changed"));
    } catch (err) {
      if (err instanceof ApiError && err.status === 403) {
        toast.error("No tenés permisos para guardar esta configuración.");
      } else {
        toast.error("Error al guardar la configuración.");
      }
    } finally {
      setSaving(false);
    }
  }, [config, docRounding]);

  // Autoguardado: persiste con debounce cada vez que cambia la config. Se
  // saltea la primera corrida posterior a la carga (hidratación) para no
  // guardar inmediatamente lo recién leído del backend.
  const hydratedRef = useRef(false);
  useEffect(() => {
    if (loading) return;
    if (!hydratedRef.current) { hydratedRef.current = true; return; }
    const t = setTimeout(() => { void saveConfig(); }, 500);
    return () => clearTimeout(t);
  }, [config, docRounding, loading, saveConfig]);

  function set<K extends keyof PricingPolicyConfig>(key: K, value: PricingPolicyConfig[K]) {
    setConfig(prev => ({ ...prev, [key]: value }));
  }

  function setDr<K extends keyof DocumentRoundingConfig>(key: K, value: DocumentRoundingConfig[K]) {
    setDocRounding(prev => ({ ...prev, [key]: value }));
  }

  // ── Etapa D4 — helpers de mutación del bloque PHYSICAL ────────────────
  function getPhysicalCfg(): DocumentPhysicalRoundingConfig {
    return docRounding.documentPhysicalRoundingConfig ?? PHYSICAL_CONFIG_DEFAULTS;
  }

  function setPhysicalMetal(metalParentId: string, patch: Partial<PhysicalMetalRoundingConfig>) {
    const cur = getPhysicalCfg();
    const prev = cur.byMetalParentId[metalParentId] ?? { mode: "NONE" as PhysicalRoundingMode, direction: "NEAREST" as PhysicalRoundingDirection };
    const nextEntry: PhysicalMetalRoundingConfig = { ...prev, ...patch };
    const nextById = { ...cur.byMetalParentId, [metalParentId]: nextEntry };
    setDr("documentPhysicalRoundingConfig", { ...cur, byMetalParentId: nextById });
  }

  function setPhysicalFallback(patch: Partial<PhysicalMetalRoundingConfig>) {
    const cur = getPhysicalCfg();
    const nextFallback: PhysicalMetalRoundingConfig = { ...cur.fallback, ...patch };
    setDr("documentPhysicalRoundingConfig", { ...cur, fallback: nextFallback });
  }

  return (
    <TPSectionShell
      title="Política comercial"
      subtitle="Definí cómo TPTech interpreta el resultado comercial de cada venta: márgenes recomendados, riesgos a advertir y cuándo pedir confirmación reforzada al operador."
      icon={<ShieldAlert size={22} />}
    >
      {loading ? (
        <div className="text-sm text-muted py-8 text-center">Cargando…</div>
      ) : (
        <div className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-5 gap-6 items-start">

            {/* ── Columna izquierda (2/5) — Márgenes y riesgos (unificado) ── */}
            <div className="lg:col-span-2">
            <TPCard title="Márgenes y riesgos">
              <div className="space-y-5">
                <TPField
                  label="Margen mínimo recomendado"
                  hint="Por debajo de este %, la línea se marca como margen bajo. Dejalo vacío para no advertir por margen."
                >
                  <TPNumberInput
                    value={config.pricingLowMarginWarningPercent}
                    onChange={v => set("pricingLowMarginWarningPercent", v)}
                    min={0}
                    max={100}
                    step={0.5}
                    decimals={1}
                    placeholder="Sin advertencia"
                    suffix="%"
                  />
                </TPField>

                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-muted">
                    Pedir confirmación reforzada al cerrar si…
                  </p>
                  <p className="text-[11px] text-muted/70 mb-2">
                    Las advertencias se muestran siempre; esto define cuáles exigen confirmación extra para cerrar la venta.
                  </p>
                  <div className="flex items-center justify-between gap-3 py-2 border-b border-border/40">
                    <span className="text-sm text-text">Hay pérdida (precio ≤ costo)</span>
                    <TPCheckbox
                      checked={config.pricingBlockLossSale}
                      onChange={v => set("pricingBlockLossSale", v)}
                      label=""
                    />
                  </div>
                  <div className="flex items-center justify-between gap-3 py-2 border-b border-border/40">
                    <span className="text-sm text-text">El precio final es cero o negativo</span>
                    <TPCheckbox
                      checked={config.pricingBlockZeroOrNegativePrice}
                      onChange={v => set("pricingBlockZeroOrNegativePrice", v)}
                      label=""
                    />
                  </div>
                  <div className="flex items-center justify-between gap-3 py-2">
                    <span className="text-sm text-text">El cálculo es parcial (faltan datos o cotizaciones)</span>
                    <TPCheckbox
                      checked={config.pricingBlockPartialData}
                      onChange={v => set("pricingBlockPartialData", v)}
                      label=""
                    />
                  </div>
                </div>
              </div>
            </TPCard>
            </div>

            {/* ── Columna derecha (3/5) — Redondeo financiero ──
                Se aplica sobre el total final luego de impuestos; distinto del
                "Redondeo comercial" de la lista de precios (antes de impuestos). */}
            <div className="lg:col-span-3">
            <TPCard title="Redondeo financiero">
            <div className="space-y-4">
              {/* Activar — switch prominente con estado visual (card que se
                  "enciende"). El control sigue siendo un checkbox nativo bajo
                  el capó (TPSwitch) → accesible y encontrable en tests. */}
              <div
                className={cn(
                  "flex items-center justify-between gap-4 rounded-xl border px-4 py-3.5 transition-colors",
                  docRounding.documentRoundingEnabled
                    ? "border-primary/50 bg-primary/5"
                    : "border-border bg-surface2/20",
                )}
              >
                <div className="flex items-start gap-3 min-w-0">
                  <span
                    className={cn(
                      "mt-0.5 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full transition-colors",
                      docRounding.documentRoundingEnabled
                        ? "bg-primary/15 text-primary"
                        : "bg-surface2 text-muted",
                    )}
                  >
                    <Coins size={18} />
                  </span>
                  <div className="min-w-0">
                    <div className="text-sm font-semibold text-text">Redondeo financiero</div>
                    <div className="text-xs text-muted mt-0.5">
                      Redondea el total a cobrar de cada comprobante, sobre la moneda base.
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2.5 shrink-0">
                  <span
                    className={cn(
                      "text-[11px] font-semibold uppercase tracking-wide",
                      docRounding.documentRoundingEnabled ? "text-primary" : "text-muted",
                    )}
                  >
                    {docRounding.documentRoundingEnabled ? "Activado" : "Desactivado"}
                  </span>
                  <TPSwitch
                    checked={docRounding.documentRoundingEnabled}
                    onChange={v => setDr("documentRoundingEnabled", v)}
                    ariaLabel="Activar redondeo financiero"
                  />
                </div>
              </div>

              {/* Config del TOTAL FINAL — comprobantes unificados (scope = BOTH) */}
              {(docRounding.documentRoundingScope === "UNIFIED" || docRounding.documentRoundingScope === "BOTH") && (
                <div className="rounded-lg border border-border/60 bg-surface2/20 px-3 py-3 space-y-3">
                  <div className="text-[12px] font-semibold text-text">
                    Redondeo del total final{" "}
                    <span className="text-muted font-normal italic">(comprobantes unificados)</span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <TPField label="Redondear a">
                      <TPSelect
                        value={docRounding.documentRoundingMode}
                        onChange={v => setDr("documentRoundingMode", v as DocumentRoundingMode)}
                        options={DOC_ROUNDING_MODE_OPTIONS}
                        disabled={!docRounding.documentRoundingEnabled}
                      />
                    </TPField>
                    <TPField label="Dirección">
                      <TPSelect
                        value={docRounding.documentRoundingDirection}
                        onChange={v => setDr("documentRoundingDirection", v as DocumentRoundingDirection)}
                        options={DOC_ROUNDING_DIRECTION_OPTIONS}
                        disabled={!docRounding.documentRoundingEnabled || docRounding.documentRoundingMode === "NONE"}
                      />
                    </TPField>
                  </div>
                </div>
              )}

              {/* Config BREAKDOWN — visible en BREAKDOWN y BOTH.
                  Mismo patrón que Configuración → Listas de precios:
                  dos sub-bloques independientes (Metal + Hechura), cada uno
                  con su par precisión/dirección. */}
              {(docRounding.documentRoundingScope === "BREAKDOWN" || docRounding.documentRoundingScope === "BOTH") && (
                <div className="rounded-lg border border-border/60 bg-surface2/20 px-3 py-3 space-y-4">
                  <div className="text-[12px] font-semibold text-text">
                    Redondeo desglosado{" "}
                    <span className="text-muted font-normal italic">(comprobantes desglosados)</span>
                  </div>
                  {/* METALES — por gramos (PHYSICAL). MISMO formato de campos que
                      "Redondeo del total final": grid de 2 columnas con labels
                      "Redondear a" / "Dirección". */}
                  <div className="space-y-3" data-testid="rounding-metales-block">
                    <div className="text-[11px] font-semibold uppercase tracking-wide text-text/80">
                      Metales <span className="font-normal normal-case text-muted">· por gramos</span>
                    </div>
                    <div className="space-y-3" data-testid="rounding-metales-physical">
                      <div className="space-y-3" data-testid="rounding-metales-physical-table">
                        {metalParents.map((mp) => {
                          const entry = getPhysicalCfg().byMetalParentId[mp.id]
                            ?? { mode: "NONE" as PhysicalRoundingMode, direction: "NEAREST" as PhysicalRoundingDirection };
                          return (
                            <div key={mp.id} className="space-y-1" data-testid={`rounding-metal-row-${mp.id}`}>
                              <div className="text-[12px] text-text font-medium">{mp.name}</div>
                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <TPField label="Redondear a">
                                  <TPSelect
                                    value={entry.mode}
                                    onChange={v => setPhysicalMetal(mp.id, { mode: v as PhysicalRoundingMode })}
                                    options={PHYSICAL_MODE_OPTIONS}
                                    disabled={!docRounding.documentRoundingEnabled}
                                  />
                                </TPField>
                                <TPField label="Dirección">
                                  <TPSelect
                                    value={entry.direction}
                                    onChange={v => setPhysicalMetal(mp.id, { direction: v as PhysicalRoundingDirection })}
                                    options={PHYSICAL_DIRECTION_OPTIONS}
                                    disabled={!docRounding.documentRoundingEnabled || entry.mode === "NONE"}
                                  />
                                </TPField>
                              </div>
                            </div>
                          );
                        })}

                        {/* Fallback (todos los metales si no hay específicos). */}
                        <div className="space-y-1" data-testid="rounding-metales-physical-fallback">
                          {metalParents.length > 0 && (
                            <div className="text-[12px] text-muted">Resto de metales</div>
                          )}
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <TPField label="Redondear a">
                              <TPSelect
                                value={getPhysicalCfg().fallback.mode}
                                onChange={v => setPhysicalFallback({ mode: v as PhysicalRoundingMode })}
                                options={PHYSICAL_MODE_OPTIONS}
                                disabled={!docRounding.documentRoundingEnabled}
                              />
                            </TPField>
                            <TPField label="Dirección">
                              <TPSelect
                                value={getPhysicalCfg().fallback.direction}
                                onChange={v => setPhysicalFallback({ direction: v as PhysicalRoundingDirection })}
                                options={PHYSICAL_DIRECTION_OPTIONS}
                                disabled={!docRounding.documentRoundingEnabled || getPhysicalCfg().fallback.mode === "NONE"}
                              />
                            </TPField>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* HECHURA Y RESTO} — MISMO formato de campos que total final. */}
                  <div className="space-y-3 border-t border-border/40 pt-4">
                    <div className="text-[11px] font-semibold uppercase tracking-wide text-text/80">
                      Hechura
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <TPField label="Redondear a">
                        <TPSelect
                          value={docRounding.documentRoundingModeHechura}
                          onChange={v => setDr("documentRoundingModeHechura", v as DocumentRoundingMode)}
                          options={DOC_ROUNDING_MODE_OPTIONS}
                          disabled={!docRounding.documentRoundingEnabled}
                        />
                      </TPField>
                      <TPField label="Dirección">
                        <TPSelect
                          value={docRounding.documentRoundingDirectionHechura}
                          onChange={v => setDr("documentRoundingDirectionHechura", v as DocumentRoundingDirection)}
                          options={DOC_ROUNDING_DIRECTION_OPTIONS}
                          disabled={!docRounding.documentRoundingEnabled || docRounding.documentRoundingModeHechura === "NONE"}
                        />
                      </TPField>
                    </div>
                  </div>

                </div>
              )}
            </div>
          </TPCard>
          </div>
          </div>

          {/* Autoguardado — sin botón. Indicador sutil del estado. */}
          <div className="flex justify-end items-center gap-2 text-xs text-muted">
            {saving
              ? <span>Guardando…</span>
              : <span>Los cambios se guardan automáticamente.</span>}
          </div>

        </div>
      )}
    </TPSectionShell>
  );
}
