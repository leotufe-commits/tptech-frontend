// src/components/ui/TPArticleVariantSearchSelect.tsx
// ============================================================================
// TPArticleVariantSearchSelect — selector de artículo + variante para
// comprobantes.
//
// Complementa al `ArticleVariantSearchSelect` existente (conectado a
// backend) con una versión 100% local pensada para el rediseño de líneas de
// comprobante. Mock data interna; Fase 7 la reemplaza inyectando `options`
// con datos reales.
//
// Características:
//   · Búsqueda por código (SKU) o nombre del artículo.
//   · Dropdown absoluto con: nombre · variante · SKU · stock disponible.
//   · Navegación con teclado (ArrowUp/ArrowDown, Enter, Escape).
//   · Bajo el input — al estar seleccionado — muestra stock por almacén y
//     precio base como contexto rápido.
//
// Devuelve el objeto completo del artículo (`id`, `article`, `variant`,
// `price?`, `stock?`, `code`, `stockByWarehouse?`) al `onChange`.
// ============================================================================

import React, { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Search, X as XIcon, Package, ChevronDown } from "lucide-react";

import { cn } from "./tp";
import { fmtMoney, fmtQty } from "../../lib/document-helpers";

export type TPArticleStockByWarehouse = {
  warehouse: string;
  qty: number;
};

export type TPArticleLite = {
  id: string;
  /** Id de la variante (si el artículo tiene variantes). El `id` apunta al artículo padre. */
  variantId?: string;
  /** Código de artículo. */
  code: string;
  /** SKU específico (de la variante o del artículo). */
  sku?: string;
  /** Barcode (opcional). */
  barcode?: string;
  /** Tipo semántico del ítem (ARTICLE_SIMPLE / ARTICLE_VARIANT / SERVICE / COMBO). */
  itemKind?: "ARTICLE_SIMPLE" | "ARTICLE_VARIANT" | "SERVICE" | "COMBO";
  /** articleType crudo del backend — útil para reglas comerciales. */
  articleType?: "PRODUCT" | "SERVICE" | "MATERIAL";
  /** ¿La línea debe administrar stock? false para servicios, opcional para combos. */
  manageStock?: boolean;
  /** Unidad de medida (ej. "u", "kg", "g", "m"). Para derivar step. */
  unitOfMeasure?: string;
  /** Constraints de cantidad — overrides de variant ganan al artículo. */
  minQty?: number;
  maxQty?: number;
  defaultQty?: number;
  /** Step (paso) de cantidad — derivado de unitOfMeasure si no se pasa. */
  quantityStep?: number;
  article: string;
  variant?: string;
  /** Descripción base (opcional). */
  description?: string;
  /** Precio base (lista por defecto). */
  price?: number;
  currency?: string;
  /** Stock total disponible — sumatoria de almacenes. */
  stock?: number;
  /** Detalle por almacén (para mostrar bajo el input al seleccionar). */
  stockByWarehouse?: TPArticleStockByWarehouse[];
  /** URL de thumbnail (opcional). */
  imageUrl?: string;
  /** Galería completa para el lightbox. Si vacía, se usa imageUrl como única. */
  images?: string[];
  /** Metadatos para cabeceras automáticas (categoría / marca / grupo /
   *  fabricante). Snapshot liviano del catálogo al momento de cargar la
   *  línea — permite generar cabeceras sin runtime fetch. */
  categoryName?: string;
  groupName?:    string;
  brand?:        string;
  manufacturer?: string;
};

