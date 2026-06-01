// src/pages/configuracion-sistema/ConfiguracionSistemaPoliticaPrecios.tsx
// Configuración de alertas y política de bloqueo del motor de pricing
import React, { useEffect, useState } from "react";
import { ShieldAlert } from "lucide-react";
import { TPSectionShell } from "../../components/ui/TPSectionShell";
import { TPCard } from "../../components/ui/TPCard";
import { TPField } from "../../components/ui/TPField";
import TPNumberInput from "../../components/ui/TPNumberInput";
import TPCheckbox from "../../components/ui/TPCheckbox";
import { TPButton } from "../../components/ui/TPButton";
import TPSelect from "../../components/ui/TPSelect";
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
  type DocumentRoundingScope,
  type DocumentRoundingMetalDomain,
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

const DOC_ROUNDING_SCOPE_OPTIONS: Array<{ value: DocumentRoundingScope; label: string }> = [
  { value: "UNIFIED",   label: "Unificado — total final" },
  { value: "BREAKDOWN", label: "Desglosado — metal + hechura" },
  { value: "BOTH",      label: "Ambos — desglose y luego total" },
];

// ── Etapa D4 — Opciones del redondeo físico de metales ─────────────────────
const METAL_DOMAIN_OPTIONS: Array<{ value: DocumentRoundingMetalDomain; label: string }> = [
  { value: "MONETARY", label: "Monetario — redondea el subtotal $ del metal" },
  { value: "PHYSICAL", label: "Físico por gramos — redondea los gramos por metal padre" },
];

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
  documentRoundingScope:     "UNIFIED",
  documentRoundingMode:      "NONE",
  documentRoundingDirection: "NEAREST",
  documentRoundingModeMetal:        "NONE",
  documentRoundingDirectionMetal:   "NEAREST",
  documentRoundingModeHechura:      "NONE",
  documentRoundingDirectionHechura: "NEAREST",
  documentRoundingMetalDomain:    "MONETARY",
  documentPhysicalRoundingConfig: null,
};

