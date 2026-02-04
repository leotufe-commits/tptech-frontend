// src/components/ui/TPComboCreatable.tsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import ConfirmActionDialog from "./ConfirmActionDialog";
import { cn } from "./tp";
import type { CatalogItem, CatalogType } from "../../services/catalogs";

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
};

export default function TPComboCreatable({
  label,
  placeholder = "Seleccionar…",

  type,
  items,
  loading = false,
  onRefresh,

  value,
  onChange,

  allowCreate = false,
  onCreate,

  disabled = false,
}: Props) {
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");

  const [confirmOpen, setConfirmOpen] = useState(false);
  const [pendingCreate, setPendingCreate] = useState("");

  const [creating, setCreating] = useState(false);
  const [errMsg, setErrMsg] = useState<string | null>(null);

  const norm = (s: string) => String(s || "").trim().replace(/\s+/g, " ");
  const qn = norm(q).toLowerCase();

  const safeItems: CatalogItem[] = useMemo(() => (Array.isArray(items) ? items : []), [items]);

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      const el = wrapRef.current;
      if (!el) return;
      if (!el.contains(e.target as any)) setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  // ✅ clave: tolera parents que pasan {items:[...]} por error
  const normalizedItems: CatalogItem[] = useMemo(() => {
    const asAny: any = safeItems as any;
    if (Array.isArray(asAny)) return asAny as CatalogItem[];
    const maybe = (asAny?.items ?? []) as any;
    return Array.isArray(maybe) ? (maybe as CatalogItem[]) : [];
  }, [safeItems]);

  const activeItems = useMemo(() => {
    const base = normalizedItems.filter((it) => it?.isActive !== false);
    if (!qn) return base;
    return base.filter((it) => String(it.label || "").toLowerCase().includes(qn));
  }, [normalizedItems, qn]);

  const hasExact = useMemo(() => {
    const t = norm(q).toLowerCase();
    if (!t) return true;
    return normalizedItems.some((it) => norm(it.label).toLowerCase() === t);
  }, [normalizedItems, q]);

  function openDropdown() {
    if (disabled || creating) return;
    setErrMsg(null);
    setOpen(true);
    setQ("");
    setTimeout(() => inputRef.current?.focus(), 0);
    onRefresh?.();
  }

  function pick(v: string) {
    onChange(v);
    setOpen(false);
    setQ("");
  }

  function requestCreate(labelToCreate: string) {
    if (disabled || creating) return;

    const clean = norm(labelToCreate);
    if (!clean) return;

    setErrMsg(null);
    setPendingCreate(clean);

    setOpen(false);
    setConfirmOpen(true);
  }

  async function doCreate() {
    if (!onCreate) {
      setConfirmOpen(false);
      return;
    }

    const clean = norm(pendingCreate);
    if (!clean) {
      setConfirmOpen(false);
      setPendingCreate("");
      return;
    }

    setCreating(true);
    setErrMsg(null);

    try {
      await onCreate(clean);
      onRefresh?.();
      pick(clean);
    } catch (e: any) {
      setErrMsg(String(e?.message || "No se pudo crear el ítem."));
    } finally {
      setCreating(false);
      setConfirmOpen(false);
      setPendingCreate("");
    }
  }

  const showCreateRow = !disabled && !creating && allowCreate && !!norm(q) && !hasExact;
  const hoverBg = "hover:bg-[color-mix(in_oklab,var(--primary)_10%,transparent)]";

  return (
    <>
      <div ref={wrapRef} className="w-full">
        {label ? <div className="mb-2 block text-sm text-[color:var(--muted)]">{label}</div> : null}

        <button
          type="button"
          onClick={() => {
            if (disabled || creating) return;
            open ? setOpen(false) : openDropdown();
          }}
          disabled={disabled || creating}
          className={cn(
            "tp-input text-left cursor-pointer select-none relative pr-10",
            disabled || creating ? "opacity-70 cursor-not-allowed" : hoverBg
          )}
          title={value || placeholder}
        >
          <span className={cn("block truncate", value ? "text-text" : "text-[color:var(--muted)]")}>
            {value || placeholder}
          </span>

          <span
            className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[color:var(--muted)]"
            aria-hidden="true"
          >
            ▾
          </span>
        </button>

        {open && !disabled && !creating ? (
          <div className="relative">
            <div className="absolute z-40 mt-2 w-full overflow-hidden rounded-2xl border border-border bg-card shadow-soft">
              <div className="p-2">
                <input
                  ref={inputRef}
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  className="tp-input w-full"
                  placeholder="Buscar o escribir…"
                />
              </div>

              <div className="max-h-64 overflow-auto px-2 pb-2">
                {loading ? <div className="px-2 py-2 text-sm text-muted">Cargando…</div> : null}

                {!loading && activeItems.length === 0 && !showCreateRow ? (
                  <div className="px-2 py-2 text-sm text-muted">Sin resultados.</div>
                ) : null}

                {activeItems.map((it) => {
                  const isSel = norm(it.label).toLowerCase() === norm(value).toLowerCase();
                  return (
                    <button
                      key={it.id}
                      type="button"
                      onClick={() => pick(it.label)}
                      className={cn(
                        "w-full rounded-xl px-3 py-2 text-left text-sm",
                        hoverBg,
                        isSel && "bg-[color-mix(in_oklab,var(--primary)_14%,transparent)]"
                      )}
                    >
                      {it.label}
                    </button>
                  );
                })}

                {showCreateRow ? (
                  <button
                    type="button"
                    onClick={() => requestCreate(q)}
                    className={cn("mt-1 w-full rounded-xl border border-border px-3 py-2 text-left text-sm", hoverBg)}
                  >
                    Agregar “{norm(q)}”…
                  </button>
                ) : null}
              </div>
            </div>
          </div>
        ) : null}

        {errMsg ? <div className="mt-2 text-xs text-red-600">{errMsg}</div> : null}
      </div>

      <ConfirmActionDialog
        open={confirmOpen}
        title="Agregar nuevo ítem"
        description={`¿Deseás agregar “${pendingCreate}” al catálogo?`}
        hint={`Tipo: ${type}`}
        confirmText="Agregar"
        cancelText="Cancelar"
        loading={creating}
        onClose={() => {
          if (creating) return;
          setConfirmOpen(false);
          setPendingCreate("");
        }}
        onConfirm={doCreate}
      />
    </>
  );
}
