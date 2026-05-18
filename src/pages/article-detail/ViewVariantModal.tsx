// src/pages/article-detail/ViewVariantModal.tsx
// Vista de solo lectura de una variante específica.
// Se abre desde la tabla de artículos al hacer "Ver variante".
import React, { useMemo } from "react";
import { formatDecimal } from "../../lib/pricing/format";
import { ExternalLink, Layers, Package, Pencil, X } from "lucide-react";
import { Modal } from "../../components/ui/Modal";
import { TPButton } from "../../components/ui/TPButton";
import { TPStatusPill } from "../../components/ui/TPStatusPill";
import { cn } from "../../components/ui/tp";
import {
  type ArticleVariant,
  type ArticleRow,
  fmtMoney,
  fmtQty,
  variantLabel,
} from "../../services/articles";

/* ── helpers ─────────────────────────────────────────────────── */
function Dash({ value }: { value: string | number | null | undefined }) {
  const str = value != null ? String(value).trim() : "";
  return <span>{str || "—"}</span>;
}

type FieldRowProps = { label: string; value?: React.ReactNode; mono?: boolean; subtle?: boolean };
function FieldRow({ label, value, mono, subtle }: FieldRowProps) {
  return (
    <div className="flex items-baseline justify-between gap-4 py-1.5 border-b border-border/30 last:border-0">
      <span className="text-xs text-muted shrink-0">{label}</span>
      <span
        className={cn(
          "text-sm text-right",
          mono ? "font-mono" : "font-medium",
          subtle ? "text-muted" : "text-text"
        )}
      >
        {value ?? "—"}
      </span>
    </div>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[11px] font-semibold uppercase tracking-wider text-muted mb-2">
      {children}
    </p>
  );
}

/* ── props ───────────────────────────────────────────────────── */
type Props = {
  open: boolean;
  onClose: () => void;
  variant: ArticleVariant;
  /** Artículo padre — provee nombre, precios heredados y stock. */
  articleRow: ArticleRow;
  /** Stock actual de esta variante (de stockData.byVariant). */
  stockQty?: number;
  /** Abre el modal de edición de esta variante. */
  onEdit?: () => void;
  /** Navega a la ficha del artículo padre. */
  onViewArticle?: () => void;
};

