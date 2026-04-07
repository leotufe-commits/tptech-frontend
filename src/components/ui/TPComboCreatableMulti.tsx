import React, { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ChevronDown, X, Plus } from "lucide-react";
import { cn, TP_INPUT } from "./tp";
import type { CatalogItem, CatalogType } from "../../services/catalogs";

type ComboItem = {
  id: string;
  label: string;
  value?: string;
  isActive?: boolean;
  isFavorite?: boolean;
};

type Props = {
  label?: string;
  placeholder?: string;
  type: CatalogType;
  items: ComboItem[] | CatalogItem[];
  loading?: boolean;
  onRefresh?: () => void;
  values: string[];
  onChange: (values: string[]) => void;
  disabled?: boolean;
  mode: "create" | "edit";
  tabIndex?: number;
  noLabelSpace?: boolean;
  allowCreate?: boolean;
  onCreate?: (label: string) => Promise<void> | void;
};

function norm(s: string) {
  return String(s || "")
    .trim()
    .replace(/\s+/g, " ");
}

function catTypeEs(t: CatalogType) {
  const map: Record<string, string> = {
    IVA_CONDITION: "Condición de IVA",
    PHONE_PREFIX: "Prefijo telefónico",
    DOCUMENT_TYPE: "Tipo de documento",
    CITY: "Ciudad",
    PROVINCE: "Provincia",
    COUNTRY: "País",
  };
  return map[String(t)] || String(t);
}

function renderHighlightedLabel(label: string, query: string) {
  const q = String(query || "").trim();
  if (!q) return label;

  const src = String(label || "");
  const srcLower = src.toLowerCase();
  const qLower = q.toLowerCase();
  let i = 0;
  const parts: React.ReactNode[] = [];

  while (i < src.length) {
    const idx = srcLower.indexOf(qLower, i);
    if (idx === -1) {
      parts.push(src.slice(i));
      break;
    }
    if (idx > i) parts.push(src.slice(i, idx));
    parts.push(
      <span
        key={`${idx}-${label.slice(idx, idx + qLower.length)}`}
        className="text-primary font-semibold"
      >
        {src.slice(idx, idx + qLower.length)}
      </span>
    );
    i = idx + qLower.length;
  }

  return <>{parts}</>;
}

