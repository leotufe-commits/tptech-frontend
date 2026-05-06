// src/components/ui/GroupArticleTreePicker.tsx
// Combo desplegable con árbol artículo→variantes y selección múltiple con checkboxes.
// La selección ocurre íntegramente dentro del dropdown; el trigger es el input de búsqueda.
// Tras confirmar, el dropdown se cierra y la selección se limpia.
import React, { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ChevronDown, ChevronRight, Loader2, Package } from "lucide-react";
import { cn } from "./tp";
import { TPCheckbox } from "./TPCheckbox";
import { TPButton } from "./TPButton";
import TPInput from "./TPInput";
import { selectableRowProps } from "./selectableRow";
import {
  articleGroupsApi,
  type ArticleTreeNode,
  type ArticleTreeVariantNode,
  type BatchAddItem,
} from "../../services/article-groups";
import { toast } from "../../lib/toast";

type PendingItem = {
  itemType: "ARTICLE" | "VARIANT";
  refId: string;
  label: string;
  imageUrl: string;
  selectorValue: string;
};

interface Props {
  groupId: string;
  selectorLabel: string;
  onAdded: () => void;
}

export function GroupArticleTreePicker({ groupId, selectorLabel, onAdded }: Props) {
  const wrapRef     = useRef<HTMLDivElement>(null);
  const inputRef    = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const [open, setOpen]           = useState(false);
  const [dropStyle, setDropStyle] = useState<React.CSSProperties>({});

  const [query, setQuery]                   = useState("");
  const [nodes, setNodes]                   = useState<ArticleTreeNode[]>([]);
  const [loading, setLoading]               = useState(false);
  const [expanded, setExpanded]             = useState<Set<string>>(new Set());
  const [selVariantIds, setSelVariantIds]   = useState<Set<string>>(new Set());
  const [selArticleIds, setSelArticleIds]   = useState<Set<string>>(new Set());

  // step "pick" = árbol con checkboxes; step "assign" = inputs de selectorValue
  const [step, setStepState]                = useState<"pick" | "assign">("pick");
  const stepRef                             = useRef<"pick" | "assign">("pick");
  function setStep(s: "pick" | "assign") { setStepState(s); stepRef.current = s; }

  const [pendingItems, setPendingItems]     = useState<PendingItem[]>([]);
  const [saving, setSaving]                 = useState(false);

  const genRef             = useRef(0);
  const timer              = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hasInitiallyLoaded = useRef(false);

  // ── Posicionamiento del dropdown ─────────────────────────────────────────
  function calcDropStyle(): React.CSSProperties {
    const rect = inputRef.current?.getBoundingClientRect();
    if (!rect) return {};
    const w          = Math.max(rect.width, 420);
    const maxH       = 360;
    const spaceBelow = window.innerHeight - rect.bottom - 8;
    const spaceAbove = rect.top - 8;
    if (spaceBelow >= maxH || spaceBelow >= spaceAbove)
      return { top: rect.bottom + 4, left: rect.left, width: w };
    return { bottom: window.innerHeight - rect.top + 4, left: rect.left, width: w };
  }

  // Cierre al hacer clic fuera — NO cierra durante el paso "assign"
  useEffect(() => {
    function onDoc(e: MouseEvent) {
      const t = e.target as Node;
      if (!wrapRef.current?.contains(t) && !dropdownRef.current?.contains(t)) {
        if (stepRef.current !== "assign") closeDropdown();
      }
    }
    document.addEventListener("mousedown", onDoc, true);
    return () => document.removeEventListener("mousedown", onDoc, true);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Reposicionar al hacer scroll/resize mientras está abierto
  useEffect(() => {
    if (!open) return;
    function update() { setDropStyle(calcDropStyle()); }
    window.addEventListener("scroll", update, true);
    window.addEventListener("resize", update);
    return () => { window.removeEventListener("scroll", update, true); window.removeEventListener("resize", update); };
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Carga del árbol ──────────────────────────────────────────────────────
  async function doSearch(val: string) {
    genRef.current++;
    const gen = genRef.current;
    setLoading(true);
    try {
      const res = await articleGroupsApi.searchAvailableTree(groupId, val);
      if (gen !== genRef.current) return;
      setNodes(res);
      setExpanded(new Set(res.map(n => n.articleId)));
    } catch {
      if (gen !== genRef.current) return;
      setNodes([]);
    } finally {
      if (gen === genRef.current) setLoading(false);
    }
  }

  function openDropdown() {
    setDropStyle(calcDropStyle());
    setOpen(true);
    if (!hasInitiallyLoaded.current) {
      hasInitiallyLoaded.current = true;
      void doSearch("");
    }
  }

  function closeDropdown() {
    setOpen(false);
    setStep("pick");
    setSelVariantIds(new Set());
    setSelArticleIds(new Set());
    setQuery("");
  }

  function handleQueryChange(val: string) {
    setQuery(val);
    setSelVariantIds(new Set());
    setSelArticleIds(new Set());
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => void doSearch(val), 300);
  }

  // ── Estado de selección ──────────────────────────────────────────────────
  function articleCheckState(node: ArticleTreeNode): "checked" | "indeterminate" | "unchecked" {
    if (!node.hasVariants)
      return selArticleIds.has(node.articleId) ? "checked" : "unchecked";
    const selectable = node.variants.filter(v => !v.alreadyInGroup && !v.inOtherGroup);
    if (selectable.length === 0) return "unchecked";
    const n = selectable.filter(v => selVariantIds.has(v.variantId)).length;
    if (n === 0) return "unchecked";
    return n === selectable.length ? "checked" : "indeterminate";
  }

  function isArticleDisabled(node: ArticleTreeNode): boolean {
    if (!node.hasVariants) return node.alreadyInGroup || node.inOtherGroup;
    return node.variants.filter(v => !v.alreadyInGroup && !v.inOtherGroup).length === 0;
  }

  function toggleArticle(node: ArticleTreeNode) {
    if (isArticleDisabled(node)) return;
    if (!node.hasVariants) {
      setSelArticleIds(prev => {
        const next = new Set(prev);
        next.has(node.articleId) ? next.delete(node.articleId) : next.add(node.articleId);
        return next;
      });
      return;
    }
    const selectable = node.variants.filter(v => !v.alreadyInGroup && !v.inOtherGroup);
    const allSel = selectable.length > 0 && selectable.every(v => selVariantIds.has(v.variantId));
    setSelVariantIds(prev => {
      const next = new Set(prev);
      allSel
        ? selectable.forEach(v => next.delete(v.variantId))
        : selectable.forEach(v => next.add(v.variantId));
      return next;
    });
  }

  function toggleVariant(v: ArticleTreeVariantNode) {
    if (v.alreadyInGroup || v.inOtherGroup) return;
    setSelVariantIds(prev => {
      const next = new Set(prev);
      next.has(v.variantId) ? next.delete(v.variantId) : next.add(v.variantId);
      return next;
    });
  }

  const selCount = selVariantIds.size + selArticleIds.size;

  // ── Lógica de agregar ────────────────────────────────────────────────────
  function buildPendingItems(): PendingItem[] {
    const items: PendingItem[] = [];
    for (const node of nodes) {
      if (!node.hasVariants && selArticleIds.has(node.articleId)) {
        items.push({ itemType: "ARTICLE", refId: node.articleId, label: node.name, imageUrl: node.mainImageUrl, selectorValue: "" });
      }
      if (node.hasVariants) {
        for (const v of node.variants) {
          if (selVariantIds.has(v.variantId)) {
            items.push({ itemType: "VARIANT", refId: v.variantId, label: `${node.name} — ${v.name}`, imageUrl: v.imageUrl || node.mainImageUrl, selectorValue: "" });
          }
        }
      }
    }
    return items;
  }

  function handleAdd() {
    if (selCount === 0) return;
    const items = buildPendingItems();
    if (selectorLabel) {
      setPendingItems(items);
      setStep("assign");
    } else {
      void doAddBatch(items);
    }
  }

  async function doAddBatch(items: PendingItem[]) {
    const payload: BatchAddItem[] = items.map(i => ({
      itemType:      i.itemType,
      refId:         i.refId,
      selectorValue: i.selectorValue,
    }));
    setSaving(true);
    try {
      const result = await articleGroupsApi.addItemsBatch(groupId, payload);
      const n = result.added;
      toast.success(
        result.skipped > 0
          ? `${n} ${n === 1 ? "item agregado" : "items agregados"} (${result.skipped} omitidos).`
          : `${n} ${n === 1 ? "item agregado" : "items agregados"}.`,
      );
      closeDropdown();
      onAdded();
      void doSearch(""); // actualiza alreadyInGroup para la próxima apertura
      hasInitiallyLoaded.current = true;
    } catch (e: any) {
      toast.error(e?.message ?? "No se pudo agregar los items.");
    } finally {
      setSaving(false);
    }
  }

  // ── Render ────────────────────────────────────────────────────────────────
  const dropdown = (
    <div
      ref={dropdownRef}
      data-tp-portal
      style={{ ...dropStyle, position: "fixed", zIndex: 9999 }}
      className="rounded-2xl border border-border bg-card shadow-soft overflow-hidden"
      onMouseDown={e => {
        // No prevenir default en inputs/textarea — necesitan el evento para recibir foco por click
        if (!(e.target as HTMLElement).closest("input, textarea")) e.preventDefault();
      }}
    >
      {step === "assign" ? (
        // ── Paso 2: asignar selectorLabel ────────────────────────────────
        <div>
          <div className="px-3 py-2 bg-primary/5 border-b border-primary/20">
            <p className="text-xs font-medium text-primary/80">
              Asignando <span className="font-semibold">"{selectorLabel}"</span>{" "}
              a {pendingItems.length} {pendingItems.length === 1 ? "item" : "items"}
            </p>
          </div>
          <div className="max-h-72 overflow-y-auto divide-y divide-border/40">
            {pendingItems.map((item, idx) => (
              <div key={`${item.itemType}-${item.refId}`} className="flex items-center gap-2.5 px-3 py-2">
                <div className="w-8 h-8 rounded shrink-0 border border-border bg-surface2 overflow-hidden flex items-center justify-center">
                  {item.imageUrl
                    ? <img src={item.imageUrl} alt="" className="w-full h-full object-cover" />
                    : <Package size={12} className="text-muted opacity-50" />
                  }
                </div>
                <span className="flex-1 min-w-0 text-xs font-medium text-text truncate">{item.label}</span>
                <span className="text-xs text-muted shrink-0">{selectorLabel}:</span>
                <TPInput
                  autoFocus={idx === 0}
                  value={item.selectorValue}
                  onChange={v => setPendingItems(prev => prev.map((p, i) => i === idx ? { ...p, selectorValue: v } : p))}
                  onKeyDown={(e: React.KeyboardEvent) => {
                    if (e.key === "Enter" && idx === pendingItems.length - 1) {
                      e.preventDefault();
                      void doAddBatch(pendingItems);
                    }
                  }}
                  placeholder="Ej: 18 mm"
                  className="h-7 w-24 text-xs"
                />
              </div>
            ))}
          </div>
          <div className="border-t border-border/50 px-3 py-2 flex items-center justify-end gap-2">
            <TPButton variant="ghost" className="h-8 text-sm" onClick={() => setStep("pick")} disabled={saving}>
              Volver
            </TPButton>
            <TPButton variant="primary" className="h-8 text-sm" onClick={() => void doAddBatch(pendingItems)} loading={saving}>
              Confirmar y agregar
            </TPButton>
          </div>
        </div>
      ) : (
        // ── Paso 1: árbol de selección ───────────────────────────────────
        <>
          {loading ? (
            <div className="flex items-center gap-2 px-3 py-5 text-sm text-muted">
              <Loader2 size={13} className="animate-spin shrink-0" /> Buscando…
            </div>
          ) : nodes.length === 0 ? (
            <div className="px-3 py-5 text-sm text-muted text-center">
              {query.trim() ? "Sin resultados para esa búsqueda." : "No hay artículos disponibles."}
            </div>
          ) : (
            <div className="max-h-80 overflow-y-auto divide-y divide-border/30">
              {nodes.map(node => {
                const checkState = articleCheckState(node);
                const disabled   = isArticleDisabled(node);
                const isExpanded = expanded.has(node.articleId);

                return (
                  <div key={node.articleId}>
                    {/* Fila de artículo */}
                    <div className={cn("flex items-center gap-1 px-2 py-1.5 hover:bg-surface2/40 transition-colors", disabled && "opacity-50")}>
                      {node.hasVariants ? (
                        <button
                          type="button"
                          onClick={() => setExpanded(prev => {
                            const next = new Set(prev);
                            next.has(node.articleId) ? next.delete(node.articleId) : next.add(node.articleId);
                            return next;
                          })}
                          className="shrink-0 w-5 h-5 flex items-center justify-center text-muted hover:text-text transition-colors rounded"
                        >
                          <ChevronRight size={13} className={cn("transition-transform", isExpanded && "rotate-90")} />
                        </button>
                      ) : (
                        <div className="shrink-0 w-5" />
                      )}

                      <span
                        {...selectableRowProps({ onToggle: () => toggleArticle(node), disabled })}
                        className="flex items-center gap-2 flex-1 min-w-0 cursor-pointer py-0.5"
                      >
                        <TPCheckbox
                          checked={checkState === "checked"}
                          indeterminate={checkState === "indeterminate"}
                          onChange={() => toggleArticle(node)}
                          disabled={disabled}
                        />
                        <div className="w-7 h-7 rounded shrink-0 border border-border bg-surface2 overflow-hidden flex items-center justify-center">
                          {node.mainImageUrl
                            ? <img src={node.mainImageUrl} alt="" className="w-full h-full object-cover" />
                            : <Package size={11} className="text-muted opacity-40" />
                          }
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-medium text-text truncate">{node.name}</div>
                          {node.inOtherGroup && (
                            <div className="text-[10px] text-amber-600">Pertenece a: {node.otherGroupName ?? "otro grupo"}</div>
                          )}
                          {node.alreadyInGroup && !node.hasVariants && (
                            <div className="text-[10px] text-emerald-600">Ya en el grupo</div>
                          )}
                          {node.hasVariants && (
                            <div className="text-[10px] text-muted">{node.variants.length} variante{node.variants.length !== 1 ? "s" : ""}</div>
                          )}
                        </div>
                      </span>
                    </div>

                    {/* Filas de variantes (expandidas) */}
                    {node.hasVariants && isExpanded && node.variants.map(v => {
                      const vDisabled = v.alreadyInGroup || v.inOtherGroup;
                      return (
                        <div
                          key={v.variantId}
                          className={cn(
                            "flex items-center gap-1 pl-9 pr-2 py-1.5 hover:bg-surface2/40 transition-colors border-t border-border/20",
                            vDisabled && "opacity-50",
                          )}
                        >
                          <div className="shrink-0 w-5" />
                          <span
                            {...selectableRowProps({ onToggle: () => toggleVariant(v), disabled: vDisabled })}
                            className="flex items-center gap-2 flex-1 min-w-0 cursor-pointer py-0.5"
                          >
                            <TPCheckbox
                              checked={selVariantIds.has(v.variantId)}
                              onChange={() => toggleVariant(v)}
                              disabled={vDisabled}
                            />
                            <div className="w-6 h-6 rounded shrink-0 border border-border bg-surface2 overflow-hidden flex items-center justify-center">
                              {(v.imageUrl || node.mainImageUrl)
                                ? <img src={v.imageUrl || node.mainImageUrl} alt="" className="w-full h-full object-cover" />
                                : <Package size={9} className="text-muted opacity-40" />
                              }
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="text-xs font-medium text-text truncate">{v.name}</div>
                              <div className="flex items-center gap-1.5">
                                {v.sku && <span className="text-[10px] text-muted font-mono">{v.sku}</span>}
                                {v.inOtherGroup   && <span className="text-[10px] text-amber-600">{v.otherGroupName ?? "otro grupo"}</span>}
                                {v.alreadyInGroup && <span className="text-[10px] text-emerald-600">Ya en el grupo</span>}
                              </div>
                            </div>
                          </span>
                        </div>
                      );
                    })}
                  </div>
                );
              })}
            </div>
          )}

          {/* Footer: botón Agregar — solo visible cuando hay selección */}
          {selCount > 0 && (
            <div className="border-t border-primary/20 bg-primary/5 px-3 py-2 flex items-center justify-between">
              <span className="text-xs text-primary/80 font-medium">
                {selCount} {selCount === 1 ? "seleccionado" : "seleccionados"}
              </span>
              <TPButton variant="primary" className="h-8 text-sm" onClick={handleAdd} loading={saving}>
                {selectorLabel ? `Asignar ${selectorLabel} →` : `Agregar ${selCount}`}
              </TPButton>
            </div>
          )}
        </>
      )}
    </div>
  );

  return (
    <div ref={wrapRef} className="w-full">
      {/* Trigger: input de búsqueda */}
      <div className="relative">
        <TPInput
          inputRef={inputRef}
          value={query}
          onChange={v => { if (!open) openDropdown(); handleQueryChange(v); }}
          onFocus={openDropdown}
          onClick={openDropdown}
          placeholder="Buscar y agregar artículos…"
          className="pr-10"
          wrapClassName="!space-y-0"
        />
        {loading && open
          ? <div className="absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none">
              <Loader2 size={15} className="animate-spin text-muted" />
            </div>
          : <button
              type="button"
              tabIndex={-1}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted hover:text-text"
              onClick={open ? closeDropdown : openDropdown}
            >
              <ChevronDown size={16} className={cn("transition-transform duration-150", open && "rotate-180")} />
            </button>
        }
      </div>

      {/* Dropdown en portal */}
      {open && createPortal(dropdown, document.body)}
    </div>
  );
}
