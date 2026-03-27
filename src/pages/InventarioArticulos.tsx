// src/pages/InventarioArticulos.tsx
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import ArticleModal from "./article-detail/ArticleModal";
import ArticleImportModal from "./article-detail/ArticleImportModal";
import LabelPrintModal, { type LabelItem } from "./article-detail/LabelPrintModal";
import BarcodeScannerOverlay from "./article-detail/BarcodeScannerOverlay";
import type { ArticleDetail } from "../services/articles";
import {
  Package,
  Plus,
  SlidersHorizontal,
  Star,
  Layers,
  ScanBarcode,
  X,
  Upload,
  Tag,
  Scan,
  Box,
  Wrench,
  Gem,
} from "lucide-react";

import { cn } from "../components/ui/tp";
import { TPSectionShell }  from "../components/ui/TPSectionShell";
import { TPButton }        from "../components/ui/TPButton";
import { TPSearchInput }   from "../components/ui/TPSearchInput";
import { TPBadge }         from "../components/ui/TPBadges";
import { TPActiveBadge }   from "../components/ui/TPBadges";
import { TPRowActions }    from "../components/ui/TPRowActions";
import { TPActionsMenu }   from "../components/ui/TPActionsMenu";
import {
  TPTableWrap,
  TPTableHeader,
} from "../components/ui/TPTable";
import { TPTreeTable, type TreeColDef, type TreeNodeBase } from "../components/ui/TPTreeTable";
import { TPColumnPicker, type ColPickerDef } from "../components/ui/TPColumnPicker";
import { TPPagination } from "../components/ui/TPPagination";
import ConfirmDeleteDialog from "../components/ui/ConfirmDeleteDialog";
import TPSelect from "../components/ui/TPSelect";

import { toast } from "../lib/toast";
import {
  articlesApi,
  type ArticleRow,
  type ArticleVariant,
  type ArticleType,
  type ArticleListParams,
  type CostLine,
  type ArticleComposition,
  ARTICLE_TYPE_LABELS,
  ARTICLE_TYPE_TONES,
  ARTICLE_STATUS_LABELS,
  ARTICLE_STATUS_COLORS,
  STOCK_MODE_LABELS,
  fmtMoney,
  fmtQty,
} from "../services/articles";
import { categoriesApi, type CategoryRow } from "../services/categories";

/* =========================================================
   Tipos del árbol
========================================================= */
type ArticleNode = {
  kind: "article";
  id: string;
  level: number;
  children: { id: string }[];
  row: ArticleRow;
};

type VariantNode = {
  kind: "variant";
  id: string;           // "variant__{variantId}"
  level: number;
  children: { id: string }[];
  row: ArticleRow;      // artículo padre
  variant: ArticleVariant;
};

type AnyNode = ArticleNode | VariantNode;

/* =========================================================
   Columnas opcionales
========================================================= */
const COL_DEFS: ColPickerDef[] = [
  { key: "tipo",     label: "Tipo" },
  { key: "estado",   label: "Estado" },
  { key: "cost",     label: "Costo s/imp" },
  { key: "costTax",  label: "Costo c/imp" },
  { key: "price",    label: "Precio venta" },
  { key: "stock",    label: "Stock" },
  { key: "supplier", label: "Proveedor" },
];

// Ocultas por defecto
const COL_VIS_DEFAULTS: Record<string, boolean> = {
  costTax:  false,
  supplier: false,
};

const COL_LS_KEY       = "tptech_col_inventario_articulos_v5";
const COL_ORDER_LS_KEY = "tptech_col_order_inventario_articulos_v5";

function loadColVis(): Record<string, boolean> {
  try {
    const stored = JSON.parse(localStorage.getItem(COL_LS_KEY) ?? "{}") as Record<string, boolean>;
    return { ...COL_VIS_DEFAULTS, ...stored };
  } catch { return { ...COL_VIS_DEFAULTS }; }
}
function saveColVis(v: Record<string, boolean>) { localStorage.setItem(COL_LS_KEY, JSON.stringify(v)); }
function loadColOrder(): string[] {
  try {
    const raw = localStorage.getItem(COL_ORDER_LS_KEY);
    return raw ? JSON.parse(raw) : COL_DEFS.map((c) => c.key);
  } catch { return COL_DEFS.map((c) => c.key); }
}
function saveColOrder(o: string[]) { localStorage.setItem(COL_ORDER_LS_KEY, JSON.stringify(o)); }
function v(colVis: Record<string, boolean>, key: string) { return colVis[key] !== false; }

/* =========================================================
   Badges helpers
========================================================= */
function ArticleTypeBadge({ type }: { type: ArticleType }) {
  const icons: Record<ArticleType, React.ReactNode> = {
    PRODUCT:  <Box size={10} />,
    SERVICE:  <Wrench size={10} />,
    MATERIAL: <Gem size={10} />,
  };
  return (
    <TPBadge tone={ARTICLE_TYPE_TONES[type]} size="sm" className="gap-1">
      {icons[type]}
      {ARTICLE_TYPE_LABELS[type]}
    </TPBadge>
  );
}

function StockModeBadge({ mode }: { mode: string }) {
  if (mode === "BY_ARTICLE")  return <TPBadge tone="primary"  size="sm">Por artículo</TPBadge>;
  if (mode === "BY_MATERIAL") return <TPBadge tone="warning"  size="sm">Por material</TPBadge>;
  return <TPBadge tone="neutral" size="sm">Sin stock</TPBadge>;
}


function ArticleTypeIcon({ type }: { type: ArticleType }) {
  if (type === "SERVICE")  return <Wrench size={18} className="text-muted/60" />;
  if (type === "MATERIAL") return <Gem size={18} className="text-muted/60" />;
  return <Package size={18} className="text-muted/60" />;
}

/* =========================================================
   Helpers de formato
========================================================= */
/** Formatea un número en es-AR sin símbolo de moneda (ej: "1.500" o "15"). */
function fmtNum(v: string | number | null | undefined): string {
  if (v == null || v === "") return "—";
  const n = typeof v === "string" ? parseFloat(v) : v;
  if (!isFinite(n)) return "—";
  return new Intl.NumberFormat("es-AR", { maximumFractionDigits: 2 }).format(n);
}

