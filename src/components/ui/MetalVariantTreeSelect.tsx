// src/components/ui/MetalVariantTreeSelect.tsx
// Selector jerárquico: muestra metales como grupos y sus variantes como opciones seleccionables.
import React, { useEffect, useMemo, useRef, useState } from "react";
import ReactDOM from "react-dom";
import { AlertTriangle, Check, ChevronDown, Search } from "lucide-react";
import { cn, TP_INPUT } from "./tp";

/* ─── Tipos públicos ────────────────────────────────────────────────────── */

export type MetalVariantSelectOption = {
  variantId: string;
  metalId: string;
  metalName: string;
  metalCode: string;
  variantName: string;
  sku: string;
};

type Props = {
  value: string;                              // variantId seleccionado
  onChange: (variantId: string) => void;
  options: MetalVariantSelectOption[];
  stockMap: Record<string, number>;           // variantId → gramos
  loadingStock?: boolean;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
};

/* ─── Tipos internos ────────────────────────────────────────────────────── */

type MetalRow = {
  kind: "metal";
  metalId: string;
  metalName: string;
  metalCode: string;
  totalGrams: number;
};

type VariantRow = {
  kind: "variant";
  variantId: string;
  variantName: string;
  sku: string;
  grams: number;
  metalId: string;
};

type FlatRow = MetalRow | VariantRow;

/* ─── Helpers ───────────────────────────────────────────────────────────── */

function fmtG(n: number): string {
  return Math.abs(n).toLocaleString("es-AR", {
    minimumFractionDigits: 3,
    maximumFractionDigits: 3,
  });
}

/* ─── Componente ────────────────────────────────────────────────────────── */

