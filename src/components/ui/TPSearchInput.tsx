// src/components/ui/TPSearchInput.tsx
import React, { useEffect, useRef, useState } from "react";
import { Search, X } from "lucide-react";
import { cn } from "./tp";

type Props = {
  value: string;
  onChange: (v: string) => void;

  placeholder?: string;
  disabled?: boolean;

  className?: string;
  wrapClassName?: string;

  refocusOnClear?: boolean;
  debounceMs?: number;
};

export function TPSearchInput({
  value,
  onChange,
  placeholder = "Buscar…",
  disabled,
  className,
  wrapClassName,
  refocusOnClear = true,
  debounceMs,
}: Props) {
  const inputRef = useRef<HTMLInputElement | null>(null);

  const [local, setLocal] = useState(value);
  const tRef = useRef<number | null>(null);

  useEffect(() => setLocal(value), [value]);

  useEffect(() => {
    return () => {
      if (tRef.current) window.clearTimeout(tRef.current);
      tRef.current = null;
    };
  }, []);

  function emit(next: string) {
    if (!debounceMs) return onChange(next);
    if (tRef.current) window.clearTimeout(tRef.current);
    tRef.current = window.setTimeout(() => {
      onChange(next);
      tRef.current = null;
    }, debounceMs);
  }

  function clearNow() {
    if (tRef.current) window.clearTimeout(tRef.current);
    tRef.current = null;

    setLocal("");
    onChange("");

    if (refocusOnClear) inputRef.current?.focus();
  }

  const showClear = !!local;

  return (
    <div className={cn("relative w-full", wrapClassName)}>
      {/* ✅ lupa centrada y sin bloquear clicks */}
      <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted" />

      <input
        ref={inputRef}
        type="search"
        className={cn(
          // ✅ IMPORTANTE: forzamos padding para que la lupa NO pise el texto aunque tp-input tenga padding con !important
          "tp-input !pl-10 !pr-10",
          // ✅ altura default (se puede pisar desde className con h-11, etc.)
          "h-10",
          className
        )}
        placeholder={placeholder}
        value={local}
        disabled={disabled}
        onChange={(e) => {
          const next = e.target.value;
          setLocal(next);
          emit(next);
        }}
        spellCheck={false}
      />

      {showClear ? (
        <button
          type="button"
          onClick={clearNow}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-muted hover:text-text"
          aria-label="Limpiar"
          title="Limpiar"
          tabIndex={-1}
          disabled={disabled}
        >
          <X className="h-4 w-4" />
        </button>
      ) : null}
    </div>
  );
}

export default TPSearchInput;