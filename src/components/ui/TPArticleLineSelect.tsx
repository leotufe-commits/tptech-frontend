// src/components/ui/TPArticleLineSelect.tsx
// ============================================================================
// TPArticleLineSelect — selector de UN artículo (con su variante opcional)
// reusando el mismo combo que se utiliza en "Descuentos por cantidad"
// (`TPArticleScopeSelect`). Su rol es ser el selector estándar de artículos
// en líneas de comprobantes.
//
// Internamente envuelve a `TPArticleScopeSelect` en modo `multiple={false}`
// y traduce el resultado del catálogo (`ScopeItem[]`) al shape `TPArticleLite`
// que consume el resto del editor de líneas.
//
// API pública compatible con `TPArticleVariantSearchSelect`:
//   · `value`        — identidad mínima del seleccionado (id + nombre).
//   · `onChange`     — recibe el `TPArticleLite` resultante (o null).
//   · `focusSignal`  — cada cambio abre el dropdown del scope select.
// ============================================================================

import React, { useEffect, useMemo, useRef } from "react";

import { TPArticleScopeSelect } from "./TPArticleScopeSelect";
import type { TPArticleLite, TPArticleSelection } from "./TPArticleVariantSearchSelect";
import type { ScopeItem } from "../../services/articles";

export type TPArticleLineSelectProps = {
  value?: TPArticleSelection | null;
  onChange: (item: TPArticleLite | null) => void;
  placeholder?: string;
  disabled?: boolean;
  /** Cada cambio de número abre el dropdown del combo (foco en buscador). */
  focusSignal?: number;
};

/**
 * Convierte el `TPArticleSelection` (lo que guarda el draft de la línea)
 * en un array `ScopeItem[]` para que el combo muestre el chip seleccionado.
 * Si no podemos saber si es ARTICLE o VARIANT (por falta de `variant`), lo
 * tratamos como ARTICLE.
 */
function selectionToScope(value?: TPArticleSelection | null): ScopeItem[] {
  if (!value || !value.id) return [];
  const isVariant = !!(value.variant ?? "").trim();
  const articleName = value.article || "";
  return [{
    kind:        isVariant ? "VARIANT" : "ARTICLE",
    id:          value.id,
    name:        isVariant ? `${articleName} — ${value.variant}` : articleName,
    code:        "",
    imageUrl:    "",
    articleId:   value.id,
    articleName: articleName,
  }];
}

export function TPArticleLineSelect({
  value,
  onChange,
  placeholder = "Buscar artículo, variante, servicio o combo…",
  disabled = false,
  focusSignal,
}: TPArticleLineSelectProps) {
  const scopeValue = useMemo(() => selectionToScope(value), [value]);

  // Foco bajo demanda — abrir el dropdown haciendo click programático en el
  // trigger del scope select. Buscamos el primer descendiente clickeable
  // (el wrap div) y disparamos un click sintético.
  const wrapRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (focusSignal === undefined) return;
    if (!wrapRef.current) return;
    // El trigger del TPArticleScopeSelect es el primer div hijo del wrap.
    const trigger = wrapRef.current.querySelector<HTMLDivElement>(":scope > div > div");
    trigger?.click();
  }, [focusSignal]);

  return (
    <div ref={wrapRef}>
      <TPArticleScopeSelect
        value={scopeValue}
        multiple={false}
        includeVariants={true}
        placeholder={placeholder}
        disabled={disabled}
        onChange={(items) => {
          if (!items || items.length === 0) {
            onChange(null);
            return;
          }
          const it = items[0];
          const isVariant = it.kind === "VARIANT";
          const articleId = it.articleId;
          const variantId = isVariant ? it.id : undefined;
          // El "variant name" viene como sufijo de `it.name` ("Artículo — Variante").
          let variantName: string | undefined;
          if (isVariant) {
            const parts = String(it.name ?? "").split(" — ");
            variantName = parts.length > 1 ? parts.slice(1).join(" — ").trim() : undefined;
          }
          // Mapping a itemKind del modelo Receipt:
          //   VARIANT                            → ARTICLE_VARIANT
          //   ARTICLE + articleType=SERVICE      → SERVICE
          //   ARTICLE + isCombo                  → COMBO
          //   ARTICLE + (PRODUCT / MATERIAL)     → ARTICLE_SIMPLE
          const itemKind: TPArticleLite["itemKind"] = isVariant
            ? "ARTICLE_VARIANT"
            : it.articleType === "SERVICE"
              ? "SERVICE"
              : it.isCombo
                ? "COMBO"
                : "ARTICLE_SIMPLE";
          const lite: TPArticleLite = {
            id:        articleId,
            variantId,
            code:      it.code || "",
            sku:       it.code || undefined,
            itemKind,
            article:   it.articleName || it.name || "",
            variant:   variantName,
            imageUrl:  it.imageUrl || undefined,
            images:    it.imageUrl ? [it.imageUrl] : undefined,
          };
          onChange(lite);
        }}
      />
    </div>
  );
}

export default TPArticleLineSelect;
