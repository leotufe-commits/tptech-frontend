// src/components/ui/TPArticleScopeSelect.tsx
// Combo jerárquico con checkboxes para seleccionar artículos y/o variantes.
// Artículos sin variantes → ScopeItem { kind:"ARTICLE" }
// Artículos con variantes → seleccionar variantes individualmente → ScopeItem { kind:"VARIANT" }
// Seleccionar el padre con variantes marca todas sus variantes en el output.
import React, { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ChevronDown, ChevronRight, Loader2, Package, X } from "lucide-react";
import { cn } from "./tp";
import { TPCheckbox } from "./TPCheckbox";
import { selectableRowProps } from "./selectableRow";
import { articlesApi } from "../../services/articles";
import type {
  ArticleScopeTreeNode,
  ArticleScopeTreeVariant,
  ScopeItem,
  ArticleType,
} from "../../services/articles";

interface Props {
  value: ScopeItem[];
  onChange: (items: ScopeItem[]) => void;
  multiple?: boolean;
  articleTypes?: ArticleType[];
  includeVariants?: boolean;
  placeholder?: string;
  disabled?: boolean;
}

const ARTICLE_TYPE_LABEL: Record<ArticleType, string> = {
  PRODUCT:  "Artículo",
  SERVICE:  "Servicio",
  MATERIAL: "Material",
};

const ARTICLE_TYPE_TONE: Record<ArticleType, string> = {
  PRODUCT:  "border-border bg-surface2/60 text-muted",
  SERVICE:  "border-emerald-500/40 bg-emerald-500/10 text-emerald-500",
  MATERIAL: "border-amber-500/40 bg-amber-500/10 text-amber-500",
};

function ArticleTypeChip({ articleType }: { articleType?: ArticleType }) {
  if (!articleType) return null;
  return (
    <span
      className={cn(
        "rounded-full border px-1.5 py-0 text-[9px] uppercase tracking-wide",
        ARTICLE_TYPE_TONE[articleType],
      )}
    >
      {ARTICLE_TYPE_LABEL[articleType]}
    </span>
  );
}

