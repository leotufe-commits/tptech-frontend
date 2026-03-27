import { useState, useRef, useCallback, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "../lib/toast";
import {
  ShoppingCart,
  Search,
  Scan,
  Trash2,
  Plus,
  Minus,
  User,
  X,
  CheckCircle,
  CreditCard,
  RefreshCw,
  ChevronRight,
  Package,
} from "lucide-react";

import { articlesApi, variantLabel } from "../services/articles";
import type {
  ArticleRow,
  ArticleVariant,
  ArticleDetail,
  ArticleStock,
} from "../services/articles";
import { salesApi } from "../services/sales";
import type { SaleLineInput, AddPaymentPayload, SaleDetail, SalePriceSource } from "../services/sales";
import { paymentsApi } from "../services/payments";
import type { PaymentMethodRow } from "../services/payments";
import { apiFetch } from "../lib/api";
import { commercialEntitiesApi } from "../services/commercial-entities";
import TPButton from "../components/ui/TPButton";
import TPInput from "../components/ui/TPInput";
import TPNumberInput from "../components/ui/TPNumberInput";
import TPField from "../components/ui/TPField";
import Modal from "../components/ui/Modal";

// ─── Types ────────────────────────────────────────────────────────────────────
type CartLine = {
  key: string; // articleId + variantId
  articleId: string;
  variantId: string | null;
  articleName: string;
  variantName: string;
  sku: string;
  barcode: string;
  imageUrl: string;
  quantity: number;
  unitPrice: number;
  unitCost: number | null;    // costo real del motor oficial (null si no disponible)
  costPartial: boolean;       // true si el costo es incompleto
  costMode: string;           // MANUAL | MULTIPLIER | METAL_MERMA_HECHURA | COST_LINES | NONE
  discountPct: number;
  priceSource: SalePriceSource | "";
  appliedPromotionName: string | null;
  appliedPriceListName: string | null;
  // Snapshot para SaleLine
  appliedPromotionId: string | null;
  appliedDiscountId: string | null;
  appliedPriceListId: string | null;
};

type ClientOption = {
  id: string;
  displayName: string;
  code: string;
};

type WarehouseOption = {
  id: string;
  name: string;
  code: string;
};

// ─── Helpers ─────────────────────────────────────────────────────────────────
function lineTotal(line: CartLine) {
  return Math.round(line.quantity * line.unitPrice * (1 - line.discountPct / 100) * 100) / 100;
}

function cartSubtotal(lines: CartLine[]) {
  return lines.reduce((s, l) => s + lineTotal(l), 0);
}

function fmt(n: number) {
  return n.toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/** Label legible de variante: muestra ejes de variante (Rojo · M) o SKU si hay */

// ─── Component ────────────────────────────────────────────────────────────────
export default function Ventas() {
  const navigate = useNavigate();

  // ── Search ─────────────────────────────────────────────────────────────────
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<ArticleRow[]>([]);
  const [searching, setSearching] = useState(false);
  const [scanInput, setScanInput] = useState("");
  const [scanLoading, setScanLoading] = useState(false);
  const scanRef = useRef<HTMLInputElement>(null);

  // ── Cart ───────────────────────────────────────────────────────────────────
  const [cart, setCart] = useState<CartLine[]>([]);

  // ── Client ────────────────────────────────────────────────────────────────
  const [clientSearch, setClientSearch] = useState("");
  const [clientResults, setClientResults] = useState<ClientOption[]>([]);
  const [clientLoading, setClientLoading] = useState(false);
  const [selectedClient, setSelectedClient] = useState<ClientOption | null>(null);
  const [showClientDrop, setShowClientDrop] = useState(false);

  // ── Warehouses ────────────────────────────────────────────────────────────
  const [warehouses, setWarehouses] = useState<WarehouseOption[]>([]);
  const [selectedWarehouseId, setSelectedWarehouseId] = useState<string>("");

  // ── Payment methods ───────────────────────────────────────────────────────
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethodRow[]>([]);

  // ── Variant picker ────────────────────────────────────────────────────────
  const [variantPickerArticle,   setVariantPickerArticle]   = useState<ArticleRow | null>(null);
  /** Detalle completo con attributeValues; se carga al abrir el picker */
  const [variantPickerDetail,    setVariantPickerDetail]    = useState<ArticleDetail | null>(null);
  /** stock[variantId] = cantidad disponible en almacén seleccionado (o total) */
  const [variantStockMap,        setVariantStockMap]        = useState<Record<string, number>>({});
  const [loadingPickerVariants,  setLoadingPickerVariants]  = useState(false);

  // ── Payment modal ─────────────────────────────────────────────────────────
  const [paymentModalOpen, setPaymentModalOpen] = useState(false);
  const [currentSale, setCurrentSale] = useState<SaleDetail | null>(null);
  const [payingMethodId, setPayingMethodId] = useState<string>("");
  const [payingAmount, setPayingAmount] = useState<number | null>(null);
  const [payingRef, setPayingRef] = useState("");
  const [paying, setPaying] = useState(false);

  // ── Notes ─────────────────────────────────────────────────────────────────
  const [notes, setNotes] = useState("");

  // ── Submit ────────────────────────────────────────────────────────────────
  const [confirming, setConfirming] = useState(false);

  // ── Completed modal ───────────────────────────────────────────────────────
  const [completedSale, setCompletedSale] = useState<SaleDetail | null>(null);

  // ─── Load warehouses + payment methods ───────────────────────────────────
  useEffect(() => {
    apiFetch<WarehouseOption[]>("/warehouses", { on401: "throw" })
      .then((list) => {
        const active = (list ?? []).filter((w: any) => w.isActive && !w.deletedAt);
        setWarehouses(active);
        if (active.length) setSelectedWarehouseId(active[0].id);
      })
      .catch(() => {});

    paymentsApi
      .list()
      .then((list) => {
        const active = list.filter((p) => p.isActive && !p.deletedAt);
        setPaymentMethods(active);
        if (active.length) setPayingMethodId(active[0].id);
      })
      .catch(() => {});
  }, []);

  // ─── Cargar detalle + stock al abrir el picker de variantes ─────────────
  useEffect(() => {
    if (!variantPickerArticle) {
      setVariantPickerDetail(null);
      setVariantStockMap({});
      return;
    }
    setLoadingPickerVariants(true);
    Promise.all([
      articlesApi.getOne(variantPickerArticle.id),
      articlesApi.stock.get(variantPickerArticle.id).catch(() => [] as ArticleStock[]),
    ])
      .then(([detail, stockRows]) => {
        setVariantPickerDetail(detail);
        const map: Record<string, number> = {};
        for (const row of stockRows) {
          if (!row.variantId) continue;
          // Si hay almacén seleccionado, filtrar por él; si no, sumar todos
          if (selectedWarehouseId && row.warehouseId !== selectedWarehouseId) continue;
          map[row.variantId] = (map[row.variantId] ?? 0) + Number(row.quantity ?? 0);
        }
        setVariantStockMap(map);
      })
      .catch(() => {})
      .finally(() => setLoadingPickerVariants(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [variantPickerArticle?.id, selectedWarehouseId]);

  // ─── Article search ───────────────────────────────────────────────────────
  const doSearch = useCallback(async (q: string) => {
    if (!q.trim()) { setSearchResults([]); return; }
    setSearching(true);
    try {
      const res = await articlesApi.list({ q: q.trim(), take: 20, status: "ACTIVE" });
      setSearchResults(res.rows ?? []);
    } catch {
      setSearchResults([]);
    } finally {
      setSearching(false);
    }
  }, []);

  useEffect(() => {
    const t = setTimeout(() => doSearch(searchQuery), 300);
    return () => clearTimeout(t);
  }, [searchQuery, doSearch]);

  // ─── Scanner ──────────────────────────────────────────────────────────────
  async function handleScan(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key !== "Enter") return;
    const code = scanInput.trim();
    if (!code) return;
    setScanInput("");
    setScanLoading(true);
    try {
      const result = await articlesApi.lookupByBarcode(code);
      if (!result.found) { toast.error("Código no encontrado."); return; }
      // Get full article to have salePrice and variants
      const full = await articlesApi.getOne(result.articleId);
      const variant = result.variantId
        ? full.variants?.find((v) => v.id === result.variantId) ?? null
        : null;
      await resolveAndAdd(full as any, variant ?? null);
    } catch {
      toast.error("Error al buscar el código.");
    } finally {
      setScanLoading(false);
      setTimeout(() => scanRef.current?.focus(), 50);
    }
  }

  // ─── Add to cart ──────────────────────────────────────────────────────────
  function addToCart(
    article: ArticleRow,
    variant: ArticleVariant | null,
    price?: number,
    priceSource?: SalePriceSource | "",
    promotionName?: string | null,
    priceListName?: string | null,
    promotionId?: string | null,
    discountId?: string | null,
    priceListId?: string | null,
    unitCostValue?: number | null,
    costPartialValue?: boolean,
    costModeValue?: string
  ) {
    const variantId = variant?.id ?? null;
    const key = `${article.id}__${variantId ?? ""}`;
    const unitPrice =
      price ??
      (parseFloat(variant?.priceOverride ?? article.salePrice ?? "0") || 0);

    setCart((prev) => {
      const idx = prev.findIndex((l) => l.key === key);
      if (idx >= 0) {
        return prev.map((l, i) =>
          i === idx ? { ...l, quantity: l.quantity + 1 } : l
        );
      }
      return [
        ...prev,
        {
          key,
          articleId: article.id,
          variantId,
          articleName: article.name,
          variantName: variant?.name ?? "",
          sku: variant?.sku || article.sku,
          barcode: variant?.barcode || article.barcode || "",
          imageUrl: article.mainImageUrl,
          quantity: 1,
          unitPrice,
          unitCost:    unitCostValue  ?? null,
          costPartial: costPartialValue ?? unitCostValue == null,
          costMode:    costModeValue  ?? "NONE",
          discountPct: 0,
          priceSource: priceSource ?? "",
          appliedPromotionName: promotionName ?? null,
          appliedPriceListName: priceListName ?? null,
          appliedPromotionId: promotionId ?? null,
          appliedDiscountId: discountId ?? null,
          appliedPriceListId: priceListId ?? null,
        },
      ];
    });

    setSearchQuery("");
    setSearchResults([]);
  }

  // ─── Resolve sale price and add to cart ───────────────────────────────────
  async function resolveAndAdd(article: ArticleRow, variant: ArticleVariant | null) {
    try {
      const result = await articlesApi.getSalePrice(article.id, {
        clientId:  selectedClient?.id ?? null,
        variantId: variant?.id ?? null,
        quantity:  1,
      });
      const price    = result.unitPrice != null
        ? parseFloat(result.unitPrice)
        : (parseFloat(variant?.priceOverride ?? article.salePrice ?? "0") || 0);
      const unitCost = result.unitCost != null ? parseFloat(result.unitCost) : null;
      addToCart(
        article, variant, price,
        result.priceSource, result.appliedPromotionName, result.appliedPriceListName,
        result.appliedPromotionId, result.appliedDiscountId, result.appliedPriceListId,
        unitCost, result.costPartial, result.costMode
      );
    } catch {
      const price = parseFloat(variant?.priceOverride ?? article.salePrice ?? "0") || 0;
      addToCart(article, variant, price, "", null, null, null, null, null, null, true, "NONE");
    }
  }

  function handleAddArticle(article: ArticleRow) {
    const variants = article.variants?.filter((v) => v.isActive) ?? [];
    if (!article.sellWithoutVariants && variants.length > 0) {
      setVariantPickerArticle(article);
      return;
    }
    resolveAndAdd(article, null);
  }

  // ─── Refresh price when quantity changes ──────────────────────────────────
  async function refreshLinePrice(key: string, articleId: string, variantId: string | null, qty: number) {
    try {
      const result = await articlesApi.getSalePrice(articleId, {
        clientId:  selectedClient?.id ?? null,
        variantId: variantId ?? null,
        quantity:  qty,
      });
      if (result.unitPrice != null) {
        const newPrice = parseFloat(result.unitPrice);
        const newCost  = result.unitCost != null ? parseFloat(result.unitCost) : null;
        setCart((p) => p.map((l) =>
          l.key === key
            ? {
                ...l,
                unitPrice:   newPrice,
                unitCost:    newCost,
                costPartial: result.costPartial,
                costMode:    result.costMode,
                priceSource:         result.priceSource,
                appliedPromotionName: result.appliedPromotionName,
                appliedPriceListName: result.appliedPriceListName,
                appliedPromotionId:  result.appliedPromotionId,
                appliedDiscountId:   result.appliedDiscountId,
                appliedPriceListId:  result.appliedPriceListId,
              }
            : l
        ));
      }
    } catch { /* keep existing price */ }
  }

  // ─── Cart operations ──────────────────────────────────────────────────────
  function updateQty(key: string, qty: number) {
    if (qty <= 0) { removeFromCart(key); return; }
    setCart((p) => p.map((l) => l.key === key ? { ...l, quantity: qty } : l));
    // Recalculate price for quantity-sensitive sources
    const line = cart.find((l) => l.key === key);
    if (line) refreshLinePrice(key, line.articleId, line.variantId, qty);
  }

  function updatePrice(key: string, price: number) {
    setCart((p) => p.map((l) => l.key === key ? { ...l, unitPrice: price } : l));
  }

  function updateDiscount(key: string, pct: number) {
    setCart((p) => p.map((l) => l.key === key ? { ...l, discountPct: Math.min(100, Math.max(0, pct)) } : l));
  }

  function removeFromCart(key: string) {
    setCart((p) => p.filter((l) => l.key !== key));
  }

  function clearCart() {
    setCart([]);
    setSelectedClient(null);
    setNotes("");
    setCurrentSale(null);
  }

  // ─── Client search ────────────────────────────────────────────────────────
  useEffect(() => {
    if (!clientSearch.trim()) { setClientResults([]); return; }
    const t = setTimeout(async () => {
      setClientLoading(true);
      try {
        const res = await commercialEntitiesApi.list({ q: clientSearch, role: "client", take: 10 });
        setClientResults(
          (res.rows ?? []).map((r: any) => ({
            id: r.id,
            displayName: r.displayName,
            code: r.code,
          }))
        );
      } catch {
        setClientResults([]);
      } finally {
        setClientLoading(false);
      }
    }, 300);
    return () => clearTimeout(t);
  }, [clientSearch]);

  // ─── Confirm + open payment ───────────────────────────────────────────────
  async function handleConfirmAndPay() {
    if (!cart.length) { toast.error("El carrito está vacío."); return; }
    setConfirming(true);
    try {
      const lines: SaleLineInput[] = cart.map((l) => ({
        articleId:          l.articleId,
        variantId:          l.variantId,
        quantity:           l.quantity,
        unitPrice:          l.unitPrice,
        discountPct:        l.discountPct,
        priceSource:        l.priceSource || undefined,
        appliedPriceListId: l.appliedPriceListId ?? null,
        appliedPromotionId: l.appliedPromotionId ?? null,
        appliedDiscountId:  l.appliedDiscountId  ?? null,
      }));

      // Create draft
      const draft = await salesApi.create({
        clientId: selectedClient?.id ?? null,
        warehouseId: selectedWarehouseId || null,
        notes,
        lines,
      });

      // Confirm immediately
      const confirmed = await salesApi.confirm(draft.id);
      setCurrentSale(confirmed);

      const sub = parseFloat(confirmed.total);
      setPayingAmount(sub);
      setPaymentModalOpen(true);
    } catch (e: any) {
      toast.error(e?.message ?? "Error al confirmar la venta.");
    } finally {
      setConfirming(false);
    }
  }

  // ─── Register payment ─────────────────────────────────────────────────────
  async function handleAddPayment() {
    if (!currentSale || !payingAmount || payingAmount <= 0) return;
    setPaying(true);
    try {
      const payload: AddPaymentPayload = {
        paymentMethodId: payingMethodId || null,
        amount: payingAmount,
        reference: payingRef,
      };
      const updated = await salesApi.addPayment(currentSale.id, payload);
      setCurrentSale(updated);

      const paid = parseFloat(updated.paidAmount);
      const total = parseFloat(updated.total);
      const remaining = Math.max(0, total - paid);

      if (remaining <= 0.001) {
        // Fully paid
        setPaymentModalOpen(false);
        setCompletedSale(updated);
        clearCart();
        toast.success("¡Venta completada!");
      } else {
        setPayingAmount(remaining);
        setPayingRef("");
        toast.success(`Pago registrado. Resta: $${fmt(remaining)}`);
      }
    } catch (e: any) {
      toast.error(e?.message ?? "Error al registrar el pago.");
    } finally {
      setPaying(false);
    }
  }

  // ─── Quick confirm without paying now ────────────────────────────────────
  async function handleConfirmOnly() {
    if (!currentSale) return;
    setPaymentModalOpen(false);
    setCompletedSale(currentSale);
    clearCart();
    toast.success("Venta confirmada (cobro pendiente).");
  }

  const subtotal = cartSubtotal(cart);
  const totalLines = cart.length;

  // Margen estimado del carrito
  const cartMargin = (() => {
    const linesWithCost = cart.filter((l) => l.unitCost != null);
    if (linesWithCost.length === 0) return null;
    const revenue = cart.reduce((s, l) => s + lineTotal(l), 0);
    const cost = cart.reduce((s, l) => {
      if (l.unitCost == null) return s;
      return s + l.unitCost * l.quantity;
    }, 0);
    const margin = revenue - cost;
    const marginPct = revenue > 0 ? (margin / revenue) * 100 : 0;
    const hasPartial = cart.some((l) => l.costPartial);
    return { revenue, cost, margin, marginPct, linesWithoutCost: cart.length - linesWithCost.length, hasPartial };
  })();

  // ─── Render ───────────────────────────────────────────────────────────────
  return (
    <div className="flex h-screen overflow-hidden bg-gray-50">
      {/* ── LEFT PANEL: Search + Results ─────────────────────────────────── */}
      <div className="flex flex-col flex-1 min-w-0 overflow-hidden border-r border-gray-200 bg-white">
        {/* Header */}
        <div className="px-4 py-3 border-b border-gray-100 flex items-center gap-3 bg-white">
          <ShoppingCart className="w-5 h-5 text-indigo-600 shrink-0" />
          <h1 className="font-semibold text-gray-800 text-lg">Punto de venta</h1>
        </div>

        {/* Scanner */}
        <div className="px-4 pt-3 pb-2 border-b border-gray-100">
          <div className="relative">
            <Scan className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              ref={scanRef}
              type="text"
              placeholder={scanLoading ? "Buscando…" : "Escanear código de barras (Enter)"}
              className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-400 bg-indigo-50 placeholder-gray-400"
              value={scanInput}
              onChange={(e) => setScanInput(e.target.value)}
              onKeyDown={handleScan}
              autoFocus
              autoComplete="off"
            />
          </div>
        </div>

        {/* Text search */}
        <div className="px-4 py-2 border-b border-gray-100">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Buscar por nombre, código, SKU…"
              className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-400 placeholder-gray-400"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              autoComplete="off"
            />
            {searchQuery && (
              <button
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                onClick={() => { setSearchQuery(""); setSearchResults([]); }}
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>

        {/* Results list */}
        <div className="flex-1 overflow-y-auto">
          {searching && (
            <div className="flex items-center justify-center py-10 text-gray-400 text-sm gap-2">
              <RefreshCw className="w-4 h-4 animate-spin" /> Buscando…
            </div>
          )}

          {!searching && searchResults.length === 0 && searchQuery && (
            <div className="flex flex-col items-center justify-center py-10 text-gray-400 gap-2">
              <Package className="w-8 h-8" />
              <span className="text-sm">Sin resultados para "{searchQuery}"</span>
            </div>
          )}

          {!searching && searchResults.length === 0 && !searchQuery && (
            <div className="flex flex-col items-center justify-center py-16 text-gray-300 gap-3">
              <Search className="w-12 h-12" />
              <p className="text-sm font-medium">Escanea o busca un artículo</p>
            </div>
          )}

          {searchResults.map((art) => (
            <button
              key={art.id}
              className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-indigo-50 transition-colors border-b border-gray-50 group"
              onClick={() => handleAddArticle(art)}
            >
              {/* Image */}
              <div className="w-12 h-12 rounded-lg overflow-hidden bg-gray-100 shrink-0 flex items-center justify-center">
                {art.mainImageUrl ? (
                  <img src={art.mainImageUrl} alt={art.name} className="w-full h-full object-cover" />
                ) : (
                  <Package className="w-5 h-5 text-gray-300" />
                )}
              </div>

              <div className="flex-1 min-w-0">
                <p className="font-medium text-gray-800 text-sm truncate">{art.name}</p>
                <p className="text-xs text-gray-400 truncate">
                  {art.code}{art.sku ? ` · ${art.sku}` : ""}
                  {art.barcode ? ` · ${art.barcode}` : ""}
                </p>
              </div>

              <div className="text-right shrink-0">
                <p className="font-semibold text-sm text-gray-700">
                  {art.salePrice ? `$${fmt(parseFloat(art.salePrice))}` : "—"}
                </p>
                {(art.variants?.length ?? 0) > 0 && (
                  <p className="text-xs text-indigo-500">{art.variants!.length} variantes</p>
                )}
              </div>

              <ChevronRight className="w-4 h-4 text-gray-300 group-hover:text-indigo-400" />
            </button>
          ))}
        </div>
      </div>

      {/* ── RIGHT PANEL: Cart ─────────────────────────────────────────────── */}
      <div className="flex flex-col w-[420px] shrink-0 bg-white">
        {/* Cart header */}
        <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
          <span className="font-semibold text-gray-700">
            Carrito {totalLines > 0 && <span className="text-indigo-600">({totalLines})</span>}
          </span>
          {cart.length > 0 && (
            <button
              className="text-xs text-red-400 hover:text-red-600 flex items-center gap-1"
              onClick={clearCart}
            >
              <Trash2 className="w-3.5 h-3.5" /> Limpiar
            </button>
          )}
        </div>

        {/* Client selector */}
        <div className="px-4 py-2 border-b border-gray-100 relative">
          <div className="relative">
            <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            {selectedClient ? (
              <div className="flex items-center gap-2 pl-9 pr-8 py-2 bg-indigo-50 rounded-lg border border-indigo-200">
                <span className="text-sm font-medium text-indigo-700 truncate flex-1">
                  {selectedClient.displayName}
                </span>
                <button
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-red-400"
                  onClick={() => setSelectedClient(null)}
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            ) : (
              <input
                type="text"
                placeholder="Buscar cliente (opcional)…"
                className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-400 placeholder-gray-400"
                value={clientSearch}
                onChange={(e) => { setClientSearch(e.target.value); setShowClientDrop(true); }}
                onFocus={() => setShowClientDrop(true)}
                onBlur={() => setTimeout(() => setShowClientDrop(false), 200)}
                autoComplete="off"
              />
            )}
          </div>

          {/* Client dropdown */}
          {showClientDrop && !selectedClient && clientSearch && (
            <div className="absolute left-4 right-4 top-full z-30 bg-white border border-gray-200 rounded-lg shadow-lg mt-1 max-h-48 overflow-y-auto">
              {clientLoading && (
                <div className="p-3 text-sm text-gray-400 text-center">Buscando…</div>
              )}
              {!clientLoading && clientResults.length === 0 && (
                <div className="p-3 text-sm text-gray-400 text-center">Sin resultados</div>
              )}
              {clientResults.map((c) => (
                <button
                  key={c.id}
                  className="w-full text-left px-3 py-2 text-sm hover:bg-indigo-50 flex items-center gap-2"
                  onMouseDown={() => {
                    setSelectedClient(c);
                    setClientSearch("");
                    setShowClientDrop(false);
                  }}
                >
                  <User className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                  <span className="flex-1 truncate">{c.displayName}</span>
                  <span className="text-xs text-gray-400 shrink-0">{c.code}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Warehouse selector */}
        {warehouses.length > 1 && (
          <div className="px-4 py-2 border-b border-gray-100">
            <select
              className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-400 bg-white"
              value={selectedWarehouseId}
              onChange={(e) => setSelectedWarehouseId(e.target.value)}
            >
              <option value="">Sin almacén (no descuenta stock)</option>
              {warehouses.map((w) => (
                <option key={w.id} value={w.id}>{w.name} ({w.code})</option>
              ))}
            </select>
          </div>
        )}

        {/* Cart lines */}
        <div className="flex-1 overflow-y-auto">
          {cart.length === 0 && (
            <div className="flex flex-col items-center justify-center h-full text-gray-300 gap-3">
              <ShoppingCart className="w-12 h-12" />
              <p className="text-sm font-medium">El carrito está vacío</p>
            </div>
          )}

          {cart.map((line) => (
            <div key={line.key} className="px-4 py-3 border-b border-gray-50 group">
              <div className="flex items-start gap-3">
                {/* Image */}
                <div className="w-10 h-10 rounded-md overflow-hidden bg-gray-100 shrink-0 flex items-center justify-center mt-0.5">
                  {line.imageUrl ? (
                    <img src={line.imageUrl} alt={line.articleName} className="w-full h-full object-cover" />
                  ) : (
                    <Package className="w-4 h-4 text-gray-300" />
                  )}
                </div>

                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-700 truncate leading-tight">
                    {line.articleName}
                    {line.variantName && (
                      <span className="ml-1 text-xs text-gray-400">· {line.variantName}</span>
                    )}
                  </p>
                  <div className="flex items-center gap-1.5 flex-wrap">
                    {line.sku && <p className="text-xs text-gray-400">{line.sku}</p>}
                    {line.priceSource === "PROMOTION" && (
                      <span className="text-xs bg-red-100 text-red-700 px-1.5 py-0.5 rounded font-medium">
                        🏷 {line.appliedPromotionName ?? "Promo"}
                      </span>
                    )}
                    {line.priceSource === "QUANTITY_DISCOUNT" && (
                      <span className="text-xs bg-orange-100 text-orange-700 px-1.5 py-0.5 rounded font-medium">
                        📦 Desc. cantidad
                      </span>
                    )}
                    {line.priceSource === "PRICE_LIST" && (
                      <span className="text-xs bg-indigo-100 text-indigo-600 px-1.5 py-0.5 rounded">
                        {line.appliedPriceListName ?? "Lista"}
                      </span>
                    )}
                    {line.priceSource === "MANUAL_OVERRIDE" && (
                      <span className="text-xs bg-violet-100 text-violet-600 px-1.5 py-0.5 rounded">Manual</span>
                    )}
                    {line.priceSource === "VARIANT_OVERRIDE" && (
                      <span className="text-xs bg-teal-100 text-teal-700 px-1.5 py-0.5 rounded">Precio variante</span>
                    )}
                  </div>

                  {/* Price + discount */}
                  <div className="flex items-center gap-2 mt-1.5">
                    <div className="flex items-center border border-gray-200 rounded-md overflow-hidden">
                      <button
                        className="px-1.5 py-0.5 text-gray-500 hover:bg-gray-50 transition-colors"
                        onClick={() => updateQty(line.key, line.quantity - 1)}
                      >
                        <Minus className="w-3 h-3" />
                      </button>
                      <input
                        type="number"
                        min={1}
                        value={line.quantity}
                        onChange={(e) => updateQty(line.key, parseFloat(e.target.value) || 0)}
                        className="w-10 text-center text-sm py-0.5 border-x border-gray-200 focus:outline-none bg-white"
                      />
                      <button
                        className="px-1.5 py-0.5 text-gray-500 hover:bg-gray-50 transition-colors"
                        onClick={() => updateQty(line.key, line.quantity + 1)}
                      >
                        <Plus className="w-3 h-3" />
                      </button>
                    </div>

                    {/* Unit price */}
                    <div className="flex items-center gap-1">
                      <span className="text-xs text-gray-400">$</span>
                      <input
                        type="number"
                        min={0}
                        step={0.01}
                        value={line.unitPrice}
                        onChange={(e) => updatePrice(line.key, parseFloat(e.target.value) || 0)}
                        className="w-20 text-sm text-right border border-gray-200 rounded-md px-1.5 py-0.5 focus:outline-none focus:ring-1 focus:ring-indigo-400"
                      />
                    </div>

                    {/* Discount */}
                    <div className="flex items-center gap-1">
                      <input
                        type="number"
                        min={0}
                        max={100}
                        step={1}
                        value={line.discountPct || ""}
                        placeholder="0"
                        onChange={(e) => updateDiscount(line.key, parseFloat(e.target.value) || 0)}
                        className="w-12 text-sm text-right border border-gray-200 rounded-md px-1.5 py-0.5 focus:outline-none focus:ring-1 focus:ring-indigo-400"
                      />
                      <span className="text-xs text-gray-400">%</span>
                    </div>
                  </div>
                </div>

                <div className="text-right shrink-0">
                  <p className="font-semibold text-sm text-gray-800">${fmt(lineTotal(line))}</p>
                  {/* Margen real por línea */}
                  {line.unitCost != null ? (() => {
                    const tot   = lineTotal(line);
                    const cost  = line.unitCost * line.quantity;
                    const mPct  = tot > 0 ? ((tot - cost) / tot) * 100 : 0;
                    const isNeg = mPct < 0;
                    const isLow = !isNeg && mPct < 10;
                    return (
                      <span
                        className={`text-xs font-medium block mt-0.5 ${
                          isNeg ? "text-red-500"
                                : isLow ? "text-amber-600"
                                        : "text-green-600"
                        }`}
                        title={`Costo: $${(line.unitCost * line.quantity).toLocaleString("es-AR", { minimumFractionDigits: 2 })}`}
                      >
                        {mPct.toFixed(1)}%
                        {line.costPartial && <span className="ml-0.5 opacity-60">~</span>}
                      </span>
                    );
                  })() : (
                    <span
                      className="text-xs text-gray-300 block mt-0.5"
                      title={`Sin costo (${line.costMode})`}
                    >
                      Costo parcial
                    </span>
                  )}
                  <button
                    className="mt-1 text-gray-300 hover:text-red-400 transition-colors"
                    onClick={() => removeFromCart(line.key)}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Notes */}
        {cart.length > 0 && (
          <div className="px-4 py-2 border-t border-gray-100">
            <input
              type="text"
              placeholder="Nota interna (opcional)…"
              className="w-full text-xs border border-gray-200 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-indigo-400 placeholder-gray-400"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>
        )}

        {/* Totals + actions */}
        <div className="px-4 py-4 border-t border-gray-200 bg-gray-50">
          <div className="flex justify-between items-center mb-1">
            <span className="text-sm text-gray-500">Subtotal</span>
            <span className="text-sm text-gray-700 font-medium">${fmt(subtotal)}</span>
          </div>
          {cartMargin && (() => {
            const isNeg = cartMargin.margin < 0;
            const isLow = !isNeg && cartMargin.marginPct < 10;
            const color = isNeg ? "text-red-500" : isLow ? "text-amber-600" : "text-green-600";
            return (
              <div className="flex justify-between items-center mb-1">
                <span className="text-xs text-gray-400 flex items-center gap-1">
                  Margen est.
                  {(cartMargin.linesWithoutCost > 0 || cartMargin.hasPartial) && (
                    <span className="text-amber-500" title={`${cartMargin.linesWithoutCost} línea(s) sin costo disponible`}>⚠</span>
                  )}
                </span>
                <span className={`text-xs font-semibold ${color}`}>
                  ${fmt(cartMargin.margin)} · {cartMargin.marginPct.toFixed(1)}%
                </span>
              </div>
            );
          })()}
          <div className="flex justify-between items-center mb-3">
            <span className="font-semibold text-gray-800">Total</span>
            <span className="font-bold text-xl text-indigo-700">${fmt(subtotal)}</span>
          </div>

          <TPButton
            variant="primary"
            className="w-full justify-center"
            disabled={cart.length === 0}
            loading={confirming}
            onClick={handleConfirmAndPay}
          >
            <CreditCard className="w-4 h-4 mr-2" />
            Confirmar y cobrar
          </TPButton>
        </div>
      </div>

      {/* ── Variant Picker Modal ──────────────────────────────────────────── */}
      {variantPickerArticle && (
        <Modal
          open={!!variantPickerArticle}
          onClose={() => setVariantPickerArticle(null)}
          title={`Variantes de ${variantPickerArticle.name}`}
          maxWidth="sm"
        >
          {loadingPickerVariants ? (
            <div className="flex items-center justify-center py-8 text-gray-400 text-sm gap-2">
              <RefreshCw className="w-4 h-4 animate-spin" /> Cargando variantes…
            </div>
          ) : (
            <div className="space-y-2 max-h-80 overflow-y-auto">
              {variantPickerArticle.sellWithoutVariants && (
                <button
                  className="w-full text-left flex items-center justify-between px-4 py-3 rounded-lg border border-gray-200 hover:bg-indigo-50 hover:border-indigo-300 transition-colors"
                  onClick={async () => {
                    await resolveAndAdd(variantPickerArticle, null);
                    setVariantPickerArticle(null);
                  }}
                >
                  <span className="text-sm font-medium text-gray-700">Sin variante (artículo base)</span>
                  <span className="text-sm font-semibold text-gray-600">
                    ${fmt(parseFloat(variantPickerArticle.salePrice ?? "0") || 0)}
                  </span>
                </button>
              )}
              {(variantPickerDetail?.variants ?? variantPickerArticle.variants)
                ?.filter((v) => v.isActive)
                .map((v) => {
                  const stockQty  = variantStockMap[v.id];
                  const hasWh     = !!selectedWarehouseId;
                  const outOfStock = hasWh && stockQty !== undefined && stockQty <= 0;
                  return (
                    <button
                      key={v.id}
                      disabled={outOfStock}
                      className={`w-full text-left flex items-center justify-between px-4 py-3 rounded-lg border transition-colors ${
                        outOfStock
                          ? "border-gray-100 bg-gray-50 opacity-50 cursor-not-allowed"
                          : "border-gray-200 hover:bg-indigo-50 hover:border-indigo-300"
                      }`}
                      onClick={async () => {
                        if (outOfStock) return;
                        await resolveAndAdd(variantPickerArticle, v);
                        setVariantPickerArticle(null);
                      }}
                    >
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-700 truncate">
                          {variantLabel(v)}
                        </p>
                        {v.sku && <p className="text-xs text-gray-400">{v.sku}</p>}
                      </div>
                      <div className="flex flex-col items-end gap-1 ml-3 shrink-0">
                        <span className="text-sm font-semibold text-gray-600">
                          ${fmt(parseFloat(v.priceOverride ?? variantPickerArticle.salePrice ?? "0") || 0)}
                        </span>
                        {stockQty !== undefined && (
                          <span className={`text-xs font-medium ${stockQty > 0 ? "text-emerald-600" : "text-red-500"}`}>
                            {outOfStock ? "Sin stock" : `${stockQty.toLocaleString("es-AR")} disponibles`}
                          </span>
                        )}
                      </div>
                    </button>
                  );
                })}
            </div>
          )}
        </Modal>
      )}

      {/* ── Payment Modal ─────────────────────────────────────────────────── */}
      <Modal
        open={paymentModalOpen}
        onClose={() => {}} // intentionally non-closable unless confirmed/skipped
        title="Registrar cobro"
        maxWidth="sm"
      >
        {currentSale && (
          <div className="space-y-4">
            {/* Summary */}
            <div className="bg-indigo-50 rounded-lg px-4 py-3 flex items-center justify-between">
              <div>
                <p className="text-sm text-indigo-600 font-medium">{currentSale.code}</p>
                <p className="text-xs text-indigo-400">
                  {currentSale.lines.length} producto{currentSale.lines.length !== 1 ? "s" : ""}
                </p>
              </div>
              <div className="text-right">
                <p className="text-xs text-indigo-500">Total</p>
                <p className="text-xl font-bold text-indigo-700">${fmt(parseFloat(currentSale.total))}</p>
              </div>
            </div>

            {/* Paid so far */}
            {parseFloat(currentSale.paidAmount) > 0 && (
              <div className="text-sm text-gray-600 flex justify-between">
                <span>Ya cobrado:</span>
                <span className="font-medium text-green-600">${fmt(parseFloat(currentSale.paidAmount))}</span>
              </div>
            )}

            {/* Remaining */}
            {parseFloat(currentSale.paidAmount) > 0 && (
              <div className="text-sm font-semibold text-gray-700 flex justify-between border-t pt-2">
                <span>Resta cobrar:</span>
                <span className="text-indigo-700">
                  ${fmt(Math.max(0, parseFloat(currentSale.total) - parseFloat(currentSale.paidAmount)))}
                </span>
              </div>
            )}

            {/* Payment methods */}
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1.5">Método de pago</label>
              <div className="grid grid-cols-2 gap-2">
                {paymentMethods.map((pm) => (
                  <button
                    key={pm.id}
                    className={`px-3 py-2 rounded-lg border text-sm font-medium transition-colors text-left ${
                      payingMethodId === pm.id
                        ? "bg-indigo-600 text-white border-indigo-600"
                        : "bg-white text-gray-700 border-gray-200 hover:border-indigo-300"
                    }`}
                    onClick={() => setPayingMethodId(pm.id)}
                  >
                    {pm.name}
                  </button>
                ))}
                <button
                  className={`px-3 py-2 rounded-lg border text-sm font-medium transition-colors text-left ${
                    payingMethodId === ""
                      ? "bg-indigo-600 text-white border-indigo-600"
                      : "bg-white text-gray-700 border-gray-200 hover:border-indigo-300"
                  }`}
                  onClick={() => setPayingMethodId("")}
                >
                  Otro
                </button>
              </div>
            </div>

            {/* Amount */}
            <TPField label="Monto recibido">
              <TPNumberInput
                value={payingAmount}
                onChange={setPayingAmount}
                placeholder="0.00"
                min={0}
              />
            </TPField>

            {/* Reference */}
            <TPField label="Referencia (opcional)">
              <TPInput
                value={payingRef}
                onChange={(v) => setPayingRef(v)}
                placeholder="Nro. de autorización, cheque…"
              />
            </TPField>

            {/* Change */}
            {payingAmount !== null && payingAmount > 0 && (
              (() => {
                const total = parseFloat(currentSale.total);
                const paid = parseFloat(currentSale.paidAmount);
                const remaining = Math.max(0, total - paid);
                const change = payingAmount - remaining;
                return change > 0.005 ? (
                  <div className="bg-green-50 border border-green-200 rounded-lg px-4 py-2 text-sm text-green-700 flex justify-between">
                    <span>Vuelto:</span>
                    <span className="font-semibold">${fmt(change)}</span>
                  </div>
                ) : null;
              })()
            )}

            {/* Actions */}
            <div className="flex gap-2 pt-1">
              <TPButton
                variant="primary"
                className="flex-1 justify-center"
                loading={paying}
                disabled={!payingAmount || payingAmount <= 0}
                onClick={handleAddPayment}
              >
                <CheckCircle className="w-4 h-4 mr-1.5" />
                Registrar cobro
              </TPButton>
              <TPButton
                variant="secondary"
                onClick={handleConfirmOnly}
                disabled={paying}
              >
                Cobrar después
              </TPButton>
            </div>
          </div>
        )}
      </Modal>

      {/* ── Completed Modal ───────────────────────────────────────────────── */}
      <Modal
        open={!!completedSale}
        onClose={() => setCompletedSale(null)}
        title="Venta finalizada"
        maxWidth="sm"
      >
        {completedSale && (
          <div className="space-y-4 text-center">
            <div className="flex justify-center">
              <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center">
                <CheckCircle className="w-10 h-10 text-green-500" />
              </div>
            </div>

            <div>
              <p className="text-lg font-bold text-gray-800">{completedSale.code}</p>
              <p className="text-sm text-gray-500">
                {completedSale.status === "PAID" ? "Pagada completamente" : "Confirmada — cobro pendiente"}
              </p>
            </div>

            <div className="bg-gray-50 rounded-lg px-4 py-3 text-left space-y-1">
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Subtotal</span>
                <span className="text-gray-700">${fmt(parseFloat(completedSale.subtotal))}</span>
              </div>
              <div className="flex justify-between text-sm font-semibold border-t pt-1">
                <span>Total</span>
                <span className="text-indigo-700">${fmt(parseFloat(completedSale.total))}</span>
              </div>
              {parseFloat(completedSale.paidAmount) > 0 && (
                <div className="flex justify-between text-sm text-green-600">
                  <span>Cobrado</span>
                  <span>${fmt(parseFloat(completedSale.paidAmount))}</span>
                </div>
              )}
            </div>

            <div className="flex gap-2">
              <TPButton
                variant="secondary"
                className="flex-1 justify-center"
                onClick={() => { setCompletedSale(null); scanRef.current?.focus(); }}
              >
                Nueva venta
              </TPButton>
              <TPButton
                variant="primary"
                className="flex-1 justify-center"
                onClick={() => navigate(`/ventas/${completedSale.id}`)}
              >
                Ver detalle
              </TPButton>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
