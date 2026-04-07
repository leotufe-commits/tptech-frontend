// src/components/ui/TPChipGroup.tsx
// Grupo de chips/botones toggle para reemplazar dropdowns con pocas opciones (2–4).
import React from "react";
import { Star } from "lucide-react";
import { cn } from "./tp";

type Option = {
  value: string;
  label: string;
  isFavorite?: boolean;
};

type Props = {
  value: string;
  onChange: (v: string) => void;
  options: Option[];
  disabled?: boolean;
  /** Valor actualmente marcado como predeterminado (alternativa a isFavorite en cada opción) */
  favoriteValue?: string | null;
  /** Si se provee, muestra una estrella en cada chip para marcar predeterminado */
  onSetFavorite?: (v: string) => void;
  /** Todos los chips ocupan el mismo ancho (flex-1) */
  equalWidth?: boolean;
};

export default function TPChipGroup({
  value,
  onChange,
  options,
  disabled = false,
  favoriteValue,
  onSetFavorite,
  equalWidth = false,
}: Props) {
  return (
    <div className={cn("flex gap-1.5", !equalWidth && "flex-wrap", disabled && "opacity-50 pointer-events-none")}>
      {options.map((opt) => {
        const isActive = opt.value === value;
        const isFav = favoriteValue !== undefined
          ? opt.value === favoriteValue
          : !!opt.isFavorite;

        return (
          <button
            key={opt.value}
            type="button"
            onClick={() => onChange(opt.value)}
            className={cn(
              "inline-flex items-center justify-center gap-1.5 rounded-xl border px-3 py-1.5 text-sm font-medium transition-all select-none",
              equalWidth && "flex-1",
              isActive
                ? "border-primary/40 bg-primary/15 text-primary"
                : "border-border bg-surface2/30 text-muted hover:bg-surface2/60 hover:text-text"
            )}
          >
            <span>{opt.label}</span>
            {onSetFavorite && (
              <span
                role="button"
                title={isFav ? "Predeterminado para nuevos artículos" : "Usar como predeterminado"}
                onMouseDown={(e) => { e.stopPropagation(); e.preventDefault(); }}
                onClick={(e) => { e.stopPropagation(); onSetFavorite(opt.value); }}
                className={cn(
                  "shrink-0 transition-colors",
                  isFav ? "text-yellow-400" : "text-muted/30 hover:text-yellow-400"
                )}
              >
                <Star size={11} className={isFav ? "fill-yellow-400" : ""} />
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
