// src/pages/InventarioArticulos.tsx
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import ArticleModal from "./article-detail/ArticleModal";
import ArticleImportModal from "./article-detail/ArticleImportModal";
import BulkHechuraModal from "./BulkHechuraModal";
import LabelPrintModal, { type LabelItem } from "./article-detail/LabelPrintModal";
import EditVariantModal from "./article-detail/EditVariantModal";
import ArticleGroupEditModal from "./article-detail/ArticleGroupEditModal";
import ViewVariantModal from "./article-detail/ViewVariantModal";
import type { ArticleDetail } from "../services/articles";
import {
  Package,
  Plus,
  Filter,
  Star,
  Layers,
  ScanBarcode,
  X,
  Upload,
  Download,
  Tag,
  Box,
  Wrench,
  Gem,
  Calculator,
  FolderOpen,
  Eye,
  EyeOff,
  RotateCcw,
  GitBranch,
  Trash2,
  Clock,
} from "lucide-react";

import { cn } from "../components/ui/tp";
import TPImageLightbox from "../components/ui/TPImageLightbox";
import { TPSectionShell }  from "../components/ui/TPSectionShell";
import { TPButton }        from "../components/ui/TPButton";
import { TPSearchInput }   from "../components/ui/TPSearchInput";
import { TPBadge }         from "../components/ui/TPBadges";
import { TPActiveBadge }   from "../components/ui/TPBadges";
import { TPRowActions }    from "../components/ui/TPRowActions";
import { TPActionsMenu }   from "../components/ui/TPActionsMenu";
import { usePersistedTableSort } from "../hooks/usePersistedTableSort";
import { TPIconButton }    from "../components/ui/TPIconButton";
import {
  TPTableWrap,
  TPTableHeader,
} from "../components/ui/TPTable";
import { TPTreeTable, type TreeColDef, type TreeNodeBase } from "../components/ui/TPTreeTable";
import { TPColumnPicker, type ColPickerDef } from "../components/ui/TPColumnPicker";
import { TPPagination } from "../components/ui/TPPagination";
import ConfirmDeleteDialog from "../components/ui/ConfirmDeleteDialog";
import { TPCheckbox } from "../components/ui/TPCheckbox";
import { selectableRowProps } from "../components/ui/selectableRow";
import { TPExpandToggle } from "../components/ui/TPExpandToggle";
import { TPFilterDrawer } from "../components/ui/TPFilterDrawer";
import { CategoryTreePicker } from "../components/ui/CategoryTreePicker";
import Modal from "../components/ui/Modal";
import TPSelect from "../components/ui/TPSelect";
import TPInput from "../components/ui/TPInput";
import TPComboFixed from "../components/ui/TPComboFixed";
import { TPArticleScopeSelect } from "../components/ui/TPArticleScopeSelect";
import { TPField } from "../components/ui/TPField";
import { SortArrows } from "../components/ui/TPSort";

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
  variantLabel,
  type ScopeItem,
} from "../services/articles";
import { categoriesApi, type CategoryRow } from "../services/categories";
import { buildCategoryTree, type CategoryNode } from "./configuracion-sistema/categorias-tree.helpers";
import { articleGroupsApi, groupsToComboOptions, type ArticleGroupRow } from "../services/article-groups";
import { getMetals, getVariants, type MetalRow, type MetalVariantRow } from "../services/valuation";
import { commercialEntitiesApi, type EntityRow } from "../services/commercial-entities";

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
   Búsqueda — helpers de matching
========================================================= */
function variantMatchesQuery(vv: ArticleVariant, query: string): boolean {
  if (!query) return false;
  const lower = query.toLowerCase();
  return (
    vv.sku.toLowerCase().includes(lower) ||
    vv.code.toLowerCase().includes(lower) ||
    vv.name.toLowerCase().includes(lower) ||
    (vv.barcode?.toLowerCase().includes(lower) ?? false) ||
    (vv.attributeValues?.some((av) => av.value.toLowerCase().includes(lower)) ?? false)
  );
}

function articleMatchesQuery(row: ArticleRow, query: string): boolean {
  if (!query) return false;
  const lower = query.toLowerCase();
  return (
    row.name.toLowerCase().includes(lower) ||
    row.code.toLowerCase().includes(lower) ||
    row.sku.toLowerCase().includes(lower) ||
    row.brand.toLowerCase().includes(lower) ||
    row.description.toLowerCase().includes(lower) ||
    (row.barcode?.toLowerCase().includes(lower) ?? false)
  );
}

/* =========================================================
   Columnas opcionales
========================================================= */
const COL_DEFS: ColPickerDef[] = [
  // Visibles por defecto
  { key: "tipo",         label: "Tipo" },
  { key: "estado",       label: "Estado" },
  { key: "category",     label: "Categoría" },
  { key: "supplier",     label: "Proveedor preferido" },
  { key: "cost",         label: "Costo" },
  { key: "price",        label: "Precio" },
  { key: "margen",       label: "Margen %" },
  { key: "stock",        label: "Stock" },
  { key: "hasVariants",  label: "Variantes" },
  { key: "unitOfMeasure", label: "Unidades" },
  // Ocultas por defecto
  { key: "group",        label: "Grupo comercial" },
  { key: "brand",        label: "Marca" },
  { key: "manufacturer", label: "Fabricante" },
  { key: "sku",          label: "SKU" },
  { key: "promo",        label: "Promociones" },
  { key: "discount",     label: "Desc. cantidad" },
  { key: "reorderPoint", label: "Punto de reposición" },
  { key: "minMaxQty",    label: "Cant. mín / máx" },
  { key: "notes",        label: "Notas" },
  { key: "taxes",        label: "Impuestos de compra" },
  { key: "showInStore",    label: "Mostrar en tienda" },
  { key: "returnable",     label: "Acepta devoluciones" },
  { key: "updatedAt",    label: "Última act." },
];

// Ocultas por defecto
const COL_VIS_DEFAULTS: Record<string, boolean> = {
  group:        false,
  brand:        false,
  manufacturer: false,
  sku:          true,
  promo:        false,
  discount:     false,
  reorderPoint: false,
  minMaxQty:    false,
  notes:        false,
  taxes:        false,
  showInStore:    false,
  returnable:     false,
  updatedAt:    false,
};

const COL_LS_KEY       = "tptech_col_inventario_articulos_v13";
const COL_ORDER_LS_KEY = "tptech_col_order_inventario_articulos_v13";
const WIDTHS_LS_KEY    = "tptech_articles_table_column_widths";

const DEFAULT_COL_WIDTHS: Record<string, number> = {
  main:         280,
  tipo:         112,
  estado:        96,
  stock:        128,
  cost:         140,
  price:        160,
  margen:       112,
  supplier:     144,
  category:     144,
  group:        128,
  reorderPoint: 128,
  minMaxQty:    144,
  notes:        200,
  promo:        112,
  discount:     160,
  brand:        128,
  manufacturer: 128,
  sku:          192,
  taxes:        160,
  hasVariants:  176,
  unitOfMeasure: 96,
  showInStore:   96,
  returnable:    96,
  updatedAt:    112,
};

const MIN_COL_WIDTHS: Record<string, number> = {
  main:         200,
  tipo:          72,
  estado:        72,
  stock:         72,
  cost:         100,
  price:        100,
  margen:        72,
  supplier:      90,
  category:      90,
  group:         72,
  reorderPoint:  90,
  minMaxQty:     90,
  notes:         90,
  promo:         72,
  discount:      90,
  brand:         72,
  manufacturer:  72,
  sku:           72,
  taxes:         90,
  hasVariants:  110,
  unitOfMeasure: 72,
  showInStore:   72,
  returnable:    72,
  updatedAt:     72,
};

/* ── draft de filtros (estado local del panel antes de "Aplicar") ──────── */
interface DraftFilters {
  type:           string;
  categoryId:     string;
  status:         string;
  stockMode:      string;
  supplierId:     string;
  groupId:        string;
  brand:          string;
  showInStore:    string;   // "" | "true" | "false"
  hasVariants:    string;   // "" | "true" | "false"
  metalId:        string;
  metalVariantId: string;
}
const EMPTY_DRAFT: DraftFilters = {
  type: "", categoryId: "", status: "", stockMode: "",
  supplierId: "", groupId: "", brand: "",
  showInStore: "", hasVariants: "",
  metalId: "", metalVariantId: "",
};

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

/** Badge "COMBO" — diferencia visualmente artículos commercialMode=COMBO_COMMERCIAL.
 *  Diseño: pill info con ícono de paquete agrupado, sin emojis. */
