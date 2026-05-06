// src/pages/article-detail/EditVariantModal.tsx
// Modal para editar una variante existente.
// Secciones: Imágenes (plegable) · Atributos (lectura) · Identificación · Valores propios · Stock · Notas
import React, { useEffect, useMemo, useState } from "react";
import { Check, ChevronDown, Info, Layers, Loader2, Package, Plus, Save, X } from "lucide-react";
import { Modal } from "../../components/ui/Modal";
import TPAlert from "../../components/ui/TPAlert";
import { TPField } from "../../components/ui/TPField";
import TPInput from "../../components/ui/TPInput";
import TPTextarea from "../../components/ui/TPTextarea";
import TPNumberInput from "../../components/ui/TPNumberInput";
import { TPButton } from "../../components/ui/TPButton";
import TPAvatarUploader from "../../components/ui/TPAvatarUploader";
import { cn } from "../../components/ui/tp";
import { toast } from "../../lib/toast";
import { articlesApi, type ArticleVariant, type VariantImage } from "../../services/articles";

type Props = {
  open: boolean;
  onClose: () => void;
  articleId: string;
  variant: ArticleVariant;
  /** Callback ante cualquier cambio (imagen o guardado de campos). */
  onVariantChange: (updated: ArticleVariant) => void;
  /** Stock actual por variantId — usado para mostrar el stock en pantalla. */
  variantStock?: Record<string, number>;
  /** Lista completa de variantes del artículo — habilita "Guardar y siguiente". */
  variants?: ArticleVariant[];
  /** Callback para cambiar qué variante se está editando sin cerrar el modal. */
  onSwitchVariant?: (nextVariantId: string) => void;
  /** Grupo del artículo padre — se muestra como heredado. */
  parentGroup?: { id: string; name: string; selectorLabel: string } | null;
  /** Notas del artículo padre — se muestran si la variante no tiene notas propias. */
  parentNotes?: string;
};

