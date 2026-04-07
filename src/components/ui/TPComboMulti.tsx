// src/components/ui/TPComboMulti.tsx
//
// Selector múltiple genérico con búsqueda, chips y portal.
// Para selección dinámica (async) preferir buildear un componente propio
// que llame a este o imite su patrón.
//
import React, { useEffect, useRef, useState } from "react";
import ReactDOM from "react-dom";
import { ChevronDown, Search, X, Check } from "lucide-react";
import { cn, TP_INPUT } from "./tp";

export type ComboMultiOption = {
  value: string;
  label: string;
  sublabel?: string;
  disabled?: boolean;
};

type Props = {
  value: string[];
  onChange: (v: string[]) => void;
  options: ComboMultiOption[];
  placeholder?: string;
  disabled?: boolean;
  searchable?: boolean;
  searchPlaceholder?: string;
  className?: string;
};

export default function TPComboMulti({
  value,
  onChange,
  options,
  placeholder = "Seleccionar…",
  disabled = false,
  searchable = true,
  searchPlaceholder = "Buscar…",
  className,
}: Props) {
  const [open, setOpen] = useState(false);
  const [searchText, setSearchText] = useState("");
  const [dropdownStyle, setDropdownStyle] = useState<React.CSSProperties>({});

  const wrapRef  = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  const selectedOptions = options.filter((o) => value.includes(o.value));

  const filteredOptions =
    searchable && searchText.trim()
      ? options.filter((o) =>
          o.label.toLowerCase().includes(searchText.trim().toLowerCase()) ||
          (o.sublabel ?? "").toLowerCase().includes(searchText.trim().toLowerCase())
        )
      : options;

  /* ---- posición dropdown ---- */
  function calcDropdownStyle(): React.CSSProperties {
    const rect = wrapRef.current?.getBoundingClientRect();
    if (!rect) return {};
    const maxH = 300;
    const below = window.innerHeight - rect.bottom - 8;
    const above = rect.top - 8;
    if (below >= maxH || below >= above) {
      return { position: "fixed", top: rect.bottom + 4, left: rect.left, width: rect.width, zIndex: 9999 };
    }
    return { position: "fixed", bottom: window.innerHeight - rect.top + 4, left: rect.left, width: rect.width, zIndex: 9999 };
  }

  /* ---- cerrar al click fuera ---- */
  useEffect(() => {
    function onDoc(e: MouseEvent) {
      const t = e.target as Node;
      const portal = document.getElementById("tp-combo-multi-portal");
      if (!wrapRef.current?.contains(t) && !portal?.contains(t)) {
        setOpen(false);
        setSearchText("");
      }
    }
    // capture:true para disparar antes del stopPropagation del Modal
    document.addEventListener("mousedown", onDoc, true);
    return () => document.removeEventListener("mousedown", onDoc, true);
  }, []);

  /* ---- reposicionar en scroll/resize ---- */
  useEffect(() => {
    if (!open) return;
    const reposition = () => setDropdownStyle(calcDropdownStyle());
    window.addEventListener("scroll", reposition, true);
    window.addEventListener("resize", reposition);
    return () => {
      window.removeEventListener("scroll", reposition, true);
      window.removeEventListener("resize", reposition);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  function openDropdown() {
    if (disabled) return;
    setOpen(true);
    setDropdownStyle(calcDropdownStyle());
    setTimeout(() => searchRef.current?.focus(), 0);
  }

  function toggle(optValue: string) {
    if (value.includes(optValue)) {
      onChange(value.filter((v) => v !== optValue));
    } else {
      onChange([...value, optValue]);
    }
  }

  function removeChip(optValue: string, e: React.MouseEvent) {
    e.stopPropagation();
    onChange(value.filter((v) => v !== optValue));
  }

  /* ---- dropdown portal ---- */
  const dropdown =
    open && !disabled &&
    ReactDOM.createPortal(
      <div
        id="tp-combo-multi-portal"
        data-tp-portal
        style={dropdownStyle}
        className="rounded-2xl border border-border bg-card shadow-soft"
        role="listbox"
        aria-multiselectable="true"
      >
        {searchable && (
          <div className="p-2 pb-1">
            <div className="relative">
              <Search
                size={14}
                className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted"
              />
              <input
                ref={searchRef}
                type="text"
                value={searchText}
                onChange={(e) => setSearchText(e.target.value)}
                placeholder={searchPlaceholder}
                className={cn(TP_INPUT, "w-full !pl-8 py-1.5 text-sm h-8")}
              />
            </div>
          </div>
        )}

        <div className="max-h-60 overflow-auto p-2 pt-1">
          {filteredOptions.length === 0 ? (
            <p className="px-3 py-2 text-sm text-muted text-center">Sin resultados</p>
          ) : (
            filteredOptions.map((opt) => {
              const isSelected = value.includes(opt.value);
              return (
                <button
                  key={opt.value}
                  type="button"
                  role="option"
                  aria-selected={isSelected}
                  aria-disabled={opt.disabled}
                  onClick={() => !opt.disabled && toggle(opt.value)}
                  className={cn(
                    "w-full rounded-xl px-3 py-2 text-left text-sm flex items-center gap-2.5 transition",
                    opt.disabled
                      ? "opacity-40 cursor-not-allowed"
                      : "hover:bg-primary/10 cursor-pointer",
                    isSelected && !opt.disabled && "bg-primary/5"
                  )}
                >
                  {/* checkbox visual */}
                  <div
                    className={cn(
                      "flex-shrink-0 w-4 h-4 rounded border flex items-center justify-center transition",
                      isSelected
                        ? "bg-primary border-primary"
                        : "border-border bg-transparent"
                    )}
                  >
                    {isSelected && <Check size={10} className="text-primary-foreground" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <span className={cn("block truncate", isSelected && "font-medium")}>
                      {opt.label}
                    </span>
                    {opt.sublabel && (
                      <span className="block text-xs text-muted truncate">{opt.sublabel}</span>
                    )}
                  </div>
                </button>
              );
            })
          )}
        </div>

        {/* Footer: seleccionados / limpiar */}
        {value.length > 0 && (
          <div className="border-t border-border px-3 py-2 flex items-center justify-between gap-2">
            <span className="text-xs text-muted">
              {value.length} seleccionado{value.length !== 1 ? "s" : ""}
            </span>
            <button
              type="button"
              onClick={() => onChange([])}
              className="text-xs text-muted hover:text-primary transition flex items-center gap-1"
            >
              <X size={11} />
              Limpiar
            </button>
          </div>
        )}
      </div>,
      document.body
    );

  return (
    <div
      ref={wrapRef}
      className={cn(
        "relative w-full",
        disabled && "opacity-[0.65] pointer-events-none",
        className
      )}
    >
      {/* Trigger */}
      <div
        onClick={openDropdown}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            openDropdown();
          }
        }}
        tabIndex={disabled ? -1 : 0}
        role="combobox"
        aria-haspopup="listbox"
        aria-expanded={open}
        className={cn(
          TP_INPUT,
          "w-full min-h-[2.5rem] cursor-pointer pr-9 py-1.5",
          "flex flex-wrap gap-1.5 items-center",
          open && "ring-2 ring-primary/30 border-primary/50"
        )}
      >
        {selectedOptions.length === 0 ? (
          <span className="text-sm text-muted leading-none">{placeholder}</span>
        ) : (
          selectedOptions.map((opt) => (
            <span
              key={opt.value}
              className="inline-flex items-center gap-1 rounded-full bg-primary/10 text-primary text-xs font-medium px-2.5 py-0.5 leading-none"
            >
              <span className="truncate max-w-[160px]">{opt.label}</span>
              <button
                type="button"
                tabIndex={-1}
                onClick={(e) => removeChip(opt.value, e)}
                className="flex-shrink-0 hover:text-primary/60 transition"
              >
                <X size={11} />
              </button>
            </span>
          ))
        )}
      </div>

      <ChevronDown
        size={16}
        className={cn(
          "pointer-events-none absolute right-3 top-3 text-muted transition-transform",
          open && "rotate-180"
        )}
      />

      {dropdown}
    </div>
  );
}
