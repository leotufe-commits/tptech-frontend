// src/components/ui/TPTreeTable.tsx
/**
 * Tabla jerárquica genérica reutilizable.
 *
 * Características:
 * - Árbol con indent automático por nivel
 * - Botón expand/collapse por fila (controlado externamente)
 * - Drag & drop opcional (requiere DndContext en el padre)
 * - Columnas configurables con visibilidad
 * - Celda de acciones opcional (renderActions)
 * - Paginación opcional (prop `pagination`)
 * - Estados loading / empty
 */
import React, { useMemo, useEffect, type ReactNode } from "react";
import { ChevronDown, ChevronRight, GripVertical, Loader2 } from "lucide-react";
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

import { cn } from "./tp";
import {
  TPTableElBase,
  TPTableXScroll,
  TPThead,
  TPTbody,
  TPTh,
  TPTd,
  TPEmptyRow,
} from "./TPTable";
import { TPPagination } from "./TPPagination";
import { usePagination, type PaginationConfig } from "../../hooks/usePagination";

/* =========================================================
   Tipos públicos
========================================================= */

/** Forma mínima que debe tener cada nodo del árbol. */
export type TreeNodeBase = {
  id: string;
  level: number;
  /** Hijos directos (usados para saber si el nodo es expandible). */
  children: { id: string }[];
};

/** Definición de una columna de la tabla. */
export type TreeColDef = {
  key: string;
  /** Contenido del encabezado (puede incluir botones de sort). */
  header: ReactNode;
  /**
   * Si false, la columna se oculta completamente (th + td).
   * Default: true.
   */
  visible?: boolean;
  /**
   * Clase CSS aplicada tanto al <th> como al <td>.
   * Útil para "hidden md:table-cell".
   */
  className?: string;
  /**
   * Render del contenido de la celda.
   * La primera columna recibe automáticamente el indent + botón expand/collapse.
   * Para acceder a campos específicos de TNode, castear: `(node as CategoryNode).name`
   */
  renderCell: (node: TreeNodeBase) => ReactNode;
};

export type TPTreeTableProps = {
  /** Nodos ya aplanados y filtrados (visibles en el árbol actual). */
  nodes: TreeNodeBase[];

  /** Definición de columnas. La primera columna recibe indent + botón expand/collapse. */
  columns: TreeColDef[];

  /**
   * Renderiza la celda de acciones (columna derecha fija).
   * Si no se pasa, la columna de acciones no aparece.
   */
  renderActions?: (node: TreeNodeBase) => ReactNode;

  /** IDs de nodos expandidos (manejado en el padre). */
  expanded: Set<string>;
  onToggleExpand: (id: string) => void;

  /**
   * Habilita drag & drop por fila.
   * El padre debe proveer `<DndContext>` y manejar `onDragEnd`.
   * TPTreeTable maneja `<SortableContext>` y `useSortable` internamente.
   */
  draggable?: boolean;

  /**
   * En modo búsqueda se oculta el drag handle y el botón expand/collapse.
   * Default: false.
   */
  isSearching?: boolean;

  loading?: boolean;

  /** Elemento que se muestra mientras carga (en el centro). Default: spinner. */
  loadingElement?: ReactNode;

  /** Texto cuando no hay filas. */
  emptyText?: string;

  /** px de sangría por nivel de árbol. Default: 24. */
  indentPx?: number;

  /** Clase CSS extra por fila (ej: "opacity-60" para inactivos). */
  rowClassName?: (node: TreeNodeBase) => string | undefined;

  /** Si se pasa, la fila entera es clickeable y llama a esta función. */
  onRowClick?: (node: TreeNodeBase) => void;

  /**
   * Activa paginación local sobre los nodos visibles.
   * - `true`            → pageSize=25 por defecto
   * - `false`/undefined → sin paginación (comportamiento anterior)
   * - `PaginationConfig`→ configuración personalizada o modo controlado
   */
  pagination?: boolean | PaginationConfig;
};

