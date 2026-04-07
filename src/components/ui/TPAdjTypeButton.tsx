// src/components/ui/TPAdjTypeButton.tsx
// Botón compacto reutilizable para seleccionar tipo de ajuste (% / Monto fijo).
// Usado en: Ajustes de costo (ArticleModal), bonif./recargo por línea (CostCompositionTable).

import React, { useState, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import { Check, Star } from "lucide-react";
import { cn } from "./tp";

export type AdjType = "PERCENTAGE" | "FIXED_AMOUNT";

type Props = {
  value: AdjType;
  onChange: (v: AdjType) => void;
  /** Valor marcado como predeterminado (muestra estrella) */
  favoriteValue?: string | null;
  /** Callback para guardar el valor predeterminado */
  onSetFavorite?: (v: string) => void;
  disabled?: boolean;
};

const OPTS = [
  { value: "PERCENTAGE"  as AdjType, label: "Porcentaje", short: "%" },
  { value: "FIXED_AMOUNT" as AdjType, label: "Monto fijo",  short: "$" },
];

export default function TPAdjTypeButton({
  value, onChange, favoriteValue, onSetFavorite, disabled,
}: Props) {
  const [open, setOpen] = useState(false);
  const [dropStyle, setDropStyle] = useState<React.CSSProperties>({});
  const btnRef = useRef<HTMLButtonElement>(null);

  const short = value === "PERCENTAGE" ? "%" : "$";

  function calcDrop(): React.CSSProperties {
    const rect = btnRef.current?.getBoundingClientRect();
    if (!rect) return {};
    const spaceBelow = window.innerHeight - rect.bottom - 4;
    const spaceAbove = rect.top - 4;
    const base: React.CSSProperties = { position: "fixed", right: window.innerWidth - rect.right, zIndex: 9999 };
    return spaceBelow >= 90 || spaceBelow >= spaceAbove
      ? { ...base, top: rect.bottom + 4 }
      : { ...base, bottom: window.innerHeight - rect.top + 4 };
  }

  useEffect(() => {
    if (!open) return;
    setDropStyle(calcDrop());
    function onDoc(e: MouseEvent) {
      const portal = document.getElementById("adj-type-portal");
      if (!btnRef.current?.contains(e.target as Node) && !portal?.contains(e.target as Node))
        setOpen(false);
    }
    document.addEventListener("mousedown", onDoc, true);
    return () => document.removeEventListener("mousedown", onDoc, true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  return (
    <>
      <button
        ref={btnRef}
        type="button"
        disabled={disabled}
        onClick={() => !disabled && setOpen(v => !v)}
        title={value === "PERCENTAGE" ? "Porcentaje — click para cambiar" : "Monto fijo — click para cambiar"}
        className={cn(
          "h-[42px] w-10 shrink-0 rounded-xl border flex items-center justify-center transition-colors select-none",
          "text-sm font-bold",
          open
            ? "border-primary/40 bg-primary/10 text-primary"
            : "border-border bg-surface2/30 text-muted hover:border-primary/30 hover:text-primary",
          disabled && "opacity-50 pointer-events-none"
        )}
      >
        {short}
      </button>
      {open && createPortal(
        <div
          id="adj-type-portal"
          style={dropStyle}
          className="rounded-2xl border border-border bg-card shadow-soft p-1.5 min-w-[140px]"
          onMouseDown={e => e.preventDefault()}
        >
          {OPTS.map(opt => {
            const isSelected = opt.value === value;
            const isFav = favoriteValue === opt.value;
            return (
              <button
                key={opt.value}
                type="button"
                onClick={() => { onChange(opt.value); setOpen(false); }}
                className={cn(
                  "w-full flex items-center gap-2 rounded-xl px-3 py-1.5 text-sm transition select-none",
                  isSelected
                    ? "bg-primary/15 text-primary font-semibold"
                    : "text-muted hover:bg-surface2/60 hover:text-text"
                )}
              >
                <span className="w-4 text-center font-bold shrink-0 text-xs">{opt.short}</span>
                <span className="flex-1 text-left">{opt.label}</span>
                {isSelected && <Check size={12} className="shrink-0" />}
                {onSetFavorite && (
                  <span
                    role="button"
                    title={isFav ? "Predeterminado" : "Usar como predeterminado"}
                    onMouseDown={e => { e.stopPropagation(); e.preventDefault(); }}
                    onClick={e => { e.stopPropagation(); onSetFavorite(opt.value); }}
                    className={cn("transition-colors", isFav ? "text-yellow-400" : "text-muted/30 hover:text-yellow-400")}
                  >
                    <Star size={9} className={isFav ? "fill-yellow-400" : ""} />
                  </span>
                )}
              </button>
            );
          })}
        </div>,
        document.body
      )}
    </>
  );
}
