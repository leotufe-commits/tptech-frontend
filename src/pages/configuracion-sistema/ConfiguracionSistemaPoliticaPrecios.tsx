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
import { toast } from "../../lib/toast";
import {
  fetchPricingPolicyConfig,
  updatePricingPolicyConfig,
  type PricingPolicyConfig,
} from "../../services/company";

const DEFAULTS: PricingPolicyConfig = {
  pricingLowMarginWarningPercent:  15,
  pricingLowMarginBlockPercent:    null,
  pricingBlockLossSale:            false,
  pricingBlockZeroOrNegativePrice: false,
  pricingBlockPartialData:         false,
};

export default function ConfiguracionSistemaPoliticaPrecios() {
  const [config, setConfig] = useState<PricingPolicyConfig>(DEFAULTS);
  const [loading, setLoading] = useState(true);
  const [saving,  setSaving]  = useState(false);

  useEffect(() => {
    fetchPricingPolicyConfig()
      .then(setConfig)
      .catch(() => toast.error("Error al cargar la configuración de precios."))
      .finally(() => setLoading(false));
  }, []);

  async function handleSave() {
    setSaving(true);
    try {
      const updated = await updatePricingPolicyConfig(config);
      setConfig(updated);
      toast.success("Configuración guardada.");
    } catch {
      toast.error("Error al guardar la configuración.");
    } finally {
      setSaving(false);
    }
  }

  function set<K extends keyof PricingPolicyConfig>(key: K, value: PricingPolicyConfig[K]) {
    setConfig(prev => ({ ...prev, [key]: value }));
  }

  return (
    <TPSectionShell
      title="Política de alertas de precio"
      subtitle="Definí cuándo el sistema alerta o bloquea una venta según el margen, el costo y la validez del precio."
      icon={<ShieldAlert size={22} />}
    >
      {loading ? (
        <div className="text-sm text-muted py-8 text-center">Cargando…</div>
      ) : (
        <div className="space-y-6 max-w-2xl">

          {/* Margen */}
          <TPCard title="Umbrales de margen">
            <div className="space-y-4">
              <TPField
                label="Margen mínimo — solo alerta"
                hint="Si el margen del artículo está por debajo de este porcentaje, se muestra una advertencia. Dejalo vacío para desactivar."
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

              <TPField
                label="Margen mínimo — bloquea confirmación"
                hint="Si el margen queda por debajo de este porcentaje, la venta NO puede confirmarse. Dejalo vacío para no bloquear."
              >
                <TPNumberInput
                  value={config.pricingLowMarginBlockPercent}
                  onChange={v => set("pricingLowMarginBlockPercent", v)}
                  min={0}
                  max={100}
                  step={0.5}
                  decimals={1}
                  placeholder="Sin límite de bloqueo"
                  suffix="%"
                />
              </TPField>
            </div>
          </TPCard>

          {/* Bloqueos */}
          <TPCard title="Reglas de bloqueo de confirmación">
            <p className="text-xs text-muted mb-4">
              Cuando una regla de bloqueo está activa, el sistema impide confirmar ventas que la violen.
              El simulador y la vista previa de precio siempre muestran las alertas aunque no estén como bloqueo.
            </p>

            <div className="space-y-4">
              <div className="flex items-start justify-between gap-4 py-3 border-b border-border/50">
                <div className="min-w-0">
                  <div className="text-sm font-medium text-text">Bloquear venta a pérdida</div>
                  <div className="text-xs text-muted mt-0.5">
                    Impide confirmar si el precio de venta es menor o igual al costo calculado.
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
                  <div className="text-sm font-medium text-text">Bloquear precio cero o negativo</div>
                  <div className="text-xs text-muted mt-0.5">
                    Impide confirmar si el precio final resultante es cero o negativo (e.g., por promociones excesivas).
                    Recomendado activo.
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
                  <div className="text-sm font-medium text-text">Bloquear cuando el cálculo es parcial</div>
                  <div className="text-xs text-muted mt-0.5">
                    Impide confirmar si el costo o el precio no pudieron calcularse completamente por falta de cotizaciones o datos.
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
