// src/components/ui/TPImageLightbox.tsx
// ============================================================================
// TPImageLightbox — visor de imagen en pantalla completa.
//
// API soportada (compatible con consumers legacy):
//
//   1) Legacy (1 imagen):
//      <TPImageLightbox src={url|null} onClose={...} alt="..." />
//      Si src === null no renderiza nada.
//
//   2) Galería:
//      <TPImageLightbox open images={[...]} initialIndex={0} onClose={...} alt="..." />
//      ESC cierra · ← → navegan · indicador 1/3 · click fuera cierra.
// ============================================================================

import React, { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { X, ChevronLeft, ChevronRight } from "lucide-react";

export type TPImageLightboxProps = {
  /** Modo legacy: si está, se usa como única imagen; null = cerrado. */
  src?: string | null;
  /** Modo galería: array de URLs. */
  images?: string[];
  /** Modo galería: control explícito de visibilidad. */
  open?: boolean;
  /** Modo galería: índice inicial. Default 0. */
  initialIndex?: number;
  alt?: string;
  onClose: () => void;
};

export function TPImageLightbox({
  src,
  images,
  open,
  initialIndex = 0,
  alt,
  onClose,
}: TPImageLightboxProps) {
  // Resolver el set de imágenes y la visibilidad según API usada.
  const galleryImages: string[] = (() => {
    if (images && images.length > 0) return images;
    if (typeof src === "string" && src) return [src];
    return [];
  })();
  const isOpen =
    images !== undefined
      ? Boolean(open) && galleryImages.length > 0
      : galleryImages.length > 0; // modo legacy: abierto si hay src

  const [idx, setIdx] = useState<number>(initialIndex);

  useEffect(() => {
    if (isOpen) setIdx(Math.min(Math.max(initialIndex, 0), Math.max(0, galleryImages.length - 1)));
  }, [isOpen, initialIndex, galleryImages.length]);

  // Bloquear scroll del body mientras está abierto.
  useEffect(() => {
    if (!isOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, [isOpen]);

  // Atajos de teclado.
  useEffect(() => {
    if (!isOpen) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.preventDefault();
        e.stopPropagation();
        onClose();
        return;
      }
      if (galleryImages.length > 1) {
        if (e.key === "ArrowLeft") {
          e.preventDefault();
          setIdx((i) => Math.max(0, i - 1));
        } else if (e.key === "ArrowRight") {
          e.preventDefault();
          setIdx((i) => Math.min(galleryImages.length - 1, i + 1));
        }
      }
    }
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [isOpen, galleryImages.length, onClose]);

  if (!isOpen) return null;

  const hasMany = galleryImages.length > 1;
  const canPrev = hasMany && idx > 0;
  const canNext = hasMany && idx < galleryImages.length - 1;

  return createPortal(
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/85 backdrop-blur-sm"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Visor de imágenes"
    >
      {/* Botón cerrar */}
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); onClose(); }}
        title="Cerrar (Esc)"
        aria-label="Cerrar visor"
        className="absolute right-4 top-4 inline-flex h-9 w-9 items-center justify-center rounded-full bg-white/10 text-white transition-colors hover:bg-white/25"
      >
        <X size={18} />
      </button>

      {/* Flecha izquierda */}
      {hasMany && (
        <button
          type="button"
          disabled={!canPrev}
          onClick={(e) => { e.stopPropagation(); setIdx((i) => Math.max(0, i - 1)); }}
          title="Anterior (←)"
          aria-label="Imagen anterior"
          className="absolute left-4 top-1/2 -translate-y-1/2 inline-flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white transition hover:bg-white/25 disabled:cursor-not-allowed disabled:opacity-30"
        >
          <ChevronLeft size={22} />
        </button>
      )}

      {/* Imagen activa */}
      <img
        src={galleryImages[idx]}
        alt={alt ?? `Imagen ${idx + 1} de ${galleryImages.length}`}
        loading="lazy"
        onClick={(e) => e.stopPropagation()}
        className="max-h-[90vh] max-w-[90vw] rounded-xl object-contain shadow-2xl"
      />

      {/* Flecha derecha */}
      {hasMany && (
        <button
          type="button"
          disabled={!canNext}
          onClick={(e) => { e.stopPropagation(); setIdx((i) => Math.min(galleryImages.length - 1, i + 1)); }}
          title="Siguiente (→)"
          aria-label="Imagen siguiente"
          className="absolute right-4 top-1/2 -translate-y-1/2 inline-flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white transition hover:bg-white/25 disabled:cursor-not-allowed disabled:opacity-30"
        >
          <ChevronRight size={22} />
        </button>
      )}

      {/* Indicador de posición */}
      {hasMany && (
        <div
          onClick={(e) => e.stopPropagation()}
          className="absolute bottom-6 left-1/2 -translate-x-1/2 rounded-full bg-white/10 px-3 py-1 text-xs font-semibold tabular-nums text-white"
        >
          {idx + 1} / {galleryImages.length}
        </div>
      )}
    </div>,
    document.body,
  );
}

export default TPImageLightbox;
