// src/pages/article-detail/ArticleImportModal.tsx
// Modal de importación masiva de artículos (wizard 4 pasos con mapeo de columnas)
import React, { useCallback, useRef, useState } from "react";
import * as XLSX from "xlsx-js-style";
import {
  AlertCircle,
  AlertTriangle,
  Check,
  CheckCircle2,
  ChevronRight,
  Download,
  FileSpreadsheet,
  Info,
  Loader2,
  RefreshCw,
  Upload,
  Wand2,
  X,
} from "lucide-react";

import { Modal } from "../../components/ui/Modal";
import { TPButton } from "../../components/ui/TPButton";
import { cn } from "../../components/ui/tp";
import ImportColumnMappingStep from "../../components/ui/ImportColumnMappingStep";
import { toast } from "../../lib/toast";
import {
  articlesApi,
  type ImportPreviewResult,
  type ImportPreviewRow,
  type ImportCommitResult,
} from "../../services/articles";
import { autoMatchColumns } from "../../lib/import-mapping/autoMatch";
import { applyMapping } from "../../lib/import-mapping/applyMapping";
import { ARTICLE_FIELDS } from "../../lib/import-mapping/articleFields";
import type { ColumnMapping } from "../../lib/import-mapping/types";

// ---------------------------------------------------------------------------
// Helpers de parseo de archivo en frontend
// ---------------------------------------------------------------------------

/**
 * Lee el archivo localmente y extrae encabezados, filas y ejemplos para el
 * paso de mapeo de columnas.
 *
 * También detecta si el archivo es de formato Guided (primera hoja = "Artículos"
 * y primera columna = "SKU Padre"). En ese caso `isGuided = true` y el modal
 * saltea el mapeo de columnas — el archivo se envía directamente al backend.
 */
function parseFileHeaders(file: File): Promise<{
  headers: string[];
  rows: Record<string, string>[];
  examples: Record<string, string>;
  isGuided: boolean;
}> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const buffer = e.target?.result as ArrayBuffer;
        const wb = XLSX.read(buffer, { type: "array" });
        const wsName = wb.SheetNames[0];
        const ws = wb.Sheets[wsName];
        const raw = XLSX.utils.sheet_to_json<any[]>(ws, { header: 1, defval: "" });
        // Detectar formato Guided: hoja "Artículos" + primera columna "SKU Padre"
        const isGuided =
          wsName === "Artículos" &&
          String((raw[0] as any[])?.[0] ?? "").trim() === "SKU Padre";
        if (raw.length < 2) {
          resolve({ headers: [], rows: [], examples: {}, isGuided });
          return;
        }
        const headers = (raw[0] as string[])
          .map(h => String(h ?? "").trim())
          .filter(Boolean);
        const dataRows = (raw.slice(1) as any[][])
          .map(cols => {
            const row: Record<string, string> = {};
            headers.forEach((h, i) => {
              row[h] = String(cols[i] ?? "").trim();
            });
            return row;
          })
          .filter(r => Object.values(r).some(v => v !== ""));
        // Primer valor no vacío de cada columna como ejemplo
        const examples: Record<string, string> = {};
        for (const h of headers) {
          examples[h] = dataRows.find(r => r[h])?.[h] ?? "";
        }
        resolve({ headers, rows: dataRows, examples, isGuided });
      } catch (err) {
        reject(err);
      }
    };
    reader.onerror = () => reject(new Error("No se pudo leer el archivo."));
    reader.readAsArrayBuffer(file);
  });
}

// ---------------------------------------------------------------------------
type Step = "upload" | "mapping" | "preview" | "results";

const STEP_LABELS: Record<Step, string> = {
  upload:  "1. Cargar archivo",
  mapping: "2. Mapeo de columnas",
  preview: "3. Vista previa",
  results: "4. Resultados",
};

