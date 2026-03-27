import React, { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ChevronDown, X, Plus } from "lucide-react";
import { cn, TP_INPUT } from "./tp";
import type { CatalogItem, CatalogType } from "../../services/catalogs";

/* =========================
   Types
========================= */

type BaseProps = {
  label?: string;
  placeholder?: string;
  type: CatalogType;
  items: CatalogItem[];
  loading?: boolean;
  onRefresh?: () => void;
  allowCreate?: boolean;
  onCreate?: (label: string) => Promise<void> | void;
  disabled?: boolean;
  mode: "create" | "edit";
  tabIndex?: number;
  noLabelSpace?: boolean;
  children?: never;
  dangerouslySetInnerHTML?: never;
};

type PropsSingle = BaseProps & {
  multiple?: false;
  value: string;
  onChange: (value: string) => void;
};

type PropsMulti = BaseProps & {
  multiple: true;
  values: string[];
  onChange: (values: string[]) => void;
};

export type Props = PropsSingle | PropsMulti;

/* =========================
   Utils
========================= */
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
    PAYMENT_TERM: "Plazo de pago",
    ARTICLE_BRAND: "Marca",
    ARTICLE_MANUFACTURER: "Fabricante",
    UNIT_OF_MEASURE: "Unidad de medida",
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

/* =========================
   Create item modal (shared)
========================= */
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
          data-tp-enter="ignore"
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

