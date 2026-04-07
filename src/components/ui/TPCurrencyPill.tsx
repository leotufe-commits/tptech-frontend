// src/components/ui/TPCurrencyPill.tsx
// Dropdown compacto para seleccionar moneda. Muestra el código (ARS, EUR…)
// con un chevron y abre un portal con la lista de opciones.
// Si solo hay una moneda disponible, se muestra como texto estático (sin dropdown).
import React, { useState, useRef, useEffect } from "react";
import ReactDOM from "react-dom";
import { ChevronDown } from "lucide-react";
import { cn } from "./tp";

export type CurrencyOption = {
  id: string;
  code: string;
  symbol: string;
};

type Props = {
  /** ID de la moneda seleccionada */
  value: string;
  onChange: (id: string) => void;
  currencies: CurrencyOption[];
  /** ID de la moneda base (fallback si value no matchea ninguna) */
  baseCurrencyId: string;
  disabled?: boolean;
  className?: string;
};

export default function TPCurrencyPill({
  value,
  onChange,
  currencies,
  baseCurrencyId,
  disabled = false,
  className,
}: Props) {
  const [open, setOpen] = useState(false);
  const btnRef = useRef<HTMLButtonElement>(null);
  const [pos, setPos] = useState({ top: 0, left: 0 });

  const curr =
    currencies.find((c) => c.id === value) ??
    currencies.find((c) => c.id === baseCurrencyId);

  useEffect(() => {
    if (!open) return;
    function onDoc(e: MouseEvent) {
      const portal = document.getElementById("tp-currency-pill-portal");
      if (
        !btnRef.current?.contains(e.target as Node) &&
        !portal?.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onDoc, true);
    return () => document.removeEventListener("mousedown", onDoc, true);
  }, [open]);

  // Solo una moneda → muestra estático, sin dropdown
  if (currencies.length <= 1) {
    return (
      <span
        className={cn(
          "inline-flex items-center justify-center px-2 h-8 rounded-lg",
          "bg-surface2/40 border border-border text-xs font-semibold text-muted w-full",
          className
        )}
      >
        {curr?.code ?? "—"}
      </span>
    );
  }

  function openMenu(e: React.MouseEvent) {
    if (disabled) return;
    e.stopPropagation();
    const r = btnRef.current?.getBoundingClientRect();
    if (r) setPos({ top: r.bottom + 4, left: r.left });
    setOpen((v) => !v);
  }

  return (
    <>
      <button
        ref={btnRef}
        type="button"
        onClick={openMenu}
        disabled={disabled}
        title="Cambiar moneda"
        className={cn(
          "inline-flex items-center justify-center gap-0.5 px-2 h-8 rounded-lg border",
          "border-border bg-surface2/40 text-xs font-semibold text-text transition w-full",
          !disabled && "hover:bg-surface2 hover:border-primary/40 cursor-pointer",
          disabled && "opacity-50 cursor-not-allowed",
          className
        )}
      >
        {curr?.code ?? "—"} <ChevronDown size={9} className="text-muted" />
      </button>

      {open &&
        ReactDOM.createPortal(
          <div
            id="tp-currency-pill-portal"
            onMouseDown={(e) => e.stopPropagation()}
            style={{ top: pos.top, left: pos.left, position: "fixed", zIndex: 9999, minWidth: 120 }}
            className="rounded-xl border border-border bg-card shadow-lg py-1 overflow-hidden"
          >
            {currencies.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => {
                  onChange(c.id);
                  setOpen(false);
                }}
                className={cn(
                  "w-full flex items-center gap-2 px-3 py-1.5 text-xs hover:bg-surface2 transition text-left",
                  c.id === value ? "font-semibold text-primary" : "text-text"
                )}
              >
                <span className="font-semibold w-8 shrink-0">{c.code}</span>
                <span className="text-muted">{c.symbol}</span>
              </button>
            ))}
          </div>,
          document.body
        )}
    </>
  );
}
