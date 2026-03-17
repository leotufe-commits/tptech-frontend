// src/components/ui/TPTableKit.tsx
import React, { useMemo, useState, type ReactNode, type CSSProperties, isValidElement, cloneElement } from "react";
import {
  TPTableWrap,
  TPTableHeader,
  TPTable,
  TPTableXScroll,
  TPTableElBase,
  TPThead,
  TPTbody,
  TPEmptyRow,
  TPTableFooter,
  TPTh,
} from "./TPTable";
import { TPColumnPicker, type ColPickerDef } from "./TPColumnPicker";
import { TPSearchInput } from "./TPSearchInput";
import { SortArrows, type SortDir } from "./TPSort";
import { cn } from "./tp";

/* =========================================================
   TYPES
========================================================= */
export type TPColDef = {
  key: string;
  label: string;
  /** Ancho fijo de la columna (ej. "120px"). Opcional. */
  width?: string;
  /** Visibilidad por defecto. Default: true */
  visible?: boolean;
  /** Si es false, la columna no se puede ocultar y no aparece en el picker. Default: true */
  canHide?: boolean;
  /** Si está presente, la cabecera muestra flechas de sort y es clickeable. */
  sortKey?: string;
  /** Alineación del contenido. Default: "left" */
  align?: "left" | "right";
};

/** Info de selección que recibe renderRow cuando selectable=true */
export type TPRowSel = {
  checked: boolean;
  onCheck: () => void;
};

type Props<T> = {
  // ---- Datos ----
  rows: T[];

  // ---- Columnas ----
  columns: TPColDef[];
  /** Clave de localStorage para persistir visibilidad. Si se omite, no persiste. */
  storageKey?: string;

  // ---- Búsqueda ----
  search?: string;
  onSearchChange?: (v: string) => void;
  searchPlaceholder?: string;

  // ---- Ordenamiento ----
  sortKey?: string;
  sortDir?: SortDir;
  onSort?: (key: string) => void;

  // ---- Cabecera ----
  /** Elemento a la derecha del header (normalmente un botón "Nuevo"). */
  actions?: ReactNode;
  /** Nodo adicional a la izquierda del header, después del search. */
  headerLeft?: ReactNode;
  /** Nodo renderizado entre el header y la tabla (ej: filtros de fecha). */
  belowHeader?: ReactNode;

  // ---- Selección masiva ----
  /**
   * Activa checkboxes de selección masiva. Requiere `getRowId`.
   * El 3er parámetro de renderRow tendrá { checked, onCheck }.
   */
  selectable?: boolean;
  /**
   * Función para obtener el ID único de cada fila.
   * Requerido cuando selectable=true.
   */
  getRowId?: (row: T) => string;
  /**
   * Se llama cada vez que cambia la selección.
   * Recibe el Set de IDs seleccionados.
   */
  onSelectionChange?: (ids: Set<string>) => void;
  /**
   * Contenido que aparece en la barra de acciones masivas (debajo del header)
   * cuando al menos una fila está seleccionada.
   * Ejemplo: <TPButton variant="danger" onClick={handleBulkDelete}>Eliminar</TPButton>
   */
  bulkActions?: ReactNode;

  // ---- Filas ----
  /**
   * Renderiza cada fila.
   * - `vis`: qué columnas están visibles (vis[colKey] === true)
   * - `sel`: solo presente cuando selectable=true → { checked, onCheck }
   *
   * Ejemplo:
   * ```tsx
   * renderRow={(row, vis, sel) => (
   *   <TPTr key={row.id}>
   *     {sel && (
   *       <TPTd><input type="checkbox" checked={sel.checked} onChange={sel.onCheck} /></TPTd>
   *     )}
   *     {vis.nombre && <TPTd>{row.name}</TPTd>}
   *     {vis.acciones && <TPTd className="text-right"><TPRowActions .../></TPTd>}
   *   </TPTr>
   * )}
   * ```
   */
  renderRow: (row: T, vis: Record<string, boolean>, sel?: TPRowSel) => ReactNode;

  // ---- Estado vacío / carga ----
  emptyText?: string;
  loading?: boolean;

  // ---- Footer ----
  /**
   * Texto del footer.
   * - String: se prefija con el conteo  →  "3 vendedores"
   * - Función: control total  →  (n) => `${n} vendedor${n !== 1 ? "es" : ""}`
   * - Si se omite, muestra "{n} registro(s)"
   */
  countLabel?: string | ((n: number) => string);

  // ---- Opcionales ----
  /** Modo responsivo. Default: "scroll" (scroll horizontal en mobile). */
  responsive?: "scroll" | "stack";
  className?: string;

  /**
   * Si se pasa, al hacer click en una fila se llama esta función.
   * Los clics dentro de [data-tp-actions] (TPRowActions) se ignoran automáticamente.
   */
  onRowClick?: (row: T) => void;
};

