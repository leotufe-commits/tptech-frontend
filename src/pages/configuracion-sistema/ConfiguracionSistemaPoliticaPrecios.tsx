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
  type PricingPolicyConfig,
  type DocumentRoundingConfig,
  type DocumentRoundingMode,
  type DocumentRoundingDirection,
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

const DOC_ROUNDING_DEFAULTS: DocumentRoundingConfig = {
  documentRoundingEnabled:   false,
  documentRoundingMode:      "NONE",
  documentRoundingDirection: "NEAREST",
};

const DEFAULTS: PricingPolicyConfig = {
  pricingLowMarginWarningPercent:  15,
  pricingLowMarginBlockPercent:    null,
  pricingBlockLossSale:            false,
  pricingBlockZeroOrNegativePrice: false,
  pricingBlockPartialData:         false,
};

export default function ConfiguracionSistemaPoliticaPrecios() {
  const [config, setConfig] = useState<PricingPolicyConfig>(DEFAULTS);
  const [docRounding, setDocRounding] = useState<DocumentRoundingConfig>(DOC_ROUNDING_DEFAULTS);
  const [loading, setLoading] = useState(true);
  const [saving,  setSaving]  = useState(false);

  useEffect(() => {
    Promise.all([
      fetchPricingPolicyConfig(),
      fetchDocumentRoundingConfig(),
    ])
      .then(([pol, dr]) => { setConfig(pol); setDocRounding(dr); })
      .catch((err) => {
        if (err instanceof ApiError && err.status === 403) return;
        toast.error("Error al cargar la configuración de precios.");
      })
      .finally(() => setLoading(false));
  }, []);

  async function handleSave() {
    setSaving(true);
    try {
      const [updatedPol, updatedDr] = await Promise.all([
        updatePricingPolicyConfig(config),
        updateDocumentRoundingConfig(docRounding),
      ]);
      setConfig(updatedPol);
      setDocRounding(updatedDr);
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

          {/* Redondeo por comprobante (modo UNIFIED) */}
          <TPCard title="Redondeo por comprobante">
            <p className="text-xs text-muted mb-4">
              Política general de la joyería. Cuando está activa, el sistema
              redondea el <span className="font-semibold text-text">total final</span>{" "}
              de cada venta — después de descuentos, impuestos, envío y forma
              de pago. No afecta líneas individuales ni impuestos.
            </p>

            <div className="space-y-4">
              <div className="flex items-start justify-between gap-4 py-3 border-b border-border/50">
                <div className="min-w-0">
                  <div className="text-sm font-medium text-text">Activar redondeo del comprobante</div>
                  <div className="text-xs text-muted mt-0.5">
                    Si está apagado, el total se muestra tal cual lo calcula el motor (puede tener decimales).
                    Si está encendido, se redondea con la granularidad y dirección elegidas abajo.
                  </div>
                </div>
                <TPCheckbox
                  checked={docRounding.documentRoundingEnabled}
                  onChange={v => setDr("documentRoundingEnabled", v)}
                  label=""
                />
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

              <p className="text-[11px] italic text-muted/80">
                El redondeo por comprobante es independiente del redondeo por lista de precios.
                Si una lista tiene redondeo configurado al neto o al total, esta política lo desactiva
                automáticamente para evitar redondear dos veces.
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
