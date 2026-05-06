// src/components/ui/ImportColumnMappingStep.tsx
// Paso visual de mapeo de columnas para el wizard de importación masiva.
// Muestra una tabla con (columna del archivo | campo del sistema | ejemplo)
// y valida campos obligatorios y duplicados antes de permitir continuar.

import React, { useMemo } from "react";
import { AlertCircle, ArrowRight, ChevronLeft, Info } from "lucide-react";
import type { FieldDef, ColumnMapping } from "../../lib/import-mapping/types";
import { getMissingRequired, getDuplicateMappings } from "../../lib/import-mapping/applyMapping";
import { TPButton } from "./TPButton";
import { cn } from "./tp";

interface Props {
  mappings:         ColumnMapping[];
  fields:           FieldDef[];
  onChangeMappings: (next: ColumnMapping[]) => void;
  onContinue:       () => void;
  onBack:           () => void;
  busy?:            boolean;
  title?:           string;
}

export default function ImportColumnMappingStep({
  mappings,
  fields,
  onChangeMappings,
  onContinue,
  onBack,
  busy = false,
  title = "Mapeo de columnas",
}: Props) {
  const requiredKeys = fields.filter(f => f.required).map(f => f.key);

  const missing    = useMemo(() => getMissingRequired(mappings, requiredKeys, fields), [mappings, requiredKeys, fields]);
  const duplicates = useMemo(() => getDuplicateMappings(mappings), [mappings]);
  const canContinue = missing.length === 0 && duplicates.length === 0;

  function handleChange(idx: number, value: string) {
    const next = mappings.map((m, i) =>
      i === idx ? { ...m, mappedTo: value === "" ? null : value } : m
    );
    onChangeMappings(next);
  }

  // Contar columnas realmente mapeadas
  const mappedCount = mappings.filter(m => m.mappedTo).length;

  return (
    <div className="flex flex-col gap-4">

      {/* Encabezado */}
      <div>
        <h3 className="text-base font-semibold text-text">{title}</h3>
        <p className="text-sm text-muted mt-1">
          Asociá cada columna de tu archivo al campo correspondiente del sistema.
          Las columnas sin asignar serán ignoradas.{" "}
          <span className="font-medium text-text">{mappedCount} de {mappings.length} asignadas.</span>
        </p>
      </div>

      {/* Banners de error */}
      {missing.length > 0 && (
        <div className="flex items-start gap-2 rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2.5 text-sm text-red-400">
          <AlertCircle size={15} className="mt-0.5 shrink-0" />
          <span>
            Campos obligatorios sin asignar:{" "}
            <strong>{missing.join(", ")}</strong>
          </span>
        </div>
      )}
      {duplicates.length > 0 && (
        <div className="flex items-start gap-2 rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-2.5 text-sm text-amber-400">
          <AlertCircle size={15} className="mt-0.5 shrink-0" />
          <span>
            Campo asignado más de una vez:{" "}
            <strong>
              {duplicates.map(k => fields.find(f => f.key === k)?.label ?? k).join(", ")}
            </strong>
          </span>
        </div>
      )}

      {/* Tabla de mapeo */}
      <div className="rounded-xl border border-border overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-surface2/40">
              <th className="px-3 py-2.5 text-left font-medium text-muted w-[38%]">
                Columna del archivo
              </th>
              <th className="px-3 py-2.5 text-left font-medium text-muted w-[40%]">
                Campo del sistema
              </th>
              <th className="px-3 py-2.5 text-left font-medium text-muted w-[22%]">
                Ejemplo
              </th>
            </tr>
          </thead>
          <tbody>
            {mappings.map((m, idx) => {
              const isDuplicate = m.mappedTo ? duplicates.includes(m.mappedTo) : false;
              const fieldDef    = m.mappedTo ? fields.find(f => f.key === m.mappedTo) : null;
              return (
                <tr
                  key={idx}
                  className={cn(
                    "border-b border-border last:border-0 transition-colors",
                    isDuplicate && "bg-amber-500/5",
                    !m.mappedTo && "opacity-60"
                  )}
                >
                  {/* Columna del archivo */}
                  <td className="px-3 py-2.5">
                    <div className="flex items-center gap-1.5">
                      <span
                        className="font-mono text-xs bg-surface2 px-1.5 py-0.5 rounded text-text/80 truncate max-w-[180px]"
                        title={m.fileHeader}
                      >
                        {m.fileHeader}
                      </span>
                      {fieldDef?.required && (
                        <span className="text-xs text-primary font-bold leading-none">*</span>
                      )}
                    </div>
                  </td>

                  {/* Selector de campo del sistema */}
                  <td className="px-3 py-2.5">
                    <select
                      value={m.mappedTo ?? ""}
                      onChange={e => handleChange(idx, e.target.value)}
                      disabled={busy}
                      className={cn(
                        "w-full rounded-lg border px-2 py-1.5 text-sm bg-background text-text",
                        "focus:outline-none focus:ring-1 focus:ring-primary/50 transition-colors",
                        "disabled:opacity-60 disabled:cursor-not-allowed",
                        isDuplicate
                          ? "border-amber-500/50 focus:ring-amber-500/30"
                          : "border-border",
                        !m.mappedTo && "text-muted"
                      )}
                    >
                      <option value="">— Ignorar columna —</option>
                      <optgroup label="Campos disponibles">
                        {fields.map(f => (
                          <option key={f.key} value={f.key}>
                            {f.label}{f.required ? " *" : ""}
                          </option>
                        ))}
                      </optgroup>
                    </select>
                  </td>

                  {/* Valor de ejemplo */}
                  <td className="px-3 py-2.5">
                    <span
                      className="text-xs text-muted truncate block max-w-[120px]"
                      title={m.example}
                    >
                      {m.example || <span className="italic opacity-60">—</span>}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Leyenda */}
      <div className="flex items-center gap-1.5 text-xs text-muted">
        <Info size={12} className="shrink-0" />
        <span>Los campos marcados con <strong>*</strong> son obligatorios para importar.</span>
      </div>

      {/* Acciones */}
      <div className="flex items-center justify-between pt-1">
        <TPButton variant="ghost" onClick={onBack} disabled={busy}>
          <ChevronLeft size={15} />
          Volver
        </TPButton>
        <TPButton
          variant="primary"
          onClick={onContinue}
          disabled={!canContinue || busy}
          loading={busy}
        >
          Continuar
          <ArrowRight size={15} />
        </TPButton>
      </div>
    </div>
  );
}