/* =========================================================
   HELPERS
========================================================= */
function loadVis(key: string | undefined, cols: TPColDef[]): Record<string, boolean> {
  const defaults: Record<string, boolean> = {};
  cols.forEach((c) => {
    defaults[c.key] = c.visible !== false;
  });
  if (!key) return defaults;
  try {
    const stored = localStorage.getItem(key);
    if (!stored) return defaults;
    const parsed = JSON.parse(stored) as Record<string, boolean>;
    const result = { ...defaults };
    Object.keys(parsed).forEach((k) => {
      if (k in result) result[k] = parsed[k];
    });
    return result;
  } catch {
    return defaults;
  }
}

function saveVis(key: string, vis: Record<string, boolean>) {
  try {
    localStorage.setItem(key, JSON.stringify(vis));
  } catch {}
}

function loadOrder(key: string | undefined, cols: TPColDef[]): string[] {
  const hideableKeys = cols.filter((c) => c.canHide !== false).map((c) => c.key);
  if (!key) return hideableKeys;
  try {
    const stored = localStorage.getItem(`${key}_order`);
    if (!stored) return hideableKeys;
    const parsed = JSON.parse(stored) as string[];
    const valid = parsed.filter((k) => hideableKeys.includes(k));
    const missing = hideableKeys.filter((k) => !valid.includes(k));
    return [...valid, ...missing];
  } catch {
    return hideableKeys;
  }
}

function saveOrder(key: string, order: string[]) {
  try {
    localStorage.setItem(`${key}_order`, JSON.stringify(order));
  } catch {}
}

