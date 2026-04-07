// src/pages/article-detail/EditVariantModal.tsx
// Modal completo para editar una variante existente (con imágenes, SKU, nombre,
// punto de reposición y existencia de apertura). Reutilizable desde cualquier vista.
import React, { useEffect, useState } from "react";
import { Check, Loader2, Package, Plus, Save, X } from "lucide-react";
import { Modal } from "../../components/ui/Modal";
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
  /** Callback invocado ante cualquier cambio (imagen o guardado de campos). */
  onVariantChange: (updated: ArticleVariant) => void;
  /** Stock actual por variantId — si > 0, bloquea edición de existencia de apertura. */
  variantStock?: Record<string, number>;
};

export default function EditVariantModal({
  open,
  onClose,
  articleId,
  variant,
  onVariantChange,
  variantStock = {},
}: Props) {
  const [sku,          setSku]          = useState("");
  const [name,         setName]         = useState("");
  const [notes,        setNotes]        = useState("");
  const [reorderPoint, setReorderPoint] = useState<number | null>(null);
  const [openingStock, setOpeningStock] = useState<number | null>(null);
  const [localImages,  setLocalImages]  = useState<VariantImage[]>([]);
  const [localImgUrl,  setLocalImgUrl]  = useState("");
  const [busySave,     setBusySave]     = useState(false);
  const [busyImage,    setBusyImage]    = useState(false);

  // Inicializar estado cada vez que se abre o cambia la variante
  useEffect(() => {
    if (!open) return;
    setSku(variant.sku ?? "");
    setName(variant.name ?? "");
    setNotes(variant.notes ?? "");
    setReorderPoint(variant.reorderPoint != null ? parseFloat(variant.reorderPoint) : null);
    setOpeningStock(variant.openingStock != null ? parseFloat(variant.openingStock) : null);
    setLocalImages(variant.images ?? []);
    setLocalImgUrl(variant.imageUrl ?? "");
  }, [open, variant.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const mainSrc  = localImages.find(i => i.isMain)?.url ?? localImages[0]?.url ?? localImgUrl ?? null;
  const stockQty = variantStock[variant.id] ?? 0;

  // ── Image handlers ──────────────────────────────────────────────────────────

  async function handleImageUpload(file: File) {
    setBusyImage(true);
    try {
      const isFirst = localImages.length === 0;
      const newImg  = await articlesApi.variants.images.upload(articleId, variant.id, file, isFirst);
      const updated: VariantImage[] = [...localImages.map(i => newImg.isMain ? { ...i, isMain: false } : i), newImg];
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

  async function save() {
    if (!sku.trim()) {
      toast.warning("Esta variante no tiene SKU. Podés asignarle uno más adelante.");
    }
    if (!name.trim()) {
      toast.error("El nombre de la variante es obligatorio.");
      return;
    }
    setBusySave(true);
    try {
      const updated = await articlesApi.variants.update(articleId, variant.id, {
        sku:          sku.trim(),
        name:         name.trim(),
        notes:        notes.trim(),
        reorderPoint,
        openingStock,
      });
      // Fusionar campos guardados con el estado de imágenes local (ya actualizadas)
      onVariantChange({ ...updated, images: localImages, imageUrl: localImgUrl || updated.imageUrl });
      onClose();
      toast.success("Variante actualizada.");
    } catch (err: any) {
      toast.error(err?.message || "Error al guardar la variante.");
    } finally {
      setBusySave(false);
    }
  }

  return (
    <Modal
      open={open}
      title="Editar variante"
      onClose={onClose}
      maxWidth="sm"
      busy={busySave}
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
      <div className="space-y-3">

        {/* ── Galería de imágenes ─────────────────────────────────────────── */}
        <div className="space-y-2">
          <span className="text-xs font-medium text-muted">Imágenes de variante</span>
          <div className="flex gap-3 items-start">

            {/* Imagen principal */}
            <div className="flex flex-col gap-1 shrink-0">
              <TPAvatarUploader
                src={mainSrc ?? ""}
                size={80}
                rounded="xl"
                loading={busyImage}
                fallbackIcon={<Package size={22} className="opacity-50" />}
                onUpload={handleImageUpload}
                onDelete={localImages.length > 0 ? handleMainImageRemove : undefined}
                onError={(msg) => toast.error(msg)}
                addLabel="Cargar"
                editLabel="Cambiar"
                deleteLabel="Quitar"
              />
              {localImages.length === 0 && !!mainSrc && (
                <span className="text-[10px] text-muted/70 italic leading-tight text-center">heredada</span>
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
                    {busyImage ? <Loader2 size={13} className="animate-spin" /> : <Plus size={13} />}
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
        </div>

        {/* ── Campos ──────────────────────────────────────────────────────── */}
        <TPField label="SKU" hint="Recomendado — permite identificar la variante fácilmente">
          <TPInput
            value={sku}
            onChange={setSku}
            placeholder="SKU de la variante"
          />
        </TPField>

        <TPField label="Nombre" required>
          <TPInput
            value={name}
            onChange={setName}
            placeholder="Nombre de la variante"
          />
        </TPField>

        <TPField label="Notas" hint="Descripción o notas internas de la variante (opcional)">
          <TPTextarea
            value={notes}
            onChange={setNotes}
            placeholder="Notas sobre esta variante…"
            rows={2}
          />
        </TPField>

        <TPField label="Punto de reposición" hint="Stock mínimo para alerta">
          <TPNumberInput
            value={reorderPoint}
            onChange={setReorderPoint}
            placeholder="0"
            min={0}
          />
        </TPField>

        <TPField
          label="Existencia de apertura"
          hint={stockQty > 0 ? "Ya existe stock — no se puede modificar" : "Stock inicial de esta variante"}
        >
          <TPNumberInput
            value={openingStock}
            onChange={setOpeningStock}
            placeholder="0"
            min={0}
            decimals={4}
            disabled={stockQty > 0}
          />
        </TPField>
      </div>
    </Modal>
  );
}
