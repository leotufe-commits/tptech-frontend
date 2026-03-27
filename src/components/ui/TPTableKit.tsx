// src/components/ui/TPTableKit.tsx
import React, {
  useMemo,
  useEffect,
  useState,
  type ReactNode,
  type CSSProperties,
  isValidElement,
  cloneElement,
} from "react";
import { Check, ArrowUpDown, CheckSquare, XSquare } from "lucide-react";
import { TPCheckbox } from "./TPCheckbox";
import { TPBadge } from "./TPBadges";
import { TPButton } from "./TPButton";
import { TPActionsMenu, type TPActionsMenuItem } from "./TPActionsMenu";
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
import { TPPagination } from "./TPPagination";
import { usePagination, type PaginationConfig } from "../../hooks/usePagination";
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

/** Ítem para el sort submenu del menú integrado */
export type TPSortMenuItem = {
  key: string;
  label: string;
  icon?: ReactNode;
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

  // ---- Menú integrado ----
  /**
   * Opciones de ordenamiento para el submenú "Ordenar por" del menú integrado.
   * Requiere que `onSort` esté presente.
   */
  sortMenuItems?: TPSortMenuItem[];
  /**
   * Si se provee, agrega "Selección masiva" / "Cancelar selección" al menú integrado.
   * El padre sigue controlando `selectable` — este callback solo notifica el toggle.
   */
  onToggleSelectable?: () => void;
  /**
   * Ítems adicionales que se agregan al final del menú integrado
   * (ej: Combinar, Relacionar, Importar).
   */
  menuItems?: TPActionsMenuItem[];

  // ---- Selección masiva ----
  selectable?: boolean;
  getRowId?: (row: T) => string;
  onSelectionChange?: (ids: Set<string>) => void;
  /**
   * Acciones del bulk bar (ej: botón "Eliminar").
   * El badge de conteo y el botón "Limpiar" son renderizados automáticamente por TPTableKit.
   */
  bulkActions?: ReactNode;
  /**
   * Llamado cuando el usuario hace clic en "Limpiar" (además de limpiar la selección interna).
   */
  onClearSelection?: () => void;

  // ---- Filas ----
  /**
   * Renderiza cada fila.
   * - `vis`: columnas visibles (vis[colKey] === true)
   * - `sel`: solo presente cuando selectable=true
   */
  renderRow: (row: T, vis: Record<string, boolean>, sel?: TPRowSel) => ReactNode;

  // ---- Estado vacío / carga ----
  emptyText?: string;
  loading?: boolean;

  // ---- Footer / count ----
  /**
   * Texto del footer.
   * - String: se prefija con el conteo  →  "3 vendedores"
   * - Función: control total  →  (n) => `${n} vendedor${n !== 1 ? "es" : ""}`
   * - Si se omite, muestra "{n} registro(s)"
   */
  countLabel?: string | ((n: number) => string);

  // ---- Paginación ----
  /**
   * Activa paginación.
   * - `true`            → modo local con pageSize=25 por defecto
   * - `false`/undefined → sin paginación (comportamiento anterior)
   * - `PaginationConfig`→ modo local con config o modo controlado (server-side)
   */
  pagination?: boolean | PaginationConfig;

  // ---- Opcionales ----
  responsive?: "scroll" | "stack";
  className?: string;
  onRowClick?: (row: T) => void;
  /** Oculta el botón de mostrar/ocultar columnas. Default: false */
  hideColumnPicker?: boolean;
};

/* =========================================================
   HELPERS
========================================================= */
function loadVis(key: string | undefined, cols: TPColDef[]): Record<string, boolean> {
  const defaults: Record<string, boolean> = {};
  cols.forEach((c) => { defaults[c.key] = c.visible !== false; });
  if (!key) return defaults;
  try {
    const stored = localStorage.getItem(key);
    if (!stored) return defaults;
    const parsed = JSON.parse(stored) as Record<string, boolean>;
    const result = { ...defaults };
    Object.keys(parsed).forEach((k) => { if (k in result) result[k] = parsed[k]; });
    return result;
  } catch { return defaults; }
}

