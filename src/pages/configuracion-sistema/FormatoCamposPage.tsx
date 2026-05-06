// src/pages/configuracion-sistema/FormatoCamposPage.tsx
// Configuración de formato para campos de teléfono y documento
import React, { useEffect, useState } from "react";
import { Sliders } from "lucide-react";
import { TPSectionShell } from "../../components/ui/TPSectionShell";
import { TPCard } from "../../components/ui/TPCard";
import { TPField } from "../../components/ui/TPField";
import TPComboFixed from "../../components/ui/TPComboFixed";
import { TPButton } from "../../components/ui/TPButton";
import { toast } from "../../lib/toast";
import { ApiError } from "../../lib/api";
import {
  fetchFieldFormats,
  updateFieldFormats,
  type FieldFormatsConfig,
} from "../../services/company";
import { formatPhone, formatDocument, countPatternDigits } from "../../lib/format";
import TPInput from "../../components/ui/TPInput";
import { useFieldFormats } from "../../context/FieldFormatsContext";

// ── Opciones de formato ──────────────────────────────────────────────────────

const PHONE_FORMAT_OPTIONS = [
  { value: "raw",             label: "Sin formato  —  11 1123456789" },
  { value: "local_ar_spaces", label: "Con espacios  —  11 1234 5678" },
  { value: "local_ar",        label: "Con guion  —  11 1234-5678" },
  { value: "intl_ar",         label: "Internacional  —  +54 11 1234-5678" },
  { value: "custom",          label: "Personalizado  —  usás # para dígitos" },
];

const DOCUMENT_FORMAT_OPTIONS = [
  { value: "raw",         label: "Sin formato  —  20123456789" },
  { value: "ar_doc",      label: "CUIL / CUIT / DNI  —  20-12345678-9 / 29039672" },
  { value: "doc_dots",    label: "Con puntos  —  123.456.789" },
  { value: "intl_dashes", label: "Con guiones  —  123-456-789" },
  { value: "custom",      label: "Personalizado  —  usás # para dígitos" },
];

// Muestra de número de teléfono según el formato seleccionado
function getPhoneSample(format: string): string {
  if (format.startsWith("custom:")) {
    const n = countPatternDigits(format.slice(7));
    if (!n) return "1123456789";
    return Array.from({ length: n }, (_, i) => ((i % 9) + 1).toString()).join("");
  }
  if (format.startsWith("us_") || format === "phone_3_3_4" || format === "phone_3_3_4_dash") return "5551234567";
  if (format.startsWith("es_")) return "612345678";
  if (format.startsWith("br_")) return "11912345678";
  if (format.startsWith("cl_")) return "912345678";
  if (format === "phone_digits") return "1123456789";
  return "1123456789"; // Argentina por defecto (10 dígitos)
}

function getDocSamples(format: string): Array<{ label: string; value: string }> {
  switch (format) {
    case "ar_doc":      return [{ label: "CUIT / CUIL",    value: "20290396728"    },
                                { label: "DNI",            value: "29039672"       }];
    case "doc_dots":
    case "intl_spaces":
    case "intl_dashes": return [{ label: "9 dígitos",      value: "123456789"      },
                                { label: "11 dígitos",     value: "20123456789"    }];
    case "cuit_cuil":   return [{ label: "CUIT / CUIL",    value: "20123456789"    }];
    case "dni":         return [{ label: "8 dígitos",      value: "12345678"       },
                                { label: "7 dígitos",      value: "1234567"        }];
    case "ssn":         return [{ label: "SSN",            value: "123456789"      }];
    case "cpf":         return [{ label: "CPF",            value: "12345678900"    }];
    case "cnpj":        return [{ label: "CNPJ",           value: "12345678000199" }];
    case "rut":         return [{ label: "RUT 9 dígitos",  value: "123456789"      },
                                { label: "RUT 8 dígitos",  value: "12345678"       }];
    case "es_dni":      return [{ label: "DNI",            value: "12345678A"      }];
    case "es_nie":      return [{ label: "NIE",            value: "X1234567L"      }];
    default:            return [{ label: "11 dígitos",     value: "20123456789"    },
                                { label: "8 dígitos",      value: "12345678"       }];
  }
}

const DEFAULTS: FieldFormatsConfig = {
  phoneFormat:    "raw",
  documentFormat: "raw",
};

// ── Componente ───────────────────────────────────────────────────────────────

