// src/pages/configuracion-sistema/clientes/BulkImportModal.tsx
// Importación masiva de clientes/proveedores — versión 2
import React, { useState } from "react";
import * as XLSX from "xlsx-js-style";
import { Download, FileDown, CheckCircle2, XCircle, SkipForward, AlertTriangle, FileText, X } from "lucide-react";
import { Modal } from "../../../components/ui/Modal";
import { TPButton } from "../../../components/ui/TPButton";
import { TPField } from "../../../components/ui/TPField";
import TPComboFixed from "../../../components/ui/TPComboFixed";
import TPDropzone from "../../../components/ui/TPDropzone";
import { toast } from "../../../lib/toast";
import {
  commercialEntitiesApi,
  commercialEntitiesExtApi,
  type ImportPreviewResponse,
  type ImportCommitResponse,
  type ImportPreviewRow,
  type ImportCommitRow,
} from "../../../services/commercial-entities";
import {
  IMPORT_COLUMNS,
  IMPORT_LABELS,
  getImportLabelsXLSX,
  mapRowToFields,
} from "./importColumns";

// ---------------------------------------------------------------------------
// CSV parser
// ---------------------------------------------------------------------------
function isEmptyRow(row: Record<string, string>): boolean {
  return Object.values(row).every((v) => !v.trim());
}

/** Detecta el separador dominante en la primera línea (coma o punto y coma). */
function detectSeparator(firstLine: string): "," | ";" {
  const commas    = (firstLine.match(/,/g)   ?? []).length;
  const semicolons = (firstLine.match(/;/g)  ?? []).length;
  return semicolons >= commas ? ";" : ",";
}

/** Divide una línea CSV respetando valores entre comillas. */
function splitLine(line: string, sep: string): string[] {
  const result: string[] = [];
  let cur = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') { cur += '"'; i++; }
      else { inQuotes = !inQuotes; }
    } else if (ch === sep && !inQuotes) {
      result.push(cur.trim());
      cur = "";
    } else {
      cur += ch;
    }
  }
  result.push(cur.trim());
  return result;
}

function parseCSV(text: string): Record<string, string>[] {
  // Quitar BOM si existe
  const clean = text.replace(/^\uFEFF/, "");
  const lines = clean.split(/\r?\n/).filter((l) => l.trim());
  if (lines.length < 2) return [];

  const sep = detectSeparator(lines[0]);
  // Quitar asteriscos de headers (para compatibilidad con el Excel exportado)
  const headers = splitLine(lines[0], sep).map((h) => h.replace(/\s*\*$/, "").trim());

  return lines.slice(1)
    .map((line) => {
      const values = splitLine(line, sep);
      const row: Record<string, string> = {};
      headers.forEach((h, i) => { row[h] = values[i] ?? ""; });
      return row;
    })
    .filter((row) => !isEmptyRow(row));
}

// ---------------------------------------------------------------------------
// Export helpers
// ---------------------------------------------------------------------------
const HEADER_STYLE = {
  font:      { bold: true, color: { rgb: "333333" } },
  fill:      { fgColor: { rgb: "E8E8E8" }, patternType: "solid" },
  border: {
    top:    { style: "thin", color: { rgb: "CCCCCC" } },
    bottom: { style: "thin", color: { rgb: "CCCCCC" } },
    left:   { style: "thin", color: { rgb: "CCCCCC" } },
    right:  { style: "thin", color: { rgb: "CCCCCC" } },
  },
  alignment: { horizontal: "center" },
};

/** Convierte una EntityRow a un array de valores en el orden de IMPORT_COLUMNS */
function entityToImportRow(e: import("../../../services/commercial-entities").EntityRow): string[] {
  return [
    e.entityType === "COMPANY" ? "EMPRESA" : "PERSONA", // entityType
    e.companyName,        // companyName
    e.tradeName,          // tradeName *
    e.firstName,          // firstName
    e.lastName,           // lastName
    e.email,              // email
    e.phone,              // phone
    e.documentType,       // documentType
    e.documentNumber,     // documentNumber
    e.ivaCondition,       // ivaCondition
    e.paymentTerm,        // paymentTerm
    "",                   // currencyCode (requiere catálogo)
    "",                   // priceListName (requiere catálogo)
    e.isActive ? "SI" : "NO", // isActive
    "",                   // notes
    "",                   // addressLabel
    "",                   // street
    "",                   // streetNumber
    "",                   // floor
    "",                   // apartment
    "",                   // city
    "",                   // province
    "",                   // country
    "",                   // postalCode
    "",                   // contactFirstName
    "",                   // contactLastName
    "",                   // contactPosition
    "",                   // contactEmail
    "",                   // contactPhone
    "",                   // contactNotes
  ];
}

