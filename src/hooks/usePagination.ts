// src/hooks/usePagination.ts
// Hook reutilizable de paginación.
// Soporta modo local (estado interno) y modo controlado (el padre lo maneja).

import { useState, useCallback } from "react";

export const DEFAULT_PAGE_SIZE_OPTIONS = [10, 25, 50, 100] as const;

export type PaginationConfig = {
  /** Tamaño de página inicial en modo local. Default: 25. */
  defaultPageSize?: number;
  /** Opciones disponibles en el selector. Default: [10, 25, 50, 100]. */
  pageSizeOptions?: readonly number[];
  /**
   * Clave de localStorage para persistir el pageSize elegido por el usuario.
   * Ej: "tptech:pageSize:promotions". Si se omite, no se persiste.
   */
  storageKey?: string;
  // ── Modo controlado (server-side) ────────────────────────────────────────
  /** Página actual (1-indexed). Activar modo controlado al pasarla. */
  page?: number;
  /** Tamaño de página. Requerido en modo controlado. */
  pageSize?: number;
  /** Total de ítems en el servidor. Requerido en modo controlado. */
  totalItems?: number;
  onPageChange?: (page: number) => void;
  onPageSizeChange?: (size: number) => void;
};

export type PaginationState =
  | { enabled: false }
  | {
      enabled:         true;
      page:            number;
      pageSize:        number;
      setPage:         (p: number) => void;
      setPageSize:     (s: number) => void;
      pageSizeOptions: readonly number[];
      /** Solo en modo controlado. En modo local es undefined. */
      totalItems?:     number;
    };

/**
 * Gestiona el estado de paginación.
 *
 * - `undefined` / `false` → paginación deshabilitada (sin cambios de comportamiento)
 * - `true`                → modo local con pageSize=25 por defecto
 * - `PaginationConfig`    → modo local con config o modo controlado (server-side)
 */
export function usePagination(
  pagination?: boolean | PaginationConfig,
): PaginationState {
  // Extraer storageKey antes de los hooks (siempre constante durante el ciclo de vida).
  const storageKey = (pagination && pagination !== true)
    ? (pagination as PaginationConfig).storageKey
    : undefined;

  // useState siempre se llama — la lógica condicional va después.
  const [localPage, setLocalPageRaw] = useState(1);
  const [localPageSize, setLocalPageSizeRaw] = useState(() => {
    if (storageKey) {
      const saved = parseInt(localStorage.getItem(storageKey) ?? "", 10);
      if (!isNaN(saved) && saved > 0) return saved;
    }
    if (!pagination || pagination === true) return 25;
    return (pagination as PaginationConfig).defaultPageSize ?? 25;
  });

  // Setters estables para modo local (useCallback garantiza referencia estable).
  const setLocalPage = useCallback((p: number) => setLocalPageRaw(p), []);
  const setLocalPageSize = useCallback((s: number) => {
    setLocalPageSizeRaw(s);
    setLocalPageRaw(1);
    if (storageKey) {
      try { localStorage.setItem(storageKey, String(s)); } catch {}
    }
  }, [storageKey]);

  // ── Paginación deshabilitada ──────────────────────────────────────────────
  if (!pagination) return { enabled: false };

  // ── Config normalizada ────────────────────────────────────────────────────
  const cfg: PaginationConfig = pagination === true ? {} : pagination;
  const isControlled = cfg.page !== undefined;

  const page     = isControlled ? cfg.page!                     : localPage;
  const pageSize = isControlled ? (cfg.pageSize ?? localPageSize) : localPageSize;

  const setPage = isControlled
    ? (p: number) => cfg.onPageChange?.(p)
    : setLocalPage;

  const setPageSize = isControlled
    ? (s: number) => cfg.onPageSizeChange?.(s)
    : setLocalPageSize;

  return {
    enabled:         true,
    page,
    pageSize,
    setPage,
    setPageSize,
    pageSizeOptions: cfg.pageSizeOptions ?? DEFAULT_PAGE_SIZE_OPTIONS,
    totalItems:      cfg.totalItems,
  };
}
