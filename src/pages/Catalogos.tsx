// tptech-frontend/src/pages/Catalogos.tsx
import React, { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Save,
  Plus,
  ArrowLeft,
  RotateCcw,
  Star,
  ShieldBan,
  ShieldCheck,
  BookOpen,
} from "lucide-react";

import { cn } from "../components/ui/tp";
import { TPSectionShell } from "../components/ui/TPSectionShell";
import { TPButton } from "../components/ui/TPButton";
import TPInput from "../components/ui/TPInput";
import TPNumberInput from "../components/ui/TPNumberInput";
import TPTextarea from "../components/ui/TPTextarea";
import { toast } from "../lib/toast";

import type { CatalogType, CatalogItem } from "../services/catalogs";
import {
  bulkCreateCatalogItems,
  createCatalogItem,
  listCatalog,
  updateCatalogItem,
  setCatalogItemFavorite,
} from "../services/catalogs";

const TYPE_LABEL: Record<CatalogType, string> = {
  PHONE_PREFIX: "Prefijos",
  CITY: "Ciudades",
  PROVINCE: "Provincias",
  COUNTRY: "Países",
  DOCUMENT_TYPE: "Tipo de documento",
  IVA_CONDITION: "Condición de IVA",
  PAYMENT_TERM: "Términos de pago",
  ARTICLE_BRAND: "Marcas",
  ARTICLE_MANUFACTURER: "Fabricantes",
  UNIT_OF_MEASURE: "Unidades de medida",
  MULTIPLIER_BASE: "Unidades de peso",
};

const TYPES: CatalogType[] = ["PHONE_PREFIX", "CITY", "PROVINCE", "COUNTRY", "DOCUMENT_TYPE", "IVA_CONDITION", "PAYMENT_TERM"];

function parseBulkTextarea(text: string) {
  return Array.from(
    new Set(
      String(text || "")
        .split(/\r?\n|,/g)
        .map((x) => x.trim())
        .filter(Boolean)
    )
  );
}

type RowDraft = {
  label: string;
  sortOrder: number;
};