/* =========================================================
   Fila interna (sin DnD)
========================================================= */
type RowInnerProps = {
  node: TreeNodeBase;
  visibleCols: TreeColDef[];
  renderActions?: (node: TreeNodeBase) => ReactNode;
  expanded: Set<string>;
  onToggleExpand: (id: string) => void;
  onRowClick?: (node: TreeNodeBase) => void;
  isSearching: boolean;
  indentPx: number;
  rowClassName?: (node: TreeNodeBase) => string | undefined;
  /** Presencia de dragHandleProps activa la columna de handle en la fila. */
  dragHandleProps?: React.HTMLAttributes<HTMLDivElement>;
  trRef?: (el: HTMLTableRowElement | null) => void;
  trStyle?: React.CSSProperties;
};

function RowInner({
  node,
  visibleCols,
  renderActions,
  expanded,
  onToggleExpand,
  onRowClick,
  isSearching,
  indentPx,
  rowClassName,
  dragHandleProps,
  trRef,
  trStyle,
}: RowInnerProps) {
  const hasChildren = node.children.length > 0;
  const isExpanded  = expanded.has(node.id);

  return (
    <tr
      ref={trRef}
      style={trStyle}
      onClick={onRowClick ? () => onRowClick(node) : undefined}
      className={cn(
        "border-b border-border",
        node.level > 0 && "bg-surface/40",
        onRowClick && "cursor-pointer hover:bg-primary/5 active:bg-primary/10 transition-colors",
        rowClassName?.(node)
      )}
    >
      {/* Drag handle */}
      {dragHandleProps !== undefined && (
        <td className="w-6 pl-2">
          <div
            {...dragHandleProps}
            className="cursor-grab active:cursor-grabbing text-muted/40 hover:text-muted p-0.5 rounded transition-colors"
            title="Arrastrar para reordenar"
          >
            <GripVertical size={13} />
          </div>
        </td>
      )}

      {/* Columnas de datos */}
      {visibleCols.map((col, idx) => (
        <TPTd key={col.key} className={col.className}>
          {idx === 0 ? (
            /* Primera columna: recibe indent + botón expand/collapse */
            <div
              className="flex items-center gap-1.5 min-w-0"
              style={{ paddingLeft: `${node.level * indentPx}px` }}
            >
              {!isSearching ? (
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); hasChildren && onToggleExpand(node.id); }}
                  className={cn(
                    "h-6 w-6 shrink-0 flex items-center justify-center rounded",
                    hasChildren
                      ? "hover:bg-surface2 text-muted cursor-pointer"
                      : "cursor-default"
                  )}
                  tabIndex={hasChildren ? 0 : -1}
                  aria-label={isExpanded ? "Colapsar" : "Expandir"}
                >
                  {hasChildren ? (
                    isExpanded
                      ? <ChevronDown  size={13} className="text-muted" />
                      : <ChevronRight size={13} className="text-muted" />
                  ) : (
                    <span className="block w-[13px]" />
                  )}
                </button>
              ) : (
                <span className="h-6 w-6 shrink-0" />
              )}
              {col.renderCell(node)}
            </div>
          ) : (
            col.renderCell(node)
          )}
        </TPTd>
      ))}

      {/* Acciones */}
      {renderActions && (
        <TPTd className="text-right" onClick={(e) => e.stopPropagation()}>
          {renderActions(node)}
        </TPTd>
      )}
    </tr>
  );
}

/* =========================================================
   Fila sortable (con DnD)
========================================================= */
type PlainRowProps = Omit<RowInnerProps, "dragHandleProps" | "trRef" | "trStyle">;

function SortableRow(props: PlainRowProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: props.node.id });

  return (
    <RowInner
      {...props}
      trRef={setNodeRef}
      trStyle={{
        transform:  CSS.Transform.toString(transform),
        transition,
        opacity:    isDragging ? 0.45       : undefined,
        zIndex:     isDragging ? 10         : undefined,
        position:   isDragging ? "relative" : undefined,
        boxShadow:  isDragging ? "0 4px 16px 0 rgba(0,0,0,0.12)" : undefined,
      }}
      dragHandleProps={
        { ...attributes, ...listeners } as React.HTMLAttributes<HTMLDivElement>
      }
    />
  );
}

