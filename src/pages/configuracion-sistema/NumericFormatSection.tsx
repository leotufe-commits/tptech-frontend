// src/pages/configuracion-sistema/NumericFormatSection.tsx
// ============================================================================
// Sección reusable de configuración de formato numérico — sin TPSectionShell.
//
// Se monta tanto desde la pantalla legacy `FormatoNumericoPage` (con shell)
// como desde la nueva `VisualizacionFormatosPage` (tab "Números", sin shell).
//
// Cero cambios de lógica vs el código original: hidratación, save, preview
// y guards anti `toFixed`/`toLocaleString` siguen funcionando idénticos.
// Pricing-engine NO se toca: este módulo solo configura display/input.
// ============================================================================

import React, { forwardRef, useEffect, useImperativeHandle, useMemo, useRef, useState } from "react";
import { TPCard } from "../../components/ui/TPCard";
import { TPField } from "../../components/ui/TPField";
import TPComboFixed from "../../components/ui/TPComboFixed";
import { TPButton } from "../../components/ui/TPButton";
import TPInput from "../../components/ui/TPInput";
import { toast } from "../../lib/toast";
import { ApiError } from "../../lib/api";
import { fetchNumberFormat, updateNumberFormat } from "../../services/company";
import { useNumberFormat } from "../../context/NumberFormatContext";
import {
  DEFAULT_NUMBER_FORMAT_CONFIG,
  DEFAULT_PRESETS,
  PRESET_LABELS,
  PRESET_ORDER,
  formatNumber,
  type NumberFormatConfig,
  type NumberFormatType,
} from "../../lib/number-format";

const REGION_OPTIONS = [
  { value: "AR",     label: "Español / Argentina  —  1.000,00" },
  { value: "US",     label: "Inglés / USA  —  1,000.00" },
  { value: "CUSTOM", label: "Personalizado  —  elegís los separadores" },
];

const DECIMALS_OPTIONS = Array.from({ length: 9 }, (_, i) => ({
  value: String(i),
  label: `${i} decimales`,
}));

const SAMPLE: Record<NumberFormatType, number> = {
  MONEY: 1250.5, MONEY_EXTENDED: 1250.1234, QUANTITY: 1, METAL_GRAMS: 1.25,
  MERMA_PERCENT: 10.5, MERMA_GRAMS: 0.35, AJUSTE_PERCENT: 5, AJUSTE_AMOUNT: 1250.5,
  PERCENT: 21, MARGIN_PERCENT: 35.5, TAX_PERCENT: 21, FX_RATE: 1250.123456,
  PURITY: 0.75, WEIGHT: 1.25, DIMENSION: 10.5, INTEGER: 10,
};

// Agrupación VISUAL de la tabla de decimales (mejora de presentación — no
// cambia datos, guardado ni modelo). Los tipos siguen siendo los mismos de
// PRESET_ORDER; solo se renderizan bajo subtítulos. "Otros" se calcula como
// el RESTO de PRESET_ORDER, así ningún tipo (presente o futuro) queda fuera.
const DECIMAL_GROUPS: Array<{ title: string; types: NumberFormatType[] }> = (() => {
  // Agrupación por la lógica del negocio (joyería), no por unidad técnica:
  //  · Moneda incluye la cotización (Tipo de cambio).
  //  · Metales = lo esencial del metal (gramos finos, merma en gramos, pureza).
  //  · Medidas y cantidades = peso/medida físicos del artículo + conteos.
  const explicit: Array<{ title: string; types: NumberFormatType[] }> = [
    { title: "Moneda",               types: ["MONEY", "MONEY_EXTENDED", "AJUSTE_AMOUNT", "FX_RATE"] },
    { title: "Metales",              types: ["METAL_GRAMS", "MERMA_GRAMS", "PURITY"] },
    { title: "Porcentajes",          types: ["PERCENT", "MARGIN_PERCENT", "TAX_PERCENT", "AJUSTE_PERCENT", "MERMA_PERCENT"] },
    { title: "Medidas y cantidades", types: ["WEIGHT", "DIMENSION", "QUANTITY", "INTEGER"] },
  ];
  // Catch-all: cualquier tipo de PRESET_ORDER no asignado arriba (p.ej. tipos
  // futuros) se muestra igual bajo "Otros" para no desaparecer de la UI.
  // Hoy todos están clasificados → queda vacío y NO se renderiza.
  const assigned = new Set<NumberFormatType>(explicit.flatMap((g) => g.types));
  const otros = PRESET_ORDER.filter((t) => !assigned.has(t));
  return otros.length ? [...explicit, { title: "Otros", types: otros }] : explicit;
})();