export default function EditVariantModal({
  open,
  onClose,
  articleId,
  variant,
  onVariantChange,
  variantStock = {},
  variants,
  onSwitchVariant,
  parentGroup = null,
  parentNotes = "",
}: Props) {
  const [sku,                  setSku]                  = useState("");
  const [name,                 setName]                 = useState("");
  const [notes,                setNotes]                = useState("");
  const [reorderPoint,         setReorderPoint]         = useState<number | null>(null);
  const [minSaleQuantity,      setMinSaleQuantity]      = useState<number | null>(null);
  const [maxSaleQuantity,      setMaxSaleQuantity]      = useState<number | null>(null);
  const [defaultQuantity,      setDefaultQuantity]      = useState<number | null>(null);
  // Solo weightOverride es permitido en variante (las variantes no tienen precio propio)
  const [weightOverride,       setWeightOverride]       = useState<number | null>(null);
  const [localImages,          setLocalImages]          = useState<VariantImage[]>([]);
  const [localImgUrl,          setLocalImgUrl]          = useState("");
  const [busySave,             setBusySave]             = useState(false);
  const [busyImage,            setBusyImage]            = useState(false);
  const [imagesExpanded,       setImagesExpanded]       = useState(false);

  /* Atributos de eje de variante, ordenados por sortOrder */
  const axisAttrs = useMemo(
    () =>
      (variant.attributeValues ?? [])
        .filter(av => av.assignment?.isVariantAxis)
        .sort((a, b) => (a.assignment?.sortOrder ?? 0) - (b.assignment?.sortOrder ?? 0)),
    [variant.attributeValues],
  );

  /* Nombre derivado automáticamente desde los valores de eje */
  const derivedName = useMemo(
    () => axisAttrs.map(av => av.value).filter(Boolean).join(" · "),
    [axisAttrs],
  );

  /* ¿El nombre actual coincide con el automático? */
  const nameIsAuto = !!derivedName && name.trim() === derivedName.trim();

  /* Variante siguiente para "Guardar y siguiente" */
  const currentIdx  = variants ? variants.findIndex(v => v.id === variant.id) : -1;
  const nextVariant = variants && currentIdx >= 0 ? (variants[currentIdx + 1] ?? null) : null;

  /* Inicializar estado cuando se abre o cambia la variante */
  useEffect(() => {
    if (!open) return;
    setSku(variant.sku ?? "");
    setName(variant.name ?? "");
    setNotes(variant.notes ?? "");
    setReorderPoint(variant.reorderPoint != null ? parseFloat(variant.reorderPoint) : null);
    setMinSaleQuantity(variant.minSaleQuantity != null ? parseFloat(variant.minSaleQuantity) : null);
    setMaxSaleQuantity(variant.maxSaleQuantity != null ? parseFloat(variant.maxSaleQuantity) : null);
    setDefaultQuantity(variant.defaultQuantity != null ? parseFloat(variant.defaultQuantity) : null);
    setWeightOverride(variant.weightOverride != null ? parseFloat(variant.weightOverride) : null);
    setLocalImages(variant.images ?? []);
    setLocalImgUrl(variant.imageUrl ?? "");
    /* Imágenes siempre expandidas al abrir */
    setImagesExpanded(true);
  }, [open, variant.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const mainSrc  = localImages.find(i => i.isMain)?.url ?? localImages[0]?.url ?? localImgUrl ?? null;
  const stockQty = variantStock[variant.id] ?? 0;
  // Mostrar hint de apertura solo si: stock actual = 0 Y no existen registros de stock (nunca hubo movimientos)
  const showOpeningHint = stockQty === 0 && !(variant.id in variantStock);

  // ── Image handlers ──────────────────────────────────────────────────────────

  async function handleImageUpload(file: File) {
    setBusyImage(true);
    try {
      const isFirst = localImages.length === 0;
      const newImg  = await articlesApi.variants.images.upload(articleId, variant.id, file, isFirst);
      const updated: VariantImage[] = [
        ...localImages.map(i => newImg.isMain ? { ...i, isMain: false } : i),
        newImg,
      ];
      const newImgUrl = newImg.isMain ? newImg.url : localImgUrl;
      setLocalImages(updated);
      setLocalImgUrl(newImgUrl);
      onVariantChange({ ...variant, images: updated, imageUrl: newImgUrl });
    } catch (err: any) {
      toast.error(err?.message || "No se pudo subir la imagen.");
      throw err; // re-throw para que TPAvatarUploader revierta el preview
    } finally {
      setBusyImage(false);
    }
  }

  async function handleImageRemoveById(imageId: string) {
    setBusyImage(true);
    try {
      await articlesApi.variants.images.remove(articleId, variant.id, imageId);
      const remaining = localImages.filter(i => i.id !== imageId);
      const newImgUrl = remaining.find(i => i.isMain)?.url ?? remaining[0]?.url ?? "";
      setLocalImages(remaining);
      setLocalImgUrl(newImgUrl);
      onVariantChange({ ...variant, images: remaining, imageUrl: newImgUrl });
    } catch (err: any) {
      toast.error(err?.message || "No se pudo eliminar la imagen.");
    } finally {
      setBusyImage(false);
    }
  }

  async function handleMainImageRemove() {
    const mainImg = localImages.find(i => i.isMain) ?? localImages[0];
    if (mainImg) await handleImageRemoveById(mainImg.id);
  }

  async function handleSetMainImage(imageId: string) {
    try {
      const updated = await articlesApi.variants.images.setMain(articleId, variant.id, imageId);
      const updatedImages = localImages.map(i => ({ ...i, isMain: i.id === imageId }));
      setLocalImages(updatedImages);
      setLocalImgUrl(updated.url);
      onVariantChange({ ...variant, images: updatedImages, imageUrl: updated.url });
    } catch (err: any) {
      toast.error(err?.message || "No se pudo establecer la imagen principal.");
    }
  }

  // ── Save ────────────────────────────────────────────────────────────────────

  /** Llama a la API y retorna la variante actualizada, o null si falla. */
  async function saveCore(): Promise<ArticleVariant | null> {
    if (!name.trim()) {
      toast.error("El nombre de la variante es obligatorio.");
      return null;
    }
    if (!sku.trim()) {
      toast.warning("Esta variante no tiene SKU. Podés asignarle uno más adelante.");
    }
    setBusySave(true);
    try {
      const updated = await articlesApi.variants.update(articleId, variant.id, {
        sku:             sku.trim(),
        name:            name.trim(),
        notes:           notes.trim(),
        reorderPoint,
        minSaleQuantity,
        maxSaleQuantity,
        defaultQuantity,
        weightOverride,
      });
      const merged: ArticleVariant = {
        ...updated,
        images:   localImages,
        imageUrl: localImgUrl || updated.imageUrl,
      };
      onVariantChange(merged);
      toast.success("Variante actualizada.");
      return merged;
    } catch (err: any) {
      toast.error(err?.message || "Error al guardar la variante.");
      return null;
    } finally {
      setBusySave(false);
    }
  }

  async function save() {
    const updated = await saveCore();
    if (updated) onClose();
  }

  async function saveAndNext() {
    const updated = await saveCore();
    if (!updated) return;
    if (nextVariant && onSwitchVariant) {
      onSwitchVariant(nextVariant.id);
    } else {
      onClose();
    }
  }

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <Modal
      open={open}
      title="Editar variante"
      onClose={onClose}
      maxWidth="2xl"
      busy={busySave}
      resizable
      maximizable
      maximizedMode="embedded"
      modalKey="articulos-variante-editor"
      onEnter={save}
      footer={
        <>
          <TPButton variant="secondary" iconLeft={<X size={14} />} onClick={onClose} disabled={busySave}>
            Cancelar
          </TPButton>
<TPButton onClick={save} loading={busySave} iconLeft={<Save size={14} />}>
            Guardar
          </TPButton>
        </>
      }
    >
      <div className="space-y-4">

        {/* ── 1. Imágenes (plegable, expandido por defecto) ────────────── */}
        <div className="space-y-2">
          <button
            type="button"
            onClick={() => setImagesExpanded(e => !e)}
            className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted hover:text-text transition-colors"
          >
            <span>Fotos</span>
            {localImages.length > 0 && (
              <span className="normal-case font-medium text-[10px] text-primary">({localImages.length}/5)</span>
            )}
            <ChevronDown
              size={12}
              className={cn("transition-transform", imagesExpanded ? "rotate-180" : "")}
            />
          </button>

          {imagesExpanded && (
            <div className="flex gap-3 items-start">

              {/* Imagen principal */}
              <div className="flex flex-col gap-1 shrink-0">
                <TPAvatarUploader
                  src={mainSrc ?? ""}
                  size={72}
                  rounded="xl"
                  loading={busyImage}
                  fallbackIcon={<Package size={20} className="opacity-50" />}
                  onUpload={handleImageUpload}
                  onDelete={localImages.length > 0 ? handleMainImageRemove : undefined}
                  onError={(msg) => toast.error(msg)}
                  addLabel="Cargar"
                  editLabel="Cambiar"
                  deleteLabel="Quitar"
                />
                {localImages.length === 0 && !!mainSrc && (
                  <span className="text-[10px] text-muted italic leading-tight text-center opacity-70">
                    heredada
                  </span>
                )}
              </div>

              {/* Tira de miniaturas */}
              <div className="flex flex-col gap-1.5">
                <div className="flex gap-1 flex-wrap" style={{ maxWidth: 160 }}>
                  {localImages.map(img => (
                    <div
                      key={img.id}
                      onClick={() => { if (!img.isMain) void handleSetMainImage(img.id); }}
                      className={cn(
                        "relative group w-9 h-9 rounded-lg overflow-hidden border-2 shrink-0 bg-surface2 transition-all",
                        img.isMain
                          ? "border-primary cursor-default"
                          : "border-border hover:border-primary/60 cursor-pointer"
                      )}
                    >
                      <img src={img.url} alt="" className="w-full h-full object-cover" />

                      {img.isMain && (
                        <div className="absolute top-0.5 left-0.5 bg-primary rounded-sm w-3 h-3 flex items-center justify-center">
                          <Check size={7} className="text-white" strokeWidth={3} />
                        </div>
                      )}

                      <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-0.5">
                        {!img.isMain && (
                          <button
                            type="button"
                            title="Hacer principal"
                            onClick={(e) => { e.stopPropagation(); void handleSetMainImage(img.id); }}
                            className="p-0.5 rounded text-white hover:text-primary"
                          >
                            <Check size={10} />
                          </button>
                        )}
                        <button
                          type="button"
                          title="Eliminar"
                          onClick={(e) => { e.stopPropagation(); void handleImageRemoveById(img.id); }}
                          className="p-0.5 rounded text-white hover:text-red-400"
                        >
                          <X size={10} />
                        </button>
                      </div>
                    </div>
                  ))}

                  {localImages.length < 5 && (
                    <label
                      className="w-9 h-9 rounded-lg border-2 border-dashed border-border flex items-center justify-center text-muted hover:text-primary hover:border-primary transition-colors cursor-pointer shrink-0"
                      title="Agregar imagen"
                    >
                      {busyImage
                        ? <Loader2 size={13} className="animate-spin" />
                        : <Plus size={13} />
                      }
                      <input
                        type="file"
                        accept="image/*"
                        hidden
                        onChange={(e) => {
                          const f = e.target.files?.[0] ?? null;
                          e.currentTarget.value = "";
                          if (f) void handleImageUpload(f);
                        }}
                      />
                    </label>
                  )}
                </div>
                <span className="text-[10px] text-muted">{localImages.length}/5 · PNG, JPG, WebP</span>
              </div>
            </div>
          )}
        </div>

        {/* ── 2. Atributos (solo lectura) ───────────────────────────────── */}
        {axisAttrs.length > 0 && (
          <div className="rounded-lg bg-surface2 px-3 py-2.5">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted mb-2">Atributos</p>
            <div className="space-y-1.5">
              {axisAttrs.map(av => (
                <div key={av.assignmentId} className="flex items-center justify-between gap-2">
                  <span className="text-xs text-muted shrink-0">{av.assignment.definition.name}</span>
                  <span className="text-xs font-medium text-text bg-surface rounded px-2 py-0.5 leading-5 text-right">
                    {av.value}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── 2b. Grupo comercial (heredado del artículo padre) ─────────── */}
        {parentGroup && (
          <div className="flex items-center gap-2 rounded-xl border border-primary/20 bg-primary/8 px-3 py-2">
            <Layers size={13} className="text-primary shrink-0" />
            <div className="flex-1 min-w-0">
              <span className="text-xs text-muted">Grupo comercial · </span>
              <span className="text-xs font-medium text-text">{parentGroup.name}</span>
              {parentGroup.selectorLabel && (
                <span className="ml-1 text-[10px] text-muted/70">({parentGroup.selectorLabel})</span>
              )}
            </div>
            <span className="text-[10px] text-muted/60 shrink-0">Heredado</span>
          </div>
        )}

        {/* ── 3. Identificación ────────────────────────────────────────── */}
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted">Identificación</p>
          <TPField label="SKU">
            <TPInput value={sku} onChange={setSku} placeholder="—" />
          </TPField>
          <TPField
            label="Nombre"
            required
            labelRight={
              derivedName
                ? nameIsAuto
                  ? <span className="text-[10px] font-medium text-primary opacity-70">automático</span>
                  : (
                    <button
                      type="button"
                      onClick={() => setName(derivedName)}
                      className="text-[10px] text-muted hover:text-primary transition-colors"
                    >
                      ↺ Usar automático
                    </button>
                  )
                : undefined
            }
          >
            <TPInput
              value={name}
              onChange={setName}
              placeholder={derivedName || "Nombre de la variante"}
            />
          </TPField>
        </div>

        {/* ── 4. Ajuste de peso ─────────────────────────────────────── */}
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted">Ajuste de peso</p>
          <div className="rounded-xl border border-border/60 bg-surface2/30 px-3 pt-3 pb-2 space-y-1">
            <div className="flex items-start gap-1.5 mb-2 text-[11px] text-muted/80">
              <Info size={12} className="mt-0.5 shrink-0 opacity-60" />
              <span>
                <span className="font-medium">El precio, costo e impuestos son heredados del artículo padre</span>{" "}
                y son iguales para todas las variantes. Solo el peso puede ajustarse por variante
                (afecta el cálculo de costo del metal).
              </span>
            </div>
            <TPField label="Peso propio" hint="en gramos">
              <TPNumberInput
                value={weightOverride}
                onChange={setWeightOverride}
                placeholder="Del artículo"
                min={0}
                decimals={4}
              />
            </TPField>
          </div>
        </div>

        {/* ── 5. Stock ─────────────────────────────────────────────────── */}
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted">Stock</p>
          <div className="rounded-xl border border-border/60 bg-surface2/30 px-3 pt-3 pb-2 space-y-1">
            <div className="grid grid-cols-2 gap-x-3 gap-y-0">
              <TPField label="Punto de reposición">
                <TPNumberInput value={reorderPoint} onChange={setReorderPoint} placeholder="0" min={0} decimals={2} />
              </TPField>
              <TPField label="Cant. predeterminada">
                <TPNumberInput value={defaultQuantity} onChange={setDefaultQuantity} placeholder="0" min={0} decimals={2} />
              </TPField>
              <TPField label="Cant. mínima de venta">
                <TPNumberInput value={minSaleQuantity} onChange={setMinSaleQuantity} placeholder="0" min={0} decimals={2} />
              </TPField>
              <TPField label="Cant. máxima de venta">
                <TPNumberInput value={maxSaleQuantity} onChange={setMaxSaleQuantity} placeholder="0" min={0} decimals={2} />
              </TPField>
            </div>
            {showOpeningHint && (
              <TPAlert tone="info" className="mt-1">
                <div className="flex items-start gap-2">
                  <Info size={14} className="mt-0.5 shrink-0 opacity-70" />
                  <span>
                    El stock inicial se registra desde{" "}
                    <span className="font-semibold">Movimientos de artículos</span>{" "}
                    mediante un movimiento de <span className="font-semibold">Apertura</span>.
                  </span>
                </div>
              </TPAlert>
            )}
          </div>
        </div>

        {/* ── 6. Notas ─────────────────────────────────────────────────── */}
        <TPField label="Notas" hint="Descripción interna (opcional)">
          <TPTextarea
            value={notes}
            onChange={setNotes}
            placeholder="Notas sobre esta variante…"
            rows={2}
          />
          {!notes.trim() && parentNotes?.trim() && (
            <p className="mt-1 text-[11px] text-muted/70 flex items-start gap-1">
              <Info size={11} className="mt-0.5 shrink-0 opacity-60" />
              El artículo padre tiene notas propias (esta variante no tiene notas propias).
            </p>
          )}
        </TPField>

      </div>
    </Modal>
  );
}