function saveVis(key: string, vis: Record<string, boolean>) {
  try { localStorage.setItem(key, JSON.stringify(vis)); } catch {}
}

function loadOrder(key: string | undefined, cols: TPColDef[]): string[] {
  const hideableKeys = cols.filter((c) => c.canHide !== false).map((c) => c.key);
  if (!key) return hideableKeys;
  try {
    const stored = localStorage.getItem(`${key}_order`);
    if (!stored) return hideableKeys;
    const parsed = JSON.parse(stored) as string[];
    const valid   = parsed.filter((k) => hideableKeys.includes(k));
    const missing = hideableKeys.filter((k) => !valid.includes(k));
    return [...valid, ...missing];
  } catch { return hideableKeys; }
}

function saveOrder(key: string, order: string[]) {
  try { localStorage.setItem(`${key}_order`, JSON.stringify(order)); } catch {}
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
  sortMenuItems,
  onToggleSelectable,
  menuItems,
  selectable = false,
  getRowId,
  onSelectionChange,
  bulkActions,
  onClearSelection,
  renderRow,
  emptyText = "No hay resultados.",
  loading = false,
  countLabel,
  pagination,
  responsive = "scroll",
  className,
  onRowClick,
  hideColumnPicker = false,
}: Props<T>) {
  // ── Visibilidad de columnas ──────────────────────────────────────────────
  const [vis, setVis] = useState<Record<string, boolean>>(() =>
    loadVis(storageKey, columns)
  );

  // ── Orden de columnas (solo las ocultables) ──────────────────────────────
  const [colOrder, setColOrder] = useState<string[]>(() =>
    loadOrder(storageKey, columns)
  );

  // ── Selección masiva ─────────────────────────────────────────────────────
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Limpiar selección cuando el padre desactiva el modo (ej: después de bulk delete)
  useEffect(() => {
    if (!selectable) {
      setSelectedIds(new Set());
    }
  }, [selectable]);

  // ── Paginación ───────────────────────────────────────────────────────────
  const pag = usePagination(pagination);

  const totalItems  = pag.enabled ? (pag.totalItems ?? rows.length) : rows.length;
  const totalPages  = pag.enabled ? Math.max(1, Math.ceil(totalItems / pag.pageSize)) : 1;
  const currentPage = pag.enabled ? Math.min(pag.page, totalPages) : 1;

  useEffect(() => {
    if (pag.enabled && pag.page > totalPages) {
      pag.setPage(1);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [totalPages]);

  const _pagTotalItems = pag.enabled ? pag.totalItems : undefined;
  const _pagPageSize   = pag.enabled ? pag.pageSize   : 0;
  const pageRows = useMemo(() => {
    if (!pag.enabled) return rows;
    if (_pagTotalItems !== undefined) return rows;
    const start = (currentPage - 1) * _pagPageSize;
    return rows.slice(start, start + _pagPageSize);
  }, [rows, pag.enabled, _pagTotalItems, currentPage, _pagPageSize]);

  // ── Selección ────────────────────────────────────────────────────────────
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
    const pageIds = pageRows.map((r) => getRowId!(r));
    const allSelected = pageIds.every((id) => selectedIds.has(id));
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (allSelected) pageIds.forEach((id) => next.delete(id));
      else             pageIds.forEach((id) => next.add(id));
      onSelectionChange?.(next);
      return next;
    });
  }

  function clearSelection() {
    setSelectedIds(new Set());
    onSelectionChange?.(new Set());
    onClearSelection?.();
  }

  // ── Columnas ─────────────────────────────────────────────────────────────
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

  const visibleCols = useMemo(() => {
    const hideableCols   = columns.filter((c) => c.canHide !== false);
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

  const colSpan = visibleCols.length + (selectable ? 1 : 0);

  // ── Footer count ─────────────────────────────────────────────────────────
  const count = pag.enabled && pag.totalItems !== undefined ? pag.totalItems : rows.length;
  const countStr =
    typeof countLabel === "function"
      ? countLabel(count)
      : countLabel
      ? `${count} ${countLabel}`
      : `${count} ${count === 1 ? "registro" : "registros"}`;

  // ── Estado del checkbox de cabecera ──────────────────────────────────────
  const pageIds     = selectable && getRowId ? pageRows.map(getRowId) : [];
  const allChecked  = pageIds.length > 0 && pageIds.every((id) => selectedIds.has(id));
  const someChecked = pageIds.some((id) => selectedIds.has(id));
  const nSelected   = selectedIds.size;

  // ── Menú integrado ───────────────────────────────────────────────────────
  const builtInItems: TPActionsMenuItem[] = [];

  if (sortMenuItems?.length && onSort) {
    builtInItems.push({
      type: "submenu",
      label: "Ordenar por",
      icon: <ArrowUpDown size={14} />,
      children: sortMenuItems.map((item) => ({
        label: item.label,
        icon: sortKey === item.key
          ? <Check size={14} className="text-primary" />
          : (item.icon ?? <ArrowUpDown size={14} />),
        onClick: () => onSort(item.key),
      })),
    });
  }

  if (onToggleSelectable) {
    if (builtInItems.length) builtInItems.push({ type: "separator" });
    builtInItems.push({
      label: selectable ? "Cancelar selección" : "Selección masiva",
      icon:  selectable ? <XSquare size={14} /> : <CheckSquare size={14} />,
      onClick: onToggleSelectable,
    });
  }

  if (menuItems?.length) {
    if (builtInItems.length) builtInItems.push({ type: "separator" });
    builtInItems.push(...menuItems);
  }

  const hasBuiltInMenu = builtInItems.length > 0;

  return (
    <TPTableWrap className={className}>
      {/* ── Header principal ── */}
      <TPTableHeader
        left={
          <div className="flex items-center gap-2">
            {!hideColumnPicker && pickerCols.length > 0 && (
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
        right={
          <div className={cn("flex items-center gap-2", !hasBuiltInMenu && !actions && "hidden")}>
            {actions}
            {hasBuiltInMenu && (
              <TPActionsMenu items={builtInItems} title="Más opciones" />
            )}
          </div>
        }
      />

      {belowHeader}

      {/* ── Barra de acciones masivas ── */}
      {selectable && nSelected > 0 && (
        <div className="flex items-center gap-3 border-b border-border px-4 py-2">
          <TPBadge tone="neutral" size="sm">
            {nSelected} seleccionado{nSelected !== 1 ? "s" : ""}
          </TPBadge>
          <div className="flex-1" />
          <TPButton
            variant="secondary"
            onClick={clearSelection}
            className="h-8 text-sm"
          >
            Limpiar
          </TPButton>
          {bulkActions}
        </div>
      )}

      {/* ── Tabla ── */}
      <TPTable>
        <TPTableXScroll>
          <TPTableElBase responsive={responsive}>
            <TPThead>
              <tr>
                {selectable && (
                  <TPTh style={{ width: "40px" }} className="px-3">
                    <TPCheckbox
                      checked={allChecked}
                      indeterminate={someChecked && !allChecked}
                      onChange={() => toggleAll()}
                      aria-label="Seleccionar todos"
                    />
                  </TPTh>
                )}
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
              ) : pageRows.length === 0 ? (
                <TPEmptyRow colSpan={colSpan} text={emptyText} />
              ) : (
                pageRows.map((row) => {
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

      {/* ── Footer ── */}
      {pag.enabled ? (
        <TPPagination
          page={currentPage}
          pageSize={pag.pageSize}
          total={totalItems}
          onPageChange={pag.setPage}
          onPageSizeChange={pag.setPageSize}
          pageSizeOptions={pag.pageSizeOptions}
          countLabel={countStr}
        />
      ) : (
        <TPTableFooter>
          <span>{countStr}</span>
        </TPTableFooter>
      )}
    </TPTableWrap>
  );
}

export default TPTableKit;
