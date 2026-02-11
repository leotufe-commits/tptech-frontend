// tptech-frontend/src/components/ui/TPComboCreatable.tsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ChevronDown, X } from "lucide-react";
import { cn } from "./tp";
import type { CatalogItem, CatalogType } from "../../services/catalogs";

/* =========================
   Types
========================= */
type Props = {
  label?: string;
  placeholder?: string;

  type: CatalogType;
  items: CatalogItem[];
  loading?: boolean;
  onRefresh?: () => void;

  value: string;
  onChange: (value: string) => void;

  allowCreate?: boolean;
  onCreate?: (label: string) => Promise<void> | void;

  disabled?: boolean;

  /** create = puede usar favorito | edit = nunca */
  mode: "create" | "edit";
};

/* =========================
   Utils
========================= */
function norm(s: string) {
  return String(s || "").trim().replace(/\s+/g, " ");
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

    const match = src.slice(idx, idx + qLower.length);
    parts.push(
      <span key={`${idx}-${match}`} className="text-primary font-semibold">
        {match}
      </span>
    );
    i = idx + qLower.length;
  }

  return <>{parts}</>;
}

/* =========================
   Modal
========================= */
function Modal({
  open,
  title,
  children,
  confirmText,
  cancelText,
  loading,
  onClose,
  onConfirm,
}: {
  open: boolean;
  title: string;
  children: React.ReactNode;
  confirmText: string;
  cancelText: string;
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
          className="w-full max-w-[420px] rounded-2xl border border-border bg-card shadow-soft"
          onMouseDown={(e) => e.stopPropagation()}
        >
          <div className="p-4 border-b border-border">
            <div className="text-base font-semibold text-text">{title}</div>
          </div>

          <div className="p-4">{children}</div>

          <div className="p-4 pt-2 flex justify-end gap-2 border-t border-border">
            <button className="tp-btn-secondary" onClick={onClose} disabled={loading} type="button">
              {cancelText}
            </button>
            <button className="tp-btn-primary" onClick={onConfirm} disabled={loading} type="button">
              {loading ? "Guardando…" : confirmText}
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}

/* =========================
   Component
========================= */
export default function TPComboCreatable({
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
}: Props) {
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const createInputRef = useRef<HTMLInputElement | null>(null);

  const [open, setOpen] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [createDraft, setCreateDraft] = useState("");
  const [creating, setCreating] = useState(false);
  const [errMsg, setErrMsg] = useState<string | null>(null);

  const safeItems = useMemo(() => (Array.isArray(items) ? items : []), [items]);
  const activeItems = useMemo(() => safeItems.filter((i) => i.isActive !== false), [safeItems]);

  const didAutoPickRef = useRef(false);

  /* =========================
     Keyboard navigation
  ========================= */
  const [activeIndex, setActiveIndex] = useState<number>(-1);
  const itemRefs = useRef<Array<HTMLButtonElement | null>>([]);

  /* Auto-pick favorito solo en CREATE */
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
      if (!wrapRef.current?.contains(e.target as any)) setOpen(false);
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
    const idx = v ? activeItems.findIndex((it) => norm(it.label).toLowerCase() === v) : -1;

    setActiveIndex(activeItems.length ? (idx >= 0 ? idx : 0) : -1);
  }, [open, activeItems, value]);

  // ✅ foco automático al abrir el modal de crear
  useEffect(() => {
    if (createOpen) {
      setTimeout(() => createInputRef.current?.focus(), 0);
    }
  }, [createOpen]);

  function openDropdown() {
    if (disabled || creating) return;
    setErrMsg(null);
    setOpen(true);
    onRefresh?.();

    const v = norm(value).toLowerCase();
    const idx = v ? activeItems.findIndex((it) => norm(it.label).toLowerCase() === v) : -1;

    setActiveIndex(activeItems.length ? (idx >= 0 ? idx : 0) : -1);
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
    if (!onCreate) return setCreateOpen(false);
    const clean = norm(createDraft);
    if (!clean) return;

    setCreating(true);
    try {
      await onCreate(clean);
      onChange(clean);
      onRefresh?.();
      setCreateOpen(false);
    } catch (e: any) {
      setErrMsg(String(e?.message || "No se pudo crear el ítem."));
    } finally {
      setCreating(false);
    }
  }

  const canClear = Boolean(value) && !disabled && !creating;

  function onInputKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (disabled || creating || createOpen) return;

    if (e.key === "ArrowDown") {
      e.preventDefault();
      if (!open) openDropdown();
      setActiveIndex((prev) => {
        const next = prev < 0 ? 0 : Math.min(prev + 1, activeItems.length - 1);
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

      if (activeIndex >= 0 && activeIndex < activeItems.length) {
        e.preventDefault();
        pick(activeItems[activeIndex].label);
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

  return (
    <>
      <div ref={wrapRef} className="w-full" onBlurCapture={onWrapBlurCapture}>
        {label && <div className="mb-2 text-sm text-muted">{label}</div>}

        <div className="relative">
          <input
            ref={inputRef}
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
            className={cn("tp-input w-full pr-16", disabled && "opacity-70")}
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

          {open && !disabled && !creating && (
            <div className="absolute z-40 mt-2 w-full rounded-2xl border border-border bg-card shadow-soft">
              <div className="max-h-64 overflow-auto p-2">
                {activeItems.map((it, idx) => (
                  <button
                    key={it.id}
                    // ✅ FIX TS2322: callback ref NO debe retornar el elemento
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
                    className="mt-2 text-sm underline text-primary"
                    onClick={() => {
                      setCreateDraft(norm(value));
                      setCreateOpen(true);
                    }}
                  >
                    Agregar ítem
                  </button>
                )}
              </div>
            </div>
          )}
        </div>

        {errMsg && <div className="mt-2 text-xs text-red-600">{errMsg}</div>}
      </div>

      <Modal
        open={createOpen}
        title="Agregar nuevo ítem"
        confirmText="Agregar"
        cancelText="Cancelar"
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
            className="tp-input w-full"
            placeholder="Escribí el ítem…"
          />
        </div>
      </Modal>
    </>
  );
}