export default function Catalogos() {
  const nav = useNavigate();

  const [type, setType] = useState<CatalogType>("CITY");
  const [newLabel, setNewLabel] = useState("");
  const [bulkText, setBulkText] = useState("");

  const [items, setItems] = useState<CatalogItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [draftById, setDraftById] = useState<Record<string, RowDraft>>({});

  async function reload() {
    setLoading(true);
    setError(null);
    try {
      const next = await listCatalog(type, { includeInactive: true });
      setItems(next);

      setDraftById((prev) => {
        const copy = { ...prev };

        for (const it of next) {
          if (!copy[it.id]) copy[it.id] = { label: it.label, sortOrder: it.sortOrder };
        }

        for (const id of Object.keys(copy)) {
          if (!next.some((x) => x.id === id)) delete copy[id];
        }

        return copy;
      });
    } catch (e: any) {
      setError(String(e?.message ?? e));
    } finally {
      setLoading(false);
    }
  }

  React.useEffect(() => {
    void reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [type]);

  const sorted = useMemo(() => {
    return [...items].sort((a, b) => {
      const af = (a as any)?.isFavorite ? 1 : 0;
      const bf = (b as any)?.isFavorite ? 1 : 0;
      if (af !== bf) return bf - af;
      return a.sortOrder - b.sortOrder || a.label.localeCompare(b.label);
    });
  }, [items]);

  const activeCount = useMemo(() => items.filter((x) => x.isActive).length, [items]);

  return (
    <TPSectionShell
      title="Catálogos (Combos)"
      subtitle="Administrá opciones por joyería: crear, activar/desactivar, ordenar y favorito."
      icon={<BookOpen size={22} />}
      right={
        <>
          <TPButton
            variant="secondary"
            onClick={() => nav(-1)}
            disabled={busy}
            iconLeft={<ArrowLeft size={15} />}
          >
            Volver
          </TPButton>
          <TPButton
            variant="secondary"
            onClick={() => reload()}
            disabled={busy || loading}
            iconLeft={<RotateCcw size={15} />}
          >
            Recargar
          </TPButton>
        </>
      }
    >
      {/* Selector de tipo */}
      <div className="tp-card p-3">
        <div className="flex flex-wrap items-center gap-2">
          {TYPES.map((t) => (
            <button
              key={t}
              type="button"
              className={cn(
                "px-3 py-1.5 rounded-xl text-sm border",
                t === type
                  ? "bg-[color-mix(in_oklab,var(--primary)_14%,var(--card))] border-[color-mix(in_oklab,var(--primary)_28%,var(--border))]"
                  : "bg-[color-mix(in_oklab,var(--card)_92%,var(--bg))] border-[color-mix(in_oklab,var(--border)_85%,transparent)] hover:bg-[color-mix(in_oklab,var(--primary)_8%,var(--card))]"
              )}
              onClick={() => setType(t)}
              disabled={busy}
            >
              {TYPE_LABEL[t]}
            </button>
          ))}
        </div>

        <div className="mt-2 text-xs text-muted">
          Activos: <b>{activeCount}</b> / Total: <b>{items.length}</b>
        </div>
      </div>

      {/* Alta simple */}
      <div className="tp-card p-3">
        <div className="text-sm font-semibold mb-2">Agregar ítem</div>
        <div className="flex gap-2">
          <TPInput
            className="flex-1"
            placeholder="Ej: Córdoba"
            value={newLabel}
            onChange={setNewLabel}
            disabled={busy}
          />
          <TPButton
            variant="primary"
            disabled={busy || !newLabel.trim()}
            iconLeft={<Plus size={15} />}
            onClick={async () => {
              setBusy(true);
              setError(null);
              try {
                await createCatalogItem(type, newLabel.trim(), 0);
                setNewLabel("");
                toast({ tone: "success", message: "Ítem agregado" } as any);
                await reload();
              } catch (e: any) {
                setError(String(e?.message ?? e));
              } finally {
                setBusy(false);
              }
            }}
          >
            Agregar
          </TPButton>
        </div>

        <div className="mt-3 border-t border-[color-mix(in_oklab,var(--border)_75%,transparent)] pt-3">
          <div className="text-sm font-semibold mb-2">Carga masiva</div>
          <div className="text-xs text-muted mb-2">
            Pegá una lista (una por línea o separadas por coma). Se ignoran duplicados automáticamente.
          </div>

          <TPTextarea
            value={bulkText}
            onChange={setBulkText}
            placeholder={"Ej:\nBuenos Aires\nCórdoba\nRosario"}
            disabled={busy}
            minH={120}
          />

          <div className="flex justify-end mt-2">
            <TPButton
              variant="primary"
              disabled={busy || parseBulkTextarea(bulkText).length === 0}
              iconLeft={<Plus size={15} />}
              onClick={async () => {
                const labels = parseBulkTextarea(bulkText);
                setBusy(true);
                setError(null);
                try {
                  await bulkCreateCatalogItems(type, labels, 0);
                  setBulkText("");
                  toast({ tone: "success", message: `Carga masiva OK (${labels.length})` } as any);
                  await reload();
                } catch (e: any) {
                  setError(String(e?.message ?? e));
                } finally {
                  setBusy(false);
                }
              }}
            >
              Cargar lista
            </TPButton>
          </div>
        </div>
      </div>

      {/* Lista */}
      <div className="tp-card p-3">
        <div className="flex items-center justify-between mb-2">
          <div className="text-sm font-semibold">Items</div>
          {loading && <div className="text-xs text-muted">Cargando…</div>}
        </div>

        {error && (
          <div
            className="mb-2 text-sm tp-card p-2"
            style={{ border: "1px solid color-mix(in oklab, var(--danger) 35%, var(--border))" }}
          >
            <div className="font-semibold">Error</div>
            <div className="text-xs text-muted break-words">{error}</div>
          </div>
        )}

        <div className="space-y-2">
          {sorted.map((it) => {
            const d = draftById[it.id] ?? { label: it.label, sortOrder: it.sortOrder };
            const dirty = d.label !== it.label || d.sortOrder !== it.sortOrder;
            const isFav = Boolean((it as any)?.isFavorite);

            return (
              <div
                key={it.id}
                className="flex flex-wrap items-center gap-2 p-2 rounded-xl"
                style={{ border: "1px solid color-mix(in oklab, var(--border) 80%, transparent)" }}
              >
                {/* ⭐ Favorito */}
                <button
                  type="button"
                  className={cn(
                    "h-9 w-9 rounded-xl border grid place-items-center",
                    isFav
                      ? "bg-[color-mix(in_oklab,var(--primary)_14%,var(--card))] border-[color-mix(in_oklab,var(--primary)_28%,var(--border))]"
                      : "bg-[color-mix(in_oklab,var(--card)_92%,var(--bg))] border-[color-mix(in_oklab,var(--border)_85%,transparent)] hover:bg-[color-mix(in_oklab,var(--primary)_8%,var(--card))]"
                  )}
                  title={isFav ? "Quitar favorito" : "Marcar como favorito"}
                  disabled={busy}
                  onClick={async () => {
                    setBusy(true);
                    setError(null);
                    try {
                      await setCatalogItemFavorite(it.id, !isFav);
                      toast({ tone: "success", message: !isFav ? "Marcado como favorito" : "Favorito quitado" } as any);
                      await reload();
                    } catch (e: any) {
                      setError(String(e?.message ?? e));
                    } finally {
                      setBusy(false);
                    }
                  }}
                >
                  <Star
                    className={cn(
                      "h-4 w-4",
                      isFav ? "fill-[color:var(--primary)] text-[color:var(--primary)]" : "text-muted"
                    )}
                  />
                </button>

                {/* Label */}
                <TPInput
                  className="flex-1 min-w-[220px]"
                  value={d.label}
                  disabled={busy}
                  onChange={(v) =>
                    setDraftById((prev) => ({
                      ...prev,
                      [it.id]: { ...d, label: v },
                    }))
                  }
                />

                {/* Orden */}
                <div className="flex items-center gap-2">
                  <label className="text-xs text-muted">Orden</label>
                  <TPNumberInput
                    className="w-[90px]"
                    value={d.sortOrder}
                    decimals={0}
                    disabled={busy}
                    onChange={(v) =>
                      setDraftById((prev) => ({
                        ...prev,
                        [it.id]: { ...d, sortOrder: v ?? 0 },
                      }))
                    }
                  />
                </div>

                {/* Toggle activo/inactivo */}
                <TPButton
                  variant="secondary"
                  disabled={busy}
                  iconLeft={
                    it.isActive ? <ShieldBan size={14} /> : <ShieldCheck size={14} />
                  }
                  onClick={async () => {
                    setBusy(true);
                    setError(null);
                    try {
                      await updateCatalogItem(it.id, { isActive: !it.isActive });
                      await reload();
                    } catch (e: any) {
                      setError(String(e?.message ?? e));
                    } finally {
                      setBusy(false);
                    }
                  }}
                >
                  {it.isActive ? "Activo" : "Inactivo"}
                </TPButton>

                {/* Guardar cambios */}
                <TPButton
                  variant="secondary"
                  disabled={busy || !dirty}
                  iconLeft={<Save size={14} />}
                  onClick={async () => {
                    const label = String(d.label ?? "").trim();
                    setBusy(true);
                    setError(null);
                    try {
                      await updateCatalogItem(it.id, { label, sortOrder: d.sortOrder });
                      toast({ tone: "success", message: "Guardado" } as any);
                      await reload();
                    } catch (e: any) {
                      setError(String(e?.message ?? e));
                    } finally {
                      setBusy(false);
                    }
                  }}
                >
                  Guardar
                </TPButton>

                {dirty && <div className="text-xs text-muted">Cambios sin guardar</div>}
              </div>
            );
          })}

          {!loading && sorted.length === 0 && (
            <div className="text-sm text-muted">No hay items para este catálogo.</div>
          )}
        </div>
      </div>
    </TPSectionShell>
  );
}