// ---------------------------------------------------------------------------
// Download errors
// ---------------------------------------------------------------------------
function downloadErrors(rows: (ImportPreviewRow | ImportCommitRow)[]) {
  const header = ["Fila", "Nombre", "Estado", "Error"];
  const dataRows = rows
    .filter((r) => r.status === "error")
    .map((r) => {
      const errs = "errors" in r && r.errors?.length
        ? r.errors.join(" | ")
        : "message" in r ? (r.message ?? "") : "";
      const fila = "index" in r ? r.index : (r as ImportCommitRow).row;
      return [fila, r.displayName, r.status, errs];
    });
  if (!dataRows.length) return;
  const content = [header, ...dataRows].map((r) => r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(",")).join("\n");
  const blob = new Blob(["\uFEFF" + content], { type: "text/csv;charset=utf-8;" });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement("a");
  a.href = url; a.download = "errores_importacion.csv"; a.click();
  URL.revokeObjectURL(url);
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------
interface Props {
  open: boolean;
  role: "client" | "supplier";
  onClose: () => void;
  onImported: () => void;
}

type Step = "config" | "preview" | "done";

export default function BulkImportModal({ open, role, onClose, onImported }: Props) {
  const [step, setStep]           = useState<Step>("config");
  const [mode, setMode]           = useState<"create" | "update" | "upsert">("create");
  const [matchBy, setMatchBy]     = useState<"documentNumber" | "email">("documentNumber");
  const [parsedRows, setParsedRows]   = useState<Record<string, string>[]>([]);
  const [fileName, setFileName]       = useState("");
  const [fileError, setFileError]     = useState("");
  const [previewResult, setPreviewResult] = useState<ImportPreviewResponse | null>(null);
  const [commitResult, setCommitResult]   = useState<ImportCommitResponse | null>(null);
  const [busy, setBusy]           = useState(false);
  const [exportBusy, setExportBusy] = useState<"csv" | "xlsx" | null>(null);

  const apiRole = role === "client" ? "client" : "supplier";
  const date    = new Date().toISOString().slice(0, 10);
  const baseName = role === "client" ? "clientes" : "proveedores";

  async function fetchEntityRows() {
    const res = await commercialEntitiesApi.list({ role: apiRole, take: 9999, showInactive: true });
    return res.rows;
  }

  async function handleExportXLSX() {
    setExportBusy("xlsx");
    try {
      const entities  = await fetchEntityRows();
      const dataRows  = entities.map(entityToImportRow);
      const labelsXLSX = getImportLabelsXLSX(role);
      const ws = XLSX.utils.aoa_to_sheet([labelsXLSX, ...dataRows]);
      labelsXLSX.forEach((_, colIdx) => {
        const ref = XLSX.utils.encode_cell({ r: 0, c: colIdx });
        if (ws[ref]) ws[ref].s = HEADER_STYLE;
      });
      ws["!cols"] = IMPORT_COLUMNS.map((col, i) => ({
        wch:    col.hidden ? 8 : Math.max(labelsXLSX[i].length + 4, 16),
        hidden: col.hidden ?? false,
      }));
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, baseName);
      const buf  = XLSX.write(wb, { bookType: "xlsx", type: "array" });
      const blob = new Blob([buf], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
      const url  = URL.createObjectURL(blob);
      const a    = document.createElement("a");
      a.href = url; a.download = `${baseName}-${date}.xlsx`; a.click();
      URL.revokeObjectURL(url);
    } catch (e: any) {
      toast.error(e?.message || "Error al exportar.");
    } finally {
      setExportBusy(null);
    }
  }

  async function handleExportCSV() {
    setExportBusy("csv");
    try {
      const entities = await fetchEntityRows();
      const dataRows = entities.map(entityToImportRow);
      const sep = ";";
      const allRows  = [IMPORT_LABELS, ...dataRows];
      const content  = allRows.map((r) => r.map((v) => (/[;"'\n\r]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v)).join(sep)).join("\n");
      const blob = new Blob(["\uFEFF" + content], { type: "text/csv;charset=utf-8;" });
      const url  = URL.createObjectURL(blob);
      const a    = document.createElement("a");
      a.href = url; a.download = `${baseName}-${date}.csv`; a.click();
      URL.revokeObjectURL(url);
    } catch (e: any) {
      toast.error(e?.message || "Error al exportar.");
    } finally {
      setExportBusy(null);
    }
  }

  function reset() {
    setStep("config");
    setParsedRows([]);
    setFileName("");
    setFileError("");
    setPreviewResult(null);
    setCommitResult(null);
    setBusy(false);
  }

  function readFile(file: File) {
    setFileError("");
    if (!file.name.endsWith(".csv")) { setFileError("Solo se aceptan archivos .csv"); return; }
    if (file.size > 2 * 1024 * 1024) { setFileError("El archivo no puede superar 2 MB."); return; }
    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result as string;
      const rows = parseCSV(text);
      if (rows.length === 0) { setFileError("El archivo está vacío o sin datos válidos."); return; }
      if (rows.length > 500) { setFileError("Máximo 500 filas por importación."); return; }
      setFileName(file.name);
      setParsedRows(rows);
    };
    reader.onerror = () => setFileError("No se pudo leer el archivo.");
    reader.readAsText(file, "UTF-8");
  }

  async function handlePreview() {
    if (!parsedRows.length) { toast.error("Cargá un archivo CSV primero."); return; }
    setBusy(true);
    try {
      const mappedRows = parsedRows.map(mapRowToFields);
      const res = await commercialEntitiesExtApi.importPreview({ rows: mappedRows, role: apiRole });
      setPreviewResult(res);
      setStep("preview");
    } catch (e: any) {
      toast.error(e?.message || "Error en el preview.");
    } finally {
      setBusy(false);
    }
  }

  async function handleCommit() {
    if (!parsedRows.length) return;
    setBusy(true);
    try {
      const mappedRows = parsedRows.map(mapRowToFields);
      const res = await commercialEntitiesExtApi.importCommit({ rows: mappedRows, mode, role: apiRole, matchBy });
      setCommitResult(res);
      setStep("done");
      toast.success(`Importación completada: ${res.summary.created} creados, ${res.summary.updated} actualizados.`);
      onImported();
    } catch (e: any) {
      toast.error(e?.message || "Error al importar.");
    } finally {
      setBusy(false);
    }
  }

  // ── Datos para la tabla de resultados ──────────────────────────────────────
  type UnifiedRow = { fila: number; displayName: string; status: string; errors: string[] };

  function normalizeRows(): UnifiedRow[] {
    if (commitResult) {
      return commitResult.results.map((r) => ({
        fila:        r.row,
        displayName: r.displayName,
        status:      r.status,
        errors:      r.errors ?? (r.message ? [r.message] : []),
      }));
    }
    if (previewResult) {
      return previewResult.rows.map((r) => ({
        fila:        r.index,
        displayName: r.displayName,
        status:      r.status === "valid" ? "new" : r.status,
        errors:      r.errors,
      }));
    }
    return [];
  }

  const tableRows    = normalizeRows();
  const errorRows    = tableRows.filter((r) => r.status === "error");
  const summaryData  = commitResult?.summary ?? (previewResult
    ? { created: previewResult.new, updated: 0, skipped: 0, errors: previewResult.errors }
    : null);

  function statusBadge(status: string) {
    if (status === "created" || status === "new")
      return <span className="inline-flex items-center gap-1 text-green-600"><CheckCircle2 size={12} /> {status === "created" ? "Crear" : "Nuevo"}</span>;
    if (status === "updated")
      return <span className="inline-flex items-center gap-1 text-blue-600"><CheckCircle2 size={12} /> Actualizar</span>;
    if (status === "existing")
      return <span className="inline-flex items-center gap-1 text-amber-600"><AlertTriangle size={12} /> Existente</span>;
    if (status === "skipped")
      return <span className="inline-flex items-center gap-1 text-muted"><SkipForward size={12} /> Omitir</span>;
    return <span className="inline-flex items-center gap-1 text-red-600"><XCircle size={12} /> Error</span>;
  }

  return (
    <Modal
      open={open}
      title="Importación masiva"
      maxWidth="lg"
      busy={busy}
      onClose={() => { reset(); onClose(); }}
      footer={
        step === "config" ? (
          <>
            <TPButton variant="secondary" onClick={() => { reset(); onClose(); }} disabled={busy}>Cancelar</TPButton>
            <TPButton variant="primary" onClick={handlePreview} disabled={!parsedRows.length} loading={busy}>
              Vista previa
            </TPButton>
          </>
        ) : step === "preview" ? (
          <>
            <TPButton variant="secondary" onClick={() => setStep("config")} disabled={busy}>Volver</TPButton>
            {errorRows.length > 0 && (
              <TPButton variant="secondary" onClick={() => downloadErrors(previewResult?.rows ?? [])} iconLeft={<Download size={14} />}>
                Descargar errores
              </TPButton>
            )}
            <TPButton
              variant="primary"
              onClick={handleCommit}
              loading={busy}
              disabled={!previewResult || previewResult.valid === 0}
            >
              Confirmar importación
            </TPButton>
          </>
        ) : (
          <>
            {errorRows.length > 0 && (
              <TPButton variant="secondary" onClick={() => downloadErrors(commitResult?.results ?? [])} iconLeft={<Download size={14} />}>
                Descargar errores
              </TPButton>
            )}
            <TPButton variant="primary" onClick={() => { reset(); onClose(); }}>Cerrar</TPButton>
          </>
        )
      }
    >
      <div className="space-y-4">

        {/* ── Paso 1: Configuración ── */}
        {step === "config" && (
          <>
            {/* Exportar datos actuales en formato de importación */}
            <div className="flex items-center justify-between rounded-xl border border-border/50 bg-surface2 px-4 py-3">
              <div>
                <div className="text-sm font-bold text-muted">Exportar datos actuales</div>
                <div className="text-xs text-muted mt-0.5">
                  Descargá todos los registros en el formato de importación. Editá las filas o agregá nuevas y volvé a importar.
                </div>
              </div>
              <div className="flex gap-2 shrink-0">
                <TPButton
                  variant="secondary"
                  onClick={handleExportCSV}
                  iconLeft={<FileDown size={14} />}
                  loading={exportBusy === "csv"}
                  disabled={exportBusy !== null}
                >
                  CSV
                </TPButton>
                <TPButton
                  variant="secondary"
                  onClick={handleExportXLSX}
                  iconLeft={<FileDown size={14} />}
                  loading={exportBusy === "xlsx"}
                  disabled={exportBusy !== null}
                >
                  Excel
                </TPButton>
              </div>
            </div>

            {/* Configuración */}
            <div className="grid grid-cols-1 gap-3">
              <TPField label="Modo de importación">
                <TPComboFixed
                  value={mode}
                  onChange={(v) => setMode(v as typeof mode)}
                  disabled={busy}
                  options={[
                    { value: "create",  label: "Solo crear nuevos" },
                    { value: "update",  label: "Solo actualizar existentes" },
                    { value: "upsert",  label: "Crear y actualizar" },
                  ]}
                />
              </TPField>
            </div>

            {/* Archivo */}
            <TPField label="Archivo CSV" hint="Máximo 500 filas · 2 MB">
              {fileName && parsedRows.length > 0 ? (
                <div className="flex items-center gap-3 rounded-xl border border-border bg-surface2 px-4 py-3">
                  <FileText size={18} className="text-primary shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-text truncate">{fileName}</div>
                    <div className="text-xs text-muted">{parsedRows.length} fila{parsedRows.length !== 1 ? "s" : ""} detectadas</div>
                  </div>
                  <button
                    type="button"
                    onClick={() => { setFileName(""); setParsedRows([]); setFileError(""); }}
                    className="tp-btn-secondary h-8 w-8 !p-0 grid place-items-center shrink-0"
                  >
                    <X size={14} />
                  </button>
                </div>
              ) : (
                <>
                  <TPDropzone
                    multiple={false}
                    accept=".csv"
                    disabled={busy}
                    title="Hacé clic o arrastrá tu archivo CSV"
                    subtitle="Solo archivos .csv — máximo 2 MB"
                    onFiles={(files) => { if (files[0]) readFile(files[0]); }}
                  />
                  {fileError && (
                    <div className="flex items-center gap-1.5 text-xs text-red-600 mt-1">
                      <XCircle size={13} className="shrink-0" />{fileError}
                    </div>
                  )}
                </>
              )}
            </TPField>
          </>
        )}

        {/* ── Pasos 2 y 3: Preview / Done ── */}
        {(step === "preview" || step === "done") && summaryData && (
          <>
            {/* Contadores */}
            <div className="grid grid-cols-4 gap-2 text-center text-xs">
              {[
                { label: step === "done" ? "Creados"      : "Nuevos",     n: summaryData.created, color: "text-green-600" },
                { label: step === "done" ? "Actualizados" : "Existentes", n: summaryData.updated || (previewResult?.existing ?? 0), color: "text-blue-600" },
                { label: "Omitidos",  n: summaryData.skipped, color: "text-muted"    },
                { label: "Errores",   n: summaryData.errors,  color: "text-red-600"  },
              ].map(({ label, n, color }) => (
                <div key={label} className="rounded-xl border border-border bg-card p-2">
                  <div className={`text-xl font-bold ${color}`}>{n}</div>
                  <div className="text-muted">{label}</div>
                </div>
              ))}
            </div>

            {/* Alertas */}
            {step === "preview" && summaryData.errors === 0 && (previewResult?.valid ?? 0) > 0 && (
              <div className="flex items-center gap-2 rounded-xl border border-green-500/30 bg-green-500/10 p-3 text-sm text-text">
                <CheckCircle2 size={16} className="text-green-500 shrink-0" />
                Vista previa sin errores. Podés confirmar la importación.
              </div>
            )}
            {summaryData.errors > 0 && (
              <div className="flex items-start gap-2 rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-text">
                <AlertTriangle size={14} className="text-amber-600 shrink-0 mt-0.5" />
                Hay {summaryData.errors} fila{summaryData.errors !== 1 ? "s" : ""} con errores.
                {step === "preview"
                  ? " Las filas con error serán omitidas al confirmar."
                  : " Esas filas no fueron importadas."}
              </div>
            )}
            {step === "done" && summaryData.errors === 0 && (
              <div className="flex items-center gap-2 rounded-xl border border-green-500/30 bg-green-500/10 p-3 text-sm text-text">
                <CheckCircle2 size={16} className="text-green-500 shrink-0" />
                Importación completada exitosamente.
              </div>
            )}

            {/* Tabla */}
            <div className="rounded-xl border border-border bg-card overflow-auto max-h-72">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-border bg-surface2/50 text-muted">
                    <th className="px-3 py-2 text-left w-10">#</th>
                    <th className="px-3 py-2 text-left">Nombre</th>
                    <th className="px-3 py-2 text-left w-28">Estado</th>
                    <th className="px-3 py-2 text-left">Detalle</th>
                  </tr>
                </thead>
                <tbody>
                  {tableRows.map((r) => (
                    <tr key={r.fila} className="border-b border-border/50 last:border-0 hover:bg-surface2/30 transition-colors">
                      <td className="px-3 py-1.5 text-muted tabular-nums">{r.fila}</td>
                      <td className="px-3 py-1.5 font-medium text-text">{r.displayName}</td>
                      <td className="px-3 py-1.5">{statusBadge(r.status)}</td>
                      <td className="px-3 py-1.5 text-muted max-w-[220px] truncate">
                        {r.errors.length > 0 ? r.errors.join(" · ") : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}

      </div>
    </Modal>
  );
}