// Ayuda contextual de UNA línea bajo el label — responde "¿DÓNDE se aplican
// estos decimales?" (no "qué es el dato"). Limpieza final: SOLO en los campos
// cuyo alcance genera una duda real. Los claros o auto-explicativos (Dinero,
// Gramos de metal, Pureza, Cantidad, Porcentaje general, Margen, Impuesto, etc.)
// NO llevan ayuda. Es texto de presentación: no cambia datos ni lógica.
const TYPE_HELP: Partial<Record<NumberFormatType, string>> = {
  MONEY_EXTENDED: "Se aplica a importes con decimales extra (precios unitarios).",
  FX_RATE:        "Se aplica a las cotizaciones de monedas.",
  WEIGHT:         "Se aplica al peso mostrado en artículos y documentos.",
  DIMENSION:      "Se aplica a las medidas mostradas de los artículos.",
  INTEGER:        "Se aplica a valores enteros del sistema.",
};

/** API imperativa para que el contenedor unificado coordine el guardado
 *  sin relocar lógica: la sección sigue siendo dueña de su estado, su save
 *  y su validación. */
export type NumericFormatSectionHandle = {
  /** ¿Hay cambios sin guardar respecto del último valor cargado/guardado? */
  isDirty: () => boolean;
  /** Guarda SOLO este dominio. true = OK; false = el PATCH falló (ya mostró su
   *  toast de error). No emite toast de éxito: en modo embedded el contenedor
   *  muestra el toast único. */
  save: () => Promise<boolean>;
};

export type NumericFormatSectionProps = {
  /** Callback opcional: se invoca cada vez que cambia la config local
   *  (incluido el preview en vivo, antes de guardar). Si no se provee, la
   *  sección funciona stand-alone. */
  onConfigChange?: (config: NumberFormatConfig) => void;
  /** Embebido en la pantalla unificada: oculta el botón propio (el guardado lo
   *  coordina el contenedor vía ref). Standalone/legacy = false → botón visible. */
  embedded?: boolean;
};