/* =========================================================
   Componente principal
========================================================= */
export function TPTreeTable({
  nodes,
  columns,
  renderActions,
  expanded,
  onToggleExpand,
  onRowClick,
  draggable    = false,
  isSearching  = false,
  loading      = false,
  loadingElement,
  emptyText    = "No hay resultados.",
  indentPx     = 24,
  rowClassName,
  pagination,
}: TPTreeTableProps) {
  const visibleCols = columns.filter((c) => c.visible !== false);
  const useDnd      = draggable && !isSearching;

  const colCount =
    (useDnd ? 1 : 0) +
    visibleCols.length +
    (renderActions ? 1 : 0);

  // ── Paginación ───────────────────────────────────────────────────────────
  const pag = usePagination(pagination);

  const totalPages  = pag.enabled ? Math.max(1, Math.ceil(nodes.length / pag.pageSize)) : 1;
  const currentPage = pag.enabled ? Math.min(pag.page, totalPages) : 1;

  // Sincronizar estado de página cuando totalPages cambia
  useEffect(() => {
    if (pag.enabled && pag.page > totalPages) {
      pag.setPage(1);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [totalPages]);

  const pageNodes = useMemo(() => {
    if (!pag.enabled) return nodes;
    const start = (currentPage - 1) * pag.pageSize;
    return nodes.slice(start, start + pag.pageSize);
  }, [nodes, pag.enabled, currentPage, pag.pageSize]);

  // ── Props comunes de fila ────────────────────────────────────────────────
  const rowProps: PlainRowProps = {
    visibleCols,
    renderActions,
    expanded,
    onToggleExpand,
    onRowClick,
    isSearching,
    indentPx,
    rowClassName,
    node: { id: "", level: 0, children: [] },
  };

  // ── Cuerpo de la tabla ───────────────────────────────────────────────────
  let body: ReactNode;

  if (loading) {
    body = (
      <tr>
        <td colSpan={colCount} className="px-5 py-12 text-center text-sm text-muted">
          <div className="flex flex-col items-center gap-2">
            {loadingElement ?? <Loader2 size={28} className="animate-spin text-muted" />}
            Cargando…
          </div>
        </td>
      </tr>
    );
  } else if (pageNodes.length === 0) {
    body = <TPEmptyRow colSpan={colCount} text={emptyText} />;
  } else if (useDnd) {
    body = (
      <SortableContext
        items={pageNodes.map((n) => n.id)}
        strategy={verticalListSortingStrategy}
      >
        {pageNodes.map((node) => (
          <SortableRow key={node.id} {...rowProps} node={node} />
        ))}
      </SortableContext>
    );
  } else {
    body = pageNodes.map((node) => (
      <RowInner key={node.id} {...rowProps} node={node} />
    ));
  }

  return (
    <>
      <TPTableXScroll>
        <TPTableElBase responsive="stack">
          <TPThead>
            <tr>
              {useDnd && <th className="w-6" />}
              {visibleCols.map((col) => (
                <TPTh key={col.key} className={col.className}>
                  {col.header}
                </TPTh>
              ))}
              {renderActions && (
                <TPTh className="text-right">Acciones</TPTh>
              )}
            </tr>
          </TPThead>
          <TPTbody>{body}</TPTbody>
        </TPTableElBase>
      </TPTableXScroll>

      {pag.enabled && (
        <TPPagination
          page={currentPage}
          pageSize={pag.pageSize}
          total={nodes.length}
          onPageChange={pag.setPage}
          onPageSizeChange={pag.setPageSize}
          pageSizeOptions={pag.pageSizeOptions}
        />
      )}
    </>
  );
}
