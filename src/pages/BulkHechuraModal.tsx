// src/pages/BulkHechuraModal.tsx
// Modal para actualización masiva de hechuras (artículos y/o variantes).

import React, { useEffect, useState, useCallback } from "react";
import { Modal } from "../components/ui/Modal";
import { TPButton } from "../components/ui/TPButton";
import { TPField } from "../components/ui/TPField";
import TPNumberInput from "../components/ui/TPNumberInput";
import TPComboFixed from "../components/ui/TPComboFixed";
import TPComboMulti from "../components/ui/TPComboMulti";
import { TPCard } from "../components/ui/TPCard";
import { articlesApi } from "../services/articles";
import { fmtMoney2 } from "../lib/format";
import { categoriesApi, type CategoryRow } from "../services/categories";
import { articleGroupsApi, type ArticleGroupRow } from "../services/article-groups";
import { getMetals, getVariants, getCurrencies, type MetalRow, type MetalVariantRow, type CurrencyRow } from "../services/valuation";
import { commercialEntitiesApi, type EntityRow } from "../services/commercial-entities";
import { ChevronRight, AlertTriangle, CheckCircle2, Loader2, X as XIcon, RotateCcw } from "lucide-react";
import { buildCategoryTree, type CategoryNode } from "./configuracion-sistema/categorias-tree.helpers";

// -----------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------
type AdjType  = "PERCENTAGE" | "FIXED";
type Direction = "ADD" | "SUBTRACT";
type Scope    = "ARTICLE" | "VARIANTS" | "BOTH";

interface MetalVariantOpt { id: string; label: string }
interface SupplierOpt { id: string; name: string }
interface MetalOpt { id: string; name: string }
interface CurrencyOpt { id: string; code: string; symbol: string; isBase: boolean }

interface PreviewItem {
  articleId: string;
  articleName: string;
  articleSku?: string;
  kind: "article" | "cost_line" | "variant";
  variantId?: string;
  variantName?: string;
  variantSku?: string;
  costLineId?: string;
  costLineLabel?: string;
  costLineCurrencyCode?: string;
  oldValue: number | null;
  newValue: number | null;
  currencyMismatch?: boolean;
}

type Step = "config" | "preview" | "done";

interface Props {
  open: boolean;
  onClose: () => void;
  /** IDs preseleccionados (opcional). Si se pasan, el filtro "IDs explícitos" está activo. */
  preSelectedIds?: string[];
}

// -----------------------------------------------------------------------
// Helpers
// -----------------------------------------------------------------------