export default function ViewVariantModal({
  open,
  onClose,
  variant,
  articleRow,
  stockQty = 0,
  onEdit,
  onViewArticle,
}: Props) {
  /* ── imagen principal ─────────────────────────────────────── */
  const imgSrc =
    variant.images?.find((i) => i.isMain)?.url ??
    variant.images?.[0]?.url ??
    (variant.imageUrl || articleRow.mainImageUrl || null);
  const imgIsFallback =
    !variant.images?.length && !variant.imageUrl && !!articleRow.mainImageUrl;

  /* ── atributos de eje ─────────────────────────────────────── */
  const axisAttrs = useMemo(
    () =>
      (variant.attributeValues ?? [])
        .filter((av) => av.assignment?.isVariantAxis)
        .sort(
          (a, b) =>
            (a.assignment?.sortOrder ?? 0) - (b.assignment?.sortOrder ?? 0)
        ),
    [variant.attributeValues]
  );

  /* ── precios: siempre del artículo padre (las variantes no tienen precio propio) ── */

  // Costo: siempre del artículo padre (composición compartida por todas las variantes).
  // computedCostBase = costo resultante del motor (composición, multiplicador, manual…)
  const artCostRaw =
    articleRow.computedCostBase != null ? parseFloat(articleRow.computedCostBase)
    : articleRow.costPrice      != null ? parseFloat(articleRow.costPrice)
    : null;

  const artPriceRaw =
    articleRow.resolvedSalePrice != null ? parseFloat(articleRow.resolvedSalePrice)
    : articleRow.salePrice       != null ? parseFloat(articleRow.salePrice)
    : null;

  const effCost  = artCostRaw;
  const effPrice = artPriceRaw; // El precio es siempre del artículo padre

  const costSource  = artCostRaw  != null ? "Del artículo" : null;
  const priceSource = artPriceRaw != null ? "Del artículo" : null;

  const margin =
    effPrice != null && effCost != null && effPrice > 0
      ? ((effPrice - effCost) / effPrice) * 100
      : null;

  /* ── label completo ───────────────────────────────────────── */
  const label = variantLabel(variant);

  return (
    <Modal
      open={open}
      title="Variante"
      onClose={onClose}
      maxWidth="lg"
      resizable
      maximizable
      maximizedMode="embedded"
      modalKey="articulos-variante-detalle"
      footer={
        <>
          <TPButton variant="secondary" iconLeft={<X size={14} />} onClick={onClose}>
            Cerrar
          </TPButton>
          {onEdit && (
            <TPButton
              variant="primary"
              iconLeft={<Pencil size={14} />}
              onClick={() => { onClose(); onEdit(); }}
            >
              Editar
            </TPButton>
          )}
        </>
      }
    >
      <div className="space-y-5">

        {/* ── 1. Identidad ─────────────────────────────────────── */}
        <div className="flex gap-4 items-start">
          {/* Imagen */}
          <div className="shrink-0">
            {imgSrc ? (
              <img
                src={imgSrc}
                alt=""
                className={cn(
                  "w-16 h-16 rounded-xl object-cover border border-border",
                  imgIsFallback && "opacity-40"
                )}
              />
            ) : (
              <div className="w-16 h-16 rounded-xl bg-surface2 border border-border flex items-center justify-center">
                <Layers size={20} className="text-muted opacity-50" />
              </div>
            )}
            {imgIsFallback && (
              <span className="text-[10px] text-muted italic text-center block mt-0.5">
                heredada
              </span>
            )}
          </div>

          {/* Datos de identidad */}
          <div className="flex-1 min-w-0 space-y-1">
            <div className="flex items-start gap-2 flex-wrap">
              <span className="font-semibold text-base text-text leading-tight">{label}</span>
              <TPStatusPill active={variant.isActive} />
            </div>

            <div className="flex items-center gap-2 flex-wrap text-xs text-muted">
              {variant.sku && (
                <span className="font-mono bg-surface2 rounded px-1.5 py-0.5">
                  SKU: {variant.sku}
                </span>
              )}
              {variant.code && (
                <span className="font-mono bg-surface2 rounded px-1.5 py-0.5">
                  Cód: {variant.code}
                </span>
              )}
              {variant.barcode && (
                <span className="font-mono bg-surface2 rounded px-1.5 py-0.5">
                  Barcode: {variant.barcode}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* ── 2. Artículo padre ─────────────────────────────────── */}
        <div className="rounded-lg bg-surface2/60 border border-border/50 px-3 py-2.5 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <Package size={13} className="text-muted shrink-0" />
            <div className="min-w-0">
              <div className="text-[10px] text-muted uppercase tracking-wide leading-none mb-0.5">
                Artículo padre
              </div>
              <div className="text-sm font-medium text-text truncate">
                {articleRow.name}
              </div>
            </div>
          </div>
          {onViewArticle && (
            <button
              type="button"
              onClick={onViewArticle}
              className="shrink-0 flex items-center gap-1 text-xs text-primary hover:underline"
            >
              <ExternalLink size={11} />
              Abrir
            </button>
          )}
        </div>

        {/* ── 3. Atributos ──────────────────────────────────────── */}
        {axisAttrs.length > 0 && (
          <div>
            <SectionTitle>Atributos</SectionTitle>
            <div className="rounded-lg bg-surface2/40 border border-border/40 px-3 py-2 space-y-1">
              {axisAttrs.map((av) => (
                <div
                  key={av.assignmentId}
                  className="flex items-center justify-between gap-2"
                >
                  <span className="text-xs text-muted shrink-0">
                    {av.assignment?.definition?.name ?? "Atributo"}
                  </span>
                  <span className="text-xs font-semibold text-text bg-surface rounded px-2 py-0.5">
                    {av.value}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── 4. Comercial ──────────────────────────────────────── */}
        <div>
          <SectionTitle>Comercial</SectionTitle>
          <div className="grid grid-cols-3 gap-2">
            {/* Costo */}
            <div className="rounded-lg border border-border/50 bg-card px-3 py-2.5 text-center flex flex-col items-center gap-0.5">
              <div className="text-[9px] font-semibold uppercase tracking-wide text-muted leading-none">
                Costo
              </div>
              <div className="text-base font-bold tabular-nums text-text leading-tight">
                {effCost != null ? fmtMoney(effCost) : "—"}
              </div>
              {costSource && (
                <div className="text-[9px] text-muted leading-none">{costSource}</div>
              )}
            </div>

            {/* Margen */}
            <div className="rounded-lg border border-border/50 bg-card px-3 py-2.5 text-center flex flex-col items-center gap-0.5">
              <div className="text-[9px] font-semibold uppercase tracking-wide text-muted leading-none">
                Margen
              </div>
              {margin != null ? (
                <div
                  className={cn(
                    "text-base font-bold tabular-nums leading-tight",
                    margin >= 0
                      ? "text-emerald-600 dark:text-emerald-400"
                      : "text-red-500"
                  )}
                >
                  {margin >= 0 ? "+" : ""}
                  {formatDecimal(margin, 1)}%
                </div>
              ) : (
                <div className="text-base font-bold text-muted leading-tight">—</div>
              )}
              <div className="text-[9px] text-muted leading-none">sin imp.</div>
            </div>

            {/* Precio */}
            <div className="rounded-lg border border-border/50 bg-card px-3 py-2.5 text-center flex flex-col items-center gap-0.5">
              <div className="text-[9px] font-semibold uppercase tracking-wide text-muted leading-none">
                Precio
              </div>
              <div className="text-base font-bold tabular-nums text-text leading-tight">
                {effPrice != null ? fmtMoney(effPrice) : "—"}
              </div>
              {priceSource && (
                <div className="text-[9px] text-muted leading-none">{priceSource}</div>
              )}
            </div>
          </div>

          {/* Peso propio (único override permitido en variante) */}
          {variant.weightOverride != null && (
            <div className="mt-2 space-y-0">
              <FieldRow
                label="Peso propio"
                value={`${fmtQty(variant.weightOverride)} g`}
              />
            </div>
          )}
        </div>

        {/* ── 5. Stock ──────────────────────────────────────────── */}
        <div>
          <SectionTitle>Stock</SectionTitle>
          <div className="space-y-0">
            <FieldRow label="Stock actual" value={<span className="font-mono font-bold">{fmtQty(stockQty)}</span>} />
            {variant.reorderPoint != null && (
              <FieldRow label="Punto de reposición" value={fmtQty(variant.reorderPoint)} />
            )}
            {variant.minSaleQuantity != null && (
              <FieldRow label="Cant. mínima de venta" value={fmtQty(variant.minSaleQuantity)} />
            )}
            {variant.maxSaleQuantity != null && (
              <FieldRow label="Cant. máxima de venta" value={fmtQty(variant.maxSaleQuantity)} />
            )}
            {variant.defaultQuantity != null && (
              <FieldRow label="Cant. predeterminada" value={fmtQty(variant.defaultQuantity)} />
            )}
          </div>
        </div>

        {/* ── 6. Notas ──────────────────────────────────────────── */}
        {variant.notes?.trim() && (
          <div>
            <SectionTitle>Notas</SectionTitle>
            <p className="text-sm text-text/80 whitespace-pre-wrap leading-relaxed bg-surface2/30 rounded-lg px-3 py-2.5 border border-border/40">
              {variant.notes}
            </p>
          </div>
        )}

      </div>
    </Modal>
  );
}