const NumericFormatSection = forwardRef<NumericFormatSectionHandle, NumericFormatSectionProps>(
  function NumericFormatSection({ onConfigChange, embedded = false }, ref) {
  const { reload } = useNumberFormat();
  const [config, setConfig] = useState<NumberFormatConfig>(DEFAULT_NUMBER_FORMAT_CONFIG);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  // Snapshot del último valor cargado/guardado — base del dirty-tracking.
  const initialRef = useRef<NumberFormatConfig | null>(null);

  useEffect(() => {
    fetchNumberFormat()
      .then((cfg) => {
        setConfig(cfg);
        initialRef.current = cfg;
        onConfigChange?.(cfg);
      })
      .catch((err) => {
        if (err instanceof ApiError && err.status === 403) return;
        toast.error("Error al cargar la configuración de formato numérico.");
      })
      .finally(() => setLoading(false));
    // onConfigChange referenced once on mount; we re-emit on every setConfig below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function updateConfig(next: NumberFormatConfig | ((prev: NumberFormatConfig) => NumberFormatConfig)) {
    setConfig((prev) => {
      const value = typeof next === "function" ? next(prev) : next;
      onConfigChange?.(value);
      return value;
    });
  }

  function setDecimals(type: NumberFormatType, decimals: number) {
    updateConfig((prev) => ({
      ...prev,
      presets: {
        ...prev.presets,
        [type]: { ...(prev.presets[type] ?? {}), decimals },
      },
    }));
  }

  // Guarda SOLO este dominio. Sin toast de éxito (lo decide el caller).
  // Reutilizado por el botón standalone y por el ref embebido.
  async function doSave(): Promise<boolean> {
    setSaving(true);
    try {
      const updated = await updateNumberFormat(config);
      setConfig(updated);
      initialRef.current = updated;
      onConfigChange?.(updated);
      reload();
      return true;
    } catch (err) {
      if (err instanceof ApiError && err.status === 403) {
        toast.error("No tenés permisos para guardar esta configuración.");
      } else {
        toast.error("Error al guardar la configuración.");
      }
      return false;
    } finally {
      setSaving(false);
    }
  }

  // Botón propio (standalone/legacy): guarda y muestra éxito.
  async function handleSave() {
    if (await doSave()) toast.success("Configuración de formato numérico guardada.");
  }

  useImperativeHandle(
    ref,
    () => ({
      isDirty: () =>
        initialRef.current != null &&
        JSON.stringify(config) !== JSON.stringify(initialRef.current),
      save: doSave,
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [config],
  );

  const isCustom = config.region === "CUSTOM";

  const regionPreview = useMemo(
    () => formatNumber(1234567.5, "MONEY", config),
    [config],
  );

  if (loading) {
    return <div className="text-sm text-muted py-8 text-center">Cargando…</div>;
  }

  return (
    <div className={embedded ? "space-y-6" : "space-y-6 max-w-2xl"}>
      <TPCard title="Región">
        <div className="space-y-4">
          <TPField
            label="Formato regional"
            hint="Define los separadores de miles y decimal en toda la app."
          >
            <TPComboFixed
              value={config.region}
              onChange={(v: string) =>
                updateConfig((prev) => ({ ...prev, region: (v as NumberFormatConfig["region"]) || "AR" }))
              }
              options={REGION_OPTIONS}
              placeholder="Seleccionar región…"
            />
          </TPField>

          {isCustom && (
            <div className="grid grid-cols-2 gap-4">
              <TPField label="Separador de miles" hint="Ej: . o , o espacio">
                <TPInput
                  value={config.custom.thousands}
                  onChange={(v) =>
                    updateConfig((prev) => ({ ...prev, custom: { ...prev.custom, thousands: v.slice(0, 1) } }))
                  }
                  placeholder="."
                />
              </TPField>
              <TPField label="Separador decimal" hint="Ej: , o .">
                <TPInput
                  value={config.custom.decimal}
                  onChange={(v) =>
                    updateConfig((prev) => ({ ...prev, custom: { ...prev.custom, decimal: v.slice(0, 1) || "," } }))
                  }
                  placeholder=","
                />
              </TPField>
            </div>
          )}

          <div className="rounded-xl border border-border bg-surface2 px-4 py-3 space-y-1">
            <span className="text-xs text-muted block">Vista previa</span>
            <span className="text-sm font-mono text-text">{regionPreview}</span>
          </div>
        </div>
      </TPCard>

      <TPCard title="Decimales por tipo de dato">
        <p className="text-xs text-muted leading-relaxed mb-4">
          Ajustá cuántos decimales se muestran por tipo. El prefijo, sufijo y
          ceros finales usan los valores recomendados del sistema.
        </p>
        {/* Cada grupo es una sub-card con encabezado propio → separación clara
            y menos sensación de tabla larga. En embedded las sub-cards fluyen
            en 2 columnas (aprovechan el ancho); standalone/mobile apilan. */}
        <div className={embedded ? "grid gap-4 xl:grid-cols-2" : "space-y-4"}>
          {DECIMAL_GROUPS.map((group) => (
            <div
              key={group.title}
              className="rounded-xl border border-border overflow-hidden"
            >
              <div className="bg-surface2 px-4 py-2 border-b border-border">
                <span className="text-xs font-semibold uppercase tracking-wide text-text">
                  {group.title}
                </span>
              </div>
              <div className="px-4 py-1">
                {group.types.map((type) => {
                  const decimals =
                    config.presets[type]?.decimals ?? DEFAULT_PRESETS[type].decimals;
                  return (
                    <div
                      key={type}
                      className="flex flex-col gap-1 py-2 border-b border-border/40 last:border-0 sm:flex-row sm:items-center sm:gap-3"
                    >
                      <div className="sm:flex-1 sm:min-w-0">
                        <span className="text-sm text-text block">{PRESET_LABELS[type]}</span>
                        {TYPE_HELP[type] && (
                          <span className="block text-[11px] text-muted leading-snug">
                            {TYPE_HELP[type]}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="w-32 shrink-0 sm:w-36">
                          <TPComboFixed
                            value={String(decimals)}
                            onChange={(v: string) => setDecimals(type, Number(v) || 0)}
                            options={DECIMALS_OPTIONS}
                          />
                        </div>
                        <span className="flex-1 text-xs font-mono text-muted tabular-nums text-right sm:flex-none sm:min-w-[6rem]">
                          {formatNumber(SAMPLE[type], type, config)}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </TPCard>

      {!embedded && (
        <div className="flex justify-end pt-2">
          <TPButton variant="primary" onClick={handleSave} disabled={saving}>
            {saving ? "Guardando…" : "Guardar cambios"}
          </TPButton>
        </div>
      )}
    </div>
  );
});

export default NumericFormatSection;