/* =========================
   SINGLE mode component
========================= */
function SingleCombo({
  label,
  placeholder = "Seleccionar o escribir…",
  type,
  items,
  loading = false,
  onRefresh,
  value,
  onChange,
  allowCreate = false,
  onCreate,
  disabled = false,
  mode,
  tabIndex,
  noLabelSpace = false,
}: PropsSingle) {
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const dropdownRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const createInputRef = useRef<HTMLInputElement | null>(null);

  const [open, setOpen] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [createDraft, setCreateDraft] = useState("");
  const [creating, setCreating] = useState(false);
  const [errMsg, setErrMsg] = useState<string | null>(null);
  const [dropdownStyle, setDropdownStyle] = useState<React.CSSProperties>({});

  function calcDropdownStyle(): React.CSSProperties {
    const rect = inputRef.current?.getBoundingClientRect();
    if (!rect) return {};
    const maxH = 280;
    const spaceBelow = window.innerHeight - rect.bottom - 4;
    const spaceAbove = rect.top - 4;
    if (spaceBelow >= maxH || spaceBelow >= spaceAbove) {
      return { top: rect.bottom + 4, left: rect.left, width: rect.width };
    }
    return { bottom: window.innerHeight - rect.top + 4, left: rect.left, width: rect.width };
  }

  const safeItems = useMemo(() => (Array.isArray(items) ? items : []), [items]);
  const activeItems = useMemo(
    () => safeItems.filter((i) => i.isActive !== false),
    [safeItems]
  );

  const filteredItems = activeItems;

  const didAutoPickRef = useRef(false);
  const refocusAfterCreateRef = useRef(false);

  function closeCreateModalAndRefocus() {
    refocusAfterCreateRef.current = true;
    setCreateOpen(false);
  }

  const [activeIndex, setActiveIndex] = useState<number>(-1);
  const itemRefs = useRef<Array<HTMLButtonElement | null>>([]);

  useEffect(() => {
    if (mode !== "create") return;
    if (disabled || creating) return;
    if (didAutoPickRef.current) return;
    if (norm(value)) return;
    const fav = activeItems.find((i) => i.isFavorite);
    if (!fav?.label) return;
    didAutoPickRef.current = true;
    onChange(fav.label);
  }, [mode, activeItems, value, disabled, creating, onChange]);

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      const target = e.target as Node;
      if (!wrapRef.current?.contains(target) && !dropdownRef.current?.contains(target)) setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  useEffect(() => {
    itemRefs.current = [];
    if (!open) {
      setActiveIndex(-1);
      return;
    }
    const v = norm(value).toLowerCase();
    let idx = -1;
    if (v) {
      idx = filteredItems.findIndex((it) => norm(it.label).toLowerCase().startsWith(v));
      if (idx === -1) idx = filteredItems.findIndex((it) => norm(it.label).toLowerCase().includes(v));
    }
    const newIdx = filteredItems.length ? (idx >= 0 ? idx : 0) : -1;
    setActiveIndex(newIdx);
    if (newIdx >= 0 && v) {
      setTimeout(() => itemRefs.current[newIdx]?.scrollIntoView({ block: "nearest" }), 0);
    }
  }, [open, filteredItems, value]);

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

  useEffect(() => {
    if (!open) return;
    function update() { setDropdownStyle(calcDropdownStyle()); }
    window.addEventListener("scroll", update, true);
    window.addEventListener("resize", update);
    return () => {
      window.removeEventListener("scroll", update, true);
      window.removeEventListener("resize", update);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  function openDropdown() {
    if (disabled || creating) return;
    setErrMsg(null);
    setDropdownStyle(calcDropdownStyle());
    setOpen(true);
    onRefresh?.();
    const v = norm(value).toLowerCase();
    let idx = -1;
    if (v) {
      idx = filteredItems.findIndex((it) => norm(it.label).toLowerCase().startsWith(v));
      if (idx === -1) idx = filteredItems.findIndex((it) => norm(it.label).toLowerCase().includes(v));
    }
    setActiveIndex(filteredItems.length ? (idx >= 0 ? idx : 0) : -1);
    setTimeout(() => inputRef.current?.focus(), 0);
  }

  function closeDropdown() {
    setOpen(false);
  }

  function pick(v: string) {
    onChange(v);
    setOpen(false);
  }

  async function doCreate() {
    if (!onCreate) return closeCreateModalAndRefocus();
    const clean = norm(createDraft);
    if (!clean) return;
    setCreating(true);
    try {
      await onCreate(clean);
      onChange(clean);
      onRefresh?.();
      closeCreateModalAndRefocus();
    } catch (e: any) {
      setErrMsg(String(e?.message || "No se pudo crear el ítem."));
    } finally {
      setCreating(false);
    }
  }

  function openCreateFromCurrent() {
    if (disabled || creating) return;
    setCreateDraft(norm(value));
    setCreateOpen(true);
    setOpen(false);
  }

  const canClear = Boolean(value) && !disabled && !creating;
  const rightPad = canClear ? "pr-16" : "pr-10";

  function onInputKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (disabled || creating || createOpen) return;

    if (e.key === "ArrowDown") {
      e.preventDefault();
      if (!open) openDropdown();
      setActiveIndex((prev) => {
        const next = prev < 0 ? 0 : Math.min(prev + 1, filteredItems.length - 1);
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
      if (!open) {
        e.preventDefault();
        openDropdown();
        return;
      }
      if (activeIndex >= 0 && activeIndex < filteredItems.length) {
        e.preventDefault();
        pick(filteredItems[activeIndex].label);
      }
      return;
    }

    if (e.key === "Escape" && open) {
      e.preventDefault();
      closeDropdown();
    }
  }

  function onWrapBlurCapture(e: React.FocusEvent<HTMLDivElement>) {
    const next = e.relatedTarget as HTMLElement | null;
    if (!next || !wrapRef.current?.contains(next)) closeDropdown();
  }

  const showLabel = !noLabelSpace && Boolean(String(label || "").trim());

  return (
    <>
      <div
        ref={wrapRef}
        data-tp-enter="ignore"
        className={cn("w-full", !noLabelSpace && "space-y-1")}
        onBlurCapture={onWrapBlurCapture}
      >
        {showLabel && <div className="text-xs font-medium text-muted">{label}</div>}

        <div className="relative">
          <input
            ref={inputRef}
            tabIndex={tabIndex}
            value={value}
            disabled={disabled || creating}
            placeholder={placeholder}
            onFocus={openDropdown}
            onKeyDown={onInputKeyDown}
            onChange={(e) => {
              didAutoPickRef.current = true;
              onChange(e.target.value);
              openDropdown();
            }}
            className={cn(TP_INPUT, "w-full", rightPad)}
          />

          {canClear && (
            <button
              type="button"
              className="absolute right-8 top-1/2 -translate-y-1/2 text-muted hover:text-text"
              onClick={() => {
                didAutoPickRef.current = true;
                onChange("");
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
            onClick={openDropdown}
            disabled={disabled || creating}
            tabIndex={-1}
          >
            <ChevronDown size={16} />
          </button>

          {open && !disabled && !creating && createPortal(
            <div
              ref={dropdownRef}
              data-tp-portal
              style={{ ...dropdownStyle, position: "fixed", zIndex: 9999 }}
              className="rounded-2xl border border-border bg-card shadow-soft"
              onMouseDown={(e) => e.preventDefault()}
            >
              <div className="max-h-64 overflow-auto p-2">
                {filteredItems.length === 0 && !allowCreate && (
                  <div className="px-3 py-2 text-sm text-muted">Sin opciones disponibles</div>
                )}

                {filteredItems.map((it, idx) => (
                  <button
                    key={it.id}
                    ref={(el) => {
                      itemRefs.current[idx] = el;
                    }}
                    type="button"
                    onMouseEnter={() => setActiveIndex(idx)}
                    onClick={() => pick(it.label)}
                    tabIndex={-1}
                    className={cn(
                      "w-full rounded-xl px-3 py-2 text-left text-sm hover:bg-primary/10",
                      idx === activeIndex && "bg-primary/10"
                    )}
                  >
                    {renderHighlightedLabel(it.label, value)}
                  </button>
                ))}

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
                    {norm(value) && (
                      <span className="text-muted no-underline">
                        "{norm(value)}"
                      </span>
                    )}
                  </button>
                )}
              </div>
            </div>,
            document.body
          )}
        </div>

        {errMsg && <div className="mt-2 text-xs text-red-600">{errMsg}</div>}
      </div>

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

/* =========================
   MULTI mode component
========================= */
function MultiCombo({
  label,
  placeholder = "Escribir o seleccionar…",
  type,
  items,
  onRefresh,
  values,
  onChange,
  allowCreate = false,
  onCreate,
  disabled = false,
  noLabelSpace = false,
}: PropsMulti) {
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const createInputRef = useRef<HTMLInputElement | null>(null);
  const dropdownRef = useRef<HTMLDivElement | null>(null);

  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [createOpen, setCreateOpen] = useState(false);
  const [createDraft, setCreateDraft] = useState("");
  const [creating, setCreating] = useState(false);
  const [errMsg, setErrMsg] = useState<string | null>(null);
  const [dropdownStyle, setDropdownStyle] = useState<React.CSSProperties>({});

  function calcDropdownStyle(): React.CSSProperties {
    const rect = wrapRef.current?.getBoundingClientRect();
    if (!rect) return {};
    const maxH = 240;
    const spaceBelow = window.innerHeight - rect.bottom - 4;
    const spaceAbove = rect.top - 4;
    if (spaceBelow >= maxH || spaceBelow >= spaceAbove) {
      return { top: rect.bottom + 4, left: rect.left, width: rect.width };
    }
    return { bottom: window.innerHeight - rect.top + 4, left: rect.left, width: rect.width };
  }

  const safeItems = useMemo(() => (Array.isArray(items) ? items : []), [items]);
  const activeItems = useMemo(
    () => safeItems.filter((i) => i.isActive !== false),
    [safeItems]
  );

  const suggestions = useMemo(() => {
    const lowerValues = values.map((v) => norm(v).toLowerCase());
    return activeItems.filter(
      (it) => !lowerValues.includes(norm(it.label).toLowerCase())
    );
  }, [activeItems, values]);

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      const target = e.target as Node;
      if (!wrapRef.current?.contains(target) && !dropdownRef.current?.contains(target)) setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  useEffect(() => {
    if (!open) setActiveIndex(-1);
    else setActiveIndex(suggestions.length > 0 ? 0 : -1);
  }, [open, suggestions.length]);

  useEffect(() => {
    if (!open || !query.trim()) return;
    const q = query.trim().toLowerCase();
    let idx = suggestions.findIndex((it) => norm(it.label).toLowerCase().startsWith(q));
    if (idx === -1) idx = suggestions.findIndex((it) => norm(it.label).toLowerCase().includes(q));
    if (idx >= 0) setActiveIndex(idx);
  }, [query, open, suggestions]);

  useEffect(() => {
    if (createOpen) {
      setTimeout(() => createInputRef.current?.select(), 50);
    }
  }, [createOpen]);

  useEffect(() => {
    if (!open) return;
    function update() { setDropdownStyle(calcDropdownStyle()); }
    window.addEventListener("scroll", update, true);
    window.addEventListener("resize", update);
    return () => {
      window.removeEventListener("scroll", update, true);
      window.removeEventListener("resize", update);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  function addValue(val: string) {
    const clean = norm(val);
    if (!clean) return;
    if (
      values.map((v) => norm(v).toLowerCase()).includes(clean.toLowerCase())
    ) {
      setQuery("");
      return;
    }
    onChange([...values, clean]);
    setQuery("");
  }

  function removeValue(idx: number) {
    onChange(values.filter((_, i) => i !== idx));
  }

  function openDropdown() {
    if (disabled) return;
    setDropdownStyle(calcDropdownStyle());
    setOpen(true);
    onRefresh?.();
  }

  async function doCreate() {
    const clean = norm(createDraft);
    if (!clean) return;
    setCreating(true);
    try {
      if (onCreate) await onCreate(clean);
      onRefresh?.();
      addValue(clean);
      setCreateOpen(false);
    } catch (e: any) {
      setErrMsg(String(e?.message || "No se pudo crear el ítem."));
    } finally {
      setCreating(false);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (disabled) return;

    if (e.key === "ArrowDown") {
      e.preventDefault();
      if (!open) openDropdown();
      setActiveIndex((prev) => Math.min(prev + 1, suggestions.length - 1));
      return;
    }

    if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((prev) => Math.max(prev - 1, 0));
      return;
    }

    if (e.key === "Enter") {
      e.preventDefault();
      if (activeIndex >= 0 && activeIndex < suggestions.length) {
        addValue(suggestions[activeIndex].label);
      } else if (query.trim()) {
        const trimmed = query.trim();
        const existsInCatalog = activeItems.some(
          (it) => norm(it.label).toLowerCase() === norm(trimmed).toLowerCase()
        );
        if (!existsInCatalog && allowCreate && onCreate) {
          setCreateDraft(trimmed);
          setCreateOpen(true);
          setOpen(false);
        } else {
          addValue(trimmed);
        }
      }
      return;
    }

    if (e.key === "Escape") {
      e.preventDefault();
      setOpen(false);
      return;
    }

    if (e.key === "Backspace" && !query && values.length > 0) {
      removeValue(values.length - 1);
    }
  }

  function onWrapBlur(e: React.FocusEvent<HTMLDivElement>) {
    const next = e.relatedTarget as HTMLElement | null;
    if (!next || !wrapRef.current?.contains(next)) setOpen(false);
  }

  const showLabel = !noLabelSpace && Boolean(String(label || "").trim());
  const showCreateButton =
    allowCreate &&
    query.trim() &&
    !activeItems.some(
      (it) => norm(it.label).toLowerCase() === norm(query).toLowerCase()
    );

  return (
    <>
      <div
        ref={wrapRef}
        data-tp-enter="ignore"
        className={cn("w-full", !noLabelSpace && "space-y-1")}
        onBlurCapture={onWrapBlur}
      >
        {showLabel && <div className="text-xs font-medium text-muted">{label}</div>}

        <div className="relative">
          <div
            className={cn(
              TP_INPUT,
              "w-full min-h-[38px] h-auto py-1.5 px-2 flex flex-wrap gap-1 items-center cursor-text",
              disabled && "opacity-60 cursor-not-allowed"
            )}
            onClick={() => {
              if (!disabled) {
                inputRef.current?.focus();
                openDropdown();
              }
            }}
          >
            {values.map((v, i) => (
              <span
                key={i}
                className="inline-flex items-center gap-1 rounded-lg bg-primary/10 border border-primary/20 px-2 py-0.5 text-xs font-medium text-text shrink-0"
              >
                {v}
                {!disabled && (
                  <button
                    type="button"
                    onMouseDown={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                    }}
                    onClick={(e) => {
                      e.stopPropagation();
                      removeValue(i);
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
              type="text"
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                if (!open) openDropdown();
              }}
              onFocus={openDropdown}
              onKeyDown={handleKeyDown}
              disabled={disabled}
              placeholder={values.length === 0 ? placeholder : ""}
              className="flex-1 min-w-[80px] bg-transparent text-sm text-text outline-none placeholder:text-muted"
              tabIndex={disabled ? -1 : 0}
            />

            <ChevronDown size={16} className="text-muted shrink-0 ml-auto" />
          </div>

          {open && !disabled && createPortal(
            <div
              ref={dropdownRef}
              data-tp-portal
              style={{ ...dropdownStyle, position: "fixed", zIndex: 9999 }}
              className="rounded-2xl border border-border bg-card shadow-soft"
            >
              <div className="max-h-56 overflow-auto p-2">
                {suggestions.length === 0 && !showCreateButton && (
                  <div className="px-3 py-2 text-sm text-muted">Sin opciones disponibles</div>
                )}

                {suggestions.map((it, idx) => (
                  <button
                    key={it.id}
                    type="button"
                    tabIndex={-1}
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => addValue(it.label)}
                    onMouseEnter={() => setActiveIndex(idx)}
                    className={cn(
                      "w-full rounded-xl px-3 py-2 text-left text-sm hover:bg-primary/10",
                      idx === activeIndex && "bg-primary/10"
                    )}
                  >
                    {renderHighlightedLabel(it.label, query)}
                  </button>
                ))}

                {showCreateButton && (
                  <button
                    type="button"
                    tabIndex={-1}
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => {
                      if (allowCreate && onCreate) {
                        setCreateDraft(query.trim());
                        setCreateOpen(true);
                        setOpen(false);
                      } else {
                        addValue(query.trim());
                      }
                    }}
                    className={cn(
                      "mt-1 w-full rounded-xl px-3 py-2 text-left text-sm",
                      "border border-dashed border-border hover:bg-primary/10",
                      "flex items-center gap-2 text-primary"
                    )}
                  >
                    <Plus className="h-4 w-4" />
                    <span className="underline">Agregar</span>
                    <span className="text-muted">"{query.trim()}"</span>
                  </button>
                )}
              </div>
            </div>,
            document.body
          )}
        </div>

        {errMsg && <div className="mt-2 text-xs text-red-600">{errMsg}</div>}
      </div>

      <CreateModal
        open={createOpen}
        title="Agregar nuevo ítem"
        loading={creating}
        onClose={() => !creating && setCreateOpen(false)}
        onConfirm={doCreate}
      >
        <div className="space-y-2">
          <div className="text-sm text-muted">Tipo: {catTypeEs(type)}</div>
          <input
            ref={createInputRef}
            value={createDraft}
            onChange={(e) => setCreateDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                void doCreate();
              }
              if (e.key === "Escape") {
                e.preventDefault();
                if (!creating) setCreateOpen(false);
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

/* =========================
   Public export — dispatcher
========================= */
export default function TPComboCreatable(props: Props) {
  if (props.multiple === true) {
    return <MultiCombo {...props} />;
  }
  return <SingleCombo {...props} />;
}