// Defaults alineados con `prisma/schema.prisma:41-47` (modelo Jewelry).
// Solo se usan durante el loading inicial — apenas responde GET /company/me
// el estado se sobrescribe con los valores reales del tenant.
const DEFAULTS: PricingPolicyConfig = {
  pricingLowMarginWarningPercent:  15,
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
        setDocRounding(dr);
        setMetalParents(metals);
      })
      .catch((err) => {
        if (err instanceof ApiError && err.status === 403) return;
        toast.error("Error al cargar la configuración de precios.");
      })
      .finally(() => setLoading(false));
  }, []);

  async function handleSave() {
    setSaving(true);
    try {
      // La UI simplificada solo expone "Margen mínimo recomendado" (warning).
      // El umbral crítico legacy (`pricingLowMarginBlockPercent`) ya no se
      // puede editar desde acá — lo neutralizamos en cada save para que la
      // experiencia sea coherente con lo que el operador ve: solo los toggles
      // de "Considerar crítico..." escalan a CRITICAL. El campo sigue vivo
      // en DB por compatibilidad backend, simplemente queda en null.
      const patch = { ...config, pricingLowMarginBlockPercent: null };
      const [updatedPol, updatedDr] = await Promise.all([
        updatePricingPolicyConfig(patch),
        updateDocumentRoundingConfig(docRounding),
      ]);
      setConfig(updatedPol);
      setDocRounding(updatedDr);
      // Notificar a otras pantallas abiertas (ej: Factura de ventas) que la
      // política del tenant cambió. Consumidores que cachean preview o leen
      // los umbrales deben invalidar y volver a pedir. Sin payload — el
      // listener vuelve a llamar al backend para obtener el estado fresco.
      window.dispatchEvent(new Event("tptech:pricing-policy-changed"));
      toast.success("Configuración guardada.");
    } catch (err) {
      if (err instanceof ApiError && err.status === 403) {
        toast.error("No tenés permisos para guardar esta configuración.");
      } else {
        toast.error("Error al guardar la configuración.");
      }
    } finally {
      setSaving(false);
    }
  }

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
        <div className="space-y-6 max-w-2xl">

          {/* A — Márgenes recomendados */}
          <TPCard title="Márgenes recomendados">
            <p className="text-xs text-muted mb-4">
              Umbrales que TPTech usa para clasificar cada línea de venta.
              <span className="font-medium text-text"> El operador siempre puede
              confirmar</span> — la política solo advierte y, en casos críticos,
              solicita confirmación reforzada antes de cerrar el comprobante.
            </p>
            <div className="space-y-4">
              <TPField
                label="Margen mínimo recomendado"
                hint="Si el margen queda por debajo de este porcentaje, la línea se marcará como margen bajo para advertir al operador."
              >
                <TPNumberInput
                  value={config.pricingLowMarginWarningPercent}
                  onChange={v => set("pricingLowMarginWarningPercent", v)}
                  min={0}
                  max={100}
                  step={0.5}
                  decimals={1}
                  placeholder="15"
                  suffix="%"
                />
              </TPField>
            </div>
          </TPCard>

          {/* B — Riesgos comerciales */}
          <TPCard title="Riesgos comerciales">
            <p className="text-xs text-muted mb-4">
              Situaciones que TPTech detecta automáticamente sobre el
              resultado final del motor de precios (después de descuentos,
              impuestos, promociones y overrides). Cuando están activadas,
              se muestran como <span className="font-medium text-text">advertencia
              en la línea</span> y se incluyen en el resumen comercial del
              comprobante.
            </p>

            <div className="space-y-4">
              <div className="flex items-start justify-between gap-4 py-3 border-b border-border/50">
                <div className="min-w-0">
                  <div className="text-sm font-medium text-text">Considerar crítica la venta con pérdida</div>
                  <div className="text-xs text-muted mt-0.5">
                    Cuando el precio final queda menor o igual al costo
                    calculado por el motor, la línea se marcará como crítica y
                    requerirá confirmación para continuar.
                  </div>
                </div>
                <TPCheckbox
                  checked={config.pricingBlockLossSale}
                  onChange={v => set("pricingBlockLossSale", v)}
                  label=""
                />
              </div>

              <div className="flex items-start justify-between gap-4 py-3 border-b border-border/50">
                <div className="min-w-0">
                  <div className="text-sm font-medium text-text">Considerar crítico el precio cero o negativo</div>
                  <div className="text-xs text-muted mt-0.5">
                    Cuando el precio final resultante sea cero o negativo,
                    TPTech solicitará confirmación reforzada antes de cerrar el
                    comprobante.
                  </div>
                </div>
                <TPCheckbox
                  checked={config.pricingBlockZeroOrNegativePrice}
                  onChange={v => set("pricingBlockZeroOrNegativePrice", v)}
                  label=""
                />
              </div>

              <div className="flex items-start justify-between gap-4 py-3">
                <div className="min-w-0">
                  <div className="text-sm font-medium text-text">Considerar crítico el cálculo parcial</div>
                  <div className="text-xs text-muted mt-0.5">
                    Cuando el motor no pueda resolver completamente el costo o
                    el precio por falta de datos o cotizaciones, la venta se
                    marcará como crítica.
                  </div>
                </div>
                <TPCheckbox
                  checked={config.pricingBlockPartialData}
                  onChange={v => set("pricingBlockPartialData", v)}
                  label=""
                />
              </div>
            </div>
          </TPCard>

          {/* C — Confirmación reforzada */}
          <TPCard title="Confirmación reforzada">
            <p className="text-xs text-muted mb-4">
              Al cerrar una venta con líneas marcadas como críticas (por
              margen muy bajo o por un riesgo comercial activado arriba),
              TPTech abre un modal pidiendo confirmación explícita. El
              operador puede <span className="font-medium text-text">volver
              y revisar</span> o <span className="font-medium text-text">confirmar
              igualmente</span> — la venta nunca se bloquea automáticamente,
              y queda registrada la decisión para trazabilidad futura.
            </p>
            <div className="rounded-lg border border-border bg-surface2/40 px-3 py-3 text-[12px] text-text/80 leading-relaxed">
              <span className="font-semibold text-text">Siempre activa.</span>{" "}
              La confirmación reforzada es parte del flujo estándar de
              Factura de ventas — no requiere configuración adicional. En
              próximas versiones se podrá pedir un motivo de excepción o
              autorización adicional para ventas críticas.
            </div>
          </TPCard>

          {/* Redondeo financiero — POLICY §R-Rounding-12 dominio FINANCIERO:
              se aplica sobre el total final luego de impuestos. Distinto del
              "Redondeo comercial" de Lista de precios (que opera antes de
              impuestos sobre el precio publicable). */}
          <TPCard title="Redondeo financiero">
            <p className="text-xs text-muted mb-4">
              <span className="font-semibold text-text">Se aplica sobre el total final luego de impuestos.</span>{" "}
              Define cómo se redondea el importe a cobrar de cada comprobante
              al cerrarse — es el redondeo de caja / cierre financiero.
              El <span className="font-medium text-text">redondeo comercial</span>
              {" "}(sobre el precio antes de impuestos) se configura
              independientemente en{" "}
              <span className="font-medium text-text">Lista de precios</span>;
              TPTech evita el doble redondeo automáticamente.
            </p>

            {/* Jerarquía de aplicación — alineada con POLICY §R-Rounding-12 */}
            <div className="rounded-lg border border-border/60 bg-surface2/30 px-3 py-3 text-[11px] leading-relaxed text-muted mb-4">
              <div className="font-semibold text-text mb-1">Orden de aplicación</div>
              <ol className="list-decimal pl-4 space-y-0.5">
                <li>Motor de precios (costo, listas, descuentos, promociones, canal, cupón).</li>
                <li><span className="font-medium text-text">Redondeo comercial</span> — antes de impuestos (Lista de precios).</li>
                <li>Impuestos, envío, forma de pago.</li>
                <li><span className="font-medium text-text">Redondeo financiero</span> — después de impuestos (este bloque).</li>
              </ol>
            </div>

            <div className="space-y-4">
              {/* Activar */}
              <div className="flex items-start justify-between gap-4 py-3 border-b border-border/50">
                <div className="min-w-0">
                  <div className="text-sm font-medium text-text">Activar redondeo financiero</div>
                  <div className="text-xs text-muted mt-0.5">
                    Si está apagado, el total se muestra tal cual lo calcula el motor.
                    Si está encendido, se aplica el modo elegido abajo al importe final a cobrar.
                  </div>
                </div>
                <TPCheckbox
                  checked={docRounding.documentRoundingEnabled}
                  onChange={v => setDr("documentRoundingEnabled", v)}
                  label=""
                />
              </div>

              {/* Selector de Modo */}
              <TPField
                label="Modo de redondeo financiero"
                hint="Unificado redondea el total final. Desglosado redondea metal y hechura por separado. Ambos aplica primero el desglose y después el total final."
              >
                <TPSelect
                  value={docRounding.documentRoundingScope}
                  onChange={v => setDr("documentRoundingScope", v as DocumentRoundingScope)}
                  options={DOC_ROUNDING_SCOPE_OPTIONS}
                  disabled={!docRounding.documentRoundingEnabled}
                />
              </TPField>

              {/* Config UNIFIED — visible en UNIFIED y BOTH */}
              {(docRounding.documentRoundingScope === "UNIFIED" || docRounding.documentRoundingScope === "BOTH") && (
                <div className="rounded-lg border border-border/60 bg-surface2/20 px-3 py-3 space-y-3">
                  <div className="text-[12px] font-semibold text-text">
                    Redondeo del total final {docRounding.documentRoundingScope === "BOTH" && (
                      <span className="text-muted font-normal italic">(se aplica después del desglose)</span>
                    )}
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <TPField
                      label="Granularidad"
                      hint="A qué nivel se redondea el total final del comprobante."
                    >
                      <TPSelect
                        value={docRounding.documentRoundingMode}
                        onChange={v => setDr("documentRoundingMode", v as DocumentRoundingMode)}
                        options={DOC_ROUNDING_MODE_OPTIONS}
                        disabled={!docRounding.documentRoundingEnabled}
                      />
                    </TPField>
                    <TPField
                      label="Dirección"
                      hint='Qué hacer cuando el total cae entre dos valores: "Más cercano" elige el más próximo, "Hacia arriba" siempre suma, "Hacia abajo" siempre resta.'
                    >
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
                    Redondeo desglosado por componente
                    {docRounding.documentRoundingScope === "BOTH" && (
                      <span className="text-muted font-normal italic"> (se aplica antes del unificado)</span>
                    )}
                  </div>
                  <p className="text-[11px] text-muted leading-relaxed">
                    Metales y hechura pueden redondearse de forma independiente
                    a nivel comprobante. Si un componente queda en "Sin redondeo",
                    el sistema deja ese subtotal intacto.
                  </p>

                  {/* METALES */}
                  <div
                    className="rounded-md border border-border/40 bg-surface/40 px-3 py-3 space-y-3"
                    data-testid="rounding-metales-block"
                  >
                    <div className="text-[11px] font-semibold uppercase tracking-wide text-text/80">
                      Metales
                    </div>

                    {/* Etapa D4 — Selector dominio del metal en BREAKDOWN.
                        MONETARY (default histórico) → redondea $ del metal.
                        PHYSICAL → redondea gramos por metal padre vía capa 16.
                        El bucket Hechura/Monetario siempre se redondea
                        monetariamente — no tiene sentido físico. */}
                    <TPField
                      label="Dominio del metal"
                      hint="Monetario redondea el subtotal $. Físico por gramos redondea los gramos consolidados por metal padre — el impacto monetario se calcula automáticamente con la cotización del documento."
                    >
                      <TPSelect
                        value={docRounding.documentRoundingMetalDomain}
                        onChange={v => setDr("documentRoundingMetalDomain", v as DocumentRoundingMetalDomain)}
                        options={METAL_DOMAIN_OPTIONS}
                        disabled={!docRounding.documentRoundingEnabled}
                        data-testid="rounding-metal-domain-select"
                      />
                    </TPField>

                    {/* MONETARIO — layout histórico (capa 15). */}
                    {docRounding.documentRoundingMetalDomain === "MONETARY" && (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4" data-testid="rounding-metales-monetary">
                        <TPField
                          label="Precisión metal"
                          hint="A qué nivel se redondea el subtotal de metal del comprobante."
                        >
                          <TPSelect
                            value={docRounding.documentRoundingModeMetal}
                            onChange={v => setDr("documentRoundingModeMetal", v as DocumentRoundingMode)}
                            options={DOC_ROUNDING_MODE_OPTIONS}
                            disabled={!docRounding.documentRoundingEnabled}
                          />
                        </TPField>
                        <TPField
                          label="Dirección metal"
                          hint='"Más cercano", "Hacia arriba" o "Hacia abajo" aplicado al subtotal de metal.'
                        >
                          <TPSelect
                            value={docRounding.documentRoundingDirectionMetal}
                            onChange={v => setDr("documentRoundingDirectionMetal", v as DocumentRoundingDirection)}
                            options={DOC_ROUNDING_DIRECTION_OPTIONS}
                            disabled={!docRounding.documentRoundingEnabled || docRounding.documentRoundingModeMetal === "NONE"}
                          />
                        </TPField>
                      </div>
                    )}

                    {/* FÍSICO POR GRAMOS — tabla por metal padre + fallback. */}
                    {docRounding.documentRoundingMetalDomain === "PHYSICAL" && (
                      <div className="space-y-3" data-testid="rounding-metales-physical">
                        <p className="text-[11px] text-muted leading-relaxed">
                          Cada metal padre se redondea de manera independiente.
                          El impacto monetario del delta de gramos se calcula con
                          la cotización al momento del comprobante y se suma al
                          total final — los gramos del documento NUNCA se mezclan
                          con la hechura.
                        </p>

                        {/* Tabla de metales padre activos */}
                        <div className="space-y-2" data-testid="rounding-metales-physical-table">
                          {metalParents.length === 0 && (
                            <p className="text-[11px] italic text-muted">
                              No hay metales padre cargados. Configurá los metales
                              del tenant en Configuración → Valuación de metales.
                              Mientras tanto, los ajustes caen al fallback de abajo.
                            </p>
                          )}
                          {metalParents.map((mp) => {
                            const entry = getPhysicalCfg().byMetalParentId[mp.id]
                              ?? { mode: "NONE" as PhysicalRoundingMode, direction: "NEAREST" as PhysicalRoundingDirection };
                            return (
                              <div
                                key={mp.id}
                                className="grid grid-cols-1 sm:grid-cols-[1fr_1fr_1fr] gap-3 items-end"
                                data-testid={`rounding-metal-row-${mp.id}`}
                              >
                                <div className="text-[12px] text-text font-medium pb-2">{mp.name}</div>
                                <TPField label="Modo">
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
                            );
                          })}
                        </div>

                        {/* Fallback general */}
                        <div
                          className="rounded-md border border-dashed border-border/50 bg-surface2/30 px-3 py-3 space-y-3"
                          data-testid="rounding-metales-physical-fallback"
                        >
                          <div className="text-[11px] font-semibold uppercase tracking-wide text-text/80">
                            Fallback general
                          </div>
                          <p className="text-[11px] text-muted leading-relaxed">
                            Modo y dirección que se aplican a cualquier metal padre
                            que NO aparezca en la tabla de arriba. Útil cuando se
                            agrega un metal nuevo y todavía no se configuró su modo
                            específico.
                          </p>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <TPField label="Modo fallback">
                              <TPSelect
                                value={getPhysicalCfg().fallback.mode}
                                onChange={v => setPhysicalFallback({ mode: v as PhysicalRoundingMode })}
                                options={PHYSICAL_MODE_OPTIONS}
                                disabled={!docRounding.documentRoundingEnabled}
                              />
                            </TPField>
                            <TPField label="Dirección fallback">
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
                    )}
                  </div>

                  {/* HECHURA / MONETARIO */}
                  <div className="rounded-md border border-border/40 bg-surface/40 px-3 py-3 space-y-3">
                    <div className="text-[11px] font-semibold uppercase tracking-wide text-text/80">
                      Hechura / Monetario
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <TPField
                        label="Precisión hechura"
                        hint="A qué nivel se redondea el subtotal de hechura del comprobante."
                      >
                        <TPSelect
                          value={docRounding.documentRoundingModeHechura}
                          onChange={v => setDr("documentRoundingModeHechura", v as DocumentRoundingMode)}
                          options={DOC_ROUNDING_MODE_OPTIONS}
                          disabled={!docRounding.documentRoundingEnabled}
                        />
                      </TPField>
                      <TPField
                        label="Dirección hechura"
                        hint='"Más cercano", "Hacia arriba" o "Hacia abajo" aplicado al subtotal de hechura.'
                      >
                        <TPSelect
                          value={docRounding.documentRoundingDirectionHechura}
                          onChange={v => setDr("documentRoundingDirectionHechura", v as DocumentRoundingDirection)}
                          options={DOC_ROUNDING_DIRECTION_OPTIONS}
                          disabled={!docRounding.documentRoundingEnabled || docRounding.documentRoundingModeHechura === "NONE"}
                        />
                      </TPField>
                    </div>
                  </div>

                  {docRounding.documentRoundingScope === "BOTH" && (
                    <p className="text-[11px] italic text-muted">
                      TPTech aplica primero el redondeo desglosado y luego el
                      redondeo final unificado sobre el total resultante.
                    </p>
                  )}
                </div>
              )}

              {/* Advertencia anti doble-rounding — dominios oficiales */}
              <p className="text-[11px] italic text-muted/80">
                Cuando el <span className="font-medium not-italic">redondeo financiero</span> está activo,
                las listas con <span className="font-medium not-italic">redondeo comercial</span> al neto o al total
                se desactivan automáticamente para evitar redondear dos veces los
                mismos importes. Las listas que solo redondean gramos (cantidad
                física) siguen funcionando — son un dominio distinto y no entran
                en conflicto.
              </p>
            </div>
          </TPCard>

          <div className="flex justify-end">
            <TPButton variant="primary" loading={saving} onClick={handleSave}>
              Guardar configuración
            </TPButton>
          </div>

        </div>
      )}
    </TPSectionShell>
  );
}