export const MOCK_ARTICLES: TPArticleLite[] = [
  {
    id: "a1", code: "ANI-001", article: "Anillo de oro 18k", variant: "Talle 10",
    price: 185_000, currency: "ARS", stock: 3,
    stockByWarehouse: [{ warehouse: "Central", qty: 2 }, { warehouse: "Local Palermo", qty: 1 }],
    imageUrl: "https://picsum.photos/seed/ani-001/80/80",
    images: [
      "https://picsum.photos/seed/ani-001/900/900",
      "https://picsum.photos/seed/ani-001b/900/900",
      "https://picsum.photos/seed/ani-001c/900/900",
    ],
  },
  {
    id: "a2", code: "ANI-002", article: "Anillo de oro 18k", variant: "Talle 12",
    price: 190_000, currency: "ARS", stock: 1,
    stockByWarehouse: [{ warehouse: "Central", qty: 1 }, { warehouse: "Local Palermo", qty: 0 }],
    imageUrl: "https://picsum.photos/seed/ani-002/80/80",
  },
  {
    id: "a3", code: "COL-101", article: "Collar de plata 925", variant: "45 cm",
    price:  62_000, currency: "ARS", stock: 8,
    stockByWarehouse: [{ warehouse: "Central", qty: 5 }, { warehouse: "Local Palermo", qty: 3 }],
    imageUrl: "https://picsum.photos/seed/col-101/80/80",
    images: [
      "https://picsum.photos/seed/col-101/900/900",
      "https://picsum.photos/seed/col-101b/900/900",
    ],
  },
  {
    id: "a4", code: "COL-102", article: "Collar de plata 925", variant: "50 cm",
    price:  70_000, currency: "ARS", stock: 4,
    stockByWarehouse: [{ warehouse: "Central", qty: 4 }],
    imageUrl: "https://picsum.photos/seed/col-102/80/80",
  },
  {
    id: "a5", code: "PUL-201", article: "Pulsera con piedras", variant: "Amatista",
    price: 145_000, currency: "ARS", stock: 0,
    stockByWarehouse: [{ warehouse: "Central", qty: 0 }, { warehouse: "Local Palermo", qty: 0 }],
    imageUrl: "https://picsum.photos/seed/pul-201/80/80",
  },
  {
    id: "a6", code: "ARO-301", article: "Aros pequeños oro 14k",
    price:  52_000, currency: "ARS", stock: 12,
    stockByWarehouse: [{ warehouse: "Central", qty: 7 }, { warehouse: "Local Palermo", qty: 5 }],
    imageUrl: "https://picsum.photos/seed/aro-301/80/80",
  },
];

export type TPArticleSelection = Pick<TPArticleLite, "id" | "article"> & {
  variant?: string;
  /** SKU/código del seleccionado — para mostrar en el trigger sin re-fetch. */
  sku?: string;
  /** Thumbnail del seleccionado — para mostrar en el trigger sin re-fetch. */
  imageUrl?: string;
};

export type TPArticleVariantSearchSelectProps = {
  value?: TPArticleSelection | null;
  onChange: (item: TPArticleLite | null) => void;
  placeholder?: string;
  /** Override del mock interno — Fase 7 inyecta la lista real. */
  options?: TPArticleLite[];
  /**
   * Si se pasa, el combo deja de filtrar localmente y delega al callback
   * remoto (con debounce). Pensado para conectar al backend (search por
   * nombre / SKU / código / barcode). Cada query devuelve la lista a mostrar.
   */
  remoteSearch?: (query: string) => Promise<TPArticleLite[]>;
  disabled?: boolean;
  className?: string;
  /**
   * Si es true, el input vuelve a enfocarse y queda listo para el siguiente
   * escaneo después de seleccionar (modo escaneo continuo).
   */
  autoFocusOnSelect?: boolean;
  /**
   * Cada cambio de número fuerza un foco al input. Útil para enfocar al
   * togglear visibilidad (incrementar el signal) sin robar el foco inicial.
   */
  focusSignal?: number;
  /**
   * Modo escaneo: Enter solo confirma resultados con MATCH EXACTO por
   * sku / code / barcode. Si la query no calza exacto con ningún resultado
   * de la lista filtrada, NO se selecciona el primer parcial — se invoca
   * `onNoExactMatch` (típicamente un toast) para que el usuario sepa que
   * el código no se encontró. Con múltiples coincidencias exactas (caso raro)
   * se invoca `onMultipleExactMatches` para que el caller decida.
   *
   * Default: false (modo manual — Enter confirma el highlight, comportamiento
   * tradicional para búsqueda con teclado y mouse).
   */
  scanMode?: boolean;
  /** Callback cuando scanMode=true y la query no calza exacto con ningún resultado. */
  onNoExactMatch?: (query: string) => void;
  /** Callback cuando scanMode=true y la query calza con múltiples ítems. */
  onMultipleExactMatches?: (query: string, matches: TPArticleLite[]) => void;
  /**
   * Lookup exacto en el backend (scanMode). Se invoca cuando los resultados
   * parciales actuales NO contienen un match exacto por sku/code/barcode.
   * Permite que el caller pegue contra un endpoint dedicado (ej.
   * `articlesApi.list({ barcode })`) y resuelva ítems que no aparecen en la
   * búsqueda parcial por relevancia/paginación. Debe devolver candidatos —
   * el componente se encarga de filtrar a los matches exactos.
   */
  exactLookup?: (query: string) => Promise<TPArticleLite[]>;
  /**
   * Si se provee, el combo permite "crear línea manual": cuando el usuario
   * escribe texto y presiona Enter (o sale por blur) sin haber elegido
   * ningún resultado, se invoca este callback con el texto ingresado para
   * que el parent convierta la línea en `isManual: true`. No se invoca en
   * `scanMode`, ni cuando hay un resultado highlighted que se pueda
   * seleccionar normalmente.
   */
  onCreateManual?: (text: string) => void;
};

