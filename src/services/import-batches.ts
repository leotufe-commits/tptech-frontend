// src/services/import-batches.ts
import { apiFetch } from "../lib/api";

// ─── Tipos ───────────────────────────────────────────────────────────────────

export type BatchStatus = "SUCCESS" | "PARTIAL" | "FAILED";
export type ActionResult = "CREATED" | "UPDATED" | "SKIPPED" | "FAILED" | "CONFLICT";
export type BatchEntityType = "ARTICLE" | "COMMERCIAL_ENTITY";

export type ImportBatchRow = {
  id:           string;
  importedAt:   string;
  entityType:   BatchEntityType;
  fileName:     string;
  onConflict:   string;
  status:       BatchStatus;
  totalRows:    number;
  created:      number;
  updated:      number;
  skipped:      number;
  errors:       number;
  createdBy:    { id: string; name: string; email: string } | null;
};

export type ImportBatchDetail = ImportBatchRow;

export type ImportBatchRowDetail = {
  id:           string;
  rowIndex:     number;
  displayName:  string;
  actionResult: ActionResult;
  identifier:   string;
  message:      string;
  errors:       string[] | null;
  rawData:      Record<string, unknown> | null;
  createdAt:    string;
};

export type ImportBatchListResponse = {
  rows:     ImportBatchRow[];
  total:    number;
  page:     number;
  pageSize: number;
};

export type ImportBatchRowsResponse = {
  rows:     ImportBatchRowDetail[];
  total:    number;
  page:     number;
  pageSize: number;
};

export type ImportBatchListParams = {
  entityType?: BatchEntityType | "";
  status?:     BatchStatus | "";
  from?:       string;
  to?:         string;
  page?:       number;
  pageSize?:   number;
};

export type ImportBatchRowsParams = {
  actionResult?: ActionResult | "";
  page?:         number;
  pageSize?:     number;
};

export type RetryResult = {
  batchId:   string;
  status:    BatchStatus;
  created:   number;
  updated:   number;
  skipped:   number;
  errors:    number;
  totalRows: number;
};

// ─── API ─────────────────────────────────────────────────────────────────────

function buildQs(params: Record<string, string | number | undefined>): string {
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== "") qs.set(k, String(v));
  }
  const s = qs.toString();
  return s ? `?${s}` : "";
}

export const importBatchesApi = {
  /** Listado paginado de importaciones del tenant */
  list: (params: ImportBatchListParams = {}): Promise<ImportBatchListResponse> => {
    const qs = buildQs({
      entityType: params.entityType,
      status:     params.status,
      from:       params.from,
      to:         params.to,
      page:       params.page,
      pageSize:   params.pageSize,
    });
    return apiFetch<ImportBatchListResponse>(`/import-batches${qs}`);
  },

  /** Detalle de un batch */
  get: (id: string): Promise<ImportBatchDetail> =>
    apiFetch<ImportBatchDetail>(`/import-batches/${id}`),

  /** Filas de un batch con filtros */
  rows: (id: string, params: ImportBatchRowsParams = {}): Promise<ImportBatchRowsResponse> => {
    const qs = buildQs({
      actionResult: params.actionResult,
      page:         params.page,
      pageSize:     params.pageSize,
    });
    return apiFetch<ImportBatchRowsResponse>(`/import-batches/${id}/rows${qs}`);
  },

  /** Descarga CSV de errores — devuelve URL para trigger de descarga */
  downloadErrors: (id: string): void => {
    // Abrimos directamente la URL autenticada vía cookie
    const base = (import.meta.env.VITE_API_URL ?? "/api").replace(/\/$/, "");
    window.open(`${base}/import-batches/${id}/errors.csv`, "_blank");
  },

  /** Reintenta las filas FAILED de un batch — crea un nuevo ImportBatch */
  retry: (id: string): Promise<RetryResult> =>
    apiFetch<RetryResult>(`/import-batches/${id}/retry-errors`, { method: "POST" }),
};