function ComboBadge() {
  return (
    <TPBadge tone="info" size="sm" className="gap-1" title="Combo comercial: precio y stock dependen de los componentes">
      <Package size={10} />
      COMBO
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
   buildCompositionView — helper compartido para Costo y Precio.
   Solo trazabilidad visual sobre `costComposition`. NO recalcula.
========================================================= */

type CompositionLine = NonNullable<ArticleRow["costComposition"]>[number];

function buildCompositionView(rawLines: CompositionLine[] | undefined) {
  const lines = (rawLines ?? []).filter(l => {
    const q = parseFloat(l.quantity)  || 0;
    const u = parseFloat(l.unitValue) || 0;
    return q > 0 || u > 0;
  });

  // ── Sub-línea compacta: "USD 74,76 · ARS 35.000 · AB102" ──
  // Reglas: máx 3 elementos, orden fijo (METAL → HECHURA → PRODUCT/SERVICE).
  // METAL/HECHURA: agregados por moneda (un item por currency code).
  // PRODUCT/SERVICE: identificador (código/SKU) sin valor.
  const summaryItems: string[] = [];
  const currencies = new Set<string>();

  const metalByCurr: Record<string, number> = {};
  for (const l of lines.filter(l => l.type === "METAL")) {
    const cur = l.currency?.code ?? "ARS";
    const qty = parseFloat(l.quantity)  || 0;
    const unit = parseFloat(l.unitValue) || 0;
    metalByCurr[cur] = (metalByCurr[cur] ?? 0) + qty * unit;
    currencies.add(cur);
  }
  for (const [cur, total] of Object.entries(metalByCurr)) {
    if (total > 0.005) summaryItems.push(`${cur} ${fmtNum(total)}`);
  }

  const hechByCurr: Record<string, number> = {};
  for (const l of lines.filter(l => l.type === "HECHURA")) {
    const cur = l.currency?.code ?? "ARS";
    const qty = parseFloat(l.quantity)  || 0;
    const unit = parseFloat(l.unitValue) || 0;
    hechByCurr[cur] = (hechByCurr[cur] ?? 0) + qty * unit;
    currencies.add(cur);
  }
  for (const [cur, total] of Object.entries(hechByCurr)) {
    if (total > 0.005) summaryItems.push(`${cur} ${fmtNum(total)}`);
  }

  for (const l of lines.filter(l => l.type === "PRODUCT" || l.type === "SERVICE")) {
    const id = (l.catalogItem?.code ?? l.catalogItem?.sku ?? l.catalogItem?.name ?? l.label ?? "").trim();
    if (id) summaryItems.push(id);
    currencies.add(l.currency?.code ?? "ARS");
  }

  const MAX = 3;
  const display = summaryItems.slice(0, MAX);
  if (summaryItems.length > MAX) display.push("…");
  const subline = display.join(" · ");

  // ── Tooltip — detalle completo, multi-línea por componente ──
  // Formato:
  //   METAL: AU18K · Oro 18K
  //   1 × USD 74,76 = USD 74,76
  const TYPE_LABEL: Record<string, string> = {
    METAL: "METAL", HECHURA: "HECHURA", PRODUCT: "PRODUCT",
    SERVICE: "SERVICE", MANUAL: "MANUAL", LOGISTICS: "LOGISTICS",
  };
  const blocks = lines.map(l => {
    const qty  = parseFloat(l.quantity)  || 0;
    const unit = parseFloat(l.unitValue) || 0;
    const subtotal = qty * unit;
    const cur  = l.currency?.code ?? "ARS";
    const head = TYPE_LABEL[l.type] ?? l.type;

    let identifier = "";
    if (l.type === "METAL") {
      const sku  = l.metalVariant?.sku ?? "";
      const nm   = [l.metalVariant?.metal?.name, l.metalVariant?.name].filter(Boolean).join(" ").trim();
      identifier = [sku, nm].filter(Boolean).join(" · ");
    } else if (l.type === "PRODUCT" || l.type === "SERVICE") {
      const sku  = l.catalogItem?.code ?? l.catalogItem?.sku ?? "";
      const nm   = l.catalogItem?.name ?? l.label ?? "";
      identifier = [sku, nm].filter(Boolean).join(" · ");
    } else {
      identifier = l.label ?? "";
    }

    const line1 = identifier ? `${head}: ${identifier}` : head;
    const line2 = `${fmtNum(qty)} × ${cur} ${fmtNum(unit)} = ${cur} ${fmtNum(subtotal)}`;
    return `${line1}\n${line2}`;
  });
  const tooltip = blocks.join("\n\n");

  return { lines, subline, tooltip, currencies: Array.from(currencies) };
}

/* =========================================================
   CompositionExtra — chip de monedas + sub-línea + tooltip.
   Render compartido para Costo y Precio.
========================================================= */

function CompositionExtra({
  view,
}: {
  view: ReturnType<typeof buildCompositionView>;
}) {
  if (!view.subline) return null;
  return (
    <div
      className="text-[10px] text-muted/70 mt-0.5 font-mono tabular-nums truncate"
      title={view.tooltip || undefined}
    >
      {view.currencies.length > 1 && (
        <span className="mr-1 px-1 rounded bg-muted/10 text-muted/80">
          {view.currencies.join("/")}
        </span>
      )}
      {view.subline}
    </div>
  );
}

/* =========================================================
   CostCellContent — celda de costo desglosada
========================================================= */

function CostCellContent({ row }: { row: ArticleRow }) {
  const base    = row.computedCostBase;
  const withTax = row.computedCostWithTax;
  if (!base) return <span className="text-muted/40">—</span>;
  const main   = withTax ?? base;
  const taxAmt = withTax ? parseFloat(withTax) - parseFloat(base) : 0;

  const view = buildCompositionView(row.costComposition);

  return (
    <div className="text-right" title={view.tooltip || undefined}>
      <div className="text-sm font-semibold tabular-nums">ARS {fmtNum(main)}</div>
      {taxAmt > 0.005 && (
        <div className="text-[10px] text-muted/60 tabular-nums mt-0.5">
          {fmtNum(base)} + {fmtNum(taxAmt.toFixed(2))} imp.
        </div>
      )}
      <CompositionExtra view={view} />
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
  if (stockMode === "NO_STOCK")    return { tone: "neutral", label: "Sin stock" };
  if (stockMode === "BY_MATERIAL") return { tone: "info",    label: "Material"   };
  if (qty === null)                return { tone: "neutral", label: "—"          };
  if (qty <= 0)                   return { tone: "danger",  label: "Agotado"    };
  const rp = reorderPoint != null ? parseFloat(String(reorderPoint)) : null;
  if (rp !== null && qty <= rp)   return { tone: "warning", label: `${fmtQty(qty)} bajo` };
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
  return <TPBadge tone="success" size="sm">Disponible</TPBadge>;
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
  const src      = (row.resolvedPriceSource ?? "NONE") as PriceSourceKey;
  const price    = row.resolvedSalePrice;
  const withTax  = row.resolvedSalePriceWithTax;
  const name     = row.resolvedPriceName;
  const cfg      = PRICE_SOURCE_CONFIG[src] ?? PRICE_SOURCE_CONFIG.NONE;
  if (!price || src === "NONE") return <span className="text-muted/40">—</span>;
  const main   = withTax ?? price;
  const taxAmt = withTax ? parseFloat(withTax) - parseFloat(price) : 0;
  const srcLabel = name ? `${cfg.label}: ${name}` : cfg.label;
  const srcColor =
    src === "PROMOTION"             ? "text-emerald-500 dark:text-emerald-400" :
    src.startsWith("PRICE_LIST")    ? "text-primary/70"                        :
    src.startsWith("MANUAL")        ? "text-amber-500"                         :
    "text-muted/60";

  const view = buildCompositionView(row.costComposition);
  const tooltip = [view.tooltip, srcLabel ? `\nFuente: ${srcLabel}` : ""].filter(Boolean).join("");

  return (
    <div className="text-right" title={tooltip || undefined}>
      <div className="text-sm font-semibold tabular-nums text-text">ARS {fmtNum(main)}</div>
      {taxAmt > 0.005 && (
        <div className="text-[10px] text-muted/60 tabular-nums mt-0.5">
          {fmtNum(price)} + {fmtNum(taxAmt.toFixed(2))} imp.
        </div>
      )}
      <CompositionExtra view={view} />
      {srcLabel && (
        <div className={cn("text-[10px] tabular-nums mt-0.5 truncate max-w-[180px] ml-auto", srcColor)}>
          {srcLabel}
        </div>
      )}
    </div>
  );
}

/* =========================================================
   MarginCellContent — columna de margen % (precio vs costo)
========================================================= */
function MarginCellContent({ row }: { row: ArticleRow }) {
  const price = row.resolvedSalePrice;
  const cost  = row.computedCostBase;
  if (!price || !cost) return <span className="text-muted/40">—</span>;
  const p = parseFloat(price);
  const c = parseFloat(cost);
  if (!isFinite(p) || !isFinite(c) || c === 0) return <span className="text-muted/40">—</span>;
  const margin = ((p - c) / c) * 100;
  const diff   = p - c;
  const isNeg  = margin < 0;
  return (
    <div className="text-right">
      <div className={cn(
        "tabular-nums text-sm font-semibold",
        isNeg ? "text-red-500 dark:text-red-400" : "text-emerald-600 dark:text-emerald-400",
      )}>
        {isNeg ? "" : "+"}{margin.toFixed(1)}%
      </div>
      <div className="text-[10px] text-muted/60 tabular-nums mt-0.5">
        ARS {fmtNum(diff.toFixed(2))}
      </div>
    </div>
  );
}

/* =========================================================
   ResizableHeader — wrapper que agrega handle de resize al <th>
========================================================= */
function ResizableHeader({
  colKey,
  children,
  onStartResize,
}: {
  colKey: string;
  children: React.ReactNode;
  onStartResize: (e: React.MouseEvent, colKey: string) => void;
}) {
  return (
    <div className="relative flex items-center gap-1 select-none" style={{ paddingRight: 10 }}>
      {children}
      <div
        className="absolute right-0 top-0 bottom-0 w-3 cursor-col-resize flex items-center justify-center group"
        onMouseDown={(e) => {
          e.preventDefault();
          e.stopPropagation();
          onStartResize(e, colKey);
        }}
        title="Arrastrar para ajustar ancho"
      >
        <div className="h-4 w-px bg-border group-hover:bg-primary/50 transition-colors" />
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
  const [lightboxSrc, setLightboxSrc] = useState<string | null>(null);
  const [rows,    setRows]    = useState<ArticleRow[]>([]);
  const [total,   setTotal]   = useState(0);
  const [loading, setLoading] = useState(false);
  const [categories,  setCategories]  = useState<CategoryRow[]>([]);
  const [groups,      setGroups]      = useState<ArticleGroupRow[]>([]);
  const [metals,      setMetals]      = useState<MetalRow[]>([]);
  const [suppliers,   setSuppliers]   = useState<EntityRow[]>([]);
  const [brandNames,  setBrandNames]  = useState<string[]>([]);
  /* Variantes del metal seleccionado en el draft del panel */
  const [draftMetalVariants,  setDraftMetalVariants]  = useState<MetalVariantRow[]>([]);
  /* Variantes del filtro aplicado (para labels en chips) */
  const [filterMetalVariants, setFilterMetalVariants] = useState<MetalVariantRow[]>([]);

  /* ── paginación ─────────────────────────────────────────────────────────── */
  const [page,     setPage]     = useState(1);
  const [pageSize, setPageSize] = useState(() => {
    const saved = parseInt(localStorage.getItem("tptech:pageSize:articles") ?? "", 10);
    return !isNaN(saved) && saved > 0 ? saved : 50;
  });

  /* ── filtros rápidos ───────────────────────────────────────────────────── */
  const [q,        setQ]       = useState("");
  const [barcodeQ, setBarcodeQ] = useState("");
  const [onlyFav,  setOnlyFav] = useState(false);

  /* ── ordenamiento (persistente en localStorage) ────────────────────────── */
  // El hook reemplaza useState + toggleSort manual y persiste la última columna
  // y dirección elegida por el usuario. Storage key dedicado para esta tabla.
  const { sortKey, sortDir, setSortKey, setSortDir, toggleSort } = usePersistedTableSort<string>({
    storageKey: "tptech_sort_articulos",
    defaultKey: "name",
    defaultDir: "asc",
    validKeys: [
      "name", "sku", "code", "cost", "price", "stock",
      "category", "supplier", "brand", "updatedAt",
    ],
  });

  /* ── filtros avanzados ─────────────────────────────────────────────────── */
  const [filtersOpen,          setFiltersOpen]          = useState(false);
  const [filterType,           setFilterType]           = useState("");
  const [filterCategoryId,     setFilterCategoryId]     = useState("");
  const [filterStatus,         setFilterStatus]         = useState("");
  const [filterStockMode,      setFilterStockMode]      = useState("");
  const [filterArticleIds,     setFilterArticleIds]     = useState<string[]>([]);
  const [filterScopeItems,     setFilterScopeItems]     = useState<ScopeItem[]>([]);
  const [draftScopeItems,      setDraftScopeItems]      = useState<ScopeItem[]>([]);
  const [filterShowInStore,    setFilterShowInStore]    = useState("");  // "" | "true" | "false"
  const [filterSupplierId,     setFilterSupplierId]     = useState("");
  const [filterGroupId,        setFilterGroupId]        = useState("");
  const [filterBrand,          setFilterBrand]          = useState("");
  const [filterHasVariants,    setFilterHasVariants]    = useState("");  // "" | "true" | "false"
  const [filterMetalId,        setFilterMetalId]        = useState("");
  const [filterMetalVariantId, setFilterMetalVariantId] = useState("");

  /* draft del panel de filtros */
  const [draft, setDraft] = useState<DraftFilters>(EMPTY_DRAFT);
  const setD = <K extends keyof DraftFilters>(key: K, value: DraftFilters[K]) =>
    setDraft((d) => ({ ...d, [key]: value }));

  /* ── árbol ─────────────────────────────────────────────────────────────── */
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  /* ── columnas ──────────────────────────────────────────────────────────── */
  const [colVis,   setColVis]   = useState<Record<string, boolean>>(loadColVis);
  const [colOrder, setColOrder] = useState<string[]>(loadColOrder);
  const [colWidths, setColWidths] = useState<Record<string, number>>(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(WIDTHS_LS_KEY) ?? "{}") as Record<string, number>;
      return { ...DEFAULT_COL_WIDTHS, ...saved };
    } catch { return { ...DEFAULT_COL_WIDTHS }; }
  });

  /* ── acciones busy ──────────────────────────────────────────────────────── */
  const [busyFav,    setBusyFav]    = useState<string | null>(null);
  const [busyToggle, setBusyToggle] = useState<string | null>(null);
  const [busyDel,    setBusyDel]    = useState<string | null>(null);
  const [confirmDel, setConfirmDel] = useState<ArticleRow | null>(null);

  /* ── barcode lookup ─────────────────────────────────────────────────────── */
  const [barcodeLoading, setBarcodeLoading] = useState(false);
  const [highlightId,    setHighlightId]    = useState<string | null>(null);
  const barcodeRef           = useRef<HTMLInputElement>(null);

  /* ── etiquetas: composición metálica ────────────────────────────────────── */
  function buildMetalWeights(compositions?: ArticleRow["costComposition"]): string | null {
    if (!compositions?.length) return null;
    const metalLines = compositions.filter(
      (c) => c.type === "METAL" && c.metalVariant && parseFloat(String(c.quantity)) > 0
    );
    if (!metalLines.length) return null;
    return metalLines
      .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0))
      .map((c) => {
        const metalName = c.metalVariant?.metal?.name ?? c.label;
        const alloyCode = c.metalVariant?.sku ? ` ${c.metalVariant.sku}` : "";
        const grams     = parseFloat(String(c.quantity))
          .toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
        return `${metalName}${alloyCode}: ${grams} g`;
      })
      .join("\n"); // multilinea — cada metal en su propia línea
  }

  /* ── etiquetas: helpers de campos ──────────────────────────────────────── */
  function buildDimensions(row: ArticleRow): string | null {
    const parts: string[] = [];
    if (row.dimensionLength) parts.push(parseFloat(row.dimensionLength).toLocaleString("es-AR", { maximumFractionDigits: 2 }));
    if (row.dimensionWidth)  parts.push(parseFloat(row.dimensionWidth).toLocaleString("es-AR", { maximumFractionDigits: 2 }));
    if (row.dimensionHeight) parts.push(parseFloat(row.dimensionHeight).toLocaleString("es-AR", { maximumFractionDigits: 2 }));
    if (parts.length === 0) return null;
    return `${parts.join("×")} ${row.dimensionUnit || "cm"}`;
  }

  function buildMainMetal(compositions?: ArticleRow["costComposition"]): string | null {
    const first = compositions?.find((c) => c.type === "METAL" && c.metalVariant);
    if (!first?.metalVariant) return null;
    const metalName = first.metalVariant.metal?.name ?? "";
    const variantName = first.metalVariant.name ?? "";
    return [metalName, variantName].filter(Boolean).join(" ") || null;
  }

  function buildPurityOrLey(compositions?: ArticleRow["costComposition"]): string | null {
    const first = compositions?.find((c) => c.type === "METAL" && c.metalVariant);
    if (!first?.metalVariant?.purity) return null;
    const n = parseFloat(first.metalVariant.purity);
    if (!isFinite(n)) return null;
    return String(Math.round(n * 1000));
  }

  function buildAttrsFromVariant(v: ArticleVariant): Record<string, string> {
    const map: Record<string, string> = {};
    for (const av of v.attributeValues ?? []) {
      if (av.value) map[av.assignment.definition.name] = av.value;
    }
    return map;
  }

  function buildAttrsSummary(v: ArticleVariant): string | null {
    const avs = v.attributeValues;
    if (!avs?.length) return null;
    const parts = [...avs]
      .filter((av) => av.value)
      .sort((a, b) => (a.assignment.sortOrder ?? 0) - (b.assignment.sortOrder ?? 0))
      .map((av) => `${av.assignment.definition.name}: ${av.value}`);
    return parts.length ? parts.join(" · ") : null;
  }

  function buildMetalMermaSummary(compositions?: ArticleRow["costComposition"]): string | null {
    if (!compositions?.length) return null;
    const metalLines = compositions.filter(
      (c) => c.type === "METAL" && c.metalVariant && parseFloat(String(c.mermaPercent ?? 0)) > 0
    );
    if (!metalLines.length) return null;
    return metalLines
      .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0))
      .map((c) => {
        const metalName = [c.metalVariant?.metal?.name, c.metalVariant?.name]
          .filter(Boolean).join(" ");
        const merma = parseFloat(String(c.mermaPercent));
        const mermaStr = merma.toLocaleString("es-AR", {
          minimumFractionDigits: 2, maximumFractionDigits: 2,
        });
        return `${metalName}: ${mermaStr}%`;
      })
      .join("\n");
  }

  /* ── modal importar / etiquetas / scanner ───────────────────────────────── */
  const [importOpen,      setImportOpen]      = useState(false);
  const [bulkHechuraOpen, setBulkHechuraOpen] = useState(false);
  const [labelsOpen,  setLabelsOpen]  = useState(false);
  const [exportingXlsx, setExportingXlsx] = useState(false);
  const [labelItems,     setLabelItems]     = useState<LabelItem[]>([]);
  const [selectedIds,          setSelectedIds]          = useState<Set<string>>(new Set());
  const [selectedVariantIds,   setSelectedVariantIds]   = useState<Set<string>>(new Set());
  const [busyBulk,             setBusyBulk]             = useState(false);
  const [confirmBulkDeactivate, setConfirmBulkDeactivate] = useState(false);
  const [confirmBulkDelete,    setConfirmBulkDelete]    = useState(false);
  const [bulkCategoryOpen,     setBulkCategoryOpen]     = useState(false);
  const [bulkCategoryVal,      setBulkCategoryVal]      = useState("");
  const [bulkGroupOpen,        setBulkGroupOpen]        = useState(false);
  const [bulkGroupVal,         setBulkGroupVal]         = useState("");
  const [quickGroupRow,        setQuickGroupRow]        = useState<ArticleRow | null>(null);

  function openLabels() {
    let items: LabelItem[] = [];
    if (selectedVariantIds.size > 0) {
      // Variantes seleccionadas individualmente
      items = rows.flatMap((row) =>
        (row.variants ?? [])
          .filter((v) => selectedVariantIds.has(v.id))
          .map((v) => ({
            id:                 v.id,
            code:               v.code,
            name:               `${row.name} — ${variantLabel(v)}`,
            barcode:            v.barcode,
            barcodeType:        v.barcodeType,
            costPrice:          v.costPrice,
            salePrice:          row.salePrice, // El precio es siempre del artículo padre
            variantName:        variantLabel(v),
            variantCode:        v.code,
            variantSku:         v.sku || null,
            sku:                row.sku || undefined,
            brand:              row.brand || undefined,
            weight:             v.weightOverride ?? row.weight,
            weightUnit:         row.weightUnit   || undefined,
            metalWeights:       buildMetalWeights(row.costComposition),
            // Atributos de variante
            attrs:              buildAttrsFromVariant(v),
            attributesSummary:  buildAttrsSummary(v),
            // Campos adicionales del artículo
            description:        row.description   || null,
            notes:              row.notes         || null,
            manufacturer:       row.manufacturer  || null,
            supplierName:       row.preferredSupplier?.displayName || null,
            categoryName:       row.category?.name || null,
            articleType:        row.articleType   || null,
            articleStatus:      row.status        || null,
            groupName:          row.group?.name   || null,
            hechuraPrice:       v.hechuraPriceOverride ?? row.hechuraPrice ?? null,
            mermaPercent:       row.mermaPercent  || null,
            stockTotal:         row.stockData?.byVariant?.[v.id] != null
                                  ? String(row.stockData.byVariant[v.id])
                                  : row.stockData?.total != null
                                  ? String(row.stockData.total) : null,
            reorderPoint:       v.reorderPoint    ?? row.reorderPoint ?? null,
            defaultQuantity:    v.defaultQuantity ?? row.defaultQuantity ?? null,
            unitOfMeasure:      row.unitOfMeasure || null,
            dimensions:         buildDimensions(row),
            mainMetal:          buildMainMetal(row.costComposition),
            purityOrLey:        buildPurityOrLey(row.costComposition),
            metalMermaSummary:  buildMetalMermaSummary(row.costComposition),
            resolvedAttributesSummary: buildAttrsSummary(v),
          }))
      );
    } else if (selectedIds.size > 0) {
      // Artículos seleccionados
      items = rows
        .filter((r) => selectedIds.has(r.id))
        .map((r) => ({
          id:               r.id,
          code:             r.code,
          name:             r.name,
          barcode:          r.barcode,
          barcodeType:      r.barcodeType,
          costPrice:        r.costPrice,
          salePrice:        r.salePrice,
          sku:              r.sku    || undefined,
          brand:            r.brand  || undefined,
          weight:           r.weight,
          weightUnit:       r.weightUnit || undefined,
          metalWeights:     buildMetalWeights(r.costComposition),
          description:      r.description   || null,
          notes:            r.notes         || null,
          manufacturer:     r.manufacturer  || null,
          supplierName:     r.preferredSupplier?.displayName || null,
          categoryName:     r.category?.name || null,
          articleType:      r.articleType   || null,
          articleStatus:    r.status        || null,
          groupName:        r.group?.name   || null,
          hechuraPrice:     r.hechuraPrice  || null,
          mermaPercent:     r.mermaPercent  || null,
          stockTotal:       r.stockData?.total != null ? String(r.stockData.total) : null,
          reorderPoint:     r.reorderPoint  || null,
          defaultQuantity:  r.defaultQuantity || null,
          unitOfMeasure:    r.unitOfMeasure || null,
          dimensions:       buildDimensions(r),
          mainMetal:        buildMainMetal(r.costComposition),
          purityOrLey:      buildPurityOrLey(r.costComposition),
          metalMermaSummary: buildMetalMermaSummary(r.costComposition),
        }));
    } else {
      // Sin selección: todos los artículos con barcode
      items = rows
        .filter((r) => r.barcode)
        .map((r) => ({
          id:               r.id,
          code:             r.code,
          name:             r.name,
          barcode:          r.barcode,
          barcodeType:      r.barcodeType,
          costPrice:        r.costPrice,
          salePrice:        r.salePrice,
          sku:              r.sku    || undefined,
          brand:            r.brand  || undefined,
          weight:           r.weight,
          weightUnit:       r.weightUnit || undefined,
          metalWeights:     buildMetalWeights(r.costComposition),
          description:      r.description   || null,
          notes:            r.notes         || null,
          manufacturer:     r.manufacturer  || null,
          supplierName:     r.preferredSupplier?.displayName || null,
          categoryName:     r.category?.name || null,
          articleType:      r.articleType   || null,
          articleStatus:    r.status        || null,
          groupName:        r.group?.name   || null,
          hechuraPrice:     r.hechuraPrice  || null,
          mermaPercent:     r.mermaPercent  || null,
          stockTotal:       r.stockData?.total != null ? String(r.stockData.total) : null,
          reorderPoint:     r.reorderPoint  || null,
          defaultQuantity:  r.defaultQuantity || null,
          unitOfMeasure:    r.unitOfMeasure || null,
          dimensions:       buildDimensions(r),
          mainMetal:        buildMainMetal(r.costComposition),
          purityOrLey:      buildPurityOrLey(r.costComposition),
          metalMermaSummary: buildMetalMermaSummary(r.costComposition),
        }));
    }
    setLabelItems(items);
    setLabelsOpen(true);
  }

  /* ── modal editar variante ─────────────────────────────────────────────── */
  const [editingVariant, setEditingVariant] = useState<{
    variant: ArticleVariant;
    articleRow: ArticleRow;
  } | null>(null);

  function handleVariantChange(updated: ArticleVariant) {
    setRows((prev) =>
      prev.map((row) => {
        if (!editingVariant || row.id !== editingVariant.articleRow.id) return row;
        return {
          ...row,
          variants: (row.variants ?? []).map((v) => (v.id === updated.id ? updated : v)),
        };
      })
    );
    // Mantener sincronizado el estado del modal para "Guardar y siguiente"
    setEditingVariant((prev) => (prev ? { ...prev, variant: updated } : null));
  }

  function handleSwitchVariant(nextVariantId: string) {
    if (!editingVariant) return;
    const nextVariant = editingVariant.articleRow.variants?.find((v) => v.id === nextVariantId);
    if (nextVariant) {
      setEditingVariant({ variant: nextVariant, articleRow: editingVariant.articleRow });
    }
  }

  /* ── modal ver variante ─────────────────────────────────────────────────── */
  const [viewingVariant, setViewingVariant] = useState<{
    variant: ArticleVariant;
    articleRow: ArticleRow;
  } | null>(null);

  /* ── eliminar variante ──────────────────────────────────────────────────── */
  const [confirmDelVariant, setConfirmDelVariant] = useState<{
    variant: ArticleVariant;
    articleRow: ArticleRow;
  } | null>(null);
  const [busyDelVariant, setBusyDelVariant] = useState(false);

  async function handleDeleteVariant() {
    if (!confirmDelVariant) return;
    const { variant, articleRow } = confirmDelVariant;
    setBusyDelVariant(true);
    try {
      await articlesApi.variants.remove(articleRow.id, variant.id);
      setRows((prev) =>
        prev.map((row) => {
          if (row.id !== articleRow.id) return row;
          return {
            ...row,
            variants: (row.variants ?? []).filter((v) => v.id !== variant.id),
          };
        })
      );
      toast.success("Variante eliminada.");
      setConfirmDelVariant(null);
    } catch (err: any) {
      toast.error(err?.message || "Error al eliminar la variante.");
    } finally {
      setBusyDelVariant(false);
    }
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
    // Clonado profesional: el backend hace la copia profunda en una sola
    // transacción (variantes, atributos, imágenes, composición, grupo) y
    // devuelve el artículo nuevo. El frontend solo refresca el listado y
    // abre el clon en modo edición.
    try {
      const cloned = await articlesApi.clone(row.id);
      toast.success(`Artículo "${cloned.name}" creado.`);
      reloadRef.current();
      setModalCloneCostLines([]);
      setModalCloneCompositions([]);
      setModalCloneData(undefined);
      setModalDefaultType(undefined);
      setModalArticleId(cloned.id);
      setModalOpen(true);
    } catch (e: any) {
      toast.error(e?.message || "No se pudo clonar el artículo.");
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
        ids:                 filterArticleIds.length ? filterArticleIds : undefined,
        showInStore:         filterShowInStore === "true" ? true : filterShowInStore === "false" ? false : undefined,
        preferredSupplierId: filterSupplierId || undefined,
        groupId:             filterGroupId || undefined,
        brand:               filterBrand || undefined,
        hasVariants:         filterHasVariants === "true" ? true : filterHasVariants === "false" ? false : undefined,
        metalId:             filterMetalId || undefined,
        metalVariantId:      filterMetalVariantId || undefined,
        isFavorite:          onlyFav || undefined,
        showInActive:        filterStatus !== "" || undefined,
        barcode:             opts.barcode,
        page:                opts.pg,
        pageSize:            opts.ps,
        sortKey,
        sortDir,
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

  // Ref estable que siempre apunta a la versión más reciente de fetchArticles con pg:1
  // Evita closures desactualizadas en el setTimeout del debounce
  const filterFetchRef = useRef<() => void>(() => {});
  filterFetchRef.current = () => void fetchArticles({ pg: 1, ps: pageSizeRef.current });

  const load = useCallback((opts?: { barcode?: string }) => {
    void fetchArticles({ pg: pageRef.current, ps: pageSizeRef.current, ...opts });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q, filterType, filterCategoryId, filterStatus, filterStockMode, filterArticleIds,
      filterShowInStore, filterSupplierId, filterGroupId, filterBrand, filterHasVariants,
      filterMetalId, filterMetalVariantId, onlyFav, sortKey, sortDir]);

  // Carga inicial
  useEffect(() => { void fetchArticles({ pg: 1, ps: pageSize }); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Sidebar quick-create
  useEffect(() => {
    function onQuickCreate(e: Event) {
      const { screen } = (e as CustomEvent).detail ?? {};
      if (screen === "articulos") openCreate();
    }
    window.addEventListener("tptech:sidebar_quick_create", onQuickCreate);
    return () => window.removeEventListener("tptech:sidebar_quick_create", onQuickCreate);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Recarga al cambiar filtros con debounce — vuelve a página 1
  // Usa filterFetchRef para garantizar que siempre se llama fetchArticles
  // con los valores de filtros más recientes (evita stale closures)
  useEffect(() => {
    setPage(1);
    const t = setTimeout(() => filterFetchRef.current(), 300);
    return () => clearTimeout(t);
  }, [q, filterType, filterCategoryId, filterStatus, filterStockMode, filterArticleIds,
      filterShowInStore, filterSupplierId, filterGroupId, filterBrand, filterHasVariants,
      filterMetalId, filterMetalVariantId, onlyFav, sortKey, sortDir]);

  // Cargar datos de apoyo para filtros
  useEffect(() => {
    categoriesApi.list().then((rows) => setCategories(rows)).catch(() => {});
    articleGroupsApi.list().then((rows) => setGroups(rows)).catch(() => {});
    getMetals().then((data: any) => setMetals(Array.isArray(data) ? data : (data?.rows ?? []))).catch(() => {});
    commercialEntitiesApi.list({ role: "supplier", take: 200 })
      .then((res) => setSuppliers(res.rows)).catch(() => {});
    articlesApi.listBrands().then((res) => setBrandNames(res.brands ?? [])).catch(() => {});
  }, []);

  // Opciones de categoría en árbol jerárquico (mismo patrón que ConfiguracionSistemaCategorias)
  const categoryTreeOptions = useMemo(() => {
    const tree = buildCategoryTree(categories);
    const result: { value: string; label: string; depth: number }[] = [];
    function traverse(nodes: CategoryNode[]) {
      for (const node of nodes) {
        result.push({ value: node.id, label: node.name, depth: node.level });
        traverse(node.children);
      }
    }
    traverse(tree);
    return result;
  }, [categories]);

  // Cargar variantes cuando cambia el metal en el draft (para el combo del panel)
  useEffect(() => {
    if (!draft.metalId) { setDraftMetalVariants([]); return; }
    getVariants(draft.metalId, { isActive: true })
      .then((data: any) => setDraftMetalVariants(Array.isArray(data) ? data : (data?.rows ?? [])))
      .catch(() => {});
  }, [draft.metalId]);

  // Cargar variantes del filtro aplicado (para etiqueta en chip)
  useEffect(() => {
    if (!filterMetalId) { setFilterMetalVariants([]); return; }
    getVariants(filterMetalId, { isActive: true })
      .then((data: any) => setFilterMetalVariants(Array.isArray(data) ? data : (data?.rows ?? [])))
      .catch(() => {});
  }, [filterMetalId]);

  /* ── árbol ─────────────────────────────────────────────────────────────── */
  const isSearching = q.length > 0 || filterType !== "" || filterCategoryId !== ""
    || filterStatus !== "" || filterStockMode !== "" || filterArticleIds.length > 0
    || filterShowInStore !== "" || filterSupplierId !== "" || filterGroupId !== ""
    || filterBrand !== "" || filterHasVariants !== "" || onlyFav
    || filterMetalId !== "" || filterMetalVariantId !== "";

  const flatNodes = useMemo<AnyNode[]>(() => {
    const nodes: AnyNode[] = [];
    // Modo búsqueda inteligente: activo solo cuando hay texto en el buscador
    const isSmartFilter = q.trim().length > 0;

    for (const row of rows) {
      const hasVariants = Array.isArray(row.variants) && row.variants.length > 0;

      // En modo smart filter, calcular qué variantes mostrar
      let variantsToShow: ArticleVariant[] = hasVariants ? row.variants! : [];
      if (isSmartFilter && hasVariants) {
        if (articleMatchesQuery(row, q)) {
          // El artículo coincide por sus propios campos → mostrar todas sus variantes,
          // pero con las que también coinciden al inicio
          variantsToShow = [...row.variants!].sort((a, b) => {
            const aMatch = variantMatchesQuery(a, q) ? 0 : 1;
            const bMatch = variantMatchesQuery(b, q) ? 0 : 1;
            return aMatch - bMatch || a.sortOrder - b.sortOrder;
          });
        } else {
          // Solo hay coincidencia en variante(s) → mostrar únicamente las que coinciden
          variantsToShow = row.variants!.filter((vv) => variantMatchesQuery(vv, q));
        }
      }

      const articleNode: ArticleNode = {
        kind: "article",
        id: row.id,
        level: 0,
        // children refleja las variantes visibles para que el chevron sea correcto
        children: variantsToShow.map((vv) => ({ id: `variant__${vv.id}` })),
        row,
      };
      nodes.push(articleNode);

      // Mostrar variantes: si está expandido, si hay filtros activos, o en smart filter
      if ((expanded.has(row.id) || isSearching) && variantsToShow.length > 0) {
        for (const vv of variantsToShow) {
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
  }, [rows, expanded, isSearching, q]);

  /* ── selección masiva: estado derivado ────────────────────────────────── */
  const articleIds  = useMemo(() => rows.map((r) => r.id), [rows]);
  const allSelected = articleIds.length > 0 && articleIds.every((aid) => selectedIds.has(aid));
  // someSelected también considera variantes individuales seleccionadas
  const someSelected = !allSelected && (articleIds.some((aid) => selectedIds.has(aid)) || selectedVariantIds.size > 0);

  // Cantidad de variantes que se eliminarán al hacer bulk delete (para el confirm)
  const bulkDeleteVariantCount = useMemo(
    () => rows.filter((r) => selectedIds.has(r.id)).reduce((sum, r) => sum + (r.variants?.length ?? 0), 0),
    [rows, selectedIds],
  );

  /* IDs de artículos que tienen variantes (para expand/collapse all) */
  const allVariantArticleIds = useMemo(
    () => new Set(rows.filter((r) => (r.variants?.length ?? 0) > 0).map((r) => r.id)),
    [rows],
  );

  const isAllExpanded = useMemo(
    () => allVariantArticleIds.size > 0 && [...allVariantArticleIds].every((id) => expanded.has(id)),
    [allVariantArticleIds, expanded],
  );

  // Limpiar selección automáticamente cuando cambia la página, sort o filtros
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { setSelectedIds(new Set()); setSelectedVariantIds(new Set()); }, [rows]);

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
      const varCount = row.variants?.length ?? 0;
      setRows((prev) => prev.filter((r) => r.id !== row.id));
      setTotal((t) => t - 1);
      setConfirmDel(null);
      // Limpiar selección del padre y sus variantes del estado local
      setSelectedIds((prev) => { const next = new Set(prev); next.delete(row.id); return next; });
      setSelectedVariantIds((prev) => {
        const next = new Set(prev);
        (row.variants ?? []).forEach((v) => next.delete(v.id));
        return next;
      });
      toast.success(`Artículo eliminado${varCount > 0 ? ` junto con ${varCount} variante${varCount !== 1 ? "s" : ""}` : ""}.`);
    } catch (e: any) {
      toast.error(e?.message || "Error al eliminar artículo.");
    } finally { setBusyDel(null); }
  }

  /* ── acciones masivas ──────────────────────────────────────────────────── */
  async function handleBulkAction(data: { isActive?: boolean; isFavorite?: boolean; categoryId?: string; groupId?: string; showInStore?: boolean; isReturnable?: boolean; sellWithoutVariants?: boolean }) {
    const ids = Array.from(selectedIds);
    if (!ids.length) return;
    setBusyBulk(true);
    // Resolver objetos de nombre para actualizar columnas visibles
    const newCategoryObj = "categoryId" in data
      ? (categories.find((c) => c.id === data.categoryId) ?? null)
      : undefined;
    const newGroupObj = "groupId" in data
      ? (groups.find((g) => g.id === data.groupId) ?? null)
      : undefined;
    try {
      await articlesApi.bulk(ids, data);
      // Actualizar estado local sin refetch
      setRows((prev) => prev.map((r) =>
        selectedIds.has(r.id)
          ? { ...r,
              ...("isActive"            in data ? { isActive:            data.isActive! }            : {}),
              ...("isFavorite"          in data ? { isFavorite:          data.isFavorite! }          : {}),
              ...("categoryId"          in data ? { categoryId:          data.categoryId!,
                                                    category: newCategoryObj ? { id: newCategoryObj.id, name: newCategoryObj.name } : null } : {}),
              ...("groupId"             in data ? { groupId:             data.groupId!,
                                                    group: newGroupObj ? { id: newGroupObj.id, name: newGroupObj.name, slug: newGroupObj.slug } : null } : {}),
              ...("showInStore"         in data ? { showInStore:         data.showInStore! }         : {}),
              ...("isReturnable"        in data ? { isReturnable:        data.isReturnable! }        : {}),
              ...("sellWithoutVariants" in data ? { sellWithoutVariants: data.sellWithoutVariants! } : {}),
            }
          : r
      ));
      const n = ids.length;
      if ("isActive"            in data) toast.success(data.isActive ? `${n} artículo${n !== 1 ? "s" : ""} activado${n !== 1 ? "s" : ""}.` : `${n} artículo${n !== 1 ? "s" : ""} desactivado${n !== 1 ? "s" : ""}.`);
      if ("isFavorite"          in data) toast.success(data.isFavorite ? `${n} marcado${n !== 1 ? "s" : ""} como favorito.` : `${n} quitado${n !== 1 ? "s" : ""} de favoritos.`);
      if ("categoryId"          in data) toast.success(`Categoría actualizada en ${n} artículo${n !== 1 ? "s" : ""}.`);
      if ("groupId"             in data) toast.success(`Grupo actualizado en ${n} artículo${n !== 1 ? "s" : ""}.`);
      if ("showInStore"         in data) toast.success(data.showInStore ? `${n} artículo${n !== 1 ? "s" : ""} mostrado${n !== 1 ? "s" : ""} en tienda.` : `${n} artículo${n !== 1 ? "s" : ""} ocultado${n !== 1 ? "s" : ""} de tienda.`);
      if ("isReturnable"        in data) toast.success(data.isReturnable ? `${n} artículo${n !== 1 ? "s" : ""}: acepta devoluciones.` : `${n} artículo${n !== 1 ? "s" : ""}: no acepta devoluciones.`);
      if ("sellWithoutVariants" in data) toast.success(data.sellWithoutVariants ? `${n} artículo${n !== 1 ? "s" : ""}: venta sin variantes habilitada.` : `${n} artículo${n !== 1 ? "s" : ""}: requiere variante para vender.`);
      setSelectedIds(new Set());
      setSelectedVariantIds(new Set());
    } catch (e: any) {
      toast.error(e?.message || "Error al aplicar acción masiva.");
    } finally {
      setBusyBulk(false);
    }
  }

  async function handleBulkDelete() {
    const ids = Array.from(selectedIds);
    if (!ids.length) return;
    setBusyBulk(true);
    try {
      const result = await articlesApi.bulkRemove(ids);
      setRows((prev) => prev.filter((r) => !selectedIds.has(r.id)));
      setTotal((t) => t - result.deleted);
      setSelectedIds(new Set());
      setSelectedVariantIds(new Set());
      setConfirmBulkDelete(false);
      const n = result.deleted;
      const v = result.variantsDeleted;
      toast.success(
        `${n} artículo${n !== 1 ? "s" : ""} eliminado${n !== 1 ? "s" : ""}` +
        (v > 0 ? ` junto con ${v} variante${v !== 1 ? "s" : ""}` : "") + "."
      );
    } catch (e: any) {
      toast.error(e?.message || "Error al eliminar artículos.");
    } finally {
      setBusyBulk(false);
    }
  }

  async function handleExportGuided() {
    setExportingXlsx(true);
    try {
      await articlesApi.import.downloadGuidedExport();
    } catch (e: any) {
      toast.error(e?.message || "Error al exportar artículos.");
    } finally {
      setExportingXlsx(false);
    }
  }

  /* ── paginación handlers ────────────────────────────────────────────────── */
  function handlePageChange(p: number) {
    setPage(p);
    void fetchArticles({ pg: p, ps: pageSizeRef.current });
  }
  function handlePageSizeChange(s: number) {
    setPageSize(s);
    setPage(1);
    try { localStorage.setItem("tptech:pageSize:articles", String(s)); } catch {}
    void fetchArticles({ pg: 1, ps: s });
  }

  /* ── panel de filtros: abrir / aplicar / limpiar ───────────────────────── */
  function openFiltersPanel() {
    setDraft({
      type:           filterType,
      categoryId:     filterCategoryId,
      status:         filterStatus,
      stockMode:      filterStockMode,
      supplierId:     filterSupplierId,
      groupId:        filterGroupId,
      brand:          filterBrand,
      showInStore:    filterShowInStore,
      hasVariants:    filterHasVariants,
      metalId:        filterMetalId,
      metalVariantId: filterMetalVariantId,
    });
    setDraftScopeItems([...filterScopeItems]);
    setFiltersOpen(true);
  }

  function applyFilters() {
    setFilterType(draft.type);
    setFilterCategoryId(draft.categoryId);
    setFilterStatus(draft.status);
    setFilterStockMode(draft.stockMode);
    const ids = [...new Set(draftScopeItems.map(i => i.kind === "ARTICLE" ? i.id : i.articleId))];
    setFilterArticleIds(ids);
    setFilterScopeItems([...draftScopeItems]);
    setFilterSupplierId(draft.supplierId);
    setFilterGroupId(draft.groupId);
    setFilterBrand(draft.brand);
    setFilterShowInStore(draft.showInStore);
    setFilterHasVariants(draft.hasVariants);
    setFilterMetalId(draft.metalId);
    setFilterMetalVariantId(draft.metalVariantId);
    setFiltersOpen(false);
  }

  function clearAllFilters() {
    setDraft(EMPTY_DRAFT);
    setFilterType(""); setFilterCategoryId(""); setFilterStatus("");
    setFilterStockMode(""); setFilterArticleIds([]); setFilterScopeItems([]); setDraftScopeItems([]);
    setFilterSupplierId("");
    setFilterGroupId(""); setFilterBrand("");
    setFilterShowInStore(""); setFilterHasVariants("");
    setFilterMetalId(""); setFilterMetalVariantId("");
    setBarcodeQ("");
  }

  /* ── chips de filtros activos ────────────────────────────────────────────── */
  const activeChips: Array<{ key: string; label: string; onRemove: () => void }> = [];
  if (filterType)       activeChips.push({ key: "type",    label: `Tipo: ${filterType === "PRODUCT" ? "Producto" : "Servicio"}`,   onRemove: () => setFilterType("") });
  if (filterStatus)     activeChips.push({ key: "status",  label: `Estado: ${{ DRAFT: "Borrador", ACTIVE: "Activo", DISCONTINUED: "Discontinuado", ARCHIVED: "Archivado" }[filterStatus] ?? filterStatus}`, onRemove: () => setFilterStatus("") });
  if (filterStockMode)  activeChips.push({ key: "stockMode", label: `Stock: ${filterStockMode === "NO_STOCK" ? "Sin stock" : "Por artículo"}`, onRemove: () => setFilterStockMode("") });
  if (filterShowInStore === "true")  activeChips.push({ key: "showInStore", label: "En tienda: Sí",  onRemove: () => setFilterShowInStore("") });
  if (filterShowInStore === "false") activeChips.push({ key: "showInStore", label: "En tienda: No",  onRemove: () => setFilterShowInStore("") });
  if (filterHasVariants === "true")  activeChips.push({ key: "hasVariants", label: "Con variantes",  onRemove: () => setFilterHasVariants("") });
  if (filterHasVariants === "false") activeChips.push({ key: "hasVariants", label: "Sin variantes",  onRemove: () => setFilterHasVariants("") });
  if (filterScopeItems.length > 0) activeChips.push({
    key: "articleIds",
    label: filterScopeItems.length === 1
      ? `Artículo: ${filterScopeItems[0].name}`
      : `Artículos: ${filterScopeItems.length}`,
    onRemove: () => { setFilterArticleIds([]); setFilterScopeItems([]); },
  });
  if (filterBrand)  activeChips.push({ key: "brand", label: `Marca: ${filterBrand}`, onRemove: () => setFilterBrand("") });
  if (filterCategoryId) {
    const cat = categories.find((c) => c.id === filterCategoryId);
    activeChips.push({ key: "categoryId", label: `Categoría: ${cat?.name ?? "…"}`, onRemove: () => setFilterCategoryId("") });
  }
  if (filterGroupId) {
    const grp = groups.find((g) => g.id === filterGroupId);
    activeChips.push({ key: "groupId", label: `Grupo: ${grp?.name ?? "…"}`, onRemove: () => setFilterGroupId("") });
  }
  if (filterSupplierId) {
    const sup = suppliers.find((s) => s.id === filterSupplierId);
    activeChips.push({ key: "supplierId", label: `Proveedor: ${sup?.displayName ?? "…"}`, onRemove: () => setFilterSupplierId("") });
  }
  if (filterMetalId) {
    const metal = metals.find((m) => m.id === filterMetalId);
    activeChips.push({ key: "metalId", label: `Metal: ${metal?.name ?? "…"}`, onRemove: () => { setFilterMetalId(""); setFilterMetalVariantId(""); } });
  }
  if (filterMetalVariantId) {
    const variant = filterMetalVariants.find((v) => v.id === filterMetalVariantId);
    activeChips.push({ key: "metalVariantId", label: `Variante: ${variant?.name ?? "…"}`, onRemove: () => setFilterMetalVariantId("") });
  }
  if (barcodeQ) activeChips.push({ key: "barcode", label: `Código: ${barcodeQ}`, onRemove: () => setBarcodeQ("") });

  /* ── filtros activos count ──────────────────────────────────────────────── */
  const activeFilterCount = activeChips.length;

  /* ── helpers columnas ────────────────────────────────────────────────────── */
  function isVisible(key: string) { return v(colVis, key); }

  function startResize(e: React.MouseEvent, colKey: string) {
    e.preventDefault();
    const startX = e.clientX;
    const startWidth = colWidths[colKey] ?? DEFAULT_COL_WIDTHS[colKey] ?? 120;
    const minW = MIN_COL_WIDTHS[colKey] ?? 72;
    document.body.style.userSelect = "none";
    document.body.style.cursor = "col-resize";

    function onMove(mv: MouseEvent) {
      const newW = Math.max(minW, Math.round(startWidth + mv.clientX - startX));
      setColWidths((prev) => ({ ...prev, [colKey]: newW }));
    }

    function onUp() {
      document.body.style.userSelect = "";
      document.body.style.cursor = "";
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onUp);
      setColWidths((prev) => {
        try { localStorage.setItem(WIDTHS_LS_KEY, JSON.stringify(prev)); } catch {}
        return prev;
      });
    }

    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
  }

  /* ── celda principal: artículo ──────────────────────────────────────────── */
  function articleMainCell(node: ArticleNode) {
    const row = node.row;
    const imgSrc = row.mainImageUrl || null;

    return (
      <div className="flex items-center gap-3 py-1 min-w-0">
        {/* Checkbox de selección — cascada a variantes hijas */}
        {(() => {
          const varIds = (row.variants ?? []).map((v) => v.id);
          const someVarsSelected = varIds.some((vid) => selectedVariantIds.has(vid));
          const isChecked  = selectedIds.has(row.id);
          const isIndet    = !isChecked && someVarsSelected;
          function toggle() {
            const selecting = !isChecked;
            setSelectedIds((prev) => {
              const next = new Set(prev);
              selecting ? next.add(row.id) : next.delete(row.id);
              return next;
            });
            setSelectedVariantIds((prev) => {
              const next = new Set(prev);
              if (selecting) { varIds.forEach((vid) => next.add(vid)); }
              else           { varIds.forEach((vid) => next.delete(vid)); }
              return next;
            });
          }
          return (
            <span onClick={(e) => e.stopPropagation()} {...selectableRowProps({ onToggle: toggle })}>
              <TPCheckbox
                checked={isChecked}
                indeterminate={isIndet}
                onChange={toggle}
              />
            </span>
          );
        })()}

        {/* Miniatura del artículo */}
        <div className="shrink-0">
          {imgSrc ? (
            <button
              type="button"
              className="cursor-zoom-in rounded-md overflow-hidden"
              onClick={(e) => { e.stopPropagation(); setLightboxSrc(imgSrc); }}
              title="Ver imagen"
            >
              <img
                src={imgSrc}
                alt=""
                className="w-9 h-9 rounded-md object-cover border border-border"
              />
            </button>
          ) : (
            <div className="w-9 h-9 rounded-md bg-surface2 border border-border flex items-center justify-center">
              <Package size={14} className="text-muted opacity-40" />
            </div>
          )}
        </div>

        {/* Nombre del artículo */}
        <div className="flex-1 min-w-0">
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); navigate(`/articulos/${row.id}`); }}
            className="font-semibold text-sm text-text hover:text-primary transition-colors text-left truncate w-full block min-w-0"
            title={row.name}
          >
            {row.name}
          </button>
          {(row.sku || !!row.variants?.length) && (
            <div className="flex items-center gap-1.5 text-[11px] text-muted leading-none mt-0.5 truncate">
              {row.sku && <span className="font-mono">{row.sku}</span>}
              {row.sku && !!row.variants?.length && <span className="opacity-40">·</span>}
              {!!row.variants?.length && (
                <span>
                  {row.variants.length === 1 ? "1 variante" : `${row.variants.length} variantes`}
                </span>
              )}
            </div>
          )}
        </div>
      </div>
    );
  }

  /* ── celda principal: variante ──────────────────────────────────────────── */
  function variantMainCell(node: VariantNode) {
    const vv = node.variant;
    const parentRow = node.row;
    const isMatch = q ? variantMatchesQuery(vv, q) : false;

    // Imagen: galería propia → imageUrl legacy → artículo padre (con opacidad)
    const ownImgSrc = vv.images?.find(i => i.isMain)?.url ?? vv.images?.[0]?.url ?? (vv.imageUrl || null);
    const displayImgSrc = ownImgSrc ?? parentRow.mainImageUrl;
    const isImgFallback = !ownImgSrc && !!parentRow.mainImageUrl;

    function toggleVariant() {
      const allParentVarIds = (parentRow.variants ?? []).map((v) => v.id);
      const isSelecting     = !selectedVariantIds.has(vv.id);
      const newVarIds = new Set(selectedVariantIds);
      isSelecting ? newVarIds.add(vv.id) : newVarIds.delete(vv.id);
      const allParentVarsNowSelected =
        allParentVarIds.length > 0 &&
        allParentVarIds.every((vid) => newVarIds.has(vid));
      setSelectedVariantIds(newVarIds);
      setSelectedIds((prev) => {
        const next = new Set(prev);
        allParentVarsNowSelected ? next.add(parentRow.id) : next.delete(parentRow.id);
        return next;
      });
    }

    return (
      <div className="flex items-center gap-3 py-0.5 min-w-0">
        {/* Checkbox variante — sincroniza selección del padre */}
        <span onClick={(e) => e.stopPropagation()} {...selectableRowProps({ onToggle: toggleVariant })}>
          <TPCheckbox
            checked={selectedVariantIds.has(vv.id)}
            onChange={toggleVariant}
          />
        </span>
        {/* Imagen variante 36×36 */}
        <div className="shrink-0">
          {displayImgSrc ? (
            <button
              type="button"
              className="cursor-zoom-in rounded-md overflow-hidden"
              onClick={(e) => { e.stopPropagation(); setLightboxSrc(displayImgSrc); }}
              title={isImgFallback ? "Ver imagen del artículo padre" : "Ver imagen"}
            >
              <img
                src={displayImgSrc}
                alt=""
                className={cn(
                  "w-9 h-9 rounded-md object-cover border border-border",
                  isImgFallback && "opacity-35"
                )}
              />
            </button>
          ) : (
            <div className="w-9 h-9 rounded-md bg-surface2 border border-border flex items-center justify-center">
              <Layers size={12} className="text-muted" />
            </div>
          )}
        </div>

        {/* Info variante */}
        <div className="flex-1 min-w-0">
          {/* Línea 1: atributos de eje (ej: "Oro 18K · Talle 12") */}
          <div className="flex items-center gap-2 flex-wrap">
            {isMatch && (
              <span className="w-2 h-2 rounded-full bg-primary shrink-0" title="Coincide con la búsqueda" />
            )}
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); setViewingVariant({ variant: vv, articleRow: parentRow }); }}
              className={cn(
                "text-sm truncate text-left hover:text-primary transition-colors",
                isMatch ? "font-semibold text-text" : "font-medium text-text opacity-90"
              )}
              title={variantLabel(vv)}
            >
              {variantLabel(vv)}
            </button>
          </div>

          {/* Línea 2: SKU + barcode */}
          {(vv.sku || vv.barcode) && (
            <div className="flex items-center gap-1.5 mt-0.5 text-[11px] text-muted leading-none truncate">
              {vv.sku && <span className="font-mono">{vv.sku}</span>}
              {vv.sku && vv.barcode && <span className="opacity-40">·</span>}
              {vv.barcode && (
                <span className="flex items-center gap-0.5 text-muted opacity-70">
                  <ScanBarcode size={9} />{vv.barcode}
                </span>
              )}
            </div>
          )}
        </div>
      </div>
    );
  }

  /* ── columnas TPTreeTable ─────────────────────────────────────────────────── */
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const treeColumns = useMemo<TreeColDef[]>(() => {
    const SortHeader = ({ colKey, label }: { colKey: string; label: string }) => (
      <button
        type="button"
        onClick={() => toggleSort(colKey)}
        className="flex items-center gap-1 text-xs cursor-pointer hover:text-text transition-colors select-none"
      >
        {label}
        <SortArrows active={sortKey === colKey} dir={sortDir} />
      </button>
    );

    const mainCol: TreeColDef = {
      key: "main",
      thStyle: { width: colWidths.main, minWidth: MIN_COL_WIDTHS.main },
      header: (
        <ResizableHeader colKey="main" onStartResize={startResize}>
          <div className="flex items-center gap-2">
            <TPCheckbox
              checked={allSelected}
              indeterminate={someSelected}
              onChange={(v) => {
                if (v) {
                  setSelectedIds(new Set(articleIds));
                  // También seleccionar todas las variantes visibles
                  setSelectedVariantIds(new Set(rows.flatMap((r) => (r.variants ?? []).map((vv) => vv.id))));
                } else {
                  setSelectedIds(new Set());
                  setSelectedVariantIds(new Set());
                }
              }}
              title={allSelected ? "Deseleccionar todo" : "Seleccionar todo"}
            />
            <SortHeader colKey="name" label="Artículo" />
          </div>
        </ResizableHeader>
      ),
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
        thStyle: { width: colWidths.tipo, minWidth: MIN_COL_WIDTHS.tipo },
        header: <ResizableHeader colKey="tipo" onStartResize={startResize}><SortHeader colKey="articleType" label="Tipo" /></ResizableHeader>,
        visible: isVisible("tipo"),
        className: "text-center align-top",
        renderCell: (raw) => {
          const node = raw as AnyNode;
          if (node.kind === "article") {
            const isCombo = node.row.commercialMode === "COMBO_COMMERCIAL";
            return (
              <div className="flex flex-col items-center gap-0.5">
                <ArticleTypeBadge type={node.row.articleType} />
                {isCombo && <ComboBadge />}
              </div>
            );
          }
          return <TPBadge tone="neutral" size="sm">Variante</TPBadge>;
        },
      },
      estado: {
        key: "estado",
        thStyle: { width: colWidths.estado, minWidth: MIN_COL_WIDTHS.estado },
        header: <ResizableHeader colKey="estado" onStartResize={startResize}><SortHeader colKey="isActive" label="Estado" /></ResizableHeader>,
        visible: isVisible("estado"),
        className: "text-center align-top",
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
        thStyle: { width: colWidths.stock, minWidth: MIN_COL_WIDTHS.stock },
        header: <ResizableHeader colKey="stock" onStartResize={startResize}><SortHeader colKey="stock" label="Stock" /></ResizableHeader>,
        visible: isVisible("stock"),
        className: "text-center align-top",
        renderCell: (raw) => {
          const node = raw as AnyNode;
          if (node.kind === "variant") {
            const vv = node.variant;
            const qty = node.row.stockData?.byVariant?.[vv.id] ?? null;
            return <StockIndicator qty={qty} reorderPoint={vv.reorderPoint} stockMode={node.row.stockMode} />;
          }
          const row = node.row;
          // Combo: stock NO editable, mostrar "según componentes" con tooltip explicativo.
          if (row.commercialMode === "COMBO_COMMERCIAL") {
            return (
              <TPBadge tone="info" size="sm" title="Disponibilidad calculada según el stock de los componentes del combo">
                según componentes
              </TPBadge>
            );
          }
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
        thStyle: { width: colWidths.cost, minWidth: MIN_COL_WIDTHS.cost },
        header: <ResizableHeader colKey="cost" onStartResize={startResize}><SortHeader colKey="costPrice" label="Costo" /></ResizableHeader>,
        visible: isVisible("cost"),
        className: "text-right align-top",
        renderCell: (raw) => {
          const node = raw as AnyNode;
          if (node.kind === "article") return <CostCellContent row={node.row} />;
          const vv = node.variant;
          if (vv.costPrice) {
            const main = vv.costPriceWithTax ?? vv.costPrice;
            return (
              <div className="text-right">
                <div className="text-sm tabular-nums">{fmtMoney(main)}</div>
                <div className="text-[10px] text-muted/50 mt-0.5">Propio</div>
              </div>
            );
          }
          const inherited = node.row.computedCostWithTax ?? node.row.computedCostBase;
          return inherited ? (
            <div className="text-right">
              <div className="text-sm tabular-nums text-muted">{fmtMoney(inherited)}</div>
              <div className="text-[10px] text-muted/40 mt-0.5">Heredado</div>
            </div>
          ) : <span className="text-muted/30 text-xs">—</span>;
        },
      },
      price: {
        key: "price",
        thStyle: { width: colWidths.price, minWidth: MIN_COL_WIDTHS.price },
        header: <ResizableHeader colKey="price" onStartResize={startResize}><SortHeader colKey="salePrice" label="Precio" /></ResizableHeader>,
        visible: isVisible("price"),
        className: "text-right align-top",
        renderCell: (raw) => {
          const node = raw as AnyNode;
          if (node.kind === "article") return <PriceCellContent row={node.row} />;
          // El precio es siempre del artículo padre (las variantes no tienen precio propio)
          const displayPrice = node.row.resolvedSalePriceWithTax ?? node.row.resolvedSalePrice;
          return displayPrice ? (
            <div className="text-right">
              <div className="text-sm tabular-nums text-muted">ARS {fmtNum(displayPrice)}</div>
              <div className="text-[10px] text-muted/40 mt-0.5">Del artículo</div>
            </div>
          ) : <span className="text-muted/30 text-xs">—</span>;
        },
      },
      margen: {
        key: "margen",
        thStyle: { width: colWidths.margen, minWidth: MIN_COL_WIDTHS.margen },
        header: <ResizableHeader colKey="margen" onStartResize={startResize}><span className="text-xs">Margen %</span></ResizableHeader>,
        visible: isVisible("margen"),
        className: "text-right align-top",
        renderCell: (raw) => {
          const node = raw as AnyNode;
          if (node.kind === "variant") return <span className="text-muted/40 text-xs">—</span>;
          return <MarginCellContent row={node.row} />;
        },
      },
      supplier: {
        key: "supplier",
        thStyle: { width: colWidths.supplier, minWidth: MIN_COL_WIDTHS.supplier },
        header: <ResizableHeader colKey="supplier" onStartResize={startResize}><SortHeader colKey="supplier" label="Proveedor preferido" /></ResizableHeader>,
        visible: isVisible("supplier"),
        className: "align-top",
        renderCell: (raw) => {
          const node = raw as AnyNode;
          if (node.kind === "variant") return <span className="text-muted/40 text-xs">—</span>;
          const s = node.row.preferredSupplier;
          return s
            ? <span className="text-xs text-muted">{s.displayName}</span>
            : <span className="text-muted/30 text-xs">—</span>;
        },
      },
      category: {
        key: "category",
        thStyle: { width: colWidths.category, minWidth: MIN_COL_WIDTHS.category },
        header: <ResizableHeader colKey="category" onStartResize={startResize}><SortHeader colKey="category" label="Categoría" /></ResizableHeader>,
        visible: isVisible("category"),
        className: "align-top",
        renderCell: (raw) => {
          const node = raw as AnyNode;
          if (node.kind === "variant") return <span className="text-muted/40 text-xs">—</span>;
          const c = node.row.category;
          return c
            ? <span className="text-xs text-muted">{c.name}</span>
            : <span className="text-muted/30 text-xs">—</span>;
        },
      },
      group: {
        key: "group",
        thStyle: { width: colWidths.group, minWidth: MIN_COL_WIDTHS.group },
        header: <ResizableHeader colKey="group" onStartResize={startResize}><SortHeader colKey="group" label="Grupo comercial" /></ResizableHeader>,
        visible: isVisible("group"),
        className: "align-top",
        renderCell: (raw) => {
          const node = raw as AnyNode;
          if (node.kind === "variant") return <span className="text-muted/40 text-xs">—</span>;
          const g = node.row.group;
          return g
            ? <span className="text-xs text-primary/80 inline-flex items-center gap-0.5"><Layers size={9} className="shrink-0" />{g.name}</span>
            : <span className="text-muted/30 text-xs">—</span>;
        },
      },
      promo: {
        key: "promo",
        thStyle: { width: colWidths.promo, minWidth: MIN_COL_WIDTHS.promo },
        header: <ResizableHeader colKey="promo" onStartResize={startResize}><span className="text-xs">Promociones</span></ResizableHeader>,
        visible: isVisible("promo"),
        className: "text-center align-top",
        renderCell: (raw) => {
          const node = raw as AnyNode;
          if (node.kind === "variant") return <span className="text-muted/40 text-xs">—</span>;
          const row = node.row;
          if (row.promotionSummary) return <span className="text-xs text-emerald-600 dark:text-emerald-400">{row.promotionSummary}</span>;
          if (row.hasActivePromotion) return <span className="text-xs text-emerald-600 dark:text-emerald-400">Sí</span>;
          return <span className="text-muted/30 text-xs">—</span>;
        },
      },
      discount: {
        key: "discount",
        thStyle: { width: colWidths.discount, minWidth: MIN_COL_WIDTHS.discount },
        header: <ResizableHeader colKey="discount" onStartResize={startResize}><span className="text-xs">Desc. cantidad</span></ResizableHeader>,
        visible: isVisible("discount"),
        className: "align-top",
        renderCell: (raw) => {
          const node = raw as AnyNode;
          if (node.kind === "variant") return <span className="text-muted/40 text-xs">—</span>;
          const row = node.row;
          const tiers = row.quantityDiscountTiers;
          if (tiers && tiers.length > 0) {
            return (
              <div className="flex flex-col gap-0.5">
                {tiers.map((t, i) => {
                  const val = t.type === "PERCENTAGE"
                    ? `-${parseFloat(t.value)}%`
                    : `-$${parseFloat(t.value).toLocaleString("es-AR")}`;
                  return (
                    <span key={i} className="text-xs text-blue-600 dark:text-blue-400">
                      {parseFloat(t.minQty).toLocaleString("es-AR")}+ u. → {val}
                    </span>
                  );
                })}
              </div>
            );
          }
          if (row.quantityDiscountSummary) return <span className="text-xs text-blue-600 dark:text-blue-400">{row.quantityDiscountSummary}</span>;
          if (row.hasQuantityDiscount) return <span className="text-xs text-blue-600 dark:text-blue-400">Sí</span>;
          return <span className="text-muted/30 text-xs">—</span>;
        },
      },
      brand: {
        key: "brand",
        thStyle: { width: colWidths.brand, minWidth: MIN_COL_WIDTHS.brand },
        header: <ResizableHeader colKey="brand" onStartResize={startResize}><SortHeader colKey="brand" label="Marca" /></ResizableHeader>,
        visible: isVisible("brand"),
        className: "align-top",
        renderCell: (raw) => {
          const node = raw as AnyNode;
          if (node.kind === "variant") return <span className="text-muted/40 text-xs">—</span>;
          return node.row.brand
            ? <span className="text-xs text-muted">{node.row.brand}</span>
            : <span className="text-muted/30 text-xs">—</span>;
        },
      },
      manufacturer: {
        key: "manufacturer",
        thStyle: { width: colWidths.manufacturer, minWidth: MIN_COL_WIDTHS.manufacturer },
        header: <ResizableHeader colKey="manufacturer" onStartResize={startResize}><SortHeader colKey="manufacturer" label="Fabricante" /></ResizableHeader>,
        visible: isVisible("manufacturer"),
        className: "align-top",
        renderCell: (raw) => {
          const node = raw as AnyNode;
          if (node.kind === "variant") return <span className="text-muted/40 text-xs">—</span>;
          return node.row.manufacturer
            ? <span className="text-xs text-muted">{node.row.manufacturer}</span>
            : <span className="text-muted/30 text-xs">—</span>;
        },
      },
      unitOfMeasure: {
        key: "unitOfMeasure",
        thStyle: { width: colWidths.unitOfMeasure, minWidth: MIN_COL_WIDTHS.unitOfMeasure },
        header: <ResizableHeader colKey="unitOfMeasure" onStartResize={startResize}><SortHeader colKey="unitOfMeasure" label="Unidades" /></ResizableHeader>,
        visible: isVisible("unitOfMeasure"),
        className: "align-top",
        renderCell: (raw) => {
          const node = raw as AnyNode;
          // Las variantes heredan la unidad del padre — no la mostramos para
          // no saturar la tabla en filas de variante.
          if (node.kind === "variant") return <span className="text-muted/40 text-xs">—</span>;
          return node.row.unitOfMeasure
            ? <span className="text-xs text-muted">{node.row.unitOfMeasure}</span>
            : <span className="text-muted/30 text-xs">—</span>;
        },
      },
      sku: {
        key: "sku",
        thStyle: { width: colWidths.sku, minWidth: MIN_COL_WIDTHS.sku },
        header: <ResizableHeader colKey="sku" onStartResize={startResize}><SortHeader colKey="sku" label="SKU" /></ResizableHeader>,
        visible: isVisible("sku"),
        className: "align-top",
        renderCell: (raw) => {
          const node = raw as AnyNode;
          const val = node.kind === "variant" ? node.variant.sku : node.row.sku;
          return val
            ? <span className="text-xs font-mono text-muted">{val}</span>
            : <span className="text-muted/30 text-xs">—</span>;
        },
      },
      taxes: {
        key: "taxes",
        thStyle: { width: colWidths.taxes, minWidth: MIN_COL_WIDTHS.taxes },
        header: <ResizableHeader colKey="taxes" onStartResize={startResize}><span className="text-xs">Imp. compra</span></ResizableHeader>,
        visible: isVisible("taxes"),
        className: "align-top",
        renderCell: (raw) => {
          const node = raw as AnyNode;
          if (node.kind === "variant") return <span className="text-muted/40 text-xs">—</span>;
          const details = node.row.taxDetails;
          if (details && details.length > 0) {
            return (
              <div className="flex flex-col gap-0.5">
                {details.map((t) => {
                  const pct = t.rate != null ? parseFloat(t.rate) : null;
                  const label = pct != null ? `${t.name} ${pct}%` : t.name;
                  return <span key={t.id} className="text-xs text-amber-600 dark:text-amber-400">{label}</span>;
                })}
              </div>
            );
          }
          const count = node.row.manualTaxIds?.length ?? 0;
          return count > 0
            ? <span className="text-xs text-amber-600 dark:text-amber-400">{count} {count === 1 ? "impuesto" : "impuestos"}</span>
            : <span className="text-muted/30 text-xs">—</span>;
        },
      },
      hasVariants: {
        key: "hasVariants",
        thStyle: { width: colWidths.hasVariants, minWidth: MIN_COL_WIDTHS.hasVariants },
        header: <ResizableHeader colKey="hasVariants" onStartResize={startResize}><SortHeader colKey="variantCount" label="Variantes" /></ResizableHeader>,
        visible: isVisible("hasVariants"),
        className: "align-top",
        renderCell: (raw) => {
          const node = raw as AnyNode;
          if (node.kind === "variant") return <span className="text-muted/40 text-xs">—</span>;
          const variants = node.row.variants ?? [];
          if (variants.length === 0) return <span className="text-muted/30 text-xs">—</span>;
          const SHOW = 3;
          const active = variants.filter((v) => v.isActive !== false);
          const preview = active.slice(0, SHOW);
          const rest = active.length - preview.length;
          return (
            <div className="flex flex-col gap-0.5">
              {preview.map((v) => (
                <span key={v.id} className="text-xs text-muted truncate">
                  {variantLabel(v)}
                </span>
              ))}
              {rest > 0 && (
                <span className="text-[10px] text-muted/50">+{rest} más</span>
              )}
            </div>
          );
        },
      },
      showInStore: {
        key: "showInStore",
        thStyle: { width: colWidths.showInStore, minWidth: MIN_COL_WIDTHS.showInStore },
        header: <ResizableHeader colKey="showInStore" onStartResize={startResize}><SortHeader colKey="showInStore" label="Mostrar en tienda" /></ResizableHeader>,
        visible: isVisible("showInStore"),
        className: "text-center align-top",
        renderCell: (raw) => {
          const node = raw as AnyNode;
          if (node.kind === "variant") return <span className="text-muted/40 text-xs">—</span>;
          return node.row.showInStore
            ? <span className="text-xs text-emerald-600 dark:text-emerald-400">Sí</span>
            : <span className="text-muted/30 text-xs">No</span>;
        },
      },
      returnable: {
        key: "returnable",
        thStyle: { width: colWidths.returnable, minWidth: MIN_COL_WIDTHS.returnable },
        header: <ResizableHeader colKey="returnable" onStartResize={startResize}><SortHeader colKey="isReturnable" label="Acepta devoluciones" /></ResizableHeader>,
        visible: isVisible("returnable"),
        className: "text-center align-top",
        renderCell: (raw) => {
          const node = raw as AnyNode;
          if (node.kind === "variant") return <span className="text-muted/40 text-xs">—</span>;
          return node.row.isReturnable
            ? <span className="text-xs text-emerald-600 dark:text-emerald-400">Sí</span>
            : <span className="text-muted/30 text-xs">No</span>;
        },
      },
      updatedAt: {
        key: "updatedAt",
        thStyle: { width: colWidths.updatedAt, minWidth: MIN_COL_WIDTHS.updatedAt },
        header: <ResizableHeader colKey="updatedAt" onStartResize={startResize}><SortHeader colKey="updatedAt" label="Última act." /></ResizableHeader>,
        visible: isVisible("updatedAt"),
        className: "align-top",
        renderCell: (raw) => {
          const node = raw as AnyNode;
          if (node.kind === "variant") return <span className="text-muted/40 text-xs">—</span>;
          const d = new Date(node.row.updatedAt);
          return (
            <span className="text-xs text-muted tabular-nums">
              {d.toLocaleDateString("es-AR", { day: "2-digit", month: "2-digit", year: "2-digit" })}
            </span>
          );
        },
      },
      reorderPoint: {
        key: "reorderPoint",
        thStyle: { width: colWidths.reorderPoint, minWidth: MIN_COL_WIDTHS.reorderPoint },
        header: <ResizableHeader colKey="reorderPoint" onStartResize={startResize}><span className="text-xs">Pto. reposición</span></ResizableHeader>,
        visible: isVisible("reorderPoint"),
        className: "text-right align-top",
        renderCell: (raw) => {
          const node = raw as AnyNode;
          if (node.kind === "variant") {
            const rp = node.variant.reorderPoint != null ? parseFloat(node.variant.reorderPoint) : null;
            return rp != null
              ? <span className="text-xs tabular-nums text-muted">{fmtQty(rp)}</span>
              : <span className="text-muted/30 text-xs">—</span>;
          }
          const rp = node.row.reorderPoint != null ? parseFloat(node.row.reorderPoint) : null;
          return rp != null
            ? <span className="text-xs tabular-nums text-muted">{fmtQty(rp)}</span>
            : <span className="text-muted/30 text-xs">—</span>;
        },
      },
      minMaxQty: {
        key: "minMaxQty",
        thStyle: { width: colWidths.minMaxQty, minWidth: MIN_COL_WIDTHS.minMaxQty },
        header: <ResizableHeader colKey="minMaxQty" onStartResize={startResize}><span className="text-xs">Cant. mín / máx</span></ResizableHeader>,
        visible: isVisible("minMaxQty"),
        className: "text-right align-top",
        renderCell: (raw) => {
          const node = raw as AnyNode;
          let minQ: string | null = null;
          let maxQ: string | null = null;
          if (node.kind === "variant") {
            minQ = node.variant.minSaleQuantity;
            maxQ = node.variant.maxSaleQuantity;
          } else {
            minQ = node.row.minSaleQuantity;
            maxQ = node.row.maxSaleQuantity;
          }
          const hasMin = minQ != null;
          const hasMax = maxQ != null;
          if (!hasMin && !hasMax) return <span className="text-muted/30 text-xs">—</span>;
          return (
            <div className="flex flex-col items-end gap-0.5">
              {hasMin && <span className="text-xs tabular-nums text-muted">Min: {fmtQty(parseFloat(minQ!))}</span>}
              {hasMax && <span className="text-xs tabular-nums text-muted">Máx: {fmtQty(parseFloat(maxQ!))}</span>}
            </div>
          );
        },
      },
      notes: {
        key: "notes",
        thStyle: { width: colWidths.notes, minWidth: MIN_COL_WIDTHS.notes },
        header: <ResizableHeader colKey="notes" onStartResize={startResize}><span className="text-xs">Notas</span></ResizableHeader>,
        visible: isVisible("notes"),
        className: "align-top",
        renderCell: (raw) => {
          const node = raw as AnyNode;
          const txt = node.kind === "variant" ? node.variant.notes : node.row.notes;
          return txt?.trim()
            ? <span className="text-xs text-muted line-clamp-2 whitespace-pre-wrap">{txt}</span>
            : <span className="text-muted/30 text-xs">—</span>;
        },
      },
    };

    // Ordenar columnas opcionales según colOrder
    const ordered = colOrder
      .map((k) => optionalCols[k])
      .filter((c): c is TreeColDef => !!c);

    return [mainCol, ...ordered];
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [colVis, colOrder, colWidths, highlightId, expanded, sortKey, sortDir, selectedIds, selectedVariantIds, allSelected, someSelected, articleIds]);

  /* ── acciones TPTreeTable ────────────────────────────────────────────────── */
  function renderTreeActions(raw: TreeNodeBase) {
    const node = raw as AnyNode;
    if (node.kind === "article") {
      return (
        <TPRowActions
          extra={
            <>
              <button
                title="Abrir en simulador de precios"
                className="h-7 w-7 rounded-md flex items-center justify-center text-muted hover:bg-surface2 hover:text-primary transition-colors"
                onClick={() => navigate(`/herramientas/simulador-precios?articleId=${node.row.id}`)}
              >
                <Calculator size={14} />
              </button>
              <button
                title={node.row.group ? `Grupo: ${node.row.group.name} — Click para cambiar` : "Asignar a grupo"}
                className={cn(
                  "h-7 w-7 rounded-md flex items-center justify-center transition-colors",
                  node.row.group
                    ? "text-primary/70 hover:bg-primary/10 hover:text-primary"
                    : "text-muted hover:bg-surface2 hover:text-primary"
                )}
                onClick={() => setQuickGroupRow(node.row)}
              >
                <Layers size={14} />
              </button>
            </>
          }
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
      <div className="flex items-center justify-end gap-1">
        <TPActionsMenu
          title="Acciones variante"
          items={[
            { label: "Ver variante",      onClick: () => setViewingVariant({ variant: node.variant, articleRow: node.row }) },
            { label: "Editar variante",   onClick: () => setEditingVariant({ variant: node.variant, articleRow: node.row }) },
            { label: "Eliminar variante", onClick: () => setConfirmDelVariant({ variant: node.variant, articleRow: node.row }) },
            { type: "separator" as const },
            { label: "Ver artículo",      onClick: () => navigate(`/articulos/${node.row.id}`) },
            { label: "Editar artículo",   onClick: () => openEdit(node.row) },
            ...(node.row.group ? [
              { type: "separator" as const },
              { label: `Grupo: ${node.row.group.name}`, disabled: true, onClick: () => {} },
            ] : []),
          ]}
        />
      </div>
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
    const isMatch = q ? variantMatchesQuery(node.variant, q) : false;
    return cn(
      isMatch ? "bg-primary/10" : "bg-surface/20",
      isHighlight && "bg-primary/5 ring-inset ring-1 ring-primary/20",
      !node.variant.isActive && "opacity-60"
    ) || undefined;
  }

  /* ── render ──────────────────────────────────────────────────────────────── */
  return (
    <TPSectionShell
      title="Artículos y Servicios"
      icon={<Package size={20} />}
    >
      <TPTableWrap>
        {/* ── Toolbar principal ─────────────────────────────────────────────────── */}
        <TPTableHeader
          left={
            /* ── Lado izquierdo: expand + búsqueda + filtros ── */
            <div className="flex items-center gap-2 flex-1 min-w-0">
              {allVariantArticleIds.size > 0 && (
                <TPExpandToggle
                  isExpanded={isAllExpanded}
                  onToggle={() =>
                    isAllExpanded
                      ? setExpanded(new Set())
                      : setExpanded(new Set(allVariantArticleIds))
                  }
                />
              )}

              {/* Selector de columnas visibles */}
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

              {/* Buscador — se estira para ocupar el espacio disponible */}
              <TPSearchInput
                value={q}
                onChange={setQ}
                placeholder="Buscar nombre, código, SKU…"
                className="flex-1 min-w-0"
              />

              {/* Botón filtros + badge de filtros activos */}
              <div className="relative shrink-0">
                <TPIconButton
                  onClick={() => filtersOpen ? setFiltersOpen(false) : openFiltersPanel()}
                  title="Filtros avanzados"
                  active={filtersOpen || activeFilterCount > 0}
                >
                  <Filter size={15} />
                </TPIconButton>
                {activeFilterCount > 0 && (
                  <span className="pointer-events-none absolute -top-1.5 -right-1.5 min-w-[16px] h-4 rounded-full bg-primary text-white text-[9px] font-bold leading-none flex items-center justify-center px-1">
                    {activeFilterCount}
                  </span>
                )}
              </div>
            </div>
          }
          right={
            /* ── Lado derecho: nuevo artículo + acciones ── */
            <div className="flex items-center gap-1.5 shrink-0">

              {/* Nuevo artículo — CTA principal */}
              <TPButton
                onClick={() => openCreate()}
                iconLeft={<Plus size={14} />}
              >
                <span className="hidden md:inline">Nuevo artículo</span>
                <span className="md:hidden">Nuevo</span>
              </TPButton>

              {/* Separador visual */}
              <div className="hidden md:block h-5 w-px bg-border/50 mx-0.5" />

              {/* Menú de más acciones + badge de selección */}
              <div className="relative shrink-0">
                <TPActionsMenu
                  title="Más acciones"
                  items={[
                    /* ── Estado ── */
                    { label: "Activar",    onClick: () => handleBulkAction({ isActive: true }),  disabled: busyBulk || selectedIds.size === 0 },
                    { label: "Desactivar", onClick: () => setConfirmBulkDeactivate(true),          disabled: busyBulk || selectedIds.size === 0 },
                    { label: "Eliminar seleccionados", icon: <Trash2 size={13} className="text-red-500" />, onClick: () => setConfirmBulkDelete(true), disabled: busyBulk || selectedIds.size === 0 },
                    { type: "separator" },
                    /* ── Favoritos ── */
                    {
                      type: "submenu",
                      label: "Favoritos",
                      icon: <Star size={14} className={onlyFav ? "fill-yellow-400 text-yellow-400" : undefined} />,
                      children: [
                        { label: "Limpiar filtro",        icon: <X size={13} />,                                                  onClick: () => setOnlyFav(false), disabled: !onlyFav },
                        { label: "Solo favoritos",        icon: <Star size={13} className={onlyFav ? "fill-yellow-400 text-yellow-400" : undefined} />, onClick: () => setOnlyFav(true), disabled: onlyFav },
                        { type: "separator" },
                        { label: "Marcar como favorito", icon: <Star size={13} className="fill-yellow-400 text-yellow-400" />, onClick: () => handleBulkAction({ isFavorite: true }),  disabled: busyBulk || selectedIds.size === 0 },
                        { label: "Quitar favorito",       icon: <Star size={13} />,                                              onClick: () => handleBulkAction({ isFavorite: false }), disabled: busyBulk || selectedIds.size === 0 },
                      ],
                    },
                    { type: "separator" },
                    {
                      type: "submenu",
                      label: "Asignar",
                      icon: <FolderOpen size={14} />,
                      children: [
                        { label: "Categoría…", icon: <FolderOpen size={13} />, onClick: () => { setBulkCategoryVal(""); setBulkCategoryOpen(true); }, disabled: busyBulk || selectedIds.size === 0 },
                        { label: "Grupo…",     icon: <Layers size={13} />,     onClick: () => { setBulkGroupVal(""); setBulkGroupOpen(true); },     disabled: busyBulk || selectedIds.size === 0 },
                      ],
                    },
                    { type: "separator" },
                    { label: "Nuevo artículo", icon: <Plus size={13} />, onClick: () => openCreate() },
                    { label: "Nuevo servicio", icon: <Plus size={13} />, onClick: () => openCreate("SERVICE") },
                    { type: "separator" },
                    { label: "Etiquetas",         icon: <Tag size={13} />,    onClick: openLabels },
                    { label: "Actualizar precios masivos", icon: <Wrench size={13} />, onClick: () => setBulkHechuraOpen(true) },
                    { label: "Carga masiva",      icon: <Upload size={13} />, onClick: () => setImportOpen(true) },
                    { label: exportingXlsx ? "Exportando..." : "Exportar artículos", icon: <Download size={13} />, onClick: () => void handleExportGuided(), disabled: exportingXlsx },
                    { type: "separator" },
                    /* ── Orden por última modificación (persiste vía usePersistedTableSort) ── */
                    {
                      label: "Última modificación: más reciente",
                      icon: <Clock size={13} />,
                      onClick: () => { setSortKey("updatedAt"); setSortDir("desc"); },
                      disabled: sortKey === "updatedAt" && sortDir === "desc",
                    },
                    {
                      label: "Última modificación: más antigua",
                      icon: <Clock size={13} />,
                      onClick: () => { setSortKey("updatedAt"); setSortDir("asc"); },
                      disabled: sortKey === "updatedAt" && sortDir === "asc",
                    },
                    ...((selectedIds.size > 0 || selectedVariantIds.size > 0) ? [
                      { type: "separator" as const },
                      { label: "Limpiar selección", onClick: () => { setSelectedIds(new Set()); setSelectedVariantIds(new Set()); } },
                    ] : []),
                  ]}
                />
                {(selectedIds.size > 0 || selectedVariantIds.size > 0) && (
                  <span className="pointer-events-none absolute -top-1.5 -right-1.5 min-w-[16px] h-4 rounded-full bg-primary text-white text-[9px] font-bold leading-none flex items-center justify-center px-1">
                    {selectedIds.size + selectedVariantIds.size}
                  </span>
                )}
              </div>

            </div>
          }
        />

        {/* ── Chips de filtros activos ───────────────────────────────────────── */}
        {activeChips.length > 0 && (
          <div className="flex flex-wrap items-center gap-1.5 px-4 py-2 border-b border-border bg-surface/20">
            {activeChips.map((chip) => (
              <span
                key={chip.key}
                className="inline-flex items-center gap-1 rounded-full border border-primary/30 bg-primary/8 text-primary text-xs px-2.5 py-0.5"
              >
                {chip.label}
                <button
                  type="button"
                  onClick={chip.onRemove}
                  className="ml-0.5 rounded-full hover:bg-primary/20 p-0.5 transition-colors"
                  title="Quitar filtro"
                >
                  <X size={10} />
                </button>
              </span>
            ))}
            <button
              type="button"
              onClick={clearAllFilters}
              className="text-xs text-muted hover:text-primary transition-colors ml-1"
            >
              Limpiar todo
            </button>
          </div>
        )}

        {/* ── Drawer lateral de filtros ──────────────────────────────────────── */}
        <TPFilterDrawer
          open={filtersOpen}
          onClose={() => setFiltersOpen(false)}
          title={activeFilterCount > 0 ? `Filtros (${activeFilterCount})` : "Filtros"}
          resizable
          storageKey="tptech_articles_filters_panel_width"
          footer={
            <div className="flex items-center justify-between">
              <TPButton
                variant="ghost"
                iconLeft={<X size={12} />}
                onClick={clearAllFilters}
                className="text-xs text-muted hover:text-primary"
              >
                Limpiar filtros
              </TPButton>
              <TPButton onClick={applyFilters}>Aplicar</TPButton>
            </div>
          }
        >
          {/* Enter en cualquier campo de texto aplica los filtros */}
          <div
            className="flex flex-col gap-6"
            onKeyDown={(e) => {
              if (e.key === "Enter") applyFilters();
            }}
          >
            {/* ── Generales ── */}
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wider text-muted mb-4">Generales</p>
              <div className="space-y-4">
                <TPField label="Tipo">
                  <TPComboFixed
                    value={draft.type}
                    onChange={(v) => setD("type", v)}
                    options={[
                      { label: "Todos", value: "" },
                      { label: "Producto", value: "PRODUCT" },
                      { label: "Servicio", value: "SERVICE" },
                      { label: "Material", value: "MATERIAL" },
                    ]}
                  />
                </TPField>
                <TPField label="Estado">
                  <TPComboFixed
                    value={draft.status}
                    onChange={(v) => setD("status", v)}
                    options={[
                      { label: "Activos", value: "" },
                      { label: "Borrador", value: "DRAFT" },
                      { label: "Activo", value: "ACTIVE" },
                      { label: "Discontinuado", value: "DISCONTINUED" },
                      { label: "Archivado", value: "ARCHIVED" },
                    ]}
                  />
                </TPField>
                <TPField label="Artículo / Variante">
                  <TPArticleScopeSelect
                    value={draftScopeItems}
                    onChange={setDraftScopeItems}
                    multiple
                    includeVariants
                    placeholder="Buscar artículo o variante…"
                  />
                </TPField>
                <TPField label="Marca">
                  <TPComboFixed
                    value={draft.brand}
                    onChange={(v) => setD("brand", v)}
                    options={[
                      { label: "Todas las marcas", value: "" },
                      ...brandNames.map((b) => ({ label: b, value: b })),
                    ]}
                    searchable
                    placeholder="Buscar marca…"
                  />
                </TPField>
              </div>
            </div>

            {/* ── Organización ── */}
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wider text-muted mb-4">Organización</p>
              <div className="space-y-4">
                <TPField label="Categoría">
                  <TPComboFixed
                    value={draft.categoryId}
                    onChange={(v) => setD("categoryId", v)}
                    options={[
                      { label: "Todas las categorías", value: "" },
                      ...categoryTreeOptions,
                    ]}
                    searchable
                  />
                </TPField>
                <TPField label="Grupo comercial">
                  <TPComboFixed
                    value={draft.groupId}
                    onChange={(v) => setD("groupId", v)}
                    options={[
                      { label: "Todos los grupos", value: "", imageUrl: "" },
                      ...groupsToComboOptions(groups),
                    ]}
                    searchable
                  />
                </TPField>
                <TPField label="Variantes">
                  <TPComboFixed
                    value={draft.hasVariants}
                    onChange={(v) => setD("hasVariants", v)}
                    options={[
                      { label: "Todos", value: "" },
                      { label: "Con variantes", value: "true" },
                      { label: "Sin variantes", value: "false" },
                    ]}
                  />
                </TPField>
              </div>
            </div>

            {/* ── Materiales y Abastecimiento ── */}
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wider text-muted mb-4">Materiales y Abastecimiento</p>
              <div className="space-y-4">
                <TPField label="Metal padre">
                  <TPComboFixed
                    value={draft.metalId}
                    onChange={(v) => setDraft((d) => ({ ...d, metalId: v, metalVariantId: "" }))}
                    options={[
                      { label: "Todos los metales", value: "" },
                      ...metals.map((m) => ({ label: m.name, value: m.id })),
                    ]}
                    searchable
                  />
                </TPField>
                <TPField label="Variante de metal">
                  <TPComboFixed
                    value={draft.metalVariantId}
                    onChange={(v) => setD("metalVariantId", v)}
                    disabled={!draft.metalId}
                    options={[
                      { label: draft.metalId ? "Todas las variantes" : "Seleccionar metal primero", value: "" },
                      ...draftMetalVariants.map((mv) => ({ label: mv.name, value: mv.id })),
                    ]}
                    searchable={!!draft.metalId}
                  />
                </TPField>
                <TPField label="Proveedor preferido">
                  <TPComboFixed
                    value={draft.supplierId}
                    onChange={(v) => setD("supplierId", v)}
                    options={[
                      { label: "Todos los proveedores", value: "" },
                      ...suppliers.map((s) => ({ label: s.displayName, value: s.id })),
                    ]}
                    searchable
                  />
                </TPField>
              </div>
            </div>
          </div>
        </TPFilterDrawer>


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
          tableFixed
          actionsMinWidth={320}
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

      {/* ── Modal bulk categoría ───────────────────────────────────────────── */}
      <Modal
        open={bulkCategoryOpen}
        title={`Cambiar categoría — ${selectedIds.size} artículo${selectedIds.size !== 1 ? "s" : ""}`}
        maxWidth="sm"
        onClose={() => { if (!busyBulk) setBulkCategoryOpen(false); }}
        busy={busyBulk}
        onEnter={() => {
          if (bulkCategoryVal && !busyBulk) {
            void handleBulkAction({ categoryId: bulkCategoryVal });
            setBulkCategoryOpen(false);
          }
        }}
        footer={
          <div className="flex justify-end gap-2">
            <TPButton variant="ghost" disabled={busyBulk} onClick={() => setBulkCategoryOpen(false)}>Cancelar</TPButton>
            <TPButton
              variant="primary"
              loading={busyBulk}
              disabled={!bulkCategoryVal}
              onClick={() => { void handleBulkAction({ categoryId: bulkCategoryVal }); setBulkCategoryOpen(false); }}
            >
              Aplicar
            </TPButton>
          </div>
        }
      >
        <div className="py-2">
          <TPField label="Categoría">
            <CategoryTreePicker
              categories={categories.filter((c) => c.isActive)}
              value={bulkCategoryVal ? [bulkCategoryVal] : []}
              onChange={(ids) => setBulkCategoryVal(ids[0] ?? "")}
              single
            />
          </TPField>
        </div>
      </Modal>

      {/* ── Modal bulk grupo ────────────────────────────────────────────────── */}
      <Modal
        open={bulkGroupOpen}
        title={`Cambiar grupo — ${selectedIds.size} artículo${selectedIds.size !== 1 ? "s" : ""}`}
        maxWidth="sm"
        onClose={() => { if (!busyBulk) setBulkGroupOpen(false); }}
        busy={busyBulk}
        onEnter={() => {
          if (bulkGroupVal && !busyBulk) {
            void handleBulkAction({ groupId: bulkGroupVal });
            setBulkGroupOpen(false);
          }
        }}
        footer={
          <div className="flex justify-end gap-2">
            <TPButton variant="ghost" disabled={busyBulk} onClick={() => setBulkGroupOpen(false)}>Cancelar</TPButton>
            <TPButton
              variant="primary"
              loading={busyBulk}
              disabled={!bulkGroupVal}
              onClick={() => { void handleBulkAction({ groupId: bulkGroupVal }); setBulkGroupOpen(false); }}
            >
              Aplicar
            </TPButton>
          </div>
        }
      >
        <div className="py-2">
          <TPField label="Grupo comercial">
            <TPComboFixed
              value={bulkGroupVal}
              onChange={(v) => setBulkGroupVal(v)}
              options={[
                { label: "— Seleccionar grupo —", value: "", imageUrl: "" },
                ...groupsToComboOptions(groups),
              ]}
              searchable
            />
          </TPField>
        </div>
      </Modal>

      {/* ── Confirm bulk deactivate ────────────────────────────────────────── */}
      <ConfirmDeleteDialog
        open={confirmBulkDeactivate}
        title={`Desactivar ${selectedIds.size} artículo${selectedIds.size !== 1 ? "s" : ""}`}
        description={`Se desactivarán ${selectedIds.size} artículo${selectedIds.size !== 1 ? "s" : ""} seleccionado${selectedIds.size !== 1 ? "s" : ""}. Podrás volver a activarlos en cualquier momento.`}
        confirmText="Desactivar"
        busy={busyBulk}
        onClose={() => { if (!busyBulk) setConfirmBulkDeactivate(false); }}
        onConfirm={() => { setConfirmBulkDeactivate(false); void handleBulkAction({ isActive: false }); }}
      />

      {/* ── Confirm delete ─────────────────────────────────────────────────── */}
      <ConfirmDeleteDialog
        open={!!confirmDel}
        title="Eliminar artículo"
        description={(() => {
          if (!confirmDel) return "";
          const varCount = confirmDel.variants?.length ?? 0;
          return varCount > 0
            ? `¿Eliminar "${confirmDel.name}" y sus ${varCount} variante${varCount !== 1 ? "s" : ""}? Esta acción no se puede deshacer.`
            : `¿Eliminar "${confirmDel.name}"? Esta acción no se puede deshacer.`;
        })()}
        onConfirm={() => confirmDel && handleDelete(confirmDel)}
        onClose={() => setConfirmDel(null)}
        busy={!!busyDel}
      />

      {/* ── Confirm bulk delete ────────────────────────────────────────────── */}
      <ConfirmDeleteDialog
        open={confirmBulkDelete}
        title={`Eliminar ${selectedIds.size} artículo${selectedIds.size !== 1 ? "s" : ""}`}
        description={(() => {
          const n = selectedIds.size;
          const v = bulkDeleteVariantCount;
          return `Se eliminarán ${n} artículo${n !== 1 ? "s" : ""}${v > 0 ? ` y ${v} variante${v !== 1 ? "s" : ""} asociadas` : ""}. Esta acción no se puede deshacer.`;
        })()}
        confirmText="Eliminar"
        busy={busyBulk}
        onClose={() => { if (!busyBulk) setConfirmBulkDelete(false); }}
        onConfirm={() => void handleBulkDelete()}
      />

      {/* ── Modal editar variante ──────────────────────────────────────────── */}
      {editingVariant && (
        <EditVariantModal
          open={!!editingVariant}
          onClose={() => setEditingVariant(null)}
          articleId={editingVariant.articleRow.id}
          variant={editingVariant.variant}
          onVariantChange={handleVariantChange}
          variantStock={editingVariant.articleRow.stockData?.byVariant ?? {}}
          variants={editingVariant.articleRow.variants ?? []}
          onSwitchVariant={handleSwitchVariant}
          parentGroup={(() => {
            const g = editingVariant.articleRow.group;
            if (!g) return null;
            const full = groups.find(gr => gr.id === g.id);
            return { id: g.id, name: g.name, selectorLabel: full?.selectorLabel ?? "" };
          })()}
          parentNotes={editingVariant.articleRow.notes ?? ""}
        />
      )}

      {/* ── Modal ver variante ─────────────────────────────────────────────── */}
      {viewingVariant && (
        <ViewVariantModal
          open={!!viewingVariant}
          onClose={() => setViewingVariant(null)}
          variant={viewingVariant.variant}
          articleRow={viewingVariant.articleRow}
          stockQty={viewingVariant.articleRow.stockData?.byVariant?.[viewingVariant.variant.id] ?? 0}
          onEdit={() => {
            setViewingVariant(null);
            setEditingVariant({ variant: viewingVariant.variant, articleRow: viewingVariant.articleRow });
          }}
          onViewArticle={() => {
            setViewingVariant(null);
            navigate(`/articulos/${viewingVariant.articleRow.id}`);
          }}
        />
      )}

      {/* ── Confirm eliminar variante ──────────────────────────────────────── */}
      <ConfirmDeleteDialog
        open={!!confirmDelVariant}
        title="Eliminar variante"
        description={
          confirmDelVariant
            ? `¿Eliminar la variante "${confirmDelVariant.variant.name || confirmDelVariant.variant.code}" de "${confirmDelVariant.articleRow.name}"? Esta acción no se puede deshacer.`
            : ""
        }
        onConfirm={handleDeleteVariant}
        onClose={() => setConfirmDelVariant(null)}
        busy={busyDelVariant}
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

      <TPImageLightbox src={lightboxSrc} onClose={() => setLightboxSrc(null)} />

      {/* ── Modal actualización masiva de hechuras ─────────────────────────── */}
      <BulkHechuraModal
        open={bulkHechuraOpen}
        onClose={() => setBulkHechuraOpen(false)}
        preSelectedIds={selectedIds.size > 0 ? Array.from(selectedIds) : undefined}
      />

      {/* ── Modal gestión de grupo (acción rápida de fila) ──────────────── */}
      {quickGroupRow && (
        <ArticleGroupEditModal
          open={!!quickGroupRow}
          onClose={() => setQuickGroupRow(null)}
          articleRow={quickGroupRow}
          groups={groups}
          onSaved={(groupId, groupSlug, groupName) => {
            setRows(prev => prev.map(r => r.id === quickGroupRow.id
              ? { ...r, groupId, group: groupId && groupName ? { id: groupId, name: groupName, slug: groupSlug ?? "" } : null }
              : r
            ));
            setQuickGroupRow(null);
          }}
        />
      )}
    </TPSectionShell>
  );
}