export default function MetalVariantTreeSelect({
  value,
  onChange,
  options,
  stockMap,
  loadingStock = false,
  placeholder = "Seleccionar variante\u2026",
  disabled = false,
  className,
}: Props) {
  const [open, setOpen]       = useState(false);
  const [search, setSearch]   = useState("");
  const [activeIdx, setActive] = useState(-1);
  const [dropStyle, setDropStyle] = useState<React.CSSProperties>({});

  const wrapRef    = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLInputElement>(null);
  const searchRef  = useRef<HTMLInputElement>(null);
  const itemRefs   = useRef<Array<HTMLButtonElement | null>>([]);

  /* ── Construir lista plana agrupada por metal ── */
  const allFlat = useMemo((): FlatRow[] => {
    const groups = new Map<string, { name: string; code: string; variants: MetalVariantSelectOption[] }>();
    for (const opt of options) {
      if (!groups.has(opt.metalId)) {
        groups.set(opt.metalId, { name: opt.metalName, code: opt.metalCode, variants: [] });
      }
      groups.get(opt.metalId)!.variants.push(opt);
    }
    const rows: FlatRow[] = [];
    for (const [metalId, g] of groups) {
      const totalGrams = g.variants.reduce((s, v) => s + (stockMap[v.variantId] ?? 0), 0);
      rows.push({ kind: "metal", metalId, metalName: g.name, metalCode: g.code, totalGrams });
      for (const v of g.variants) {
        rows.push({
          kind: "variant",
          variantId:   v.variantId,
          variantName: v.variantName,
          sku:         v.sku,
          grams:       stockMap[v.variantId] ?? 0,
          metalId,
        });
      }
    }
    return rows;
  }, [options, stockMap]);

  /* ── Filtrado por búsqueda ── */
  const filtered = useMemo((): FlatRow[] => {
    const q = search.trim().toLowerCase();
    if (!q) return allFlat;

    // Determinar qué metales y variantes coinciden
    const matchMetal   = new Set<string>();
    const matchVariant = new Set<string>();

    for (const row of allFlat) {
      if (row.kind === "metal" && row.metalName.toLowerCase().includes(q)) {
        matchMetal.add(row.metalId);
      }
      if (row.kind === "variant" &&
        (row.variantName.toLowerCase().includes(q) || row.sku.toLowerCase().includes(q))
      ) {
        matchVariant.add(row.variantId);
        matchMetal.add(row.metalId);   // mostrar el grupo padre
      }
    }

    // Si el metal coincide, incluir todas sus variantes
    for (const row of allFlat) {
      if (row.kind === "variant" && matchMetal.has(row.metalId)) {
        matchVariant.add(row.variantId);
      }
    }

    return allFlat.filter(row =>
      row.kind === "metal"
        ? matchMetal.has(row.metalId)
        : matchVariant.has(row.variantId)
    );
  }, [allFlat, search]);

  /* Índices navegables (solo variantes) */
  const selectableIdxs = useMemo(
    () => filtered.reduce<number[]>((a, row, i) => { if (row.kind === "variant") a.push(i); return a; }, []),
    [filtered]
  );

  /* Label del trigger */
  const selected = options.find(o => o.variantId === value);
  const triggerLabel = selected
    ? `${selected.metalName} \u2014 ${selected.variantName}`
    : "";

  /* ── Posicionamiento del dropdown ── */
  function calcPos(): React.CSSProperties {
    const rect = triggerRef.current?.getBoundingClientRect();
    if (!rect) return {};
    const maxH = 340;
    const below = window.innerHeight - rect.bottom - 8;
    const above = rect.top - 8;
    if (below >= maxH || below >= above) {
      return { position: "fixed", top: rect.bottom + 4, left: rect.left, width: rect.width, zIndex: 9999 };
    }
    return { position: "fixed", bottom: window.innerHeight - rect.top + 4, left: rect.left, width: rect.width, zIndex: 9999 };
  }

  /* ── Seleccionar variante ── */
  function pick(variantId: string) {
    onChange(variantId);
    setOpen(false);
    setSearch("");
    setTimeout(() => triggerRef.current?.focus(), 0);
  }

  /* ── Efectos ── */
  useEffect(() => {
    if (!open) { setActive(-1); setSearch(""); return; }
    setDropStyle(calcPos());
    const cur = filtered.findIndex(r => r.kind === "variant" && r.variantId === value);
    setActive(cur >= 0 ? cur : (selectableIdxs[0] ?? -1));
    setTimeout(() => searchRef.current?.focus(), 0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // Resetear activeIdx al filtrar
  useEffect(() => {
    if (!open) return;
    const cur = filtered.findIndex(r => r.kind === "variant" && r.variantId === value);
    setActive(cur >= 0 ? cur : (selectableIdxs[0] ?? -1));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);

  useEffect(() => {
    if (!open) return;
    const onScroll = () => setDropStyle(calcPos());
    window.addEventListener("scroll", onScroll, true);
    window.addEventListener("resize", onScroll);
    return () => {
      window.removeEventListener("scroll", onScroll, true);
      window.removeEventListener("resize", onScroll);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      const t = e.target as Node;
      const portal = document.getElementById("tp-metal-tree-portal");
      if (!wrapRef.current?.contains(t) && !portal?.contains(t)) {
        setOpen(false);
        setSearch("");
      }
    }
    document.addEventListener("mousedown", onDoc, true);
    return () => document.removeEventListener("mousedown", onDoc, true);
  }, []);

  /* ── Teclado ── */
  function onTriggerKey(e: React.KeyboardEvent) {
    if (disabled) return;
    if (["ArrowDown", "ArrowUp", "Enter"].includes(e.key)) { e.preventDefault(); setOpen(true); }
    if (e.key === "Escape" && open) { e.preventDefault(); setOpen(false); }
  }

  function onSearchKey(e: React.KeyboardEvent) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive(prev => {
        const pos  = selectableIdxs.indexOf(prev);
        const next = selectableIdxs[pos + 1] ?? selectableIdxs[0] ?? -1;
        if (next >= 0) itemRefs.current[next]?.scrollIntoView({ block: "nearest" });
        return next;
      });
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive(prev => {
        const pos  = selectableIdxs.indexOf(prev);
        const next = pos > 0
          ? selectableIdxs[pos - 1]
          : (selectableIdxs[selectableIdxs.length - 1] ?? -1);
        if (next >= 0) itemRefs.current[next]?.scrollIntoView({ block: "nearest" });
        return next;
      });
    } else if (e.key === "Enter") {
      e.preventDefault();
      const row = activeIdx >= 0 ? filtered[activeIdx] : undefined;
      if (row?.kind === "variant") pick(row.variantId);
    } else if (e.key === "Escape") {
      e.preventDefault();
      setOpen(false);
    }
  }

  /* ── Dropdown ── */
  const dropdown = open && !disabled && ReactDOM.createPortal(
    <div
      id="tp-metal-tree-portal"
      data-tp-portal
      style={dropStyle}
      className="rounded-2xl border border-border bg-card shadow-soft overflow-hidden"
      role="listbox"
    >
      {/* Búsqueda */}
      <div className="p-2 pb-1">
        <div className="relative">
          <Search size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
          <input
            ref={searchRef}
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            onKeyDown={onSearchKey}
            placeholder="Buscar metal o variante\u2026"
            className={cn(TP_INPUT, "w-full !pl-8 py-1.5 text-sm h-8")}
          />
        </div>
      </div>

      <div className="max-h-72 overflow-auto p-2 pt-1 space-y-0.5">
        {filtered.length === 0 ? (
          <p className="px-3 py-3 text-sm text-muted text-center">Sin resultados</p>
        ) : (
          filtered.map((row, idx) => {

            /* ── Fila de metal (grupo, no seleccionable) ── */
            if (row.kind === "metal") {
              return (
                <div
                  key={`m-${row.metalId}`}
                  className="flex items-center justify-between px-3 py-2 rounded-xl bg-surface2/40 border border-border/50 select-none mt-1 first:mt-0"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="text-xs font-bold text-text uppercase tracking-wide truncate">
                      {row.metalName}
                    </span>
                    {row.metalCode && (
                      <span className="shrink-0 text-[10px] font-mono text-muted bg-card border border-border px-1.5 py-0.5 rounded">
                        {row.metalCode}
                      </span>
                    )}
                  </div>
                  <span className="shrink-0 text-xs text-muted tabular-nums ml-3">
                    {loadingStock ? "\u2026" : `${fmtG(row.totalGrams)} g`}
                  </span>
                </div>
              );
            }

            /* ── Fila de variante (seleccionable) ── */
            const isSelected = row.variantId === value;
            const isActive   = idx === activeIdx;
            const { grams }  = row;
            const gramsClass =
              grams > 0  ? "text-green-600" :
              grams < 0  ? "text-red-600"   :
                           "text-muted";

            return (
              <button
                key={row.variantId}
                ref={el => { itemRefs.current[idx] = el; }}
                type="button"
                role="option"
                aria-selected={isSelected}
                onMouseEnter={() => setActive(idx)}
                onClick={() => pick(row.variantId)}
                tabIndex={-1}
                className={cn(
                  "w-full rounded-xl pl-6 pr-3 py-2 text-left text-sm flex items-center gap-2 transition-colors",
                  "hover:bg-primary/10 cursor-pointer",
                  isActive   && "bg-primary/10",
                  isSelected && "font-semibold"
                )}
              >
                {/* Nombre + SKU */}
                <div className="flex-1 min-w-0 flex flex-col gap-0.5">
                  <span className="text-text truncate leading-none">{row.variantName}</span>
                  {row.sku && (
                    <span className="text-[10px] font-mono text-muted leading-none">{row.sku}</span>
                  )}
                </div>

                {/* Gramos + check */}
                <div className="shrink-0 flex items-center gap-1.5">
                  {grams < 0 && <AlertTriangle size={11} className="text-red-500" />}
                  <span className={cn("text-xs tabular-nums font-medium", gramsClass)}>
                    {loadingStock ? "\u2026" : `${fmtG(grams)} g`}
                  </span>
                  <span className="w-[14px] flex items-center justify-center">
                    {isSelected && <Check size={13} className="text-primary" />}
                  </span>
                </div>
              </button>
            );
          })
        )}
      </div>
    </div>,
    document.body
  );

  return (
    <div
      ref={wrapRef}
      className={cn("relative w-full", disabled && "opacity-[0.65] pointer-events-none", className)}
    >
      <input
        ref={triggerRef}
        readOnly
        disabled={disabled}
        value={triggerLabel}
        placeholder={placeholder}
        onClick={() => !disabled && setOpen(v => !v)}
        onKeyDown={onTriggerKey}
        className={cn(TP_INPUT, "w-full cursor-pointer pr-9", disabled && "!opacity-100")}
        aria-haspopup="listbox"
        aria-expanded={open}
      />
      <ChevronDown
        size={16}
        className={cn(
          "pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-muted transition-transform",
          open && "rotate-180"
        )}
      />
      {dropdown}
    </div>
  );
}