function buildLabel(a: TPArticleLite): string {
  return a.variant ? `${a.article} · ${a.variant}` : a.article;
}

const ITEM_KIND_LABEL: Record<NonNullable<TPArticleLite["itemKind"]>, string> = {
  ARTICLE_SIMPLE:  "Artículo",
  ARTICLE_VARIANT: "Variante",
  SERVICE:         "Servicio",
  COMBO:           "Combo",
};

const ITEM_KIND_TONE: Record<NonNullable<TPArticleLite["itemKind"]>, string> = {
  ARTICLE_SIMPLE:  "border-border bg-surface2/60 text-muted",
  ARTICLE_VARIANT: "border-border bg-surface2/60 text-muted",
  SERVICE:         "border-emerald-500/40 bg-emerald-500/10 text-emerald-500",
  COMBO:           "border-violet-500/40 bg-violet-500/10 text-violet-400",
};

function ItemKindChip({ kind }: { kind?: TPArticleLite["itemKind"] }) {
  if (!kind) return null;
  return (
    <span
      className={cn(
        "shrink-0 rounded-full border px-1.5 py-0 text-[9px] uppercase tracking-wide",
        ITEM_KIND_TONE[kind],
      )}
    >
      {ITEM_KIND_LABEL[kind]}
    </span>
  );
}

function stockTone(stock: number | undefined | null): string {
  // null/undefined cuentan como 0 (sin información ≡ 0).
  const n = typeof stock === "number" ? stock : 0;
  if (n <= 0) return "text-red-500 dark:text-red-400";
  return "text-emerald-500 dark:text-emerald-400";
}

function stockLabel(stock: number | undefined | null): string {
  const n = typeof stock === "number" ? stock : 0;
  if (n <= 0) return "Stock: 0";
  return `Stock: ${fmtQty(n)} u`;
}

/** Mini-componente: thumbnail con fallback a icono Package. */
function ArticleThumb({ src, size = 36 }: { src?: string; size?: number }) {
  const dim = { width: size, height: size };
  if (src) {
    return (
      <img
        src={src}
        alt=""
        loading="lazy"
        style={dim}
        className="shrink-0 rounded-md border border-border object-cover"
        onError={(e) => {
          (e.currentTarget as HTMLImageElement).style.display = "none";
        }}
      />
    );
  }
  return (
    <div
      style={dim}
      className="flex shrink-0 items-center justify-center rounded-md border border-border bg-surface2/60"
    >
      <Package size={Math.round(size * 0.5)} className="text-muted/70" />
    </div>
  );
}