/* =========================================================
   CostCellContent — celda de costo desglosada
========================================================= */
type CostCompositionLine = NonNullable<ArticleRow["costComposition"]>[number];

function CostCellContent({ row }: { row: ArticleRow }) {
  const lines: CostCompositionLine[] = row.costComposition ?? [];
  const metalLines = lines.filter((l) => l.type === "METAL");
  const otherLines = lines.filter((l) => l.type !== "METAL");
  const hasBreakdown = lines.length > 0;
  const hasTotal = row.computedCostBase != null;

  if (!hasBreakdown && !hasTotal) {
    return <span className="text-muted/40">—</span>;
  }

  function lineLabel(l: CostCompositionLine): string {
    if (l.label) return l.label;
    if (l.type === "HECHURA")  return "Hechura";
    if (l.type === "MANUAL")   return "Manual";
    if (l.type === "PRODUCT")  return "Producto";
    if (l.type === "SERVICE")  return "Servicio";
    return l.type;
  }

  return (
    <div className="text-right min-w-[9rem]">
      {/* ── Composición ── */}
      {hasBreakdown && (
        <div className="space-y-0.5 mb-1.5">
          {metalLines.map((l, i) => (
            <div key={i} className="flex items-baseline justify-between gap-3 text-xs text-muted">
              <span className="shrink-0 text-muted/70">
                {l.metalVariant?.sku ?? l.metalVariant?.name ?? "Metal"}
              </span>
              <span className="tabular-nums">
                {fmtNum(l.quantity)} g
              </span>
            </div>
          ))}
          {otherLines.map((l, i) => {
            const total = parseFloat(l.quantity) * parseFloat(l.unitValue);
            const code = l.currency?.code ?? "ARS";
            return (
              <div key={`o${i}`} className="flex items-baseline justify-between gap-3 text-xs text-muted">
                <span className="shrink-0 text-muted/70">{lineLabel(l)}</span>
                <span className="tabular-nums">{code} {fmtNum(total)}</span>
              </div>
            );
          })}
        </div>
      )}

      {/* ── Separador ── */}
      {hasBreakdown && hasTotal && (
        <div className="border-t border-border/50 mb-1" />
      )}

      {/* ── Totales ── */}
      {hasTotal ? (
        <div className="space-y-0.5">
          <div className="text-sm font-semibold tabular-nums">
            ARS {fmtNum(row.computedCostBase)}
          </div>
          {row.computedCostWithTax != null && (
            <div className="text-xs text-muted tabular-nums">
              c/imp ARS {fmtNum(row.computedCostWithTax)}
            </div>
          )}
        </div>
      ) : (
        <span className="text-muted/40 text-sm">—</span>
      )}
    </div>
  );
}

/* =========================================================
   StockIndicator — semáforo de stock con TPBadge
========================================================= */
type StockTone = "neutral" | "success" | "warning" | "danger" | "info";

type StockLevel = {
  tone: StockTone;
  label: string;
};

function stockLevel(
  qty:          number | null,
  reorderPoint: string | number | null,
  stockMode:    string,
): StockLevel {
  if (stockMode === "NO_STOCK")   return { tone: "neutral", label: "Sin stock" };
  if (stockMode === "BY_MATERIAL") return { tone: "info",    label: "Por material" };
  if (qty === null)               return { tone: "neutral", label: "—" };
  if (qty <= 0)                   return { tone: "danger",  label: "0" };
  const rp = reorderPoint != null ? parseFloat(String(reorderPoint)) : null;
  if (rp !== null && qty <= rp)  return { tone: "warning", label: `${fmtQty(qty)} / mín. ${fmtQty(rp)}` };
  return { tone: "success", label: fmtQty(qty) };
}

function StockIndicator({
  qty, reorderPoint, stockMode,
}: {
  qty:          number | null;
  reorderPoint: string | number | null;
  stockMode:    string;
}) {
  const lvl = stockLevel(qty, reorderPoint, stockMode);
  return <TPBadge tone={lvl.tone} size="sm">{lvl.label}</TPBadge>;
}

/** Resumen de stock para artículo con variantes. */
function VariantStockSummary({
  variants,
  byVariant,
}: {
  variants: ArticleVariant[];
  byVariant: { [variantId: string]: number };
}) {
  let red = 0, yellow = 0;
  for (const vv of variants) {
    const qty = byVariant[vv.id] ?? 0;
    const rp  = vv.reorderPoint != null ? parseFloat(vv.reorderPoint) : null;
    if (qty <= 0)                     red++;
    else if (rp !== null && qty <= rp) yellow++;
  }
  const total = variants.length;
  if (red > 0) {
    return (
      <TPBadge tone="danger" size="sm">
        {red === total ? "Sin stock" : `${red} crítica${red > 1 ? "s" : ""}`}
      </TPBadge>
    );
  }
  if (yellow > 0) {
    return (
      <TPBadge tone="warning" size="sm">
        {`${yellow} baja${yellow > 1 ? "s" : ""}`}
      </TPBadge>
    );
  }
  return <TPBadge tone="success" size="sm">OK</TPBadge>;
}

/* =========================================================
   PriceCellContent — celda de precio con fuente
========================================================= */
type PriceSourceKey =
  | "PROMOTION" | "PRICE_LIST_CATEGORY" | "PRICE_LIST_GENERAL"
  | "MANUAL_OVERRIDE" | "MANUAL_FALLBACK" | "NONE";

const PRICE_SOURCE_CONFIG: Record<PriceSourceKey, {
  label: string;
  tone: "success" | "primary" | "neutral" | "warning";
}> = {
  PROMOTION:           { label: "Promoción",       tone: "success"  },
  PRICE_LIST_CATEGORY: { label: "Lista categoría", tone: "primary"  },
  PRICE_LIST_GENERAL:  { label: "Lista general",   tone: "neutral"  },
  MANUAL_OVERRIDE:     { label: "Precio manual",   tone: "warning"  },
  MANUAL_FALLBACK:     { label: "Precio manual",   tone: "warning"  },
  NONE:                { label: "",                tone: "neutral"  },
};

