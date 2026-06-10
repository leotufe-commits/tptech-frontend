// src/pages/MisPreferencias.tsx
//
// Preferencias PERSONALES del usuario logueado (scope SALES_INVOICE).
// Solo precargan defaults al crear una Factura de ventas nueva.
// NO tocan pricing-engine ni recalculan precios (frontend lector).
//
// Fuente de verdad: GET/PUT /api/user-preferences/me (UserPreference).
import React, { useEffect, useMemo, useState } from "react";
import { SlidersHorizontal, Save } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { toast } from "../lib/toast";
import { TPButton } from "../components/ui/TPButton";
import TPComboFixed from "../components/ui/TPComboFixed";
import {
  userPreferencesApi,
  type SalesUserPreference,
} from "../services/user-preferences";
import { warehousesApi } from "./InventarioAlmacenes/warehouses.api";
import { sellersApi } from "../services/sellers";
import { priceListsApi } from "../services/price-lists";
import { salesChannelsApi } from "../services/sales-channels";
import { listCurrencies } from "../services/valuation";

type Opt = { value: string; label: string };

const NONE: Opt = {
  value: "",
  label: "Sin preferencia (usar favorito de la joyería)",
};

function withNone(opts: Opt[]): Opt[] {
  return [NONE, ...opts];
}

/** Construye las opciones del combo de una entidad con el MISMO patrón
 *  para los 5 combos (Almacén / Vendedor / Lista / Canal / Moneda):
 *
 *    1. Filtra inactivos / soft-deleted.
 *    2. Mapea cada row a `{value, label}` con el labeler provisto.
 *    3. Ordena con favorito (o `isBase` para monedas) primero, luego
 *       alfabético por label (`es` locale, case-insensitive).
 *
 *  Antes cada combo dependía del orden del API y eso hacía que el de
 *  Almacén se viera "raro" comparado con los otros (que casualmente
 *  llegaban ordenados). Ahora los 5 combos tienen la misma personalidad. */
function buildOpts<T extends CatalogRow>(
  rows: T[],
  labeler: (r: T) => string,
  isFav: (r: T) => boolean = (r) => !!r.isFavorite,
): Opt[] {
  const filtered = rows.filter((r) => r.isActive !== false && !r.deletedAt);
  const mapped = filtered.map((r) => ({
    value: r.id,
    label: labeler(r),
    _fav: isFav(r) ? 1 : 0,
  }));
  mapped.sort((a, b) => {
    if (a._fav !== b._fav) return b._fav - a._fav;
    return a.label.localeCompare(b.label, "es", { sensitivity: "base" });
  });
  return mapped.map(({ value, label }) => ({ value, label }));
}

/**
 * Normaliza respuestas de catálogo: algunos endpoints devuelven un array
 * y otros `{ rows: [...] }` (p. ej. /valuation/currencies). Sin esto,
 * `.filter` sobre el objeto crudo tira "is not a function".
 */
type CatalogRow = {
  id: string;
  name?: string;
  code?: string;
  isActive?: boolean;
  deletedAt?: string | null;
  displayName?: string;
  firstName?: string;
  lastName?: string;
  isBase?: boolean;
  /** Favorito de la joyería. Usado por `buildOpts` para ordenar primero
   *  los favoritos en cada combo (igual para Almacén/Vendedor/Lista/Canal). */
  isFavorite?: boolean;
};

function asArray(x: unknown): CatalogRow[] {
  if (Array.isArray(x)) return x as CatalogRow[];
  const rows = (x as { rows?: unknown } | null | undefined)?.rows;
  if (Array.isArray(rows)) return rows as CatalogRow[];
  return [];
}