/* =========================================================
   COMPONENT
========================================================= */
export function TPTableKit<T>({
  rows,
  columns,
  storageKey,
  search,
  onSearchChange,
  searchPlaceholder = "Buscar…",
  sortKey,
  sortDir = "asc",
  onSort,
  actions,
  headerLeft,
  belowHeader,
  selectable = false,
  getRowId,
  onSelectionChange,
  bulkActions,
  renderRow,
  emptyText = "No hay resultados.",
  loading = false,
  countLabel,
  responsive = "scroll",
  className,
  onRowClick,
}: Props<T>) {
  // ---- column visibility ----
  const [vis, setVis] = useState<Record<string, boolean>>(() =>
    loadVis(storageKey, columns)
  );

  // ---- column order (hideable columns only) ----
  const [colOrder, setColOrder] = useState<string[]>(() =>
    loadOrder(storageKey, columns)
  );

  // ---- bulk selection ----
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  function toggleRow(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      onSelectionChange?.(next);
      return next;
    });
  }

  function toggleAll() {
    if (!getRowId) return;
    const allIds = rows.map(getRowId);
    const allSelected = allIds.every((id) => selectedIds.has(id));
    const next = allSelected ? new Set<string>() : new Set(allIds);
    setSelectedIds(next);
    onSelectionChange?.(next);
  }

  // ---- column helpers ----
  function handleVisChange(key: string, visible: boolean) {
    const next = { ...vis, [key]: visible };
    setVis(next);
    if (storageKey) saveVis(storageKey, next);
  }

  function handleOrderChange(nextOrder: string[]) {
    setColOrder(nextOrder);
    if (storageKey) saveOrder(storageKey, nextOrder);
  }

  const pickerCols: ColPickerDef[] = columns
    .filter((c) => c.canHide !== false)
    .map((c) => ({ key: c.key, label: c.label }));

  // Compute visible columns respecting user-defined order.
  // Fixed columns (canHide=false) keep their original relative positions;
  // hideable columns are sorted by colOrder among themselves, then merged in.
  const visibleCols = useMemo(() => {
    const hideableCols = columns.filter((c) => c.canHide !== false);
    const sortedHideable = [...hideableCols].sort((a, b) => {
      const ai = colOrder.indexOf(a.key);
      const bi = colOrder.indexOf(b.key);
      return (ai === -1 ? Infinity : ai) - (bi === -1 ? Infinity : bi);
    });
    let hideableIdx = 0;
    return columns
      .map((c) => (c.canHide === false ? c : sortedHideable[hideableIdx++]))
      .filter((c) => c.canHide === false || vis[c.key] !== false);
  }, [columns, colOrder, vis]);

  // +1 para la columna de checkbox cuando selectable
  const colSpan = visibleCols.length + (selectable ? 1 : 0);

  // ---- footer ----
  const count = rows.length;
  const countStr =
    typeof countLabel === "function"
      ? countLabel(count)
      : countLabel
      ? `${count} ${countLabel}`
      : `${count} ${count === 1 ? "registro" : "registros"}`;

  // ---- selection state summary ----
  const allIds = selectable && getRowId ? rows.map(getRowId) : [];
  const allChecked = allIds.length > 0 && allIds.every((id) => selectedIds.has(id));
  const someChecked = allIds.some((id) => selectedIds.has(id));
  const nSelected = selectedIds.size;

  return (
    <TPTableWrap className={className}>
      {/* ---- Header principal ---- */}
      <TPTableHeader
        left={
          <div className="flex items-center gap-2">
            {pickerCols.length > 0 && (
              <TPColumnPicker
                columns={pickerCols}
                visibility={vis}
                onChange={handleVisChange}
                order={colOrder}
                onOrderChange={handleOrderChange}
              />
            )}
            {onSearchChange && (
              <TPSearchInput
                value={search ?? ""}
                onChange={onSearchChange}
                placeholder={searchPlaceholder}
                className="w-full md:w-64"
              />
            )}
            {headerLeft}
          </div>
        }
        right={actions}
      />

      {/* ---- Sección extra bajo el header (ej: filtros de fecha) ---- */}
      {belowHeader}

      {/* ---- Barra de acciones masivas (cuando hay selección) ---- */}
      {selectable && nSelected > 0 && bulkActions && (
        <div className="flex items-center gap-3 border-b border-border bg-primary/5 px-4 py-2.5">
          <span className="text-xs font-medium text-primary">
            {nSelected} seleccionado{nSelected !== 1 ? "s" : ""}
          </span>
          <div className="flex items-center gap-2">{bulkActions}</div>
        </div>
      )}

      {/* ---- Tabla ---- */}
      <TPTable>
        <TPTableXScroll>
          <TPTableElBase responsive={responsive}>
            <TPThead>
              <tr>
                {/* Columna checkbox (select all) */}
                {selectable && (
                  <TPTh style={{ width: "40px" }} className="px-3">
                    <input
                      type="checkbox"
                      checked={allChecked}
                      ref={(el) => {
                        if (el) el.indeterminate = someChecked && !allChecked;
                      }}
                      onChange={toggleAll}
                      className="h-4 w-4 cursor-pointer rounded border-border accent-primary"
                      aria-label="Seleccionar todos"
                    />
                  </TPTh>
                )}

                {/* Columnas de datos */}
                {visibleCols.map((col) => {
                  const thStyle: CSSProperties | undefined = col.width
                    ? { width: col.width }
                    : undefined;
                  const thClass = col.align === "right" ? "text-right" : undefined;

                  return (
                    <TPTh key={col.key} style={thStyle} className={thClass}>
                      {col.sortKey && onSort ? (
                        <button
                          type="button"
                          onClick={() => onSort(col.sortKey!)}
                          className="inline-flex items-center gap-1"
                        >
                          {col.label}
                          <SortArrows active={sortKey === col.sortKey} dir={sortDir} />
                        </button>
                      ) : (
                        col.label
                      )}
                    </TPTh>
                  );
                })}
              </tr>
            </TPThead>

            <TPTbody>
              {loading ? (
                <TPEmptyRow colSpan={colSpan} text="Cargando…" />
              ) : rows.length === 0 ? (
                <TPEmptyRow colSpan={colSpan} text={emptyText} />
              ) : (
                rows.map((row) => {
                  const id = selectable && getRowId ? getRowId(row) : undefined;
                  const sel: TPRowSel | undefined =
                    selectable && id !== undefined
                      ? { checked: selectedIds.has(id), onCheck: () => toggleRow(id) }
                      : undefined;
                  const element = renderRow(row, vis, sel);
                  if (onRowClick && isValidElement(element)) {
                    return cloneElement(element as React.ReactElement<any>, {
                      onClick: (e: React.MouseEvent) => {
                        if ((e.target as HTMLElement).closest("[data-tp-actions]")) return;
                        onRowClick(row);
                      },
                    });
                  }
                  return element;
                })
              )}
            </TPTbody>
          </TPTableElBase>
        </TPTableXScroll>
      </TPTable>

      {/* ---- Footer ---- */}
      <TPTableFooter>
        <span>{countStr}</span>
        {selectable && nSelected > 0 && (
          <span className="ml-3 text-primary font-medium">
            · {nSelected} seleccionado{nSelected !== 1 ? "s" : ""}
          </span>
        )}
      </TPTableFooter>
    </TPTableWrap>
  );
}

export default TPTableKit;