function PriceCellContent({ row }: { row: ArticleRow }) {
  const src   = (row.resolvedPriceSource ?? "NONE") as PriceSourceKey;
  const price = row.resolvedSalePrice;
  const name  = row.resolvedPriceName;
  const cfg   = PRICE_SOURCE_CONFIG[src] ?? PRICE_SOURCE_CONFIG.NONE;

  if (!price || src === "NONE") {
    return <span className="text-muted/40">—</span>;
  }

  return (
    <div className="text-right space-y-1">
      {/* Fuente del precio */}
      <div>
        <TPBadge tone={cfg.tone} size="sm">
          {name ? `${cfg.label}: ${name}` : cfg.label}
        </TPBadge>
      </div>
      {/* Importe */}
      <div className="text-sm font-semibold tabular-nums text-text">
        ARS {fmtNum(price)}
      </div>
    </div>
  );
}

/* =========================================================
   Componente principal
========================================================= */
export default function InventarioArticulos() {
  const navigate = useNavigate();

  /* ── datos ─────────────────────────────────────────────────────────────── */
  const [rows,    setRows]    = useState<ArticleRow[]>([]);
  const [total,   setTotal]   = useState(0);
  const [loading, setLoading] = useState(false);
  const [categories, setCategories] = useState<CategoryRow[]>([]);

  /* ── paginación ─────────────────────────────────────────────────────────── */
  const [page,     setPage]     = useState(1);
  const [pageSize, setPageSize] = useState(50);

  /* ── filtros rápidos ───────────────────────────────────────────────────── */
  const [q,        setQ]       = useState("");
  const [barcodeQ, setBarcodeQ] = useState("");
  const [onlyFav,  setOnlyFav] = useState(false);

  /* ── filtros avanzados ─────────────────────────────────────────────────── */
  const [filtersOpen,          setFiltersOpen]          = useState(false);
  const [filterType,           setFilterType]           = useState("");
  const [filterCategoryId,     setFilterCategoryId]     = useState("");
  const [filterStatus,         setFilterStatus]         = useState("");
  const [filterStockMode,      setFilterStockMode]      = useState("");
  const [filterSku,            setFilterSku]            = useState("");
  const [filterShowInStore,    setFilterShowInStore]    = useState(false);
  const [filterSupplierId,     setFilterSupplierId]     = useState("");

  /* ── árbol ─────────────────────────────────────────────────────────────── */
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  /* ── columnas ──────────────────────────────────────────────────────────── */
  const [colVis,   setColVis]   = useState<Record<string, boolean>>(loadColVis);
  const [colOrder, setColOrder] = useState<string[]>(loadColOrder);

  /* ── acciones busy ──────────────────────────────────────────────────────── */
  const [busyFav,    setBusyFav]    = useState<string | null>(null);
  const [busyToggle, setBusyToggle] = useState<string | null>(null);
  const [busyDel,    setBusyDel]    = useState<string | null>(null);
  const [confirmDel, setConfirmDel] = useState<ArticleRow | null>(null);

  /* ── barcode lookup ─────────────────────────────────────────────────────── */
  const [barcodeLoading, setBarcodeLoading] = useState(false);
  const [highlightId,    setHighlightId]    = useState<string | null>(null);
  const barcodeRef = useRef<HTMLInputElement>(null);

  /* ── modal importar / etiquetas / scanner ───────────────────────────────── */
  const [importOpen,  setImportOpen]  = useState(false);
  const [labelsOpen,  setLabelsOpen]  = useState(false);
  const [scannerOpen, setScannerOpen] = useState(false);
  const [labelItems,  setLabelItems]  = useState<LabelItem[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  function openLabels() {
    // Si hay selección, usar esa; si no, todos los visibles con barcode
    const source = selectedIds.size > 0
      ? rows.filter((r) => selectedIds.has(r.id))
      : rows.filter((r) => r.barcode);
    setLabelItems(source.map((r) => ({
      id:          r.id,
      code:        r.code,
      name:        r.name,
      barcode:     r.barcode,
      barcodeType: r.barcodeType,
      costPrice:   r.costPrice,
      salePrice:   r.salePrice,
    })));
    setLabelsOpen(true);
  }

  /* ── modal artículo ──────────────────────────────────────────────────────── */
  const [modalOpen,             setModalOpen]             = useState(false);
  const [modalArticleId,        setModalArticleId]        = useState<string | null>(null);
  const [modalCloneData,        setModalCloneData]        = useState<Record<string, unknown> | undefined>(undefined);
  const [modalDefaultType,      setModalDefaultType]      = useState<"PRODUCT" | "SERVICE" | "MATERIAL" | undefined>(undefined);
  const [modalCloneCostLines,   setModalCloneCostLines]   = useState<CostLine[]>([]);
  const [modalCloneCompositions,setModalCloneCompositions]= useState<ArticleComposition[]>([]);

  function openCreate(type?: "PRODUCT" | "SERVICE" | "MATERIAL") {
    setModalCloneCostLines([]);
    setModalCloneCompositions([]);
    setModalArticleId(null);
    setModalCloneData(undefined);
    setModalDefaultType(type);
    setModalOpen(true);
  }
  function openEdit(row: ArticleRow) {
    setModalCloneCostLines([]);
    setModalCloneCompositions([]);
    setModalArticleId(row.id);
    setModalCloneData(undefined);
    setModalDefaultType(undefined);
    setModalOpen(true);
  }
  async function handleClone(row: ArticleRow) {
    try {
      const detail = await articlesApi.getOne(row.id);
      setModalArticleId(null);
      setModalCloneData({
        articleType:           detail.articleType,
        name:                  detail.name + " (copia)",
        description:           detail.description,
        categoryId:            detail.categoryId,
        stockMode:             detail.stockMode,
        brand:                 detail.brand,
        manufacturer:          detail.manufacturer,
        costPrice:             detail.costPrice   != null ? parseFloat(detail.costPrice)   : null,
        salePrice:             detail.salePrice   != null ? parseFloat(detail.salePrice)   : null,
        hechuraPrice:          detail.hechuraPrice != null ? parseFloat(detail.hechuraPrice) : null,
        hechuraPriceMode:      detail.hechuraPriceMode,
        mermaPercent:          detail.mermaPercent != null ? parseFloat(detail.mermaPercent) : null,
        costCalculationMode:   detail.costCalculationMode,
        multiplierBase:        detail.multiplierBase ?? "",
        multiplierValue:       detail.multiplierValue   != null ? parseFloat(detail.multiplierValue)   : null,
        multiplierQuantity:    detail.multiplierQuantity != null ? parseFloat(detail.multiplierQuantity) : null,
        manualBaseCost:        detail.manualBaseCost != null ? parseFloat(detail.manualBaseCost) : null,
        manualCurrencyId:      detail.manualCurrencyId ?? "",
        manualAdjustmentKind:  detail.manualAdjustmentKind  as "" | "BONUS" | "SURCHARGE",
        manualAdjustmentType:  detail.manualAdjustmentType  as "" | "PERCENTAGE" | "FIXED_AMOUNT",
        manualAdjustmentValue: detail.manualAdjustmentValue != null ? parseFloat(detail.manualAdjustmentValue) : null,
        manualTaxIds:          detail.manualTaxIds ?? [],
        unitOfMeasure:         detail.unitOfMeasure,
        isReturnable:          detail.isReturnable,
        showInStore:           detail.showInStore,
        sellWithoutVariants:   detail.sellWithoutVariants,
      });
      // Strip 'id' so las líneas se traten como nuevos registros al guardar
      setModalCloneCostLines(
        (detail.costComposition ?? []).map(({ id: _id, ...rest }) => rest as CostLine)
      );
      setModalCloneCompositions(detail.compositions ?? []);
      setModalDefaultType(undefined);
      setModalOpen(true);
    } catch {
      toast.error("Error al cargar los datos del artículo para clonar.");
    }
  }
  // Definido como ref mutable para que handleModalSaved (definido antes que fetchArticles) pueda llamarlo
  const reloadRef = useRef<() => void>(() => {});
  function handleModalSaved(_saved: ArticleDetail) {
    setModalOpen(false);
    reloadRef.current();
  }

  /* ── carga de datos ─────────────────────────────────────────────────────── */
  // Función base de carga — siempre recibe página/tamaño explícitamente
  async function fetchArticles(opts: {
    pg: number; ps: number; barcode?: string;
  }) {
    setLoading(true);
    try {
      const res = await articlesApi.list({
        q:                   q || undefined,
        articleType:         filterType || undefined,
        categoryId:          filterCategoryId || undefined,
        status:              filterStatus || undefined,
        stockMode:           filterStockMode || undefined,
        sku:                 filterSku || undefined,
        showInStore:         filterShowInStore || undefined,
        preferredSupplierId: filterSupplierId || undefined,
        isFavorite:          onlyFav || undefined,
        showInActive:        filterStatus !== "" || undefined,
        barcode:             opts.barcode,
        page:                opts.pg,
        pageSize:            opts.ps,
      });
      setRows(res.rows);
      setTotal(res.total);
    } catch (e: any) {
      toast.error(e?.message || "Error al cargar artículos.");
    } finally {
      setLoading(false);
    }
  }

  // Refs para acceso estable a página/tamaño en el efecto de filtros
  const pageRef     = useRef(page);
  const pageSizeRef = useRef(pageSize);
  pageRef.current     = page;
  pageSizeRef.current = pageSize;

  // Wire up el reloadRef ahora que fetchArticles está definida
  reloadRef.current = () => void fetchArticles({ pg: pageRef.current, ps: pageSizeRef.current });

  const load = useCallback((opts?: { barcode?: string }) => {
    void fetchArticles({ pg: pageRef.current, ps: pageSizeRef.current, ...opts });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q, filterType, filterCategoryId, filterStatus, filterStockMode, filterSku,
      filterShowInStore, filterSupplierId, onlyFav]);

  // Carga inicial
  useEffect(() => { void fetchArticles({ pg: 1, ps: pageSize }); }, []);

  // Recarga al cambiar filtros con debounce — vuelve a página 1
  useEffect(() => {
    setPage(1);
    const t = setTimeout(() => void fetchArticles({ pg: 1, ps: pageSizeRef.current }), 300);
    return () => clearTimeout(t);
  }, [q, filterType, filterCategoryId, filterStatus, filterStockMode, filterSku,
      filterShowInStore, filterSupplierId, onlyFav]);

  // Cargar categorías para el filtro
  useEffect(() => {
    categoriesApi.list()
      .then((rows) => setCategories(rows))
      .catch(() => {});
  }, []);

  /* ── árbol ─────────────────────────────────────────────────────────────── */
  const isSearching = q.length > 0 || filterType !== "" || filterCategoryId !== ""
    || filterStatus !== "" || filterStockMode !== "" || filterSku !== ""
    || filterShowInStore || filterSupplierId !== "" || onlyFav;

  const flatNodes = useMemo<AnyNode[]>(() => {
    const nodes: AnyNode[] = [];
    for (const row of rows) {
      const hasVariants = Array.isArray(row.variants) && row.variants.length > 0;
      const articleNode: ArticleNode = {
        kind: "article",
        id: row.id,
        level: 0,
        children: hasVariants
          ? row.variants!.map((vv) => ({ id: `variant__${vv.id}` }))
          : [],
        row,
      };
      nodes.push(articleNode);

      // Agregar variantes si está expandido (o si estamos buscando)
      if ((expanded.has(row.id) || isSearching) && hasVariants) {
        for (const vv of row.variants!) {
          nodes.push({
            kind: "variant",
            id: `variant__${vv.id}`,
            level: 1,
            children: [],
            row,
            variant: vv,
          } as VariantNode);
        }
      }
    }
    return nodes;
  }, [rows, expanded, isSearching]);

  /* ── columnas ordenadas y visibles ─────────────────────────────────────── */
  const orderedCols = useMemo(() => {
    const map = Object.fromEntries(COL_DEFS.map((c) => [c.key, c]));
    return colOrder.map((k) => map[k]).filter(Boolean) as ColPickerDef[];
  }, [colOrder]);

  /* ── barcode lookup ─────────────────────────────────────────────────────── */
  async function handleBarcodeSearch(val: string) {
    const trimmed = val.trim();
    if (!trimmed) return;
    setBarcodeLoading(true);
    try {
      const res = await articlesApi.lookupByBarcode(trimmed);
      if (!res.found) {
        toast.error(`No se encontró ningún artículo con barcode "${trimmed}".`);
        return;
      }
      // Si el artículo no está en la lista, recargar con ese barcode (sin paginar)
      const existsInList = rows.some((r) => r.id === res.articleId);
      if (!existsInList) {
        await fetchArticles({ pg: 1, ps: pageSizeRef.current, barcode: trimmed });
      }
      // Expandir padre y resaltar
      setExpanded((prev) => new Set([...prev, res.articleId]));
      setHighlightId(res.variantId ? `variant__${res.variantId}` : res.articleId);
      // Limpiar highlight después de 3s
      setTimeout(() => setHighlightId(null), 3000);
      setBarcodeQ("");
    } catch (e: any) {
      toast.error(e?.message || "Error en búsqueda por barcode.");
    } finally {
      setBarcodeLoading(false);
    }
  }

  /* ── acciones de fila ───────────────────────────────────────────────────── */
  async function handleFavorite(row: ArticleRow) {
    setBusyFav(row.id);
    try {
      const updated = await articlesApi.favorite(row.id);
      setRows((prev) => prev.map((r) => r.id === row.id ? { ...r, isFavorite: updated.isFavorite } : r));
    } catch (e: any) {
      toast.error(e?.message || "Error al actualizar favorito.");
    } finally { setBusyFav(null); }
  }

  async function handleToggle(row: ArticleRow) {
    setBusyToggle(row.id);
    try {
      const updated = await articlesApi.toggle(row.id);
      setRows((prev) => prev.map((r) => r.id === row.id ? { ...r, isActive: updated.isActive } : r));
      toast.success(updated.isActive ? "Artículo activado." : "Artículo desactivado.");
    } catch (e: any) {
      toast.error(e?.message || "Error al cambiar estado.");
    } finally { setBusyToggle(null); }
  }

  async function handleDelete(row: ArticleRow) {
    setBusyDel(row.id);
    try {
      await articlesApi.remove(row.id);
      setRows((prev) => prev.filter((r) => r.id !== row.id));
      setTotal((t) => t - 1);
      setConfirmDel(null);
      toast.success("Artículo eliminado.");
    } catch (e: any) {
      toast.error(e?.message || "Error al eliminar artículo.");
    } finally { setBusyDel(null); }
  }

  /* ── paginación handlers ────────────────────────────────────────────────── */
  function handlePageChange(p: number) {
    setPage(p);
    void fetchArticles({ pg: p, ps: pageSizeRef.current });
  }
  function handlePageSizeChange(s: number) {
    setPageSize(s);
    setPage(1);
    void fetchArticles({ pg: 1, ps: s });
  }

  /* ── filtros activos count ──────────────────────────────────────────────── */
  const activeFilterCount = [
    filterType, filterCategoryId, filterStatus, filterStockMode, filterSku, filterSupplierId,
    barcodeQ,
    filterShowInStore ? "1" : "",
  ].filter(Boolean).length;

  /* ── helpers columnas ────────────────────────────────────────────────────── */
  function isVisible(key: string) { return v(colVis, key); }

  /* ── celda principal: artículo ──────────────────────────────────────────── */
  function articleMainCell(node: ArticleNode) {
    const row = node.row;
    const hasVariants = node.children.length > 0;

    return (
      <div className="flex items-center gap-3 py-1 min-w-0">
        {/* Imagen 48×48 */}
        <div className="shrink-0">
          {row.mainImageUrl ? (
            <img src={row.mainImageUrl} alt="" className="w-12 h-12 rounded-lg object-cover border border-border" />
          ) : (
            <div className="w-12 h-12 rounded-lg bg-surface2 border border-border flex items-center justify-center">
              <ArticleTypeIcon type={row.articleType} />
            </div>
          )}
        </div>

        {/* Bloque de información */}
        <div className="flex-1 min-w-0">
          {/* Línea 1: nombre + badges extra */}
          <div className="flex items-center gap-2 flex-wrap">
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); navigate(`/articulos/${row.id}`); }}
              className="font-semibold text-sm text-text hover:text-primary transition-colors text-left truncate max-w-xs"
              title={row.name}
            >
              {row.name}
            </button>
            {row.isFavorite && <Star size={11} className="text-yellow-400 fill-yellow-400 shrink-0" />}
            {row.showInStore && (
              <span className="text-[10px] text-primary bg-primary/10 rounded-full px-1.5 py-0.5 shrink-0">Tienda</span>
            )}
          </div>

          {/* Línea 2: code · SKU · variantes */}
          <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
            <span className="font-mono text-xs text-muted">{row.code}</span>
            {row.sku && row.sku !== row.code && (
              <span className="text-xs text-muted/60">· SKU {row.sku}</span>
            )}
            {hasVariants && (
              <span className="text-[10px] text-muted bg-surface2 rounded-full px-2 py-0.5 shrink-0">
                {node.children.length} {node.children.length === 1 ? "variante" : "variantes"}
              </span>
            )}
          </div>

          {/* Línea 3: categoría · proveedor */}
          <div className="flex items-center gap-1.5 mt-1 flex-wrap text-xs text-muted">
            {row.category && <span className="text-muted/70">{row.category.name}</span>}
            {isVisible("supplier") && row.preferredSupplier && (
              <>
                <span className="text-muted/30">·</span>
                <span className="text-muted/70">{row.preferredSupplier.displayName}</span>
              </>
            )}
          </div>
        </div>
      </div>
    );
  }

  /* ── celda principal: variante ──────────────────────────────────────────── */
  function variantMainCell(node: VariantNode) {
    const vv = node.variant;
    const parentRow = node.row;

    // Imagen: galería propia → imageUrl legacy → artículo padre (con opacidad)
    const ownImgSrc = vv.images?.find(i => i.isMain)?.url ?? vv.images?.[0]?.url ?? (vv.imageUrl || null);
    const displayImgSrc = ownImgSrc ?? parentRow.mainImageUrl;
    const isImgFallback = !ownImgSrc && !!parentRow.mainImageUrl;

    return (
      <div className="flex items-center gap-3 py-0.5 min-w-0">
        {/* Imagen variante 36×36 */}
        <div className="shrink-0">
          {displayImgSrc ? (
            <img
              src={displayImgSrc}
              alt=""
              className={cn(
                "w-9 h-9 rounded-md object-cover border border-border",
                isImgFallback && "opacity-35"
              )}
              title={isImgFallback ? "Imagen del artículo padre" : undefined}
            />
          ) : (
            <div className="w-9 h-9 rounded-md bg-surface2 border border-border flex items-center justify-center">
              <Layers size={12} className="text-muted" />
            </div>
          )}
        </div>

        {/* Info variante */}
        <div className="flex-1 min-w-0">
          {/* Línea 1: nombre */}
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-medium text-text/90 truncate">{vv.name}</span>
          </div>

          {/* Línea 2: code · SKU · barcode · atributos */}
          <div className="flex items-center gap-1.5 mt-0.5 text-xs text-muted flex-wrap">
            <span className="font-mono">{vv.code}</span>
            {vv.sku && <span className="text-muted/60">· SKU {vv.sku}</span>}
            {vv.barcode && (
              <span className="flex items-center gap-0.5 text-muted/60">
                <ScanBarcode size={9} />{vv.barcode}
              </span>
            )}
            {Array.isArray(vv.attributeValues) && vv.attributeValues.length > 0 && (
              <span className="text-muted/70">
                · {vv.attributeValues.map((av: any) => av.value).join(" · ")}
              </span>
            )}
          </div>
        </div>
      </div>
    );
  }

  /* ── columnas TPTreeTable ─────────────────────────────────────────────────── */
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const treeColumns = useMemo<TreeColDef[]>(() => {
    const mainCol: TreeColDef = {
      key: "main",
      header: "Artículo",
      renderCell: (raw) => {
        const node = raw as AnyNode;
        return node.kind === "article"
          ? articleMainCell(node)
          : variantMainCell(node);
      },
    };

    // Definición de cada columna opcional (orden real lo da colOrder)
    const optionalCols: Record<string, TreeColDef> = {
      tipo: {
        key: "tipo",
        header: <span className="text-xs">Tipo</span>,
        visible: isVisible("tipo"),
        className: "text-center w-28 align-top",
        renderCell: (raw) => {
          const node = raw as AnyNode;
          if (node.kind === "article") {
            return <ArticleTypeBadge type={node.row.articleType} />;
          }
          return <TPBadge tone="neutral" size="sm">Variante</TPBadge>;
        },
      },
      estado: {
        key: "estado",
        header: <span className="text-xs">Estado</span>,
        visible: isVisible("estado"),
        className: "text-center w-24 align-top",
        renderCell: (raw) => {
          const node = raw as AnyNode;
          const isActive = node.kind === "article"
            ? node.row.isActive
            : node.variant.isActive;
          return <TPActiveBadge active={isActive} size="sm" />;
        },
      },
      stock: {
        key: "stock",
        header: <span className="text-xs">Stock</span>,
        visible: isVisible("stock"),
        className: "text-center w-32 align-top",
        renderCell: (raw) => {
          const node = raw as AnyNode;
          if (node.kind === "variant") {
            const vv = node.variant;
            const qty = node.row.stockData?.byVariant?.[vv.id] ?? null;
            return <StockIndicator qty={qty} reorderPoint={vv.reorderPoint} stockMode={node.row.stockMode} />;
          }
          const row = node.row;
          if (row.stockMode === "NO_STOCK")    return <StockIndicator qty={null} reorderPoint={null} stockMode="NO_STOCK" />;
          if (row.stockMode === "BY_MATERIAL") return <StockIndicator qty={null} reorderPoint={null} stockMode="BY_MATERIAL" />;
          if (node.children.length > 0) {
            return (
              <VariantStockSummary
                variants={row.variants ?? []}
                byVariant={row.stockData?.byVariant ?? {}}
              />
            );
          }
          const qty = row.stockData?.total ?? null;
          return <StockIndicator qty={qty} reorderPoint={row.reorderPoint} stockMode={row.stockMode} />;
        },
      },
      cost: {
        key: "cost",
        header: <span className="text-xs">Costo</span>,
        visible: isVisible("cost"),
        className: "text-right align-top",
        renderCell: (raw) => {
          const node = raw as AnyNode;
          if (node.kind === "article") return <CostCellContent row={node.row} />;
          const vv = node.variant;
          return (
            <div className="text-right">
              {vv.costPrice
                ? <span className="tabular-nums text-sm">{fmtMoney(vv.costPrice)}</span>
                : <span className="text-muted/40 italic text-xs">hered.</span>}
            </div>
          );
        },
      },
      costTax: {
        key: "costTax",
        header: <span className="text-xs">c/imp</span>,
        visible: isVisible("costTax"),
        className: "text-right w-28 align-top",
        renderCell: (raw) => {
          const node = raw as AnyNode;
          if (node.kind !== "article") return null;
          return node.row.computedCostWithTax != null
            ? <span className="tabular-nums text-sm">{fmtMoney(node.row.computedCostWithTax)}</span>
            : <span className="text-muted/40">—</span>;
        },
      },
      price: {
        key: "price",
        header: <span className="text-xs">Precio</span>,
        visible: isVisible("price"),
        className: "text-right align-top",
        renderCell: (raw) => {
          const node = raw as AnyNode;
          if (node.kind === "article") return <PriceCellContent row={node.row} />;
          const vv = node.variant;
          if (vv.priceOverride) {
            return (
              <div className="text-right">
                <div className="text-[10px] text-muted/70 mb-0.5">Precio propio</div>
                <span className="tabular-nums text-sm font-medium text-primary">
                  ARS {fmtNum(vv.priceOverride)}
                </span>
              </div>
            );
          }
          const parentPrice = node.row.resolvedSalePrice;
          if (parentPrice) {
            return (
              <div className="text-right">
                <div className="text-[10px] text-muted/70 mb-0.5">Del artículo</div>
                <span className="tabular-nums text-sm text-muted">
                  ARS {fmtNum(parentPrice)}
                </span>
              </div>
            );
          }
          return <span className="text-muted/40 italic text-xs">hered.</span>;
        },
      },
    };

    // Ordenar columnas opcionales según colOrder (supplier va inline, no tiene columna propia)
    const ordered = colOrder
      .map((k) => optionalCols[k])
      .filter((c): c is TreeColDef => !!c);

    return [mainCol, ...ordered];
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [colVis, colOrder, highlightId, expanded]);

  /* ── acciones TPTreeTable ────────────────────────────────────────────────── */
  function renderTreeActions(raw: TreeNodeBase) {
    const node = raw as AnyNode;
    if (node.kind === "article") {
      return (
        <TPRowActions
          onView={() => navigate(`/articulos/${node.row.id}`)}
          onEdit={() => openEdit(node.row)}
          onClone={() => handleClone(node.row)}
          onFavorite={() => handleFavorite(node.row)}
          isFavorite={node.row.isFavorite}
          busyFavorite={busyFav === node.row.id}
          onToggle={() => handleToggle(node.row)}
          isActive={node.row.isActive}
          busyToggle={busyToggle === node.row.id}
          onDelete={() => setConfirmDel(node.row)}
          busyDelete={busyDel === node.row.id}
        />
      );
    }
    return (
      <TPActionsMenu
        title="Acciones variante"
        items={[
          { label: "Ver artículo",    onClick: () => navigate(`/articulos/${node.row.id}`) },
          { label: "Editar artículo", onClick: () => openEdit(node.row) },
        ]}
      />
    );
  }

  /* ── rowClassName TPTreeTable ────────────────────────────────────────────── */
  function treeRowClassName(raw: TreeNodeBase) {
    const node = raw as AnyNode;
    const isHighlight = highlightId === node.id;
    if (node.kind === "article") {
      return cn(
        isHighlight && "ring-inset ring-1 ring-primary/30 bg-primary/5",
        !node.row.isActive && "opacity-60"
      ) || undefined;
    }
    return cn(
      "bg-surface/20",
      isHighlight && "bg-primary/5 ring-inset ring-1 ring-primary/20",
      !node.variant.isActive && "opacity-60"
    ) || undefined;
  }

  /* ── render ──────────────────────────────────────────────────────────────── */
  return (
    <TPSectionShell
      title="Artículos y Servicios"
      subtitle={`${total} registro${total !== 1 ? "s" : ""}`}
      icon={<Package size={20} />}
      right={
        <div className="flex items-center gap-2">
          {/* Scanner */}
          <TPButton
            variant="secondary"
            onClick={() => setScannerOpen(true)}
            iconLeft={<Scan size={15} />}
            title="Scanner de barcode"
          >
            <span className="hidden md:inline">Scanner</span>
          </TPButton>
          {/* Etiquetas */}
          <TPButton
            variant="secondary"
            onClick={openLabels}
            iconLeft={<Tag size={15} />}
            title="Imprimir etiquetas"
          >
            <span className="hidden md:inline">Etiquetas</span>
          </TPButton>
          {/* Importar */}
          <TPButton
            variant="secondary"
            onClick={() => setImportOpen(true)}
            iconLeft={<Upload size={15} />}
            title="Importar desde Excel"
          >
            <span className="hidden md:inline">Importar</span>
          </TPButton>
          <TPButton
            variant="secondary"
            onClick={() => openCreate("SERVICE")}
            iconLeft={<Plus size={15} />}
          >
            <span className="hidden sm:inline">Nuevo servicio</span>
            <span className="sm:hidden">Servicio</span>
          </TPButton>
          <TPButton
            onClick={() => openCreate()}
            iconLeft={<Plus size={15} />}
          >
            <span className="hidden sm:inline">Nuevo artículo</span>
            <span className="sm:hidden">Artículo</span>
          </TPButton>
        </div>
      }
    >
      <TPTableWrap>
        {/* ── Barra principal: búsqueda + columnas | favoritos + filtros ──────── */}
        <TPTableHeader
          left={
            <div className="flex items-center gap-2 w-full">
              <TPSearchInput
                value={q}
                onChange={setQ}
                placeholder="Buscar nombre, código, SKU…"
                className="w-full max-w-sm"
              />
              <TPColumnPicker
                columns={orderedCols}
                visibility={colVis}
                onChange={(key, visible) => {
                  const next = { ...colVis, [key]: visible };
                  setColVis(next); saveColVis(next);
                }}
                order={colOrder}
                onOrderChange={(o) => { setColOrder(o); saveColOrder(o); }}
              />
            </div>
          }
          right={
            <div className="flex items-center gap-2">
              {/* Favoritos */}
              <TPButton
                variant="secondary"
                onClick={() => setOnlyFav((v) => !v)}
                title={onlyFav ? "Ver todos" : "Solo favoritos"}
                className={cn("w-9 !px-0", onlyFav && "border-yellow-500/40 text-yellow-400")}
              >
                <Star size={15} className={onlyFav ? "fill-yellow-400 text-yellow-400" : undefined} />
              </TPButton>

              {/* Filtros avanzados */}
              <TPButton
                variant="secondary"
                iconLeft={<SlidersHorizontal size={14} />}
                onClick={() => setFiltersOpen((v) => !v)}
                title="Filtros avanzados"
                className={cn((filtersOpen || activeFilterCount > 0) && "border-primary/40 text-primary")}
              >
                <span className="hidden sm:inline">Filtros</span>
                {activeFilterCount > 0 && (
                  <span className="bg-primary text-primary-foreground rounded-full px-1.5 py-0.5 text-[10px] font-bold leading-none ml-0.5">
                    {activeFilterCount}
                  </span>
                )}
              </TPButton>
            </div>
          }
        />

        {/* ── Filtros avanzados ──────────────────────────────────────────────── */}
        {filtersOpen && (
          <div className="px-4 pb-4 pt-3 border-b border-border bg-surface/30">
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-7 gap-3">
              {/* Tipo — sin MATERIAL */}
              <TPSelect
                value={filterType}
                onChange={setFilterType}
                label="Tipo"
                className="!h-9 text-sm"
              >
                <option value="">Todos</option>
                <option value="PRODUCT">Producto</option>
                <option value="SERVICE">Servicio</option>
              </TPSelect>

              {/* Categoría */}
              <TPSelect
                value={filterCategoryId}
                onChange={setFilterCategoryId}
                label="Categoría"
                className="!h-9 text-sm"
              >
                <option value="">Todas</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </TPSelect>

              {/* Estado */}
              <TPSelect
                value={filterStatus}
                onChange={setFilterStatus}
                label="Estado"
                className="!h-9 text-sm"
              >
                <option value="">Activos</option>
                <option value="DRAFT">Borrador</option>
                <option value="ACTIVE">Activo</option>
                <option value="DISCONTINUED">Discontinuado</option>
                <option value="ARCHIVED">Archivado</option>
              </TPSelect>

              {/* Modo stock — sin BY_MATERIAL */}
              <TPSelect
                value={filterStockMode}
                onChange={setFilterStockMode}
                label="Modo stock"
                className="!h-9 text-sm"
              >
                <option value="">Todos</option>
                <option value="NO_STOCK">Sin stock</option>
                <option value="BY_ARTICLE">Por artículo</option>
              </TPSelect>

              {/* SKU con X */}
              <div>
                <div className="mb-1.5 text-sm text-muted">SKU</div>
                <div className="relative">
                  <input
                    type="text"
                    value={filterSku}
                    onChange={(e) => setFilterSku(e.target.value)}
                    placeholder="Filtrar por SKU"
                    className="tp-input h-9 text-sm w-full pr-7"
                  />
                  {filterSku && (
                    <button
                      type="button"
                      onClick={() => setFilterSku("")}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-muted hover:text-text"
                    >
                      <X size={12} />
                    </button>
                  )}
                </div>
              </div>

              {/* Barcode con X — movido desde la barra superior */}
              <div>
                <div className="mb-1.5 text-sm text-muted">Barcode</div>
                <div className="relative">
                  <ScanBarcode size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted pointer-events-none" />
                  <input
                    ref={barcodeRef}
                    type="text"
                    value={barcodeQ}
                    onChange={(e) => setBarcodeQ(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") { void handleBarcodeSearch(barcodeQ); }
                    }}
                    placeholder="Escaneá o tipeá…"
                    className="tp-input h-9 text-sm w-full pl-8 pr-7"
                  />
                  {barcodeLoading && (
                    <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted text-xs">…</span>
                  )}
                  {barcodeQ && !barcodeLoading && (
                    <button
                      type="button"
                      onClick={() => setBarcodeQ("")}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-muted hover:text-text"
                    >
                      <X size={12} />
                    </button>
                  )}
                </div>
              </div>

              {/* En tienda */}
              <div>
                <div className="mb-1.5 text-sm text-muted">En tienda</div>
                <TPButton
                  variant="secondary"
                  onClick={() => setFilterShowInStore((v) => !v)}
                  className={cn(
                    "w-full h-9 text-sm",
                    filterShowInStore && "border-primary/40 text-primary"
                  )}
                >
                  {filterShowInStore ? "Solo en tienda" : "Todos"}
                </TPButton>
              </div>
            </div>

            {/* Limpiar filtros */}
            {activeFilterCount > 0 && (
              <div className="mt-3 flex justify-end">
                <TPButton
                  variant="ghost"
                  iconLeft={<X size={11} />}
                  onClick={() => {
                    setFilterType(""); setFilterCategoryId(""); setFilterStatus("");
                    setFilterStockMode(""); setFilterSku(""); setFilterShowInStore(false);
                    setFilterSupplierId(""); setBarcodeQ("");
                  }}
                  className="text-xs text-muted hover:text-primary"
                >
                  Limpiar filtros
                </TPButton>
              </div>
            )}
          </div>
        )}

        {/* ── Lista jerárquica de artículos ─────────────────────────────────── */}
        <TPTreeTable
          nodes={flatNodes as TreeNodeBase[]}
          columns={treeColumns}
          renderActions={renderTreeActions}
          expanded={expanded}
          onToggleExpand={(id) =>
            setExpanded((prev) => {
              const next = new Set(prev);
              next.has(id) ? next.delete(id) : next.add(id);
              return next;
            })
          }
          rowClassName={treeRowClassName}
          isSearching={isSearching}
          loading={loading}
          emptyText="No hay artículos que coincidan."
          indentPx={40}
        />

        <TPPagination
          page={page}
          pageSize={pageSize}
          total={total}
          onPageChange={handlePageChange}
          onPageSizeChange={handlePageSizeChange}
          countLabel={
            flatNodes.filter((n) => n.kind === "variant").length > 0
              ? `${flatNodes.filter((n) => n.kind === "article").length} artículo${flatNodes.filter((n) => n.kind === "article").length !== 1 ? "s" : ""} · ${flatNodes.filter((n) => n.kind === "variant").length} var. visibles`
              : undefined
          }
          pageSizeOptions={[25, 50, 100, 200]}
        />
      </TPTableWrap>

      {/* ── Confirm delete ─────────────────────────────────────────────────── */}
      <ConfirmDeleteDialog
        open={!!confirmDel}
        title="Eliminar artículo"
        description={
          confirmDel
            ? `¿Eliminar "${confirmDel.name}"? Esta acción no se puede deshacer.`
            : ""
        }
        onConfirm={() => confirmDel && handleDelete(confirmDel)}
        onClose={() => setConfirmDel(null)}
        busy={!!busyDel}
      />

      {/* ── Modal crear / editar artículo ──────────────────────────────────── */}
      <ArticleModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        articleId={modalArticleId}
        cloneData={modalCloneData as any}
        cloneCostLines={modalCloneCostLines}
        cloneCompositions={modalCloneCompositions}
        defaultType={modalDefaultType}
        onSaved={handleModalSaved}
      />

      {/* ── Modal importar ─────────────────────────────────────────────────── */}
      <ArticleImportModal
        open={importOpen}
        onClose={() => setImportOpen(false)}
        onImported={() => void load()}
      />

      {/* ── Modal etiquetas ────────────────────────────────────────────────── */}
      <LabelPrintModal
        open={labelsOpen}
        onClose={() => setLabelsOpen(false)}
        items={labelItems}
      />

      {/* ── Scanner overlay ─────────────────────────────────────────────────── */}
      <BarcodeScannerOverlay
        open={scannerOpen}
        onClose={() => setScannerOpen(false)}
      />
    </TPSectionShell>
  );
}