function CreateModal({
  open,
  title,
  children,
  loading,
  onClose,
  onConfirm,
}: {
  open: boolean;
  title: string;
  children: React.ReactNode;
  loading?: boolean;
  onClose: () => void;
  onConfirm: () => void;
}) {
  if (!open) return null;

  return createPortal(
    <div className="fixed inset-0 z-[200]">
      <div className="absolute inset-0 bg-black/40" onMouseDown={onClose} />
      <div className="absolute inset-0 grid place-items-center p-4">
        <div
          role="dialog"
          aria-modal="true"
          className="w-full max-w-[420px] rounded-2xl border border-border bg-card shadow-soft"
          onMouseDown={(e) => e.stopPropagation()}
        >
          <div className="p-4 border-b border-border">
            <div className="text-base font-semibold text-text">{title}</div>
          </div>
          <div className="p-4">{children}</div>
          <div className="p-4 pt-2 flex justify-end gap-2 border-t border-border">
            <button
              className="tp-btn-secondary"
              onClick={onClose}
              disabled={loading}
              type="button"
            >
              Cancelar
            </button>
            <button
              className="tp-btn-primary"
              onClick={onConfirm}
              disabled={loading}
              type="button"
            >
              {loading ? "Guardando…" : "Agregar"}
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}

function getItemValue(item: ComboItem | CatalogItem) {
  return "value" in item && item.value ? item.value : item.label;
}

export default function TPComboCreatableMulti({
  label,
  placeholder = "Seleccionar o escribir…",
  type,
  items,
  loading = false,
  onRefresh,
  values,
  onChange,
  allowCreate = false,
  onCreate,
  disabled = false,
  mode,
  tabIndex,
  noLabelSpace = false,
}: Props) {
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const createInputRef = useRef<HTMLInputElement | null>(null);
  const itemRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const dropdownRef = useRef<HTMLDivElement | null>(null);
  const [dropdownStyle, setDropdownStyle] = useState<React.CSSProperties>({});

  const [open, setOpen] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [createDraft, setCreateDraft] = useState("");
  const [creating, setCreating] = useState(false);
  const [errMsg, setErrMsg] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState<number>(-1);

  const refocusAfterCreateRef = useRef(false);

  function closeCreateModalAndRefocus() {
    refocusAfterCreateRef.current = true;
    setCreateOpen(false);
  }

  const safeItems = useMemo(() => (Array.isArray(items) ? items : []), [items]);

  const activeItems = useMemo(
    () => safeItems.filter((i) => i.isActive !== false),
    [safeItems]
  );

  const selectedLower = useMemo(
    () => values.map((v) => norm(v).toLowerCase()),
    [values]
  );

  const valueToLabelMap = useMemo(() => {
    const map = new Map<string, string>();
    activeItems.forEach((item) => {
      map.set(getItemValue(item), item.label);
    });
    return map;
  }, [activeItems]);

  const suggestions = useMemo(() => {
    return activeItems.filter(
      (it) => !selectedLower.includes(norm(getItemValue(it)).toLowerCase())
    );
  }, [activeItems, selectedLower]);

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (
        !wrapRef.current?.contains(e.target as any) &&
        !dropdownRef.current?.contains(e.target as any)
      ) {
        setOpen(false);
      }
    }
    // capture:true para disparar antes del stopPropagation del Modal
    document.addEventListener("mousedown", onDoc, true);
    return () => document.removeEventListener("mousedown", onDoc, true);
  }, []);

  useEffect(() => {
    if (!open || !wrapRef.current) return;
    function updatePos() {
      if (!wrapRef.current) return;
      const rect = wrapRef.current.getBoundingClientRect();
      setDropdownStyle({
        position: "fixed",
        top: rect.bottom + 8,
        left: rect.left,
        width: rect.width,
        zIndex: 9999,
      });
    }
    updatePos();
    window.addEventListener("scroll", updatePos, true);
    window.addEventListener("resize", updatePos);
    return () => {
      window.removeEventListener("scroll", updatePos, true);
      window.removeEventListener("resize", updatePos);
    };
  }, [open]);

  useEffect(() => {
    itemRefs.current = [];
    if (!open) {
      setActiveIndex(-1);
      return;
    }
    setActiveIndex(suggestions.length ? 0 : -1);
  }, [open, suggestions]);

  useEffect(() => {
    if (!open || !query.trim()) return;
    const q = query.trim().toLowerCase();
    let idx = suggestions.findIndex((it) => norm(it.label).toLowerCase().startsWith(q));
    if (idx === -1) idx = suggestions.findIndex((it) => norm(it.label).toLowerCase().includes(q));
    if (idx >= 0) {
      setActiveIndex(idx);
      setTimeout(() => itemRefs.current[idx]?.scrollIntoView({ block: "nearest" }), 0);
    }
  }, [query, open, suggestions]);

  useEffect(() => {
    if (createOpen) {
      setTimeout(() => {
        createInputRef.current?.select();
      }, 50);
    }
  }, [createOpen]);

  useEffect(() => {
    if (!createOpen && refocusAfterCreateRef.current) {
      refocusAfterCreateRef.current = false;
      setTimeout(() => inputRef.current?.focus(), 0);
    }
  }, [createOpen]);

  function openDropdown() {
    if (disabled || creating) return;
    setErrMsg(null);
    setOpen(true);
    onRefresh?.();
  }

  function closeDropdown() {
    setOpen(false);
  }

  function addValue(rawValue: string) {
    const clean = norm(rawValue);
    if (!clean) return;

    if (selectedLower.includes(clean.toLowerCase())) {
      setQuery("");
      return;
    }

    onChange([...values, clean]);
    setQuery("");
    setOpen(true);
  }

  function removeValue(index: number) {
    onChange(values.filter((_, i) => i !== index));
  }

  async function doCreate() {
    if (!onCreate) return closeCreateModalAndRefocus();

    const clean = norm(createDraft);
    if (!clean) return;

    setCreating(true);
    try {
      await onCreate(clean);
      onRefresh?.();
      addValue(clean);
      closeCreateModalAndRefocus();
    } catch (e: any) {
      setErrMsg(String(e?.message || "No se pudo crear el ítem."));
    } finally {
      setCreating(false);
    }
  }

  function openCreateFromCurrent() {
    if (disabled || creating) return;
    setCreateDraft(norm(query));
    setCreateOpen(true);
    setOpen(false);
  }

  const canClear = values.length > 0 && !disabled && !creating;
  const rightPad = canClear ? "pr-16" : "pr-10";
  const showLabel = !noLabelSpace && Boolean(String(label || "").trim());

  function onInputKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (disabled || creating || createOpen) return;

    if (e.key === "ArrowDown") {
      e.preventDefault();
      if (!open) openDropdown();
      setActiveIndex((prev) => {
        const next = prev < 0 ? 0 : Math.min(prev + 1, suggestions.length - 1);
        itemRefs.current[next]?.scrollIntoView({ block: "nearest" });
        return next;
      });
      return;
    }

    if (e.key === "ArrowUp") {
      e.preventDefault();
      if (!open) openDropdown();
      setActiveIndex((prev) => {
        const next = prev <= 0 ? 0 : prev - 1;
        itemRefs.current[next]?.scrollIntoView({ block: "nearest" });
        return next;
      });
      return;
    }

    if (e.key === "Enter") {
      e.preventDefault();

      if (!open) {
        openDropdown();
        return;
      }

      if (activeIndex >= 0 && activeIndex < suggestions.length) {
        addValue(getItemValue(suggestions[activeIndex]));
        return;
      }

      const clean = norm(query);
      if (!clean) return;

      const existsInCatalog = activeItems.some(
        (it) => norm(it.label).toLowerCase() === clean.toLowerCase()
      );

      if (!existsInCatalog && allowCreate) {
        openCreateFromCurrent();
        return;
      }

      addValue(clean);
      return;
    }

    if (e.key === "Escape" && open) {
      e.preventDefault();
      closeDropdown();
      return;
    }

    if (e.key === "Backspace" && !query && values.length > 0) {
      e.preventDefault();
      removeValue(values.length - 1);
    }
  }

  function onWrapBlurCapture(e: React.FocusEvent<HTMLDivElement>) {
    const next = e.relatedTarget as HTMLElement | null;
    if (!next || !wrapRef.current?.contains(next)) closeDropdown();
  }

  return (
    <>
      <div
        ref={wrapRef}
        className={cn("w-full", !noLabelSpace && "space-y-1")}
        onBlurCapture={onWrapBlurCapture}
      >
        {showLabel && <div className="text-xs font-medium text-muted">{label}</div>}

        <div className="relative">
          <div
            className={cn(
              TP_INPUT,
              "w-full min-h-[38px] h-auto px-3 py-1.5 flex flex-wrap items-center gap-1.5 rounded-xl",
              "border border-border bg-card shadow-none",
              "focus-within:outline-none focus-within:ring-0 focus-within:border-primary",
              rightPad,
              disabled || creating ? "opacity-60 cursor-not-allowed" : "cursor-text"
            )}
            onClick={() => {
              if (disabled || creating) return;
              inputRef.current?.focus();
              openDropdown();
            }}
          >
            {values.map((v, idx) => (
              <span
                key={`${v}-${idx}`}
                title={valueToLabelMap.get(v) ?? v}
                className="inline-flex max-w-[180px] shrink-0 items-center gap-1 rounded-lg border border-border bg-bg px-2 py-0.5 text-xs font-medium text-text"
              >
                <span className="truncate">{valueToLabelMap.get(v) ?? v}</span>

                {!disabled && !creating && (
                  <button
                    type="button"
                    onMouseDown={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                    }}
                    onClick={(e) => {
                      e.stopPropagation();
                      removeValue(idx);
                    }}
                    className="text-muted hover:text-text"
                    tabIndex={-1}
                  >
                    <X size={10} />
                  </button>
                )}
              </span>
            ))}

            <input
              ref={inputRef}
              tabIndex={tabIndex}
              value={query}
              disabled={disabled || creating}
              placeholder={values.length === 0 ? placeholder : ""}
              onFocus={openDropdown}
              onKeyDown={onInputKeyDown}
              onChange={(e) => {
                setQuery(e.target.value);
                openDropdown();
              }}
              className="flex-1 min-w-[80px] bg-transparent border-0 p-0 text-sm text-text outline-none placeholder:text-muted shadow-none"
            />
          </div>

          {canClear && (
            <button
              type="button"
              className="absolute right-8 top-1/2 -translate-y-1/2 text-muted hover:text-text"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => {
                onChange([]);
                setQuery("");
                setOpen(false);
              }}
              tabIndex={-1}
            >
              <X size={14} />
            </button>
          )}

          <button
            type="button"
            className="absolute right-2 top-1/2 -translate-y-1/2 text-muted hover:text-text"
            onMouseDown={(e) => e.preventDefault()}
            onClick={openDropdown}
            disabled={disabled || creating}
            tabIndex={-1}
          >
            <ChevronDown size={16} />
          </button>
        </div>

        {errMsg && <div className="mt-2 text-xs text-red-600">{errMsg}</div>}
      </div>

      {open &&
        !disabled &&
        !creating &&
        createPortal(
          <div
            ref={dropdownRef}
            style={dropdownStyle}
            className="rounded-2xl border border-border bg-card shadow-soft"
            onMouseDown={(e) => e.preventDefault()}
          >
            <div className="max-h-64 overflow-auto p-2">
              {suggestions.map((it, idx) => (
                <button
                  key={it.id}
                  ref={(el) => {
                    itemRefs.current[idx] = el;
                  }}
                  type="button"
                  onMouseEnter={() => setActiveIndex(idx)}
                  onClick={() => addValue(getItemValue(it))}
                  tabIndex={-1}
                  className={cn(
                    "w-full rounded-xl px-3 py-2 text-left text-sm hover:bg-primary/10",
                    idx === activeIndex && "bg-primary/10"
                  )}
                >
                  {renderHighlightedLabel(it.label, query)}
                </button>
              ))}

              {suggestions.length === 0 && !allowCreate && (
                <div className="px-3 py-2 text-sm text-muted">Sin opciones disponibles</div>
              )}

              {allowCreate && (
                <button
                  type="button"
                  tabIndex={-1}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={openCreateFromCurrent}
                  className={cn(
                    "mt-2 w-full rounded-xl px-3 py-2 text-left text-sm",
                    "border border-dashed border-border hover:bg-primary/10",
                    "flex items-center gap-2 text-primary"
                  )}
                >
                  <Plus className="h-4 w-4" />
                  <span className="underline">Agregar ítem</span>
                  {norm(query) && (
                    <span className="text-muted no-underline">
                      "{norm(query)}"
                    </span>
                  )}
                </button>
              )}
            </div>
          </div>,
          document.body
        )}

      <CreateModal
        open={createOpen}
        title="Agregar nuevo ítem"
        loading={creating}
        onClose={() => !creating && closeCreateModalAndRefocus()}
        onConfirm={doCreate}
      >
        <div className="space-y-2">
          <div className="text-sm text-muted">Tipo: {catTypeEs(type)}</div>
          <input
            ref={createInputRef}
            autoFocus
            value={createDraft}
            onChange={(e) => setCreateDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                void doCreate();
              }
              if (e.key === "Escape") {
                e.preventDefault();
                if (!creating) closeCreateModalAndRefocus();
              }
            }}
            className={cn(TP_INPUT, "w-full")}
            placeholder="Escribí el ítem…"
          />
        </div>
      </CreateModal>
    </>
  );
}