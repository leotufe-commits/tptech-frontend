// src/components/ui/CategoryTreePicker.tsx
import React, { useEffect, useMemo, useState } from "react";
import { ChevronRight, Search, X } from "lucide-react";
import { cn } from "./tp";
import { TPCheckbox } from "./TPCheckbox";
import { selectableRowProps } from "./selectableRow";
import type { CategoryRow } from "../../services/categories";

/* =========================================================
   Helpers de árbol
========================================================= */
export type CatNode = CategoryRow & { children: CatNode[] };

export function buildCategoryTree(cats: CategoryRow[]): CatNode[] {
  const map = new Map<string, CatNode>();
  cats.forEach((c) => map.set(c.id, { ...c, children: [] }));
  const roots: CatNode[] = [];
  map.forEach((node) => {
    if (node.parentId && map.has(node.parentId)) {
      map.get(node.parentId)!.children.push(node);
    } else {
      roots.push(node);
    }
  });
  return roots.sort((a, b) => a.sortOrder - b.sortOrder);
}

export function getAllDescendantIds(node: CatNode): string[] {
  const ids: string[] = [node.id];
  node.children.forEach((c) => ids.push(...getAllDescendantIds(c)));
  return ids;
}

/* Devuelve true si el nodo o algún descendiente coincide con la búsqueda */
function nodeMatchesSearch(node: CatNode, q: string): boolean {
  if (node.name.toLowerCase().includes(q)) return true;
  return node.children.some((c) => nodeMatchesSearch(c, q));
}

/* =========================================================
   CategoryTreePicker
   - single=false (default): selección múltiple con cascada padre→hijos
   - single=true:            selección de una sola categoría
========================================================= */
export function CategoryTreePicker({
  categories,
  value,
  onChange,
  disabled = false,
  single = false,
  listMaxHeight = "max-h-52",
}: {
  categories: CategoryRow[];
  value: string[];
  onChange: (ids: string[]) => void;
  disabled?: boolean;
  single?: boolean;
  /** Tailwind max-h-* class para la lista del árbol. Default: "max-h-52" */
  listMaxHeight?: string;
}) {
  const tree = useMemo(() => buildCategoryTree(categories), [categories]);
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set());
  const [search, setSearch] = useState("");

  useEffect(() => {
    setExpanded(new Set(tree.map((n) => n.id)));
  }, [tree]);

  // Al buscar, expandir todo para mostrar resultados
  useEffect(() => {
    if (search.trim()) {
      const allIds = new Set<string>();
      function collectIds(node: CatNode) {
        allIds.add(node.id);
        node.children.forEach(collectIds);
      }
      tree.forEach(collectIds);
      setExpanded(allIds);
    }
  }, [search, tree]);

  function toggleExpand(id: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  /* ---- lógica de selección ---- */
  function getCheckState(node: CatNode): "checked" | "partial" | "unchecked" {
    if (single) {
      return value.includes(node.id) ? "checked" : "unchecked";
    }
    const ids = getAllDescendantIds(node);
    const count = ids.filter((id) => value.includes(id)).length;
    if (count === 0) return "unchecked";
    if (count === ids.length) return "checked";
    return "partial";
  }

  function toggleNode(node: CatNode) {
    if (single) {
      const already = value.includes(node.id);
      onChange(already ? [] : [node.id]);
      return;
    }
    const ids = getAllDescendantIds(node);
    const state = getCheckState(node);
    if (state === "checked") {
      onChange(value.filter((id) => !ids.includes(id)));
    } else {
      const toAdd = ids.filter((id) => !value.includes(id));
      onChange([...value, ...toAdd]);
    }
  }

  function renderNode(node: CatNode, depth: number): React.ReactNode {
    const q = search.trim().toLowerCase();
    if (q && !nodeMatchesSearch(node, q)) return null;

    const checkState = getCheckState(node);
    const hasChildren = node.children.length > 0;
    const isOpen = expanded.has(node.id);

    return (
      <div key={node.id}>
        <div
          className={cn(
            "flex items-center gap-1.5 py-1.5 rounded-lg transition-colors",
            !disabled && "hover:bg-primary/5",
            disabled && "opacity-60"
          )}
          style={{ paddingLeft: `${8 + depth * 18}px`, paddingRight: "8px" }}
          {...selectableRowProps({ onToggle: () => toggleNode(node), disabled })}
        >
          {/* Botón expand/collapse */}
          {hasChildren ? (
            <button
              type="button"
              disabled={disabled}
              onClick={() => toggleExpand(node.id)}
              className="flex-shrink-0 w-5 h-5 flex items-center justify-center text-muted hover:text-text transition"
            >
              <ChevronRight
                size={13}
                className={cn("transition-transform", isOpen && "rotate-90")}
              />
            </button>
          ) : (
            <span className="w-5 flex-shrink-0" />
          )}

          {/* Checkbox + label */}
          <TPCheckbox
            checked={checkState === "checked"}
            indeterminate={!single && checkState === "partial"}
            onChange={() => toggleNode(node)}
            disabled={disabled}
            className="flex-1 min-w-0"
            label={
              <span className="flex items-center gap-1.5 min-w-0">
                <span className="text-sm text-text truncate">{node.name}</span>
                {hasChildren && !single && (
                  <span className="text-[11px] text-muted flex-shrink-0 tabular-nums">
                    {node.children.length}
                  </span>
                )}
              </span>
            }
          />
        </div>

        {isOpen &&
          node.children
            .slice()
            .sort((a, b) => a.sortOrder - b.sortOrder)
            .map((child) => renderNode(child, depth + 1))}
      </div>
    );
  }

  if (categories.length === 0) {
    return <p className="text-sm text-muted italic py-2">No hay categorías disponibles.</p>;
  }

  const selectionCount = value.length;
  const selectionLabel = single
    ? selectionCount === 1 ? "1 seleccionada" : "Ninguna seleccionada"
    : selectionCount === 0
    ? "Ninguna seleccionada"
    : `${selectionCount} seleccionada${selectionCount !== 1 ? "s" : ""}`;

  return (
    <div className="border border-border rounded-xl overflow-hidden bg-surface/40">
      {/* Buscador interno */}
      <div className="relative border-b border-border">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted pointer-events-none" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar categoría..."
          disabled={disabled}
          className="w-full bg-transparent pl-8 pr-3 py-1.5 text-sm text-text placeholder:text-muted outline-none"
        />
        {search && (
          <button
            type="button"
            onClick={() => setSearch("")}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-muted hover:text-text transition"
          >
            <X size={13} />
          </button>
        )}
      </div>

      <div className={cn("overflow-y-auto p-2 space-y-0.5", listMaxHeight)}>
        {tree.map((root) => renderNode(root, 0))}
      </div>

      {/* Footer siempre visible con dimensiones estables */}
      <div className="border-t border-border px-3 py-1.5 flex items-center justify-between gap-2 bg-surface/50">
        <span className="text-xs text-muted whitespace-nowrap shrink-0">{selectionLabel}</span>
        <button
          type="button"
          disabled={disabled || selectionCount === 0}
          onClick={() => onChange([])}
          className={cn(
            "text-xs flex items-center gap-1 shrink-0",
            selectionCount > 0
              ? "text-muted hover:text-primary cursor-pointer"
              : "invisible cursor-default"
          )}
        >
          <X size={11} /> Limpiar
        </button>
      </div>
    </div>
  );
}
