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

import React, { useEffect, useMemo, useState } from "react";
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

export type NumericFormatSectionProps = {
  /** Callback opcional: se invoca cada vez que cambia la config local
   *  (incluido el preview en vivo, antes de guardar). El contenedor con
   *  tabs lo usa para alimentar un panel de previews globales sin tener
   *  que duplicar fetch. Si no se provee, la sección funciona stand-alone. */
  onConfigChange?: (config: NumberFormatConfig) => void;
};

export default function NumericFormatSection({ onConfigChange }: NumericFormatSectionProps = {}) {
  const { reload } = useNumberFormat();
  const [config, setConfig] = useState<NumberFormatConfig>(DEFAULT_NUMBER_FORMAT_CONFIG);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchNumberFormat()
      .then((cfg) => {
        setConfig(cfg);
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

  async function handleSave() {
    setSaving(true);
    try {
      const updated = await updateNumberFormat(config);
      setConfig(updated);
      onConfigChange?.(updated);
      reload();
      toast.success("Configuración de formato numérico guardada.");
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

  const isCustom = config.region === "CUSTOM";

  const regionPreview = useMemo(
    () => formatNumber(1234567.5, "MONEY", config),
    [config],
  );

  if (loading) {
    return <div className="text-sm text-muted py-8 text-center">Cargando…</div>;
  }

  return (
    <div className="space-y-6 max-w-2xl">
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
        <p className="text-xs text-muted leading-relaxed mb-3">
          Ajustá cuántos decimales se muestran por tipo. El prefijo, sufijo y
          ceros finales usan los valores recomendados del sistema.
        </p>
        <div className="space-y-2">
          {PRESET_ORDER.map((type) => {
            const decimals =
              config.presets[type]?.decimals ?? DEFAULT_PRESETS[type].decimals;
            return (
              <div
                key={type}
                className="grid grid-cols-[1fr_auto_auto] items-center gap-3 py-1.5 border-b border-border/40 last:border-0"
              >
                <span className="text-sm text-text">{PRESET_LABELS[type]}</span>
                <div className="w-36">
                  <TPComboFixed
                    value={String(decimals)}
                    onChange={(v: string) => setDecimals(type, Number(v) || 0)}
                    options={DECIMALS_OPTIONS}
                  />
                </div>
                <span className="text-xs font-mono text-muted tabular-nums min-w-[7rem] text-right">
                  {formatNumber(SAMPLE[type], type, config)}
                </span>
              </div>
            );
          })}
        </div>
      </TPCard>

      <div className="flex justify-end pt-2">
        <TPButton variant="primary" onClick={handleSave} disabled={saving}>
          {saving ? "Guardando…" : "Guardar cambios"}
        </TPButton>
      </div>
    </div>
  );
}
