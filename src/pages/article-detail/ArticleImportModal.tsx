// src/pages/article-detail/ArticleImportModal.tsx
// Modal de importación masiva de artículos (wizard 3 pasos)
import React, { useCallback, useRef, useState } from "react";
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
  X,
} from "lucide-react";

import { Modal } from "../../components/ui/Modal";
import { TPButton } from "../../components/ui/TPButton";
import { TPCard } from "../../components/ui/TPCard";
import { cn } from "../../components/ui/tp";
import { toast } from "../../lib/toast";
import {
  articlesApi,
  type ImportPreviewResult,
  type ImportPreviewRow,
  type ImportCommitResult,
} from "../../services/articles";

// ---------------------------------------------------------------------------
type Step = "upload" | "preview" | "results";

const STEP_LABELS: Record<Step, string> = {
  upload:  "1. Cargar archivo",
  preview: "2. Vista previa",
  results: "3. Resultados",
};

const STATUS_COLORS: Record<ImportPreviewRow["status"], string> = {
  valid:    "text-emerald-400",
  existing: "text-amber-300",
  warning:  "text-yellow-300",
  error:    "text-red-400",
};
const STATUS_ICONS: Record<ImportPreviewRow["status"], React.ReactNode> = {
  valid:    <Check size={12} />,
  existing: <RefreshCw size={12} />,
  warning:  <AlertTriangle size={12} />,
  error:    <X size={12} />,
};
const STATUS_LABELS: Record<ImportPreviewRow["status"], string> = {
  valid:    "Nuevo",
  existing: "Existente",
  warning:  "Advertencia",
  error:    "Error",
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
  const [step,        setStep]        = useState<Step>("upload");
  const [file,        setFile]        = useState<File | null>(null);
  const [dragging,    setDragging]    = useState(false);
  const [preview,     setPreview]     = useState<ImportPreviewResult | null>(null);
  const [results,     setResults]     = useState<ImportCommitResult | null>(null);
  const [onConflict,  setOnConflict]  = useState<"skip" | "update">("skip");
  const [busyPreview, setBusyPreview] = useState(false);
  const [busyImport,  setBusyImport]  = useState(false);
  const [dlTemplate,  setDlTemplate]  = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ── Reset al cerrar ─────────────────────────────────────────────────────
  function handleClose() {
    if (busyPreview || busyImport) return;
    setStep("upload");
    setFile(null);
    setPreview(null);
    setResults(null);
    onClose();
  }

  // ── Drop zone ────────────────────────────────────────────────────────────
  function handleFileDrop(f: File) {
    const ok = f.name.endsWith(".xlsx") || f.name.endsWith(".xls") || f.name.endsWith(".csv");
    if (!ok) { toast.error("Solo se aceptan archivos .xlsx, .xls o .csv"); return; }
    setFile(f);
    setPreview(null);
  }

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const f = e.dataTransfer.files?.[0];
    if (f) handleFileDrop(f);
  }, []);

  // ── Preview ──────────────────────────────────────────────────────────────
  async function handlePreview() {
    if (!file) return;
    setBusyPreview(true);
    try {
      const result = await articlesApi.import.preview(file);
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
    if (!file || !preview) return;
    const hasErrors = preview.errors > 0;
    const canProceed = preview.valid > 0 || preview.existing > 0 || preview.warnings > 0;
    if (!canProceed) { toast.error("No hay filas válidas para importar."); return; }
    setBusyImport(true);
    try {
      const result = await articlesApi.import.execute(file, onConflict);
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
  async function handleDownloadTemplate() {
    setDlTemplate(true);
    try { await articlesApi.import.downloadTemplate(); }
    catch (e: any) { toast.error(e?.message || "Error al descargar la plantilla."); }
    finally { setDlTemplate(false); }
  }

  // ── Footer ────────────────────────────────────────────────────────────────
  function renderFooter() {
    if (step === "upload") {
      return (
        <div className="flex items-center gap-2 w-full">
          <TPButton
            variant="ghost"
            iconLeft={dlTemplate ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />}
            loading={dlTemplate}
            onClick={handleDownloadTemplate}
          >
            Descargar plantilla
          </TPButton>
          <div className="flex-1" />
          <TPButton variant="secondary" onClick={handleClose}>Cancelar</TPButton>
          <TPButton
            onClick={handlePreview}
            disabled={!file}
            loading={busyPreview}
            iconLeft={<ChevronRight size={14} />}
          >
            Vista previa
          </TPButton>
        </div>
      );
    }
    if (step === "preview") {
      return (
        <div className="flex items-center gap-2 w-full">
          <TPButton variant="secondary" onClick={() => setStep("upload")} disabled={busyImport}>
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
            disabled={!preview || (preview.valid === 0 && preview.existing === 0 && preview.warnings === 0)}
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
              <li>Descargá la plantilla Excel con el botón de abajo.</li>
              <li>Completá las filas de artículos (y variantes si aplica).</li>
              <li>Subí el archivo completo para hacer una vista previa antes de importar.</li>
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
    const { total, articles, variants, valid, errors, existing, warnings } = preview;
    const onlyErrors = errors > 0 && valid === 0 && existing === 0 && warnings === 0;

    return (
      <div className="space-y-4">
        {/* Summary cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: "Nuevos",      count: valid,    color: "text-emerald-400", bg: "bg-emerald-500/10 border-emerald-500/30" },
            { label: "Existentes",  count: existing, color: "text-amber-300",   bg: "bg-amber-500/10 border-amber-500/30" },
            { label: "Advertencias",count: warnings, color: "text-yellow-300",  bg: "bg-yellow-500/10 border-yellow-500/30" },
            { label: "Errores",     count: errors,   color: "text-red-400",     bg: "bg-red-500/10 border-red-500/30" },
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
  const steps: Step[] = ["upload", "preview", "results"];

  return (
    <Modal
      open={open}
      title="Importar artículos"
      onClose={handleClose}
      maxWidth="2xl"
      busy={busyPreview || busyImport}
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

      {step === "upload"   && renderUpload()}
      {step === "preview"  && renderPreview()}
      {step === "results"  && renderResults()}
    </Modal>
  );
}