export function TPArticleScopeSelect({
  value,
  onChange,
  multiple = true,
  articleTypes,
  includeVariants = true,
  placeholder = "Buscar artículos…",
  disabled = false,
}: Props) {
  const wrapRef     = useRef<HTMLDivElement>(null);
  const inputRef    = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const [open,      setOpen]      = useState(false);
  const [dropStyle, setDropStyle] = useState<React.CSSProperties>({});
  const [query,     setQuery]     = useState("");
  const [nodes,     setNodes]     = useState<ArticleScopeTreeNode[]>([]);
  const [loading,   setLoading]   = useState(false);
  const [expanded,  setExpanded]  = useState<Set<string>>(new Set());

  const genRef             = useRef(0);
  const timer              = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hasInitiallyLoaded = useRef(false);

  // ── Posicionamiento ──────────────────────────────────────────────────────
  // Apertura forzada SIEMPRE hacia abajo (sin auto-flip). Si no entra en
  // pantalla, el dropdown mantiene su scroll interno (`max-h-72` + overflow
  // dentro del render). Más predecible para el usuario.
  function calcDropStyle(): React.CSSProperties {
    const rect = wrapRef.current?.getBoundingClientRect();
    if (!rect) return {};
    const w = Math.max(rect.width, 380);
    return { top: rect.bottom + 4, left: rect.left, width: w };
  }

  // ── Cierre al hacer clic fuera ──────────────────────────────────────────
  useEffect(() => {
    function onDoc(e: MouseEvent) {
      const t = e.target as Node;
      if (!wrapRef.current?.contains(t) && !dropdownRef.current?.contains(t))
        closeDropdown();
    }
    document.addEventListener("mousedown", onDoc, true);
    return () => document.removeEventListener("mousedown", onDoc, true);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Reposicionar en scroll/resize ────────────────────────────────────────
  useEffect(() => {
    if (!open) return;
    function update() { setDropStyle(calcDropStyle()); }
    window.addEventListener("scroll", update, true);
    window.addEventListener("resize", update);
    return () => { window.removeEventListener("scroll", update, true); window.removeEventListener("resize", update); };
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Búsqueda ─────────────────────────────────────────────────────────────
  async function doSearch(val: string) {
    genRef.current++;
    const gen = genRef.current;
    setLoading(true);
    try {
      const res = await articlesApi.tree({
        q:               val,
        articleTypes:    articleTypes,
        includeVariants: includeVariants,
      });
      if (gen !== genRef.current) return;
      setNodes(res);
      // Expandir todos por defecto cuando hay pocos resultados o hay query
      if (res.length <= 10 || val.trim()) {
        setExpanded(new Set(res.map(n => n.articleId)));
      }
    } catch {
      if (gen !== genRef.current) return;
      setNodes([]);
    } finally {
      if (gen === genRef.current) setLoading(false);
    }
  }

  function openDropdown() {
    if (disabled) return;
    setDropStyle(calcDropStyle());
    setOpen(true);
    if (!hasInitiallyLoaded.current) {
      hasInitiallyLoaded.current = true;
      void doSearch("");
    }
  }

  function closeDropdown() {
    setOpen(false);
    setQuery("");
  }

  function handleQueryChange(val: string) {
    setQuery(val);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => void doSearch(val), 300);
  }

  // ── Helpers de selección ─────────────────────────────────────────────────
  const selectedIds = new Set(value.map(i => i.id));

  function articleCheckState(node: ArticleScopeTreeNode): "checked" | "indeterminate" | "unchecked" {
    if (!node.hasVariants)
      return selectedIds.has(node.articleId) ? "checked" : "unchecked";
    const n = node.variants.filter(v => selectedIds.has(v.variantId)).length;
    if (n === 0) return "unchecked";
    return n === node.variants.length ? "checked" : "indeterminate";
  }

  function articleScopeOf(node: ArticleScopeTreeNode): ScopeItem {
    return {
      kind:        "ARTICLE",
      id:          node.articleId,
      name:        node.name,
      code:        node.code,
      imageUrl:    node.mainImageUrl,
      articleId:   node.articleId,
      articleName: node.name,
      articleType: node.articleType,
    };
  }

  function variantScopeOf(node: ArticleScopeTreeNode, v: ArticleScopeTreeVariant): ScopeItem {
    return {
      kind:        "VARIANT",
      id:          v.variantId,
      name:        `${node.name} — ${v.name}`,
      code:        v.code,
      imageUrl:    v.imageUrl || node.mainImageUrl,
      articleId:   node.articleId,
      articleName: node.name,
      articleType: node.articleType,
    };
  }

  function toggleArticle(node: ArticleScopeTreeNode) {
    if (!node.hasVariants) {
      // Artículo simple → togglear como ARTICLE
      if (!multiple) {
        onChange(selectedIds.has(node.articleId) ? [] : [articleScopeOf(node)]);
        closeDropdown();
        return;
      }
      if (selectedIds.has(node.articleId)) {
        onChange(value.filter(i => i.id !== node.articleId));
      } else {
        onChange([...value, articleScopeOf(node)]);
      }
      return;
    }

    // Artículo con variantes → seleccionar/deseleccionar todas sus variantes
    const allSel = node.variants.every(v => selectedIds.has(v.variantId));
    if (allSel) {
      // Deseleccionar todas las variantes de este artículo
      const varIds = new Set(node.variants.map(v => v.variantId));
      onChange(value.filter(i => !varIds.has(i.id)));
    } else {
      // Seleccionar todas las variantes
      const varIds = new Set(node.variants.map(v => v.variantId));
      const existing = value.filter(i => !varIds.has(i.id));
      const toAdd: ScopeItem[] = node.variants.map(v => variantScopeOf(node, v));
      if (!multiple) {
        // Single mode: solo una variante → la primera
        onChange(toAdd.slice(0, 1));
        closeDropdown();
        return;
      }
      onChange([...existing, ...toAdd]);
    }
  }

  function toggleVariant(node: ArticleScopeTreeNode, v: ArticleScopeTreeVariant) {
    if (!multiple) {
      onChange(selectedIds.has(v.variantId) ? [] : [variantScopeOf(node, v)]);
      closeDropdown();
      return;
    }
    if (selectedIds.has(v.variantId)) {
      onChange(value.filter(i => i.id !== v.variantId));
    } else {
      onChange([...value, variantScopeOf(node, v)]);
    }
  }

  function removeChip(id: string) {
    onChange(value.filter(i => i.id !== id));
  }

  // ── Dropdown ─────────────────────────────────────────────────────────────
  const dropdown = (
    <div
      ref={dropdownRef}
      data-tp-portal
      style={{ ...dropStyle, position: "fixed", zIndex: 9999 }}
      className="rounded-2xl border border-border bg-card shadow-soft overflow-hidden"
      onMouseDown={e => e.preventDefault()}
    >
      {/* Search input — usa el mismo estilo que el resto de los TPInputs
          del sistema (clase `tp-input` definida en index.css). Eso evita el
          fondo blanco del autofill y respeta el dark theme. */}
      <div className="px-2 pt-2 pb-1 border-b border-border/40">
        <input
          autoFocus
          type="text"
          value={query}
          onChange={e => handleQueryChange(e.target.value)}
          placeholder="Buscar por nombre, código…"
          autoComplete="off"
          spellCheck={false}
          className="tp-input"
          style={{ height: 36, fontSize: "0.875rem" }}
        />
      </div>

      {loading ? (
        <div className="flex items-center gap-2 px-3 py-5 text-sm text-muted">
          <Loader2 size={13} className="animate-spin shrink-0" /> Buscando…
        </div>
      ) : nodes.length === 0 ? (
        <div className="px-3 py-5 text-sm text-muted text-center">
          {query.trim() ? "Sin resultados para esa búsqueda." : "No hay artículos disponibles."}
        </div>
      ) : (
        <div className="max-h-72 overflow-y-auto divide-y divide-border/30">
          {nodes.map(node => {
            const checkState = articleCheckState(node);
            const isExpanded = expanded.has(node.articleId);

            return (
              <div key={node.articleId}>
                {/* Fila de artículo */}
                <div className="flex items-center gap-1 px-2 py-1.5 hover:bg-surface2/40 transition-colors">
                  {node.hasVariants ? (
                    <button
                      type="button"
                      tabIndex={-1}
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
                    {...selectableRowProps({ onToggle: () => toggleArticle(node), disabled: false })}
                    className="flex items-center gap-2 flex-1 min-w-0 cursor-pointer py-0.5"
                  >
                    <TPCheckbox
                      checked={checkState === "checked"}
                      indeterminate={checkState === "indeterminate"}
                      onChange={() => toggleArticle(node)}
                    />
                    <div className="w-7 h-7 rounded shrink-0 border border-border bg-surface2 overflow-hidden flex items-center justify-center">
                      {node.mainImageUrl
                        ? <img src={node.mainImageUrl} alt="" className="w-full h-full object-cover" />
                        : <Package size={11} className="text-muted opacity-40" />
                      }
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="text-sm font-medium text-text truncate">{node.name}</span>
                        <ArticleTypeChip articleType={node.articleType} />
                      </div>
                      <div className="text-[10px] text-muted">
                        {node.code}
                        {node.hasVariants && ` · ${node.variants.length} variante${node.variants.length !== 1 ? "s" : ""}`}
                      </div>
                    </div>
                  </span>
                </div>

                {/* Variantes (cuando expandido) */}
                {node.hasVariants && isExpanded && node.variants.map(v => (
                  <div
                    key={v.variantId}
                    className="flex items-center gap-1 pl-9 pr-2 py-1.5 hover:bg-surface2/40 transition-colors border-t border-border/20"
                  >
                    <div className="shrink-0 w-5" />
                    <span
                      {...selectableRowProps({ onToggle: () => toggleVariant(node, v), disabled: false })}
                      className="flex items-center gap-2 flex-1 min-w-0 cursor-pointer py-0.5"
                    >
                      <TPCheckbox
                        checked={selectedIds.has(v.variantId)}
                        onChange={() => toggleVariant(node, v)}
                      />
                      <div className="w-6 h-6 rounded shrink-0 border border-border bg-surface2 overflow-hidden flex items-center justify-center">
                        {(v.imageUrl || node.mainImageUrl)
                          ? <img src={v.imageUrl || node.mainImageUrl!} alt="" className="w-full h-full object-cover" />
                          : <Package size={9} className="text-muted opacity-40" />
                        }
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs font-medium text-text truncate">{v.name}</span>
                          <span className="rounded-full border border-border bg-surface2/60 px-1.5 py-0 text-[9px] uppercase tracking-wide text-muted">
                            Variante
                          </span>
                        </div>
                        {v.sku && <div className="text-[10px] font-mono text-muted">{v.sku}</div>}
                      </div>
                    </span>
                  </div>
                ))}
              </div>
            );
          })}
        </div>
      )}

      {/* Footer */}
      {value.length > 0 && (
        <div className="border-t border-border/50 px-3 py-1.5 flex items-center justify-between">
          <span className="text-xs text-muted">
            {value.length} {value.length === 1 ? "seleccionado" : "seleccionados"}
          </span>
          <button
            type="button"
            onClick={closeDropdown}
            className="text-xs text-primary hover:text-primary/80 font-medium"
          >
            Listo
          </button>
        </div>
      )}
    </div>
  );

  // ── Render principal ─────────────────────────────────────────────────────
  return (
    <div ref={wrapRef} className={cn("w-full", disabled && "opacity-50 pointer-events-none")}>
      {/* Trigger: chips + botón abrir */}
      <div
        className={cn(
          "min-h-[42px] rounded-2xl border border-border bg-surface px-3 py-1.5 flex flex-wrap items-center gap-1.5 cursor-text transition-colors",
          open ? "border-primary/50 ring-1 ring-primary/20" : "hover:border-border/80",
        )}
        onClick={openDropdown}
      >
        {value.length === 0 ? (
          <span className="text-sm text-muted flex-1">{placeholder}</span>
        ) : (
          <>
            {value.map(item => (
              <span
                key={item.id}
                className="inline-flex items-center gap-1 rounded-full bg-primary/10 text-primary text-xs px-2 py-0.5 max-w-[200px]"
                onClick={e => e.stopPropagation()}
              >
                <span className="truncate">{item.name}</span>
                <button
                  type="button"
                  onClick={() => removeChip(item.id)}
                  className="shrink-0 text-primary/60 hover:text-primary transition-colors ml-0.5"
                >
                  <X size={11} />
                </button>
              </span>
            ))}
          </>
        )}
        <div className="ml-auto shrink-0">
          {loading && open
            ? <Loader2 size={14} className="animate-spin text-muted" />
            : <ChevronDown size={14} className={cn("text-muted transition-transform duration-150", open && "rotate-180")} />
          }
        </div>
      </div>

      {/* Dropdown en portal */}
      {open && createPortal(dropdown, document.body)}
    </div>
  );
}