export function TPArticleVariantSearchSelect({
  value,
  onChange,
  placeholder = "Buscar artículo por nombre o código…",
  options,
  remoteSearch,
  disabled = false,
  className,
  autoFocusOnSelect = false,
  focusSignal,
  scanMode = false,
  onNoExactMatch,
  onMultipleExactMatches,
  exactLookup,
  onCreateManual,
}: TPArticleVariantSearchSelectProps) {
  const data = options ?? MOCK_ARTICLES;

  const [query, setQuery]               = useState("");
  const [isOpen, setIsOpen]             = useState(false);
  const [highlight, setHighlight]       = useState(0);
  const [remoteResults, setRemoteResults] = useState<TPArticleLite[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const remoteSearchReqRef = useRef(0);
  const containerRef              = useRef<HTMLDivElement>(null);
  const panelRef                  = useRef<HTMLDivElement>(null);
  const inputRef                  = useRef<HTMLInputElement>(null);

  // Posicionamiento del dropdown (renderizado vía portal, position: fixed).
  // Se recalcula al abrir, en scroll/resize, para seguir al combo.
  const [panelPos, setPanelPos] = useState<{
    top: number;
    left: number;
    width: number;
    placeAbove: boolean;
  } | null>(null);

  useEffect(() => {
    if (!isOpen) { setPanelPos(null); return; }
    function update() {
      const el = containerRef.current;
      if (!el) return;
      const r = el.getBoundingClientRect();
      // Si no hay espacio debajo (max-h-80 = 320px + 4 margen) → flip arriba.
      const below = window.innerHeight - r.bottom;
      const above = r.top;
      const placeAbove = below < 280 && above > below;
      setPanelPos({
        top: placeAbove ? r.top : r.bottom,
        left: r.left,
        width: r.width,
        placeAbove,
      });
    }
    update();
    window.addEventListener("scroll", update, true);
    window.addEventListener("resize", update);
    return () => {
      window.removeEventListener("scroll", update, true);
      window.removeEventListener("resize", update);
    };
  }, [isOpen]);

  // Cierre por click/touch fuera (combo + panel del portal).
  // IMPORTANTE: usamos `pointerdown` en fase de CAPTURA porque algunos
  // ancestros (ej. Modal arrastrable) hacen `stopPropagation` en mousedown,
  // lo que impedía que un listener en bubbling se enterara del click.
  useEffect(() => {
    function onPointerDown(e: PointerEvent) {
      const target = e.target as Node;
      if (containerRef.current?.contains(target)) return;
      if (panelRef.current?.contains(target)) return;
      setIsOpen(false);
    }
    document.addEventListener("pointerdown", onPointerDown, true);
    return () => document.removeEventListener("pointerdown", onPointerDown, true);
  }, []);

  // Cierre cuando el foco pasa a un elemento fuera del combo (Tab, click en
  // otro input, etc.). `focusin` se dispara al ENTRAR foco al nuevo target,
  // así sabemos si se fue afuera.
  useEffect(() => {
    if (!isOpen) return;
    function onFocusIn(e: FocusEvent) {
      const target = e.target as Node | null;
      if (!target) return;
      if (containerRef.current?.contains(target)) return;
      if (panelRef.current?.contains(target)) return;
      setIsOpen(false);
    }
    document.addEventListener("focusin", onFocusIn, true);
    return () => document.removeEventListener("focusin", onFocusIn, true);
  }, [isOpen]);

  // Cierre con Escape — listener global mientras está abierto, en captura
  // para anteceder a otros handlers (ej. cierre del Modal con Esc).
  useEffect(() => {
    if (!isOpen) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.stopPropagation();
        setIsOpen(false);
      }
    }
    document.addEventListener("keydown", onKey, true);
    return () => document.removeEventListener("keydown", onKey, true);
  }, [isOpen]);

  // Filtro local: SOLO cuando NO hay remoteSearch (caso mocks/options).
  const localFiltered = useMemo(() => {
    if (remoteSearch) return [];
    const term = query.trim().toLowerCase();
    if (!term) return data;
    return data.filter((a) =>
      [a.article, a.variant ?? "", a.code, a.sku ?? "", a.barcode ?? ""]
        .some((v) => String(v).toLowerCase().includes(term))
    );
  }, [data, query, remoteSearch]);

  const filtered = remoteSearch ? remoteResults : localFiltered;

  // Búsqueda remota con debounce. Se dispara mientras el dropdown está abierto.
  useEffect(() => {
    if (!remoteSearch) return;
    if (!isOpen) return;
    const reqId = ++remoteSearchReqRef.current;
    setSearchLoading(true);
    const handle = window.setTimeout(() => {
      remoteSearch(query.trim())
        .then((rows) => {
          if (remoteSearchReqRef.current !== reqId) return;
          setRemoteResults(rows);
        })
        .catch(() => {
          if (remoteSearchReqRef.current !== reqId) return;
          setRemoteResults([]);
        })
        .finally(() => {
          if (remoteSearchReqRef.current === reqId) setSearchLoading(false);
        });
    }, 200);
    return () => window.clearTimeout(handle);
  }, [remoteSearch, query, isOpen]);

  useEffect(() => { setHighlight(0); }, [query, isOpen]);

  // Foco bajo demanda — cada cambio de focusSignal mueve foco al input.
  useEffect(() => {
    if (focusSignal === undefined) return;
    inputRef.current?.focus();
  }, [focusSignal]);

  function commitSelection(a: TPArticleLite) {
    onChange(a);
    setQuery("");
    setIsOpen(false);
    if (autoFocusOnSelect) {
      // Modo escaneo: mantenemos el input listo para el próximo código.
      inputRef.current?.focus();
    } else {
      inputRef.current?.blur();
    }
  }

  function clearSelection() {
    onChange(null);
    setQuery("");
    inputRef.current?.focus();
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    // [DEBUG TEMP] Diagnóstico Bug 1 — log al INICIO del handler para
    // confirmar que el evento llega y bajo qué condiciones.
    console.debug("[article-keydown]", {
      key: e.key,
      isOpen,
      scanMode: !!scanMode,
      query,
      hasValue: !!value,
      filteredCount: filtered.length,
    });
    if (!isOpen) {
      // Solo ArrowDown abre el menú; Enter no abre (lo deja para Modal.onEnter).
      if (e.key === "ArrowDown") {
        setIsOpen(true);
        e.preventDefault();
      }
      return;
    }
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlight((h) => Math.min(filtered.length - 1, h + 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlight((h) => Math.max(0, h - 1));
    } else if (e.key === "Enter") {
      // [DEBUG TEMP] Bug 1 — qué rama del Enter entra.
      console.debug("[article-enter:branch]", { scanMode: !!scanMode });
      // Modo SCAN: Enter solo confirma matches EXACTOS. Si el código
      // ingresado/escaneado no calza exacto con ningún resultado, NO
      // seleccionamos un parcial al azar — invocamos onNoExactMatch.
      if (scanMode) {
        const norm = (s: string | undefined | null) =>
          (s ?? "").trim().toUpperCase().replace(/\s+/g, "");
        const q = norm(query);
        if (q.length === 0) return;
        const queryRaw = query;
        const isExact = (it: TPArticleLite) => {
          if (norm(it.sku) === q)     return true;
          if (norm(it.code) === q)    return true;
          if (it.barcode && norm(it.barcode) === q) return true;
          return false;
        };
        const exactMatches = filtered.filter(isExact);
        e.preventDefault();
        e.stopPropagation();
        if (exactMatches.length === 1) {
          commitSelection(exactMatches[0]);
          return;
        }
        if (exactMatches.length > 1) {
          // Caso raro: múltiples ítems con el mismo código exacto.
          onMultipleExactMatches?.(queryRaw, exactMatches);
          return;
        }
        // Sin match en la lista parcial → si el caller proveyó un
        // `exactLookup` (típicamente contra un endpoint exact-match del
        // backend), lo intentamos antes de declarar "no encontrado".
        // Esto cubre el caso de códigos que existen pero no aparecen en
        // los primeros N resultados del search por relevancia.
        if (exactLookup) {
          const reqId = ++remoteSearchReqRef.current;
          setSearchLoading(true);
          exactLookup(queryRaw)
            .then((rows) => {
              if (remoteSearchReqRef.current !== reqId) return;
              const remoteExact = (rows ?? []).filter(isExact);
              if (remoteExact.length === 1) {
                commitSelection(remoteExact[0]);
              } else if (remoteExact.length > 1) {
                onMultipleExactMatches?.(queryRaw, remoteExact);
              } else if (onCreateManual) {
                // Sin match remoto, pero el caller acepta líneas manuales:
                // creamos una en lugar de mostrar "no encontrado".
                setIsOpen(false);
                setQuery("");
                onCreateManual(queryRaw);
              } else {
                onNoExactMatch?.(queryRaw);
              }
            })
            .catch(() => {
              if (remoteSearchReqRef.current !== reqId) return;
              if (onCreateManual) {
                setIsOpen(false);
                setQuery("");
                onCreateManual(queryRaw);
              } else {
                onNoExactMatch?.(queryRaw);
              }
            })
            .finally(() => {
              if (remoteSearchReqRef.current === reqId) setSearchLoading(false);
            });
          return;
        }
        // Sin exactLookup remoto: si hay `onCreateManual`, creamos línea manual.
        if (onCreateManual) {
          setIsOpen(false);
          setQuery("");
          onCreateManual(queryRaw);
          return;
        }
        onNoExactMatch?.(queryRaw);
        return;
      }
      // Modo MANUAL (default): prioridad de Enter para evitar que un
      // código existente termine como línea manual:
      //   1. Highlighted option (lo que el operador navegó con flechas).
      //   2. Match EXACTO en `filtered` (sku/code/barcode/name).
      //   3. Único resultado en `filtered` (sin ambigüedad).
      //   4. `exactLookup` remoto si el caller lo provee (cubre catálogos
      //      grandes donde el ítem no entró al top-N de la búsqueda).
      //   5. Solo si TODO falla → `onCreateManual`.
      e.preventDefault();
      e.stopPropagation();

      // 1) Highlighted
      const picked = filtered[highlight];
      // [DEBUG TEMP] Diagnóstico Bug 1 — ver por qué A000-00A cae a manual.
      // Quitar estos logs una vez resuelto.
      console.debug("[article-enter:1-highlight]", {
        queryRaw:    query,
        scanMode:    !!scanMode,
        highlight,
        pickedExists: !!picked,
        pickedSummary: picked
          ? { id: picked.id, code: picked.code, sku: picked.sku, article: picked.article, variant: picked.variant }
          : null,
        filteredCount: filtered.length,
      });
      if (picked) {
        console.debug("[article-select]", { source: "highlight", option: picked });
        commitSelection(picked);
        return;
      }

      // 2) Match exacto en filtered
      const txt = (query ?? "").trim();
      if (!txt) return;
      const norm = (s: string | undefined | null) =>
        (s ?? "").trim().toUpperCase().replace(/\s+/g, "");
      const q = norm(txt);
      const isExact = (it: TPArticleLite) => {
        if (norm(it.sku)         === q) return true;
        if (norm(it.code)        === q) return true;
        if (it.barcode && norm(it.barcode) === q) return true;
        // Coincidencia exacta por nombre (con espacios normalizados).
        const nameNorm = (it.article ?? "").trim().toUpperCase();
        if (nameNorm === txt.toUpperCase()) return true;
        return false;
      };
      const exactInFiltered = filtered.filter(isExact);
      console.debug("[article-enter:2-exact-local]", {
        queryNorm:        q,
        exactInFilteredN: exactInFiltered.length,
        exactInFilteredSummary: exactInFiltered.map((it) => ({
          id: it.id, code: it.code, sku: it.sku, barcode: it.barcode, article: it.article, variant: it.variant,
        })),
        filteredSummary: filtered.slice(0, 5).map((it) => ({
          id: it.id, code: it.code, sku: it.sku, barcode: it.barcode, article: it.article, variant: it.variant,
        })),
      });
      if (exactInFiltered.length === 1) {
        console.debug("[article-select]", { source: "exact-local", option: exactInFiltered[0] });
        commitSelection(exactInFiltered[0]);
        return;
      }
      if (exactInFiltered.length > 1) {
        // Múltiples ítems con el mismo código exacto: el caller decide.
        onMultipleExactMatches?.(txt, exactInFiltered);
        return;
      }

      // 3) Único resultado en filtered (sin ambigüedad)
      if (filtered.length === 1) {
        console.debug("[article-select]", { source: "single-local", option: filtered[0] });
        commitSelection(filtered[0]);
        return;
      }

      // 4) Lookup remoto exacto (si el caller lo provee). Antes esto solo
      //    corría en modo SCAN; ahora también en modo manual para que un
      //    código válido nunca termine como línea manual por error.
      if (exactLookup) {
        const reqId = ++remoteSearchReqRef.current;
        setSearchLoading(true);
        console.debug("[article-enter:4-exact-lookup-start]", { txt, reqId });
        exactLookup(txt)
          .then((rows) => {
            if (remoteSearchReqRef.current !== reqId) {
              console.debug("[article-enter:4-stale-resp]", { reqId, current: remoteSearchReqRef.current });
              return;
            }
            const remoteExact = (rows ?? []).filter(isExact);
            console.debug("[article-enter:4-exact-lookup-resp]", {
              rowsN: rows?.length ?? 0,
              rowsSummary: (rows ?? []).slice(0, 5).map((it) => ({
                id: it.id, code: it.code, sku: it.sku, barcode: it.barcode, article: it.article, variant: it.variant,
              })),
              remoteExactN: remoteExact.length,
              remoteExactSummary: remoteExact.map((it) => ({
                id: it.id, code: it.code, sku: it.sku, barcode: it.barcode, article: it.article, variant: it.variant,
              })),
            });
            if (remoteExact.length === 1) {
              console.debug("[article-select]", { source: "exact-remote", option: remoteExact[0] });
              commitSelection(remoteExact[0]);
            } else if (remoteExact.length > 1) {
              onMultipleExactMatches?.(txt, remoteExact);
            } else if (onCreateManual) {
              console.debug("[manual-create]", { source: "exact-lookup-empty", text: txt });
              setIsOpen(false);
              setQuery("");
              onCreateManual(txt);
            }
          })
          .catch((err) => {
            if (remoteSearchReqRef.current !== reqId) return;
            console.debug("[article-enter:4-exact-lookup-error]", { err: String(err) });
            if (onCreateManual) {
              console.debug("[manual-create]", { source: "exact-lookup-error", text: txt });
              setIsOpen(false);
              setQuery("");
              onCreateManual(txt);
            }
          })
          .finally(() => {
            if (remoteSearchReqRef.current === reqId) setSearchLoading(false);
          });
        return;
      }

      // 5) Sin lookup remoto y sin match local: si el caller acepta línea
      //    manual, la creamos. Si no, no hacemos nada (el operador puede
      //    seguir refinando la búsqueda).
      if (onCreateManual) {
        console.debug("[manual-create]", { source: "no-exact-lookup-provided", text: txt });
        setIsOpen(false);
        setQuery("");
        onCreateManual(txt);
      }
    } else if (e.key === "Escape") {
      e.preventDefault();
      e.stopPropagation();
      setIsOpen(false);
    }
  }

  const selectedFull = value ? data.find((d) => d.id === value.id) ?? null : null;
  const displayValue = selectedFull ? buildLabel(selectedFull) : (value ? buildLabel({ id: "", code: "", article: value.article, variant: value.variant }) : "");
  // Fallback chain: lookup contra `data` (sólo encuentra cosas en modo local /
  // mocks) → value.sku/imageUrl (lo que mandó el padre, suele ser real) →
  // vacío. Importante para `remoteSearch`, donde `data` es MOCK_ARTICLES.
  const selectedSku  = (selectedFull?.sku || selectedFull?.code || value?.sku || "").trim();
  const selectedImg  = selectedFull?.imageUrl || selectedFull?.images?.[0] || value?.imageUrl || "";
  // En modo "selección visible" (hay selección y el dropdown NO está abierto)
  // mostramos un trigger de 2 líneas: imagen + nombre arriba + SKU abajo.
  // Cuando se abre el dropdown volvemos al input puro de búsqueda.
  // OJO: usamos `value`, no `selectedFull`, porque en modo `remoteSearch` el
  // lookup contra `data` (mocks) no encuentra nada y queda null.
  const showSelectedDisplay = !!value && !isOpen;

  return (
    <div ref={containerRef} className={cn("relative", className)}>
      <div className={cn(
        // Foco coherente con `.tp-input` (ver index.css): borde primario + halo
        // sutil de 1px. Sin outline, sin doble ring, sin invadir el dark mode.
        "rounded-xl border border-border bg-card",
        "transition-[box-shadow,border-color] duration-150",
        "focus-within:border-[color-mix(in_oklab,var(--primary)_60%,var(--border))]",
        "focus-within:shadow-[0_0_0_1px_color-mix(in_oklab,var(--primary)_35%,transparent)]",
      )}>
        {showSelectedDisplay ? (
          // Trigger de selección: imagen + nombre arriba + SKU abajo. Click
          // sobre el área enfoca el input invisible y abre el dropdown para
          // permitir editar la selección.
          <div
            role="button"
            tabIndex={disabled ? -1 : 0}
            aria-haspopup="listbox"
            aria-expanded={isOpen}
            aria-disabled={disabled}
            onClick={() => {
              if (disabled) return;
              setIsOpen(true);
              window.setTimeout(() => inputRef.current?.focus(), 0);
            }}
            onKeyDown={(e) => {
              if (disabled) return;
              if (e.key === "Enter" || e.key === " " || e.key === "ArrowDown") {
                e.preventDefault();
                setIsOpen(true);
                window.setTimeout(() => inputRef.current?.focus(), 0);
              }
            }}
            className={cn(
              "flex w-full items-center gap-2 px-3 py-1.5 text-left",
              disabled ? "opacity-60" : "cursor-pointer",
            )}
          >
            <ArticleThumb src={selectedImg} size={36} />
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-medium text-text">{displayValue}</div>
              {selectedSku && (
                <div className="truncate text-[11px] leading-tight text-text/60">
                  SKU: <span className="font-mono text-text/85">{selectedSku}</span>
                </div>
              )}
            </div>
            {!disabled && (
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); clearSelection(); }}
                className="inline-flex h-5 w-5 items-center justify-center rounded text-muted hover:bg-surface2 hover:text-text"
                title="Quitar selección"
                aria-label="Quitar selección"
              >
                <XIcon size={12} />
              </button>
            )}
            <ChevronDown
              size={14}
              className={cn(
                "shrink-0 text-muted transition-transform duration-150",
                isOpen && "rotate-180",
              )}
            />
            {/* Input oculto para no perder la API de teclado (focusSignal, etc).
                Se mantiene fuera de pantalla pero recibe foco programático. */}
            <input
              ref={inputRef}
              type="text"
              value=""
              onChange={(e) => { setQuery(e.target.value); setIsOpen(true); }}
              onKeyDown={onKeyDown}
              tabIndex={-1}
              aria-hidden
              className="absolute -left-[9999px] h-0 w-0 opacity-0"
            />
          </div>
        ) : (
          <div className="flex items-center gap-2 px-3">
            <Search size={14} className="text-muted shrink-0" />
            <input
              ref={inputRef}
              type="text"
              value={isOpen ? query : displayValue}
              onChange={(e) => { setQuery(e.target.value); setIsOpen(true); }}
              onClick={() => setIsOpen(true)}
              onKeyDown={onKeyDown}
              onBlur={(e) => {
                // Bug 1 fix — `onBlur` NO crea líneas manuales. Crear manual
                // es SIEMPRE explícito: Enter sin match (después de
                // exactLookup), o el botón "Crear línea manual" del
                // dropdown vacío. Antes este handler creaba una línea
                // manual al perder foco con texto, lo que hacía que un
                // código existente como "A000-00A" cayera a línea manual
                // si el blur ocurría antes de que el handler de Enter
                // resolviera el lookup.
                const next = e.relatedTarget as Node | null;
                // [DEBUG TEMP] Diagnóstico Bug 1.
                console.debug("[article-blur]", {
                  query,
                  hasValue: !!value,
                  hasCreateManual: !!onCreateManual,
                  relatedTarget: next ? (next as HTMLElement).tagName : null,
                  blurInsidePanel: !!(next && (containerRef.current?.contains(next) || panelRef.current?.contains(next))),
                });
                // Sin `onCreateManual` desde aquí. Si el blur va a un
                // elemento dentro del panel del dropdown, no hacemos nada
                // (mantenemos el estado abierto para permitir click sobre
                // una opción). Para el resto de los casos, el dropdown se
                // cierra solo vía los listeners globales (pointerdown /
                // focusin) ya configurados.
              }}
              placeholder={placeholder}
              disabled={disabled}
              className="min-w-0 flex-1 bg-transparent py-2 text-sm text-text outline-none placeholder:text-muted disabled:opacity-60 focus:shadow-none focus-visible:shadow-none focus-visible:border-transparent"
              aria-autocomplete="list"
              aria-expanded={isOpen}
            />
            {value && !disabled && (
              <button
                type="button"
                onClick={clearSelection}
                className="inline-flex h-5 w-5 items-center justify-center rounded text-muted hover:bg-surface2 hover:text-text"
                title="Quitar selección"
                aria-label="Quitar selección"
              >
                <XIcon size={12} />
              </button>
            )}
            <ChevronDown
              size={14}
              className={cn(
                "shrink-0 text-muted transition-transform duration-150",
                isOpen && "rotate-180",
              )}
            />
          </div>
        )}
      </div>

      {/* Dropdown — portal a <body> con position: fixed para escapar de
          stacking contexts y overflow del padre. Fondo sólido garantizado. */}
      {isOpen && !disabled && panelPos && createPortal(
        <div
          ref={panelRef}
          role="presentation"
          style={{
            position: "fixed",
            top: panelPos.placeAbove ? undefined : panelPos.top + 4,
            bottom: panelPos.placeAbove
              ? window.innerHeight - panelPos.top + 4
              : undefined,
            left: panelPos.left,
            width: panelPos.width,
            zIndex: 1000,
            backgroundColor: "var(--card)",
            backdropFilter: "none",
            opacity: 1,
          }}
          className="max-h-80 overflow-auto rounded-md border border-border shadow-2xl ring-1 ring-black/10"
        >
          {filtered.length === 0 ? (
            <div className="px-3 py-6 text-center text-xs text-muted">
              {searchLoading ? (
                "Buscando…"
              ) : (
                <>
                  <div>Sin resultados{query ? ` para «${query}»` : ""}.</div>
                  {!searchLoading && onCreateManual && query.trim().length > 0 && !scanMode && (
                    <button
                      type="button"
                      onMouseDown={(ev) => {
                        ev.preventDefault();
                        const txt = query.trim();
                        if (!txt) return;
                        setIsOpen(false);
                        setQuery("");
                        onCreateManual(txt);
                      }}
                      className="mt-2 inline-flex items-center gap-1 rounded-md border border-amber-500/30 bg-amber-500/10 px-2 py-1 text-[11px] font-semibold text-amber-600 transition hover:bg-amber-500/20 dark:text-amber-400"
                    >
                      Presioná Enter para crear línea manual
                    </button>
                  )}
                </>
              )}
            </div>
          ) : (
            <ul role="listbox">
              {filtered.map((a, idx) => {
                const rowSku = a.sku || a.code;
                const rowImg = a.imageUrl || a.images?.[0];
                return (
                  <li
                    key={(a.variantId ?? a.id) + ":" + idx}
                    role="option"
                    aria-selected={idx === highlight}
                    onMouseDown={(ev) => { ev.preventDefault(); commitSelection(a); }}
                    onMouseEnter={() => setHighlight(idx)}
                    className={cn(
                      "flex cursor-pointer items-center gap-2.5 px-3 py-2 text-sm",
                      idx === highlight ? "bg-primary/10 text-text" : "text-text/80 hover:bg-surface2/60"
                    )}
                  >
                    <ArticleThumb src={rowImg} size={36} />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        <span className="min-w-0 truncate font-medium">{buildLabel(a)}</span>
                        <ItemKindChip kind={a.itemKind} />
                      </div>
                      <div className="truncate text-[11px] text-muted">
                        {rowSku && (
                          <>SKU: <span className="font-mono">{rowSku}</span></>
                        )}
                        {a.barcode && a.barcode !== a.code && (
                          <> · <span className="font-mono">{a.barcode}</span></>
                        )}
                        <> · </>
                        <span className={cn("tabular-nums", stockTone(a.stock))}>
                          {stockLabel(a.stock)}
                        </span>
                        {typeof a.price === "number" && (
                          <> · {fmtMoney(a.price, a.currency)}</>
                        )}
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>,
        document.body
      )}
    </div>
  );
}

export default TPArticleVariantSearchSelect;