// -----------------------------------------------------------------------
// Component
// -----------------------------------------------------------------------
export default function BulkHechuraModal({ open, onClose, preSelectedIds }: Props) {
  // -- Config --
  const [adjType,    setAdjType]    = useState<AdjType>("PERCENTAGE");
  const [direction,  setDirection]  = useState<Direction>("ADD");
  const [value,      setValue]      = useState<number | null>(null);
  const [currencyId, setCurrencyId] = useState<string>("");  // "" = moneda base
  const scope: Scope = "BOTH"; // siempre artículos y variantes

  // -- Filters --
  const [categoryId,      setCategoryId]      = useState("");
  const [groupId,         setGroupId]         = useState("");
  const [metalVariantIds, setMetalVariantIds] = useState<string[]>([]);  // multi
  const [brand,           setBrand]           = useState("");             // single
  const [supplierId,      setSupplierId]      = useState("");             // single
  const [metalIds,        setMetalIds]        = useState<string[]>([]);  // multi
  const usePreSelected = (preSelectedIds?.length ?? 0) > 0;

  // -- Data for filters --
  const [categories,    setCategories]    = useState<CategoryRow[]>([]);
  const [groups,        setGroups]        = useState<ArticleGroupRow[]>([]);
  const [metalVariants, setMetalVariants] = useState<MetalVariantOpt[]>([]);
  const [suppliers,     setSuppliers]     = useState<SupplierOpt[]>([]);
  const [metals,        setMetals]        = useState<MetalOpt[]>([]);
  const [brandNames,    setBrandNames]    = useState<string[]>([]);
  const [currencies,    setCurrencies]    = useState<CurrencyOpt[]>([]);

  // -- Flow state --
  const [step,         setStep]         = useState<Step>("config");
  const [previewItems, setPreviewItems] = useState<PreviewItem[]>([]);
  /** Claves de ítems excluidos manualmente desde el preview (no se actualizarán). */
  const [excluded,     setExcluded]     = useState<Set<string>>(new Set());
  const [busy,         setBusy]         = useState(false);
  const [error,        setError]        = useState<string | null>(null);
  const [submitted,    setSubmitted]    = useState(false);
  const [result,       setResult]       = useState<{ articlesUpdated: number; variantsUpdated: number } | null>(null);

  // -- Load filter data --
  useEffect(() => {
    if (!open) return;
    categoriesApi.list().then(setCategories).catch(() => {});
    articleGroupsApi.list().then(setGroups).catch(() => {});
    articlesApi.listBrands().then((res) => setBrandNames(res.brands ?? [])).catch(() => {});
    commercialEntitiesApi.list({ role: "supplier", take: 200 } as any)
      .then((res) => setSuppliers((res.rows ?? []).map((e: EntityRow) => ({ id: e.id, name: e.displayName }))))
      .catch(() => {});

    getCurrencies()
      .then((res: any) => {
        const rows: CurrencyRow[] = Array.isArray(res) ? res : (res?.rows ?? []);
        setCurrencies(rows.map((c) => ({ id: c.id, code: c.code, symbol: c.symbol, isBase: c.isBase })));
      })
      .catch(() => {});

    // Cargar metales y sus variantes para los filtros
    getMetals().then(async (data: any) => {
      const metalRows: MetalRow[] = Array.isArray(data) ? data : (data?.rows ?? []);
      setMetals(metalRows.map((m) => ({ id: m.id, name: m.name })));
      const opts: MetalVariantOpt[] = [];
      for (const m of metalRows) {
        const vData: any = await getVariants(m.id, { isActive: true }).catch(() => []);
        const variants: MetalVariantRow[] = Array.isArray(vData) ? vData : (vData?.rows ?? []);
        for (const v of variants) {
          opts.push({ id: v.id, label: `${m.name} — ${v.name}${v.sku ? ` (${v.sku})` : ""}` });
        }
      }
      setMetalVariants(opts);
    }).catch(() => {});
  }, [open]);

  // Reset on open
  useEffect(() => {
    if (!open) return;
    setStep("config");
    setAdjType("PERCENTAGE");
    setDirection("ADD");
    setValue(null);
    setCurrencyId("");
    setCategoryId("");
    setGroupId("");
    setMetalVariantIds([]);
    setBrand("");
    setSupplierId("");
    setMetalIds([]);
    setPreviewItems([]);
    setExcluded(new Set());
    setError(null);
    setSubmitted(false);
    setResult(null);
  }, [open]);

  // -- Item key (clave única por fila de preview) --
  function itemKey(item: PreviewItem): string {
    if (item.kind === "cost_line") return `cl:${item.costLineId}`;
    if (item.kind === "variant")   return `v:${item.variantId}`;
    return `art:${item.articleId}`;
  }

  // -- Build params --
  function buildParams(isPreview: boolean) {
    // Para apply: calcular los IDs excluidos por tipo
    const excludedArticleIds  = !isPreview
      ? previewItems.filter(i => i.kind === "article"   && excluded.has(itemKey(i))).map(i => i.articleId)
      : undefined;
    const excludedVariantIds  = !isPreview
      ? previewItems.filter(i => i.kind === "variant"   && excluded.has(itemKey(i))).map(i => i.variantId!)
      : undefined;
    const excludedCostLineIds = !isPreview
      ? previewItems.filter(i => i.kind === "cost_line" && excluded.has(itemKey(i))).map(i => i.costLineId!)
      : undefined;

    return {
      adjustType: adjType,
      direction,
      value: value ?? 0,
      scope,
      preview: isPreview,
      // Para FIXED: enviar currencyId seleccionado ("" = base = undefined)
      currencyId:          adjType === "FIXED" ? (currencyId || undefined) : undefined,
      ids:                 usePreSelected ? preSelectedIds : undefined,
      categoryId:          categoryId        || undefined,
      groupId:             groupId           || undefined,
      metalVariantIds:     metalVariantIds.length ? metalVariantIds : undefined,
      brand:               brand             || undefined,
      preferredSupplierId: supplierId        || undefined,
      metalIds:            metalIds.length   ? metalIds     : undefined,
      excludedArticleIds:   excludedArticleIds?.length  ? excludedArticleIds  : undefined,
      excludedVariantIds:   excludedVariantIds?.length  ? excludedVariantIds  : undefined,
      excludedCostLineIds:  excludedCostLineIds?.length ? excludedCostLineIds : undefined,
    };
  }

  // -- Preview --
  const handlePreview = useCallback(async () => {
    setSubmitted(true);
    if (!value || value <= 0) return;
    setBusy(true);
    setError(null);
    try {
      const res = await articlesApi.bulkHechura({ ...buildParams(true) });
      setPreviewItems(res.items ?? []);
      setExcluded(new Set()); // resetear exclusiones al regenerar
      setStep("preview");
    } catch (e: any) {
      setError(e?.data?.message ?? e?.message ?? "Error al generar la vista previa.");
    } finally {
      setBusy(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [adjType, direction, value, scope, currencyId, usePreSelected, preSelectedIds, categoryId, groupId, metalVariantIds, brand, supplierId, metalIds]);

  // -- Apply --
  const handleApply = useCallback(async () => {
    setBusy(true);
    setError(null);
    try {
      const res = await articlesApi.bulkHechura({ ...buildParams(false) });
      setResult({ articlesUpdated: res.articlesUpdated, variantsUpdated: res.variantsUpdated });
      setStep("done");
    } catch (e: any) {
      setError(e?.data?.message ?? e?.message ?? "Error al aplicar los cambios.");
    } finally {
      setBusy(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [adjType, direction, value, scope, currencyId, excluded, usePreSelected, preSelectedIds, categoryId, groupId, metalVariantIds, brand, supplierId, metalIds]);

  // -- Metal variants flat list (multi) --
  const metalVariantMultiOptions = React.useMemo(() =>
    metalVariants.map((v) => ({ value: v.id, label: v.label })),
  [metalVariants]);

  const categoryOptions = React.useMemo(() => {
    const tree = buildCategoryTree(categories);
    const result: { value: string; label: string; depth: number }[] = [];
    function traverse(nodes: CategoryNode[]) {
      for (const node of nodes) {
        result.push({ value: node.id, label: node.name, depth: node.level });
        traverse(node.children);
      }
    }
    traverse(tree);
    return [{ value: "", label: "Todas las categorías", depth: 0 }, ...result];
  }, [categories]);

  const groupOptions = React.useMemo(() => [
    { value: "", label: "Todos los grupos" },
    ...groups.map((g) => ({ value: g.id, label: g.name })),
  ], [groups]);

  const brandComboOptions = React.useMemo(() => [
    { value: "", label: "Todas las marcas" },
    ...brandNames.map((b) => ({ value: b, label: b })),
  ], [brandNames]);

  const supplierComboOptions = React.useMemo(() => [
    { value: "", label: "Todos los proveedores" },
    ...suppliers.map((s) => ({ value: s.id, label: s.name })),
  ], [suppliers]);

  const metalsMultiOptions = React.useMemo(() =>
    metals.map((m) => ({ value: m.id, label: m.name })),
  [metals]);

  const currencyOptions = React.useMemo(() => {
    const base = currencies.find((c) => c.isBase);
    const baseLabel = base ? `Moneda base (${base.code})` : "Moneda base";
    return [
      { value: "", label: baseLabel },
      ...currencies.filter((c) => !c.isBase).map((c) => ({ value: c.id, label: `${c.code} — ${c.symbol}` })),
    ];
  }, [currencies]);

  // code → symbol para el formateo del preview
  const currencySymbolMap = React.useMemo(() => {
    const m: Record<string, string> = {};
    for (const c of currencies) m[c.code] = c.symbol;
    return m;
  }, [currencies]);

  const baseCurrencySymbol = React.useMemo(
    () => currencies.find((c) => c.isBase)?.symbol ?? "$",
    [currencies],
  );

  // Símbolo para el TPNumberInput según el modo de ajuste y moneda seleccionada
  const inputSymbol = React.useMemo(() => {
    if (adjType === "PERCENTAGE") return "%";
    if (currencyId) return currencies.find((c) => c.id === currencyId)?.symbol ?? baseCurrencySymbol;
    return baseCurrencySymbol;
  }, [adjType, currencyId, currencies, baseCurrencySymbol]);

  const valueError = submitted && (!value || value <= 0) ? "Ingresá un valor mayor a 0." : null;

  const hasActiveFilters =
    !!categoryId || !!groupId || !!brand || !!supplierId ||
    metalVariantIds.length > 0 || metalIds.length > 0;

  function clearFilters() {
    setCategoryId("");
    setGroupId("");
    setBrand("");
    setSupplierId("");
    setMetalVariantIds([]);
    setMetalIds([]);
  }

  // -----------------------------------------------------------------------
  // Preview helpers (fuera del JSX para evitar redefinición en cada render)
  // -----------------------------------------------------------------------
  // applicable = tiene valor Y no es mismatch de moneda (incluyendo excluidos manualmente)
  const applicable = previewItems.filter((i) => i.oldValue != null && !i.currencyMismatch);
  // applicableActive = applicable menos los excluidos manualmente → lo que REALMENTE se actualizará
  const applicableActive = applicable.filter((i) => !excluded.has(itemKey(i)));
  // skipped = sin hechura (oldValue null) O mismatch de moneda
  const skipped = previewItems.filter((i) => i.oldValue == null || i.currencyMismatch);

  function itemLabel(item: PreviewItem): string {
    if (item.kind === "variant")   return `${item.articleName} / ${item.variantName}`;
    if (item.kind === "cost_line") return `${item.articleName} — ${item.costLineLabel ?? "Hechura"}`;
    return item.articleName;
  }

  function renderPreviewRow(item: PreviewItem, idx: number) {
    const isMismatch   = item.currencyMismatch === true;
    const key          = itemKey(item);
    const isExcluded   = excluded.has(key);
    // Filas no elegibles (mismatch/sin hechura) no tienen botón de exclusión
    const isEligible   = item.oldValue != null && !isMismatch;
    const sku          = item.kind === "variant" ? (item.variantSku ?? item.articleSku) : item.articleSku;

    const sym =
      item.kind === "cost_line" && item.costLineCurrencyCode
        ? (currencySymbolMap[item.costLineCurrencyCode] ?? item.costLineCurrencyCode)
        : baseCurrencySymbol;

    function toggleExclusion() {
      setExcluded((prev) => {
        const next = new Set(prev);
        if (next.has(key)) next.delete(key); else next.add(key);
        return next;
      });
    }

    return (
      <div
        key={`${item.articleId}-${item.variantId ?? item.costLineId ?? "art"}-${idx}`}
        className={[
          "grid grid-cols-[1fr_auto_auto_auto_auto] items-center gap-2 px-3 py-2 text-sm transition-colors",
          isExcluded   ? "opacity-40 bg-surface2/30" :
          isMismatch   ? "opacity-50" :
          "hover:bg-surface2/20",
        ].join(" ")}
      >
        {/* Columna 1: nombre */}
        <div className="min-w-0 truncate">
          {item.kind === "variant" ? (
            <span>
              <span className="text-xs text-muted mr-1">{item.articleName} /</span>
              <span className="text-text opacity-80">{item.variantName}</span>
            </span>
          ) : item.kind === "cost_line" ? (
            <span className="flex items-center gap-1.5 flex-wrap">
              <span className="font-medium">{item.articleName}</span>
              <span className="text-xs text-muted">({item.costLineLabel ?? "Hechura"})</span>
              {item.costLineCurrencyCode && (
                <span className="text-xs bg-border/40 rounded px-1 py-0.5 leading-none">
                  {item.costLineCurrencyCode}
                </span>
              )}
              {isMismatch && (
                <span className="text-xs text-amber-600">moneda distinta — omitida</span>
              )}
            </span>
          ) : (
            <span className="font-medium">{item.articleName}</span>
          )}
          {isExcluded && (
            <span className="ml-2 text-[10px] font-semibold uppercase tracking-wide text-muted border border-border rounded px-1 py-0.5 leading-none">
              excluido
            </span>
          )}
        </div>

        {/* Columna 2: SKU */}
        <span className="text-right tabular-nums w-24 text-muted shrink-0 font-mono text-xs">
          {sku ?? "—"}
        </span>

        {/* Columna 3: Actual */}
        <span className="text-right tabular-nums w-28 text-muted shrink-0">
          {fmtMoney2(sym, item.oldValue)}
        </span>

        {/* Columna 4: Nuevo */}
        <span className={[
          "text-right tabular-nums w-28 font-semibold shrink-0",
          isExcluded || isMismatch ? "text-muted" : "text-primary",
        ].join(" ")}>
          {fmtMoney2(sym, item.newValue)}
        </span>

        {/* Columna 5: acción toggle */}
        <div className="w-6 flex items-center justify-center shrink-0">
          {isEligible && (
            <button
              type="button"
              title={isExcluded ? "Volver a incluir" : "Excluir de la actualización"}
              onClick={toggleExclusion}
              className={[
                "flex items-center justify-center w-5 h-5 rounded transition-colors",
                isExcluded
                  ? "text-primary hover:text-primary/70"
                  : "text-muted hover:text-red-500",
              ].join(" ")}
            >
              {isExcluded
                ? <RotateCcw size={12} />
                : <XIcon size={12} />
              }
            </button>
          )}
        </div>
      </div>
    );
  }

  function renderPreview() {
    if (busy) {
      return (
        <div className="flex items-center justify-center gap-2 py-10 text-muted text-sm">
          <Loader2 size={16} className="animate-spin" />
          Calculando vista previa…
        </div>
      );
    }

    // Sin artículos que coincidan con el filtro
    if (previewItems.length === 0) {
      return (
        <div className="flex items-center justify-center py-10 text-muted text-sm">
          No hay artículos que coincidan con los filtros seleccionados.
        </div>
      );
    }

    // Encontró artículos pero ninguno aplica (sin hechura o todos mismatch)
    if (applicable.length === 0) {
      const mismatchCount = skipped.filter((i) => i.currencyMismatch).length;
      const noHechuraCount = skipped.filter((i) => !i.currencyMismatch && i.oldValue == null).length;
      return (
        <div className="space-y-3">
          <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 space-y-2">
            <p className="text-sm font-semibold text-amber-800">
              Ningún registro será actualizado
            </p>
            <p className="text-xs text-amber-700">
              {mismatchCount > 0 && noHechuraCount === 0 && (
                <>
                  {mismatchCount} línea{mismatchCount !== 1 ? "s" : ""} encontrada{mismatchCount !== 1 ? "s" : ""},
                  pero {mismatchCount !== 1 ? "todas tienen" : "tiene"} una moneda distinta a la seleccionada.
                  Cambiá la moneda o elegí otra.
                </>
              )}
              {noHechuraCount > 0 && mismatchCount === 0 && (
                <>
                  Se encontraron {noHechuraCount} artículo{noHechuraCount !== 1 ? "s" : ""}, pero ninguno tiene
                  un valor de hechura definido. Configurá la hechura en cada artículo antes de usar la actualización masiva.
                </>
              )}
              {noHechuraCount > 0 && mismatchCount > 0 && (
                <>
                  {noHechuraCount} sin hechura y {mismatchCount} con moneda distinta a la seleccionada.
                </>
              )}
            </p>
            <ul className="space-y-0.5 text-xs text-amber-700">
              {skipped.slice(0, 6).map((item, i) => (
                <li key={i} className="truncate">
                  · {itemLabel(item)}{item.currencyMismatch ? ` (${item.costLineCurrencyCode ?? "otra moneda"})` : ""}
                </li>
              ))}
              {skipped.length > 6 && <li className="opacity-60">… y {skipped.length - 6} más</li>}
            </ul>
          </div>
          {error && (
            <div className="flex items-start gap-2 rounded-xl bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-700">
              <AlertTriangle size={14} className="mt-0.5 shrink-0" />
              <span>{error}</span>
            </div>
          )}
        </div>
      );
    }

    // Hay registros actualizables → mostrar tabla
    return (
      <div className="space-y-3">
        <div className="rounded-xl border border-border overflow-hidden">
          <div className="grid grid-cols-[1fr_auto_auto_auto_auto] gap-2 px-3 py-2 bg-surface2/30 text-xs font-semibold text-muted border-b border-border">
            <span>Artículo / Variante</span>
            <span className="text-right w-24">SKU</span>
            <span className="text-right w-28">Actual</span>
            <span className="text-right w-28">Nuevo</span>
            <span className="w-6" />
          </div>
          <div className="divide-y divide-border max-h-[320px] overflow-y-auto tp-scroll">
            {previewItems.map((item, i) => renderPreviewRow(item, i))}
          </div>
        </div>

        <div className="flex items-center justify-between text-xs gap-4">
          <span className="text-muted">
            {excluded.size > 0
              ? `${excluded.size} excluido${excluded.size !== 1 ? "s" : ""} manualmente`
              : ""}
          </span>
          <span className="font-medium text-muted shrink-0">
            {applicableActive.length} registro{applicableActive.length !== 1 ? "s" : ""} serán actualizados
          </span>
        </div>

        {error && (
          <div className="flex items-start gap-2 rounded-xl bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-700">
            <AlertTriangle size={14} className="mt-0.5 shrink-0" />
            <span>{error}</span>
          </div>
        )}
      </div>
    );
  }

  // -- Footer --
  const footer = step === "config" ? (
    <>
      <TPButton variant="ghost" onClick={onClose} disabled={busy}>Cancelar</TPButton>
      <TPButton variant="primary" onClick={handlePreview} loading={busy} iconRight={<ChevronRight size={14} />}>
        Vista previa
      </TPButton>
    </>
  ) : step === "preview" ? (
    <>
      <TPButton variant="ghost" onClick={() => setStep("config")} disabled={busy}>Volver</TPButton>
      <TPButton variant="primary" onClick={handleApply} loading={busy}
        disabled={applicableActive.length === 0}
      >
        Aplicar cambios ({applicableActive.length})
      </TPButton>
    </>
  ) : (
    <TPButton variant="primary" onClick={onClose}>Cerrar</TPButton>
  );

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Actualización de precios masivos"
      subtitle={step === "config" ? "Configurá el ajuste y los filtros" : step === "preview" ? "Revisá los cambios antes de aplicar" : "Cambios aplicados"}
      maxWidth="6xl"
      busy={busy}
      footer={footer}
    >
      {/* ---------------------------------------------------------------- */}
      {/* STEP: config                                                     */}
      {/* ---------------------------------------------------------------- */}
      {step === "config" && (
        <div className="space-y-4">

          {/* Tipo de ajuste */}
          <TPCard title="Tipo de ajuste">
            <div className="space-y-3">
              {/* Tipo: porcentaje / monto fijo */}
              <TPField label="Tipo">
                <div className="flex gap-2">
                  {(["PERCENTAGE", "FIXED"] as AdjType[]).map((t) => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => setAdjType(t)}
                      className={[
                        "flex-1 rounded-xl border py-2 text-sm font-medium transition",
                        adjType === t
                          ? "border-primary bg-primary/10 text-primary"
                          : "border-border bg-surface2/30 text-muted hover:border-primary/30",
                      ].join(" ")}
                    >
                      {t === "PERCENTAGE" ? "Porcentaje (%)" : "Monto fijo ($)"}
                    </button>
                  ))}
                </div>
              </TPField>

              {/* Dirección: sumar / restar */}
              <TPField label="Dirección">
                <div className="flex gap-2">
                  {(["ADD", "SUBTRACT"] as Direction[]).map((d) => (
                    <button
                      key={d}
                      type="button"
                      onClick={() => setDirection(d)}
                      className={[
                        "flex-1 rounded-xl border py-2 text-sm font-medium transition",
                        direction === d
                          ? "border-primary bg-primary/10 text-primary"
                          : "border-border bg-surface2/30 text-muted hover:border-primary/30",
                      ].join(" ")}
                    >
                      {d === "ADD" ? "+ Sumar" : "− Restar"}
                    </button>
                  ))}
                </div>
              </TPField>

              {/* Moneda — solo para monto fijo (va ANTES del monto) */}
              {adjType === "FIXED" && (
                <TPField label="Moneda" required>
                  <TPComboFixed
                    value={currencyId}
                    onChange={setCurrencyId}
                    options={currencyOptions}
                    searchable={false}
                  />
                  <p className="text-xs text-muted mt-1">
                    Solo se actualizarán las líneas de hechura con esa moneda. Las demás se omitirán.
                  </p>
                </TPField>
              )}

              {/* Valor */}
              <TPField label={adjType === "PERCENTAGE" ? "Porcentaje" : "Monto"} required error={valueError}>
                <TPNumberInput
                  value={value}
                  onChange={setValue}
                  min={0}
                  step={adjType === "PERCENTAGE" ? 1 : 0.01}
                  decimals={adjType === "PERCENTAGE" ? 2 : 4}
                  placeholder={adjType === "PERCENTAGE" ? "Ej: 10" : "Ej: 500"}
                  suffix={<span className="font-semibold">{inputSymbol}</span>}
                />
              </TPField>

            </div>
          </TPCard>

          {/* Filtros */}
          <TPCard
            title="Filtros (opcional)"
            right={
              <button
                type="button"
                onClick={clearFilters}
                disabled={!hasActiveFilters}
                className="flex items-center gap-1 text-xs text-muted hover:text-primary transition disabled:opacity-40 disabled:pointer-events-none"
              >
                <RotateCcw size={11} />
                Limpiar filtros
              </button>
            }
          >
            <div className="space-y-3">
              {usePreSelected && (
                <div className="flex items-center gap-2 rounded-xl bg-primary/10 border border-primary/20 px-3 py-2 text-sm text-primary">
                  <CheckCircle2 size={14} />
                  <span>Aplicar solo a los <strong>{preSelectedIds!.length}</strong> artículos seleccionados.</span>
                </div>
              )}

              <TPField label="Proveedor preferido">
                <TPComboFixed
                  value={supplierId}
                  onChange={setSupplierId}
                  options={supplierComboOptions}
                  searchable
                />
              </TPField>

              <TPField label="Categoría">
                <TPComboFixed
                  value={categoryId}
                  onChange={setCategoryId}
                  options={categoryOptions}
                  searchable
                />
              </TPField>

              <TPField label="Grupo">
                <TPComboFixed
                  value={groupId}
                  onChange={setGroupId}
                  options={groupOptions}
                  searchable
                />
              </TPField>

              <TPField label="Marca">
                <TPComboFixed
                  value={brand}
                  onChange={setBrand}
                  options={brandComboOptions}
                  searchable
                />
              </TPField>

              <TPField label="Metal padre">
                <TPComboMulti
                  value={metalIds}
                  onChange={setMetalIds}
                  options={metalsMultiOptions}
                  placeholder="Todos los metales"
                  searchable
                />
              </TPField>

              <TPField label="Metal / variante">
                <TPComboMulti
                  value={metalVariantIds}
                  onChange={setMetalVariantIds}
                  options={metalVariantMultiOptions}
                  placeholder="Todas las variantes"
                  searchable
                />
              </TPField>
            </div>
          </TPCard>

          {error && (
            <div className="flex items-start gap-2 rounded-xl bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-700">
              <AlertTriangle size={14} className="mt-0.5 shrink-0" />
              <span>{error}</span>
            </div>
          )}
        </div>
      )}

      {/* ---------------------------------------------------------------- */}
      {/* STEP: preview                                                    */}
      {/* ---------------------------------------------------------------- */}
      {step === "preview" && renderPreview()}

      {/* ---------------------------------------------------------------- */}
      {/* STEP: done                                                       */}
      {/* ---------------------------------------------------------------- */}
      {step === "done" && result && (
        <div className="flex flex-col items-center gap-4 py-8 text-center">
          <CheckCircle2 size={40} className="text-emerald-500" />
          <div>
            <p className="text-lg font-bold text-text">Precios actualizados</p>
            <p className="text-sm text-muted mt-1">
              {result.articlesUpdated > 0 && (
                <span>{result.articlesUpdated} artículo{result.articlesUpdated !== 1 ? "s" : ""}</span>
              )}
              {result.articlesUpdated > 0 && result.variantsUpdated > 0 && <span> y </span>}
              {result.variantsUpdated > 0 && (
                <span>{result.variantsUpdated} variante{result.variantsUpdated !== 1 ? "s" : ""}</span>
              )}
              {result.articlesUpdated === 0 && result.variantsUpdated === 0 && (
                <span>Ningún registro fue modificado (todos tenían hechura vacía).</span>
              )}
            </p>
          </div>
          {error && (
            <div className="flex items-start gap-2 rounded-xl bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-700">
              <AlertTriangle size={14} className="mt-0.5 shrink-0" />
              <span>{error}</span>
            </div>
          )}
        </div>
      )}
    </Modal>
  );
}