const STATUS_COLORS: Record<ImportPreviewRow["status"], string> = {
  valid:           "text-emerald-400",
  overwrite:       "text-amber-300",
  warning:         "text-yellow-300",
  implicit_parent: "text-blue-400",
  error:           "text-red-400",
};
const STATUS_ICONS: Record<ImportPreviewRow["status"], React.ReactNode> = {
  valid:           <Check size={12} />,
  overwrite:       <RefreshCw size={12} />,
  warning:         <AlertTriangle size={12} />,
  implicit_parent: <Wand2 size={12} />,
  error:           <X size={12} />,
};
const STATUS_LABELS: Record<ImportPreviewRow["status"], string> = {
  valid:           "Nuevo",
  overwrite:       "Se sobreescribirá",
  warning:         "Advertencia",
  implicit_parent: "Padre implícito",
  error:           "Error",
};

// ---------------------------------------------------------------------------
export type ArticleImportModalProps = {
  open: boolean;
  onClose: () => void;
  onImported?: () => void;
};

export default function ArticleImportModal({
  open,
  onClose,
  onImported,
}: ArticleImportModalProps) {
  const [step,         setStep]         = useState<Step>("upload");
  const [file,         setFile]         = useState<File | null>(null);
  const [dragging,     setDragging]     = useState(false);
  const [preview,      setPreview]      = useState<ImportPreviewResult | null>(null);
  const [results,      setResults]      = useState<ImportCommitResult | null>(null);
  const [onConflict,   setOnConflict]   = useState<"skip" | "update">("skip");
  const [busyPreview,  setBusyPreview]  = useState(false);
  const [busyImport,   setBusyImport]   = useState(false);
  const [busyParse,    setBusyParse]    = useState(false);
  const [dlGuided,     setDlGuided]     = useState(false);
  const [dlExport,     setDlExport]     = useState(false);
  // true cuando el archivo cargado es formato Guided — saltea el paso de mapeo
  const [isGuidedFile, setIsGuidedFile] = useState(false);

  // Estado del paso de mapeo
  const [rawRows,      setRawRows]      = useState<Record<string, string>[]>([]);
  const [mappings,     setMappings]     = useState<ColumnMapping[]>([]);
  const [parsedFileName, setParsedFileName] = useState("");

  const fileInputRef = useRef<HTMLInputElement>(null);

  // ── Reset al cerrar ─────────────────────────────────────────────────────
  function handleClose() {
    if (busyPreview || busyImport || busyParse) return;
    setStep("upload");
    setFile(null);
    setPreview(null);
    setResults(null);
    setRawRows([]);
    setMappings([]);
    setParsedFileName("");
    setIsGuidedFile(false);
    onClose();
  }

  // ── Drop zone ────────────────────────────────────────────────────────────
  function handleFileDrop(f: File) {
    const ok = f.name.endsWith(".xlsx") || f.name.endsWith(".xls") || f.name.endsWith(".csv");
    if (!ok) { toast.error("Solo se aceptan archivos .xlsx, .xls o .csv"); return; }
    setFile(f);
    setPreview(null);
    setRawRows([]);
    setMappings([]);
    setIsGuidedFile(false);
  }

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const f = e.dataTransfer.files?.[0];
    if (f) handleFileDrop(f);
  }, []);

  // ── Avanzar al paso de mapeo (o directo a preview si es Guided) ─────────
  async function handleGoToMapping() {
    if (!file) return;
    setBusyParse(true);
    try {
      const { headers, rows, examples, isGuided } = await parseFileHeaders(file);

      // ── Formato Guided detectado: saltear mapeo, enviar archivo al backend ──
      if (isGuided) {
        setIsGuidedFile(true);
        // El formato Guided es una plantilla estructurada donde el usuario espera
        // que los cambios se apliquen. Cambiar el default a "update" para evitar
        // que una reimportación quede silenciosa con "skip".
        setOnConflict("update");
        setBusyPreview(true);
        try {
          const result = await articlesApi.import.preview(file);
          setPreview(result);
          setStep("preview");
        } catch (e: any) {
          toast.error(e?.message || "Error al procesar el archivo Guided.");
        } finally {
          setBusyPreview(false);
        }
        return;
      }

      // ── Formato estándar: continuar con el wizard de mapeo ──────────────
      setIsGuidedFile(false);
      if (headers.length === 0) {
        toast.error("El archivo no contiene encabezados válidos.");
        return;
      }
      if (rows.length === 0) {
        toast.error("El archivo no contiene datos.");
        return;
      }
      if (rows.length > 2000) {
        toast.error("El archivo supera el límite de 2000 filas.");
        return;
      }
      const autoMapped = autoMatchColumns(headers, ARTICLE_FIELDS, examples);
      setRawRows(rows);
      setMappings(autoMapped);
      setParsedFileName(file.name);
      setStep("mapping");
    } catch (e: any) {
      toast.error(e?.message || "Error al leer el archivo.");
    } finally {
      setBusyParse(false);
    }
  }

  // ── Confirmar mapeo y llamar al preview ──────────────────────────────────
  async function handleMappingContinue() {
    setBusyPreview(true);
    try {
      const mapped = applyMapping(rawRows, mappings);
      if (mapped.length === 0) {
        toast.error("No hay filas para importar tras el mapeo.");
        return;
      }
      const result = await articlesApi.import.previewJson(mapped);
      setPreview(result);
      setStep("preview");
    } catch (e: any) {
      toast.error(e?.message || "Error al procesar el archivo.");
    } finally {
      setBusyPreview(false);
    }
  }

  // ── Execute ──────────────────────────────────────────────────────────────
  async function handleImport() {
    if (!preview) return;
    const canProceed = preview.valid > 0 || preview.overwrite > 0 || preview.warnings > 0 || preview.implicitParents > 0;
    if (!canProceed) { toast.error("No hay filas válidas para importar."); return; }
    setBusyImport(true);
    try {
      let result: ImportCommitResult;
      if (isGuidedFile && file) {
        // Archivo Guided: enviar el archivo directamente al backend (no JSON mapeado)
        result = await articlesApi.import.execute(file, onConflict);
      } else {
        const mapped = applyMapping(rawRows, mappings);
        result = await articlesApi.import.executeJson(mapped, onConflict, parsedFileName);
      }
      setResults(result);
      setStep("results");
      if (result.summary.created > 0 || result.summary.updated > 0) {
        onImported?.();
        toast.success(
          `Importación completada: ${result.summary.created} creados, ${result.summary.updated} actualizados.`
        );
      }
    } catch (e: any) {
      toast.error(e?.message || "Error durante la importación.");
    } finally {
      setBusyImport(false);
    }
  }

  // ── Descargar template ───────────────────────────────────────────────────
  async function handleDownloadGuided() {
    setDlGuided(true);
    try { await articlesApi.import.downloadGuidedTemplate(); }
    catch (e: any) { toast.error(e?.message || "Error al descargar la plantilla guiada."); }
    finally { setDlGuided(false); }
  }
  async function handleGuidedExport() {
    setDlExport(true);
    try { await articlesApi.import.downloadGuidedExport(); }
    catch (e: any) { toast.error(e?.message || "Error al exportar los artículos."); }
    finally { setDlExport(false); }
  }

  // ── Footer ────────────────────────────────────────────────────────────────
  function renderFooter() {
    if (step === "upload") {
      return (
        <div className="flex items-center gap-2 w-full">
          <TPButton
            variant="ghost"
            iconLeft={dlGuided ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />}
            loading={dlGuided}
            onClick={handleDownloadGuided}
          >
            Plantilla guiada
          </TPButton>
          <TPButton
            variant="ghost"
            iconLeft={dlExport ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />}
            loading={dlExport}
            onClick={handleGuidedExport}
          >
            Exportar artículos
          </TPButton>
          <div className="flex-1" />
          <TPButton variant="secondary" onClick={handleClose}>Cancelar</TPButton>
          <TPButton
            onClick={handleGoToMapping}
            disabled={!file}
            loading={busyParse}
            iconLeft={<ChevronRight size={14} />}
          >
            Siguiente
          </TPButton>
        </div>
      );
    }
    if (step === "mapping") {
      // El footer del paso de mapeo lo maneja ImportColumnMappingStep internamente
      return null;
    }
    if (step === "preview") {
      return (
        <div className="flex items-center gap-2 w-full">
          <TPButton variant="secondary" onClick={() => setStep(isGuidedFile ? "upload" : "mapping")} disabled={busyImport}>
            ← Volver
          </TPButton>
          <div className="flex-1" />
          <div className="flex items-center gap-2 text-xs text-muted">
            <span>Artículos existentes:</span>
            <select
              value={onConflict}
              onChange={(e) => setOnConflict(e.target.value as "skip" | "update")}
              className="tp-select h-8 text-xs"
            >
              <option value="skip">Omitir</option>
              <option value="update">Actualizar</option>
            </select>
          </div>
          <TPButton
            onClick={handleImport}
            loading={busyImport}
            disabled={!preview || (preview.valid === 0 && preview.overwrite === 0 && preview.warnings === 0)}
            iconLeft={<Upload size={14} />}
          >
            Importar ahora
          </TPButton>
        </div>
      );
    }
    return (
      <div className="flex justify-end w-full">
        <TPButton onClick={handleClose}>Cerrar</TPButton>
      </div>
    );
  }

  // ── Content: Upload ───────────────────────────────────────────────────────
  function renderUpload() {
    return (
      <div className="space-y-4">
        <div className="rounded-xl border border-border bg-surface2/20 p-4 flex items-start gap-3 text-sm text-muted">
          <Info size={15} className="shrink-0 mt-0.5 text-primary" />
          <div>
            <p className="font-medium text-text mb-1">Instrucciones rápidas</p>
            <ol className="list-decimal list-inside space-y-0.5 text-xs">
              <li>Descargá la plantilla guiada con el botón de abajo (o exportá tus artículos actuales).</li>
              <li>Completá las filas — los artículos con variantes usan SKU Padre para vincularlas.</li>
              <li>Subí el archivo. Si usás la plantilla guiada, se importa directamente sin mapeo extra.</li>
            </ol>
          </div>
        </div>

        {/* Drop zone */}
        <div
          className={cn(
            "rounded-xl border-2 border-dashed transition-colors cursor-pointer p-8 text-center",
            dragging ? "border-primary bg-primary/10" : "border-border hover:border-primary/50",
          )}
          onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={onDrop}
          onClick={() => fileInputRef.current?.click()}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept=".xlsx,.xls,.csv"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) handleFileDrop(f);
              e.target.value = "";
            }}
          />
          {file ? (
            <div className="flex flex-col items-center gap-2">
              <FileSpreadsheet size={36} className="text-primary" />
              <p className="font-medium text-text">{file.name}</p>
              <p className="text-xs text-muted">
                {(file.size / 1024).toFixed(1)} KB · Hacé click para cambiar
              </p>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-2">
              <Upload size={36} className="text-muted/40" />
              <p className="text-sm font-medium text-muted">
                Arrastrá tu archivo aquí o hacé click para seleccionar
              </p>
              <p className="text-xs text-muted/60">Formatos: .xlsx, .xls, .csv · Máximo 10MB</p>
            </div>
          )}
        </div>
      </div>
    );
  }

  // ── Content: Preview ──────────────────────────────────────────────────────
  function renderPreview() {
    if (!preview) return null;
    const { total, articles, variants, valid, errors, overwrite, warnings, implicitParents } = preview;
    const onlyErrors = errors > 0 && valid === 0 && overwrite === 0 && warnings === 0 && implicitParents === 0;

    return (
      <div className="space-y-4">
        {/* Summary cards */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
          {[
            { label: "Nuevos",             count: valid,            color: "text-emerald-400", bg: "bg-emerald-500/10 border-emerald-500/30" },
            { label: "Se sobreescribirán", count: overwrite,        color: "text-amber-300",   bg: "bg-amber-500/10 border-amber-500/30" },
            { label: "Padres implícitos",  count: implicitParents,  color: "text-blue-400",    bg: "bg-blue-500/10 border-blue-500/30" },
            { label: "Advertencias",       count: warnings,         color: "text-yellow-300",  bg: "bg-yellow-500/10 border-yellow-500/30" },
            { label: "Errores",            count: errors,           color: "text-red-400",     bg: "bg-red-500/10 border-red-500/30" },
          ].map(({ label, count, color, bg }) => (
            <div key={label} className={cn("rounded-xl border p-3 text-center", bg)}>
              <div className={cn("text-2xl font-bold", color)}>{count}</div>
              <div className="text-xs text-muted mt-0.5">{label}</div>
            </div>
          ))}
        </div>

        <p className="text-xs text-muted">
          Total: {total} filas ({articles} artículos, {variants} variantes)
        </p>

        {onlyErrors && (
          <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-3 flex items-center gap-2 text-sm text-red-300">
            <AlertCircle size={15} />
            Todas las filas tienen errores. Corregí el archivo antes de importar.
          </div>
        )}

        {/* Tabla de preview */}
        {(() => {
          const hasAnyAttrs = preview.rows.some(r => r.attributes && Object.keys(r.attributes).length > 0);
          return (
            <div className="rounded-xl border border-border overflow-hidden">
              <div className="max-h-64 overflow-y-auto tp-scroll">
                <table className="w-full text-xs">
                  <thead className="sticky top-0 bg-surface2 border-b border-border">
                    <tr>
                      <th className="text-left px-3 py-2 font-medium text-muted">#</th>
                      <th className="text-left px-3 py-2 font-medium text-muted">Nombre</th>
                      {hasAnyAttrs && (
                        <th className="text-left px-3 py-2 font-medium text-muted">Atributos</th>
                      )}
                      <th className="text-left px-3 py-2 font-medium text-muted">Estado</th>
                      <th className="px-3 py-2"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {preview.rows.map((row) => (
                      <tr
                        key={row.index}
                        className={cn(
                          "border-t border-border",
                          row.status === "error" ? "bg-red-500/5" : "hover:bg-surface/40"
                        )}
                      >
                        <td className="px-3 py-1.5 text-muted">{row.index}</td>
                        <td className="px-3 py-1.5 font-medium max-w-[200px] truncate">
                          {row.isVariant && (
                            <span className="mr-1 text-[10px] text-muted bg-surface2 rounded px-1">VAR</span>
                          )}
                          {row.displayName}
                        </td>
                        {hasAnyAttrs && (
                          <td className="px-3 py-1.5 text-muted max-w-[160px]">
                            {row.attributes && Object.keys(row.attributes).length > 0
                              ? Object.entries(row.attributes).map(([k, v]) => `${k}=${v}`).join(" / ")
                              : null}
                          </td>
                        )}
                        <td className="px-3 py-1.5">
                          <span className={cn("flex items-center gap-1 font-medium", STATUS_COLORS[row.status])}>
                            {STATUS_ICONS[row.status]}
                            {STATUS_LABELS[row.status]}
                          </span>
                        </td>
                        <td className="px-3 py-1.5">
                          {(row.errors.length > 0 || row.warnings.length > 0) && (
                            <div className="space-y-0.5">
                              {row.errors.map((e, i) => (
                                <div key={i} className="text-red-400 flex items-start gap-1">
                                  <X size={10} className="mt-0.5 shrink-0" />
                                  {e}
                                </div>
                              ))}
                              {row.warnings.map((w, i) => (
                                <div key={i} className="text-yellow-300 flex items-start gap-1">
                                  <AlertTriangle size={10} className="mt-0.5 shrink-0" />
                                  {w}
                                </div>
                              ))}
                            </div>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          );
        })()}
      </div>
    );
  }

  // ── Content: Results ──────────────────────────────────────────────────────
  function renderResults() {
    if (!results) return null;
    const { summary, results: rows } = results;
    const total = summary.created + summary.updated + summary.skipped + summary.errors;

    return (
      <div className="space-y-4">
        {/* Summary */}
        <div className={cn(
          "rounded-xl border p-4 flex items-center gap-3",
          summary.errors === 0
            ? "border-emerald-500/30 bg-emerald-500/10"
            : "border-amber-500/30 bg-amber-500/10"
        )}>
          {summary.errors === 0
            ? <CheckCircle2 size={20} className="text-emerald-400 shrink-0" />
            : <AlertTriangle size={20} className="text-amber-400 shrink-0" />
          }
          <div>
            <p className="font-semibold text-text">
              {summary.errors === 0 ? "Importación completada" : "Importación con errores"}
            </p>
            <p className="text-xs text-muted mt-0.5">
              {summary.created} creados · {summary.updated} actualizados ·{" "}
              {summary.skipped} omitidos · {summary.errors} errores · {total} total
            </p>
          </div>
        </div>

        {/* Tabla de resultados */}
        <div className="rounded-xl border border-border overflow-hidden">
          <div className="max-h-64 overflow-y-auto tp-scroll">
            <table className="w-full text-xs">
              <thead className="sticky top-0 bg-surface2 border-b border-border">
                <tr>
                  <th className="text-left px-3 py-2 font-medium text-muted">#</th>
                  <th className="text-left px-3 py-2 font-medium text-muted">Nombre</th>
                  <th className="text-left px-3 py-2 font-medium text-muted">Resultado</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => {
                  const colorMap = {
                    created: "text-emerald-400",
                    updated: "text-amber-300",
                    skipped: "text-muted",
                    error:   "text-red-400",
                  };
                  const labelMap = {
                    created: "Creado",
                    updated: "Actualizado",
                    skipped: "Omitido",
                    error:   "Error",
                  };
                  return (
                    <tr key={row.index} className="border-t border-border hover:bg-surface/40">
                      <td className="px-3 py-1.5 text-muted">{row.index}</td>
                      <td className="px-3 py-1.5 font-medium max-w-[200px] truncate">{row.displayName}</td>
                      <td className="px-3 py-1.5">
                        <span className={cn("font-medium", colorMap[row.status])}>
                          {labelMap[row.status]}
                        </span>
                        {row.errors && row.errors.length > 0 && (
                          <span className="ml-2 text-red-400">{row.errors.join(", ")}</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    );
  }

  // ── Step indicator ────────────────────────────────────────────────────────
  const steps: Step[] = ["upload", "mapping", "preview", "results"];

  return (
    <Modal
      open={open}
      title="Importar artículos"
      onClose={handleClose}
      maxWidth="2xl"
      busy={busyPreview || busyImport || busyParse}
      resizable
      maximizable
      maximizedMode="embedded"
      modalKey="articulos-importacion"
      footer={renderFooter()}
    >
      {/* Step indicator */}
      <div className="flex items-center gap-1 mb-5 -mt-1">
        {steps.map((s, i) => (
          <React.Fragment key={s}>
            <div className={cn(
              "flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-lg transition",
              step === s ? "bg-primary text-white" : "text-muted"
            )}>
              <span className={cn(
                "w-4 h-4 rounded-full text-[10px] font-bold flex items-center justify-center",
                step === s ? "bg-white/20 text-white" : "bg-surface2 text-muted"
              )}>
                {i + 1}
              </span>
              <span className="hidden sm:inline">{STEP_LABELS[s].split(". ")[1]}</span>
            </div>
            {i < steps.length - 1 && (
              <ChevronRight size={12} className="text-muted/40 shrink-0" />
            )}
          </React.Fragment>
        ))}
      </div>

      {step === "upload"  && renderUpload()}
      {step === "mapping" && (
        <ImportColumnMappingStep
          mappings={mappings}
          fields={ARTICLE_FIELDS}
          onChangeMappings={setMappings}
          onContinue={handleMappingContinue}
          onBack={() => setStep("upload")}
          busy={busyPreview}
          title="Mapeo de columnas del archivo"
        />
      )}
      {step === "preview" && renderPreview()}
      {step === "results" && renderResults()}
    </Modal>
  );
}
