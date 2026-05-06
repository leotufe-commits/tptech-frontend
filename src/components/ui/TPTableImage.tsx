// src/components/ui/TPTableImage.tsx
/**
 * Miniatura de imagen reutilizable para celdas de tabla.
 * Al hacer hover muestra un ícono de zoom; al hacer click abre TPImageLightbox.
 * Compatible con TPTable, TPTableKit y TPTreeTable — usar en renderRow / renderCell.
 */
import React, { useState } from "react";
import { Maximize2, Package } from "lucide-react";
import TPImageLightbox from "./TPImageLightbox";
import { cn } from "./tp";

interface TPTableImageProps {
  /** URL de la imagen. Si está vacía o es null, se muestra el fallback. */
  src?: string | null;
  /**
   * Clases Tailwind que controlan el tamaño del cuadrado.
   * Ej: "w-7 h-7" (28 px, default) · "w-9 h-9" (36 px) · "w-10 h-10" (40 px).
   */
  sizeClass?: string;
  /** Clases extra aplicadas al wrapper. */
  className?: string;
  /** Nodo de fallback cuando no hay imagen. Por defecto muestra un ícono Package. */
  fallback?: React.ReactNode;
  /** Texto alternativo para la imagen. */
  alt?: string;
}

export default function TPTableImage({
  src,
  sizeClass = "w-7 h-7",
  className,
  fallback,
  alt = "",
}: TPTableImageProps) {
  const [lightboxOpen, setLightboxOpen] = useState(false);

  const base = cn(
    "shrink-0 rounded border border-border overflow-hidden",
    sizeClass,
    className
  );

  if (!src) {
    return (
      <div className={cn(base, "bg-surface2/50 flex items-center justify-center")}>
        {fallback ?? <Package size={12} className="text-muted" />}
      </div>
    );
  }

  return (
    <>
      <button
        type="button"
        title="Ver imagen"
        onClick={(e) => { e.stopPropagation(); setLightboxOpen(true); }}
        className={cn(base, "relative group/timg cursor-zoom-in")}
      >
        <img src={src} alt={alt} className="w-full h-full object-cover" />
        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover/timg:opacity-100 transition-opacity flex items-center justify-center pointer-events-none">
          <Maximize2 size={11} className="text-white drop-shadow" />
        </div>
      </button>
      {lightboxOpen && (
        <TPImageLightbox src={src} alt={alt} onClose={() => setLightboxOpen(false)} />
      )}
    </>
  );
}