export default function MisPreferencias() {
  const { user } = useAuth();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [warehouses, setWarehouses] = useState<Opt[]>([]);
  const [sellers, setSellers] = useState<Opt[]>([]);
  const [priceLists, setPriceLists] = useState<Opt[]>([]);
  const [channels, setChannels] = useState<Opt[]>([]);
  const [currencies, setCurrencies] = useState<Opt[]>([]);

  const [form, setForm] = useState<Omit<SalesUserPreference, "scope">>({
    defaultWarehouseId: null,
    defaultSellerId: null,
    defaultPriceListId: null,
    defaultChannelId: null,
    defaultCurrencyId: null,
    // Etapa — Tipo de saldo por defecto (UNIFIED/BREAKDOWN). Editable acá;
    // nivel R11.4 entre cliente y lista. `null` = sin preferencia.
    defaultBalanceMode: null,
    // `defaultGlobalDiscountType` no se edita desde Mis preferencias (la
    // estrella vive en el card "Descuento global" de la Factura). Aquí solo
    // hidratamos el campo para que el tipo no rompa el form.
    defaultGlobalDiscountType: null,
    // `invoiceLayoutConfig` tampoco se edita desde acá — vive en el modal
    // de Factura (Fase 2 DnD). Solo hidratamos el campo para mantener la
    // imagen completa de la preferencia y que el tipo no rompa el form.
    invoiceLayoutConfig: null,
    // `preferredInvoiceViewPreset` se edita desde el toolbar del modal de
    // Factura ("Plantillas de vista"). Hidratamos null para imagen completa.
    preferredInvoiceViewPreset: null,
    // `invoiceUiPreferences` (UX.20) tampoco se edita acá — vive en el
    // modal de Configuración de Factura. Hidratamos null.
    invoiceUiPreferences: null,
    // Etapa 5 — "Mis vistas" del layout. Tampoco se edita acá; hidratamos
    // null para mantener imagen completa de la preferencia.
    invoiceLayoutPresets: null,
  });

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const [pref, whsR, selsR, plsR, chsR, cursR] = await Promise.all([
          userPreferencesApi.get(),
          warehousesApi.list().catch(() => []),
          sellersApi.list().catch(() => []),
          priceListsApi.list().catch(() => []),
          salesChannelsApi.list().catch(() => []),
          listCurrencies().catch(() => []),
        ]);
        if (cancelled) return;

        const whs  = asArray(whsR);
        const sels = asArray(selsR);
        const pls  = asArray(plsR);
        const chs  = asArray(chsR);
        const curs = asArray(cursR);

        setForm({
          defaultWarehouseId: pref.defaultWarehouseId,
          defaultSellerId: pref.defaultSellerId,
          defaultPriceListId: pref.defaultPriceListId,
          defaultChannelId: pref.defaultChannelId,
          defaultCurrencyId: pref.defaultCurrencyId,
          defaultBalanceMode: pref.defaultBalanceMode,
          defaultGlobalDiscountType: pref.defaultGlobalDiscountType,
          invoiceLayoutConfig: pref.invoiceLayoutConfig,
          preferredInvoiceViewPreset: pref.preferredInvoiceViewPreset,
          invoiceUiPreferences: pref.invoiceUiPreferences,
          invoiceLayoutPresets: pref.invoiceLayoutPresets,
        });

        setWarehouses(buildOpts(whs, (w) => w.name || w.code || w.id));
        setSellers(buildOpts(
          sels,
          (sx) => sx.displayName || `${sx.firstName ?? ""} ${sx.lastName ?? ""}`.trim() || sx.id,
        ));
        setPriceLists(buildOpts(pls, (p) => p.name || p.code || p.id));
        setChannels(buildOpts(chs, (c) => c.name || c.code || c.id));
        // Monedas usan `isBase` como "favorito" semántico (moneda base
        // del tenant). Mismo orden visual que los otros combos.
        setCurrencies(buildOpts(
          curs,
          (c) => `${c.code}${c.name ? ` — ${c.name}` : ""}${c.isBase ? " (base)" : ""}`,
          (c) => !!c.isBase,
        ));
      } catch (e) {
        if (!cancelled) toast.error((e as Error)?.message || "No se pudieron cargar los catálogos.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  function set<K extends keyof typeof form>(key: K, value: string) {
    setForm((prev) => ({ ...prev, [key]: value || null }));
  }

  async function handleSave() {
    setSaving(true);
    try {
      // Se envían SIEMPRE los 5 campos: la pantalla es la imagen completa de
      // la preferencia (un campo vacío = limpiar esa preferencia).
      const payload = {
        defaultWarehouseId: form.defaultWarehouseId,
        defaultSellerId: form.defaultSellerId,
        defaultPriceListId: form.defaultPriceListId,
        defaultChannelId: form.defaultChannelId,
        defaultCurrencyId: form.defaultCurrencyId,
        defaultBalanceMode: form.defaultBalanceMode,
      };
      const saved = await userPreferencesApi.update(payload);
      setForm({
        defaultWarehouseId: saved.defaultWarehouseId,
        defaultSellerId: saved.defaultSellerId,
        defaultPriceListId: saved.defaultPriceListId,
        defaultChannelId: saved.defaultChannelId,
        defaultCurrencyId: saved.defaultCurrencyId,
        defaultBalanceMode: saved.defaultBalanceMode,
        // Preservamos lo que el backend devolvió (esta pantalla no edita el
        // tipo del descuento global, layout, presets ni preset de vista;
        // pero los refleja para mantener consistencia con la imagen completa).
        defaultGlobalDiscountType: saved.defaultGlobalDiscountType,
        invoiceLayoutConfig: saved.invoiceLayoutConfig,
        preferredInvoiceViewPreset: saved.preferredInvoiceViewPreset,
        invoiceUiPreferences: saved.invoiceUiPreferences,
        invoiceLayoutPresets: saved.invoiceLayoutPresets,
      });
      toast.success("Preferencias guardadas.");
    } catch (e) {
      toast.error((e as Error)?.message || "No se pudieron guardar las preferencias.");
    } finally {
      setSaving(false);
    }
  }

  const rows = useMemo(
    () => [
      {
        key: "defaultWarehouseId" as const,
        label: "Almacén",
        hint: "Almacén precargado al crear una factura nueva.",
        options: withNone(warehouses),
      },
      {
        key: "defaultSellerId" as const,
        label: "Vendedor",
        hint: "Vendedor asignado por defecto.",
        options: withNone(sellers),
      },
      {
        key: "defaultPriceListId" as const,
        label: "Lista de precios",
        hint: "Lista usada al armar la factura.",
        options: withNone(priceLists),
      },
      {
        key: "defaultChannelId" as const,
        label: "Canal de venta",
        hint: "Canal precargado en la factura.",
        options: withNone(channels),
      },
      {
        key: "defaultCurrencyId" as const,
        label: "Moneda",
        hint: "Moneda del documento. Si no elegís, se usa la moneda base.",
        options: withNone(currencies),
      },
    ],
    [warehouses, sellers, priceLists, channels, currencies]
  );

  return (
    <div className="p-4 md:p-6 space-y-5 min-h-0">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="h-10 w-10 rounded-2xl border border-border bg-card grid place-items-center">
          <SlidersHorizontal className="h-5 w-5 text-primary" />
        </div>
        <div className="min-w-0">
          <div className="text-lg font-semibold text-text">Mis preferencias</div>
          <div className="text-sm text-muted">
            Valores que se precargan al crear una{" "}
            <span className="font-semibold text-text">Factura de ventas</span> nueva. Se guardan{" "}
            <span className="font-semibold text-text">por usuario</span>
            {user?.email ? (
              <>
                {" "}
                (<span className="font-semibold text-text">{user.email}</span>)
              </>
            ) : null}
            . No afectan los cálculos de precios.
          </div>
        </div>
      </div>

      <div className="tp-card p-4 space-y-4">
        {loading ? (
          <div className="text-sm text-muted">Cargando…</div>
        ) : (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {rows.map((r) => (
                <div key={r.key} className="space-y-1">
                  <div className="text-sm font-medium text-text">{r.label}</div>
                  <TPComboFixed
                    value={form[r.key] ?? ""}
                    onChange={(v) => set(r.key, v)}
                    options={r.options}
                    searchable
                    placeholder="Sin preferencia…"
                  />
                  <div className="text-[11px] text-muted">{r.hint}</div>
                </div>
              ))}
            </div>

            {/* Tipo de saldo por defecto (UNIFIED/BREAKDOWN). Nivel R11.4 entre
                cliente y lista. "Sin preferencia" (vacío) → null → delega. */}
            <div className="space-y-1 max-w-md" data-testid="pref-default-balance-mode">
              <div className="text-sm font-medium text-text">Tipo de saldo por defecto</div>
              <TPComboFixed
                value={form.defaultBalanceMode ?? ""}
                onChange={(v) => set("defaultBalanceMode", v)}
                options={[
                  { value: "UNIFIED",   label: "Unificado" },
                  { value: "BREAKDOWN", label: "Desglosado" },
                ]}
                placeholder="Sin preferencia…"
              />
              <div className="text-[11px] text-muted">
                Modo de saldo precargado al crear una factura. El default del cliente y el
                cambio manual en la factura tienen prioridad sobre esta preferencia.
              </div>
            </div>

            <div className="flex items-center justify-between gap-3 pt-1">
              <div className="text-[11px] text-muted">
                Prioridad al crear la factura: default del cliente → tu preferencia → favorito de la
                joyería → primer activo.
              </div>
              <TPButton
                variant="primary"
                onClick={handleSave}
                loading={saving}
                iconLeft={<Save size={16} />}
              >
                Guardar
              </TPButton>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
