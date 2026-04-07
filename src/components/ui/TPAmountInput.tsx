// src/components/ui/TPAmountInput.tsx
//
// Patrón estándar TPTech para campos de valor comercial.
// Combina número + moneda integrada + selector de tipo compacto.
//
//   Modo porcentaje: [ 10,00              ▲▼ ]  [%]
//   Modo monto:      [ 10,00    ARS ▼     ▲▼ ]  [$]
//
// Reglas de diseño:
//   - El valor es siempre el protagonista (flex-1)
//   - La moneda va DENTRO del input (solo en modo monto)
//   - El tipo va FUERA, como botón compacto con dropdown
//
// Cuándo usarlo:
//   - Descuentos, recargos, bonificaciones, ajustes, comisiones,
//     promociones, intereses, cualquier campo porcentaje-o-monto
//
// Cuándo NO usarlo:
//   - Cantidades (stock, unidades), medidas (gramos, cm)
//   - Valores fijos sin variación de tipo
//
import React, { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Check, Star } from "lucide-react";
import { cn } from "./tp";
import TPNumberInput from "./TPNumberInput";
import TPNumberSelect, { type NSOption } from "./TPNumberSelect";

// ─── Tipos públicos ────────────────────────────────────────────────────────────

export type AmountType = "PERCENTAGE" | "FIXED_AMOUNT";

export type TPAmountInputProps = {
  /** Valor numérico actual */
  value: number | null;
  onChange: (v: number | null) => void;

  /** Decimales a mostrar (default: 2) */
  decimals?: number;
  /** Valor mínimo permitido (default: 0) */
  min?: number;
  /** Placeholder del input numérico */
  placeholder?: string;

  /** Tipo de valor actual: porcentaje o monto fijo */
  type: AmountType;
  onTypeChange: (t: AmountType) => void;
  /** Valor marcado como predeterminado en el selector de tipo */
  favoriteType?: string | null;
  /** Callback para marcar un tipo como predeterminado */
  onSetFavoriteType?: (v: string) => void;

  /**
   * ID de la moneda seleccionada.
   * Solo relevante cuando type === "FIXED_AMOUNT".
   */
  currencyId?: string;
  onCurrencyChange?: (id: string) => void;
  /** Lista de monedas disponibles (value=id, label=código ej: "ARS") */
  currencyOptions?: NSOption[];

  disabled?: boolean;
  className?: string;
};

// ─── Botón de tipo compacto (interno) ─────────────────────────────────────────
//
// Muestra "%" o "$" según el tipo activo.
// Al hacer click abre un dropdown portal con las opciones.

function TypeButton({
  value,
  onChange,
  favoriteValue,
  onSetFavorite,
  disabled,
}: {
  value: AmountType;
  onChange: (v: AmountType) => void;
  favoriteValue?: string | null;
  onSetFavorite?: (v: string) => void;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [dropStyle, setDropStyle] = useState<React.CSSProperties>({});
  const btnRef = useRef<HTMLButtonElement>(null);

  const short = value === "PERCENTAGE" ? "%" : "$";

  function calcDrop(): React.CSSProperties {
    const rect = btnRef.current?.getBoundingClientRect();
    if (!rect) return {};
    const spaceBelow = window.innerHeight - rect.bottom - 4;
    const spaceAbove = rect.top - 4;
    const base: React.CSSProperties = {
      position: "fixed",
      right: window.innerWidth - rect.right,
      zIndex: 9999,
    };
    return spaceBelow >= 90 || spaceBelow >= spaceAbove
      ? { ...base, top: rect.bottom + 4 }
      : { ...base, bottom: window.innerHeight - rect.top + 4 };
  }

  useEffect(() => {
    if (!open) return;
    setDropStyle(calcDrop());
    function onDoc(e: MouseEvent) {
      const portal = document.getElementById("tp-amount-type-portal");
      if (
        !btnRef.current?.contains(e.target as Node) &&
        !portal?.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onDoc, true);
    return () => document.removeEventListener("mousedown", onDoc, true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const opts: { value: AmountType; label: string; short: string }[] = [
    { value: "PERCENTAGE",   label: "Porcentaje", short: "%" },
    { value: "FIXED_AMOUNT", label: "Monto fijo",  short: "$" },
  ];

  return (
    <>
      <button
        ref={btnRef}
        type="button"
        disabled={disabled}
        onClick={() => !disabled && setOpen(v => !v)}
        title={
          value === "PERCENTAGE"
            ? "Porcentaje — click para cambiar"
            : "Monto fijo — click para cambiar"
        }
        className={cn(
          "h-[42px] w-10 shrink-0 rounded-xl border flex items-center justify-center",
          "text-sm font-bold transition-colors select-none",
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
          id="tp-amount-type-portal"
          style={dropStyle}
          className="rounded-2xl border border-border bg-card shadow-soft p-1.5 min-w-[140px]"
          onMouseDown={e => e.preventDefault()}
        >
          {opts.map(opt => {
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
                    className={cn(
                      "transition-colors",
                      isFav ? "text-yellow-400" : "text-muted/30 hover:text-yellow-400"
                    )}
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

// ─── Componente principal ──────────────────────────────────────────────────────

/**
 * TPAmountInput — campo de valor comercial estándar TPTech.
 *
 * Ejemplo de uso (descuento):
 * ```tsx
 * <TPAmountInput
 *   value={discount}
 *   onChange={setDiscount}
 *   type={discountType}
 *   onTypeChange={setDiscountType}
 *   currencyId={currencyId}
 *   onCurrencyChange={setCurrencyId}
 *   currencyOptions={currencies.map(c => ({ value: c.id, label: c.code }))}
 * />
 * ```
 */
export default function TPAmountInput({
  value,
  onChange,
  decimals = 2,
  min = 0,
  placeholder,
  type,
  onTypeChange,
  favoriteType,
  onSetFavoriteType,
  currencyId,
  onCurrencyChange,
  currencyOptions = [],
  disabled = false,
  className,
}: TPAmountInputProps) {
  return (
    <div className={cn("flex items-center gap-3", className)}>
      {/* ── Input numérico principal (protagonista) ── */}
      <div className="flex-1 min-w-0">
        {type === "PERCENTAGE" ? (
          <TPNumberInput
            value={value}
            onChange={onChange}
            decimals={decimals}
            min={min}
            placeholder={placeholder}
            disabled={disabled}
            suffix={<span className="text-[11px] font-bold">%</span>}
          />
        ) : (
          <TPNumberSelect
            numberValue={value}
            onNumberChange={onChange}
            numberDecimals={decimals}
            numberMin={min}
            numberPlaceholder={placeholder ?? "0,00"}
            showArrows
            selectorValue={currencyId ?? ""}
            onSelectorChange={onCurrencyChange ?? (() => {})}
            selectorOptions={currencyOptions}
            disabled={disabled}
          />
        )}
      </div>

      {/* ── Selector de tipo compacto (% / $) ── */}
      <TypeButton
        value={type}
        onChange={onTypeChange}
        favoriteValue={favoriteType}
        onSetFavorite={onSetFavoriteType}
        disabled={disabled}
      />
    </div>
  );
}