export default function FormatoCamposPage() {
  const { reload } = useFieldFormats();
  const [config, setConfig] = useState<FieldFormatsConfig>(DEFAULTS);
  const [loading, setLoading] = useState(true);
  const [saving,  setSaving]  = useState(false);

  useEffect(() => {
    fetchFieldFormats()
      .then(setConfig)
      .catch((err) => {
        // 403 = sin permisos → usar defaults silenciosamente
        if (err instanceof ApiError && err.status === 403) return;
        toast.error("Error al cargar la configuración de formato.");
      })
      .finally(() => setLoading(false));
  }, []);

  // Flags y patrones para el modo personalizado
  const phoneIsCustom    = config.phoneFormat.startsWith("custom:");
  const phoneCustomPat   = phoneIsCustom ? config.phoneFormat.slice(7) : "";
  const docIsCustom      = config.documentFormat.startsWith("custom:");
  const docCustomPat     = docIsCustom ? config.documentFormat.slice(7) : "";

  async function handleSave() {
    if (phoneIsCustom && countPatternDigits(phoneCustomPat) === 0) {
      toast.error("El patrón de teléfono debe contener al menos un # para indicar dígitos.");
      return;
    }
    if (docIsCustom && countPatternDigits(docCustomPat) === 0) {
      toast.error("El patrón de documento debe contener al menos un # para indicar dígitos.");
      return;
    }
    setSaving(true);
    try {
      const updated = await updateFieldFormats(config);
      setConfig(updated);
      reload();
      toast.success("Configuración de formato guardada.");
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

  // Previews en tiempo real
  const phonePreview = formatPhone("", getPhoneSample(config.phoneFormat), config.phoneFormat);
  const docSamples = (() => {
    if (docIsCustom) {
      const n = countPatternDigits(docCustomPat);
      if (!n) return [{ label: "Vista previa", value: "" }];
      const sample = Array.from({ length: n }, (_, i) => ((i % 9) + 1).toString()).join("");
      return [{ label: "Patrón propio", value: sample }];
    }
    return getDocSamples(config.documentFormat);
  })();

  return (
    <TPSectionShell
      title="Formato de campos"
      subtitle="Definí cómo se muestran teléfonos y documentos en los listados y fichas del sistema. No afecta el valor guardado."
      icon={<Sliders size={22} />}
    >
      {loading ? (
        <div className="text-sm text-muted py-8 text-center">Cargando…</div>
      ) : (
        <div className="space-y-6 max-w-2xl">

          {/* Teléfono */}
          <TPCard title="Formato de teléfono">
            <div className="space-y-4">
              <TPField
                label="Formato de visualización"
                hint="Solo afecta cómo se ve el número en pantalla. El valor se guarda sin cambios."
              >
                <TPComboFixed
                  value={phoneIsCustom ? "custom" : config.phoneFormat}
                  onChange={(v: string) => {
                    if (v === "custom") {
                      setConfig(prev => ({ ...prev, phoneFormat: "custom:" }));
                    } else {
                      setConfig(prev => ({ ...prev, phoneFormat: v || "raw" }));
                    }
                  }}
                  options={PHONE_FORMAT_OPTIONS}
                  placeholder="Seleccionar formato…"
                />
              </TPField>

              {/* Campo Patrón — visible solo cuando se elige Personalizado */}
              {phoneIsCustom && (
                <TPField
                  label="Patrón"
                  hint="Usá # para dígitos. Los demás caracteres se respetan."
                >
                  <TPInput
                    value={phoneCustomPat}
                    onChange={(v) => setConfig(prev => ({ ...prev, phoneFormat: "custom:" + v }))}
                    placeholder="## ####-####"
                  />
                </TPField>
              )}

              {/* Preview en tiempo real */}
              <div className="rounded-xl border border-border bg-surface2 px-4 py-3 space-y-1">
                <span className="text-xs text-muted block">Vista previa</span>
                <span className="text-sm font-mono text-text">{phonePreview || "—"}</span>
              </div>

              <p className="text-xs text-muted leading-relaxed">
                Se aplica en: Clientes, Proveedores, Vendedores, Empresa y todos los módulos con campo teléfono.
                El formato solo funciona si el número tiene la estructura numérica esperada.
              </p>
            </div>
          </TPCard>

          {/* Documento */}
          <TPCard title="Formato de documento">
            <div className="space-y-4">
              <TPField
                label="Formato de visualización"
                hint="El valor se guarda limpio. Al mostrar se aplica la máscara según el tipo seleccionado."
              >
                <TPComboFixed
                  value={docIsCustom ? "custom" : config.documentFormat}
                  onChange={(v: string) => {
                    if (v === "custom") {
                      setConfig(prev => ({ ...prev, documentFormat: "custom:" }));
                    } else {
                      setConfig(prev => ({ ...prev, documentFormat: v || "raw" }));
                    }
                  }}
                  options={DOCUMENT_FORMAT_OPTIONS}
                  placeholder="Seleccionar formato…"
                />
              </TPField>

              {/* Campo Patrón — visible solo cuando se elige Personalizado */}
              {docIsCustom && (
                <TPField
                  label="Patrón"
                  hint="Usá # para dígitos. Los demás caracteres se respetan."
                >
                  <TPInput
                    value={docCustomPat}
                    onChange={(v) => setConfig(prev => ({ ...prev, documentFormat: "custom:" + v }))}
                    placeholder="##-########-#"
                  />
                </TPField>
              )}

              {/* Preview en tiempo real */}
              <div className="rounded-xl border border-border bg-surface2 px-4 py-3 space-y-2">
                <span className="text-xs text-muted block">Vista previa</span>
                <div className="flex flex-wrap gap-x-6 gap-y-1">
                  {docSamples.map(({ label, value }) => (
                    <div key={label}>
                      <span className="text-xs text-muted">{label}: </span>
                      <span className="text-sm font-mono text-text">
                        {value ? formatDocument(value, config.documentFormat) : "—"}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              <p className="text-xs text-muted leading-relaxed">
                Se aplica en: Clientes, Proveedores, Vendedores y otros módulos con campo documento.
                El formato solo se aplica si el número tiene la longitud esperada.
              </p>
            </div>
          </TPCard>

          {/* Guardar */}
          <div className="flex justify-end pt-2">
            <TPButton variant="primary" onClick={handleSave} disabled={saving}>
              {saving ? "Guardando…" : "Guardar cambios"}
            </TPButton>
          </div>

        </div>
      )}
    </TPSectionShell>
  );
}
