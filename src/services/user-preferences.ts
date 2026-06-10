// tptech-frontend/src/services/user-preferences.ts
//
// Service para la preferencia personal del usuario (scope SALES_INVOICE).
// Solo precarga UI — NO interviene en pricing.
//
// Patron de defaults (orden obligatorio): cliente > UserPreference >
// favorito global > primer activo. Los helpers `resolveDefault*` viven aca
// para que VentasFacturas (y otras pantallas hermanas) los reusen.
import { apiFetch } from "../lib/api";

/**
 * Set oficial de presets. Los valores legacy (`BALANCED`, `FINANCIAL`) se
 * aceptan en lectura como `string` opaco y se migran a `COMPACT` en el
 * frontend via `migrateLegacyPreset`. La escritura usa solo los nuevos.
 */
export type InvoiceViewPresetId = "CLASSIC" | "COMPACT" | "ONE_LINE";

export type SalesUserPreference = {
  // Campos de metadata del backend — opcionales para que el form state de
  // "Mis preferencias" (que solo edita los campos editables) pueda omitirlos.
  id?: string;
  jewelryId?: string;
  userId?: string;
  scope: "SALES_INVOICE";
  defaultWarehouseId: string | null;
  defaultSellerId: string | null;
  defaultPriceListId: string | null;
  defaultChannelId: string | null;
  defaultCurrencyId: string | null;
  defaultGlobalDiscountType: "PERCENT" | "AMOUNT" | null;
  /** Tipo de saldo por defecto del usuario (nivel R11.4 entre cliente y lista).
   *  `null` = sin preferencia → delega a lista/tenant/fallback. */
  defaultBalanceMode: "UNIFIED" | "BREAKDOWN" | null;
  invoiceLayoutConfig: unknown;
  preferredInvoiceViewPreset: InvoiceViewPresetId | null;
  invoiceUiPreferences: unknown;
  /** Mis vistas guardadas — preset NOMBRADOS persistidos por usuario.
   *  JSON opaco; el frontend valida shape antes de aplicar. */
  invoiceLayoutPresets?: unknown;
  createdAt?: string;
  updatedAt?: string;
};

/**
 * Configuraciones finas de UI del modal de Factura. Re-exportadas desde el
 * service para que helpers de `lib/sales/*` puedan importar el tipo sin
 * crear una dependencia inversa hacia el hook que las consume.
 *
 * NOTA — `density` y `stickyActions` quedaron deprecados con el nuevo
 * sistema de layout V2 (auto-grow + manualResize + grilla 12-col):
 * el "compactado" ahora lo gobierna el preset + el auto-grow por
 * contenido, y las acciones de fila siempre son visibles. Si la DB
 * tiene esos campos persistidos, el sanitizador los ignora.
 */
export type InvoiceUiPreferences = {
  visibleCards: {
    accountImpact: boolean;
    discount: boolean;
    shipping: boolean;
    coupon: boolean;
    totals: boolean;
    payments: boolean;
    observations: boolean;
  };
};

export type UpdateUserPreferenceInput = Partial<{
  defaultWarehouseId: string | null;
  defaultSellerId: string | null;
  defaultPriceListId: string | null;
  defaultChannelId: string | null;
  defaultCurrencyId: string | null;
  defaultGlobalDiscountType: "PERCENT" | "AMOUNT" | null;
  defaultBalanceMode: "UNIFIED" | "BREAKDOWN" | null;
  invoiceLayoutConfig: unknown;
  preferredInvoiceViewPreset: InvoiceViewPresetId | null;
  invoiceUiPreferences: unknown;
}>;

export const userPreferencesApi = {
  async get(): Promise<SalesUserPreference> {
    return apiFetch<SalesUserPreference>("/user-preferences/me", { method: "GET" as any });
  },
  async update(patch: UpdateUserPreferenceInput): Promise<SalesUserPreference> {
    return apiFetch<SalesUserPreference>("/user-preferences/me", {
      method: "PUT" as any,
      body: JSON.stringify(patch),
      headers: { "Content-Type": "application/json" },
    } as any);
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// Helpers de resolucion de defaults (puros — sin side effects)
// ─────────────────────────────────────────────────────────────────────────────

type WithId = { id: string; isActive?: boolean };

/** Devuelve `preferredId` si es activo; sino `favoriteId` si es activo; sino primer activo; sino "". */
export function resolveDefaultId(
  preferredId: string | null | undefined,
  favoriteId: string | null | undefined,
  options: ReadonlyArray<WithId>,
): string {
  const isActive = (id: string | null | undefined) =>
    !!id && options.some((o) => o.id === id && o.isActive !== false);
  if (isActive(preferredId)) return preferredId!;
  if (isActive(favoriteId)) return favoriteId!;
  const first = options.find((o) => o.isActive !== false);
  return first?.id ?? "";
}

/**
 * Resolución de "Canal de venta" para una factura nueva.
 *
 * A diferencia de `resolveDefaultId`, este helper NO cae al "primer activo"
 * cuando no hay preferencia ni favorito. Razón: el canal aplica
 * recargos/descuentos que modifican el total del comprobante. Asumir un
 * canal sin decisión explícita del operador puede inflar o reducir el
 * total sin que nadie lo haya pedido.
 *
 * Jerarquía oficial:
 *   1. canal del cliente (resuelto por el caller, no por este helper).
 *   2. preferencia del usuario (`UserPreference.defaultChannelId`).
 *   3. favorito de la joyería (`SalesChannel.isFavorite`).
 *   4. `""` → "Sin canal".
 *
 * Acepta los mismos shape que `resolveDefaultId` para que el caller pueda
 * intercambiar uno por otro sin cambiar el resto del wiring.
 */
export function resolveDefaultChannelId(
  preferredId: string | null | undefined,
  favoriteId: string | null | undefined,
  options: ReadonlyArray<WithId>,
): string {
  const isActive = (id: string | null | undefined) =>
    !!id && options.some((o) => o.id === id && o.isActive !== false);
  if (isActive(preferredId)) return preferredId!;
  if (isActive(favoriteId))  return favoriteId!;
  return "";
}

type WithIdActive = { id: string; isActive?: boolean };

/**
 * Almacen por defecto: el legacy `favoriteWarehouseId` se trata igual que
 * `favoriteId` en `resolveDefaultId`. Devuelve "" si no hay match.
 */
export function resolveDefaultWarehouseId(
  favoriteWarehouseId: string | null | undefined,
  warehouses: ReadonlyArray<WithIdActive>,
): string {
  return resolveDefaultId(null, favoriteWarehouseId ?? null, warehouses);
}

type CurrencyOption = { id: string; code: string; isActive?: boolean };

/** Devuelve el code de la moneda preferida; cae a `fallbackCode` si no esta. */
export function resolveDefaultCurrencyCode(
  preferredCurrencyId: string | null | undefined,
  currencies: ReadonlyArray<CurrencyOption>,
  fallbackCode: string = "ARS",
): string {
  if (preferredCurrencyId) {
    const found = currencies.find((c) => c.id === preferredCurrencyId);
    if (found && found.isActive !== false) return found.code;
  }
  const first = currencies.find((c) => c.isActive !== false);
  return first?.code ?? fallbackCode;
}

/** Tipo preferido para el descuento global. Cae a "PERCENT" si null/invalido. */
export function resolveDefaultGlobalDiscountType(
  preferred: string | null | undefined,
): "PERCENT" | "AMOUNT" {
  if (preferred === "AMOUNT") return "AMOUNT";
  return "PERCENT";
}

type CurrencyWithRate = {
  id: string;
  code: string;
  /**
   * Marca la moneda como BASE del tenant. SIEMPRE existe una y solo una
   * moneda con `isBase=true` por tenant. `resolveCurrencyRate` la fuerza
   * a `fxRate=1` sin importar lo que diga `latestRate` (defensa contra
   * data corrupta en la DB).
   */
  isBase?: boolean;
  latestRate?: number | null;
  rate?: number | null;
};

/**
 * Tasa vigente de la moneda. Reglas:
 *
 *   1. Si la moneda es BASE del tenant (`isBase: true`) → SIEMPRE 1,
 *      ignorando `latestRate` / `rate`. **Defensa crítica**: si la DB
 *      tiene `latestRate` populated por error para la moneda base
 *      (ej. 0.000556 = 1/1798.561, o 1798.561 directamente), este
 *      check evita propagar el valor corrupto al `draft.fxRate`. Sin
 *      esto, el bug observado el 2026-05-29 generaba shipping cost de
 *      21.582.733 al seleccionar Motomensajería 12000 ARS en un
 *      comprobante también ARS (matemática: 12000 / 0.000556 = 21.6M).
 *   2. Si la moneda no existe en el catálogo → 1 (defensivo).
 *   3. Si la moneda existe y NO es base, devuelve `latestRate` o `rate`
 *      si es un número positivo finito; si no, fallback a 1.
 */
export function resolveCurrencyRate(
  currencyCode: string,
  currencies: ReadonlyArray<CurrencyWithRate>,
): number {
  const found = currencies.find((c) => c.code === currencyCode);
  if (!found) return 1;
  // (1) Moneda base → SIEMPRE 1, blindaje contra rates corruptos.
  if (found.isBase === true) return 1;
  // (3) Moneda no-base → resolver desde el catálogo.
  const r = found.latestRate ?? found.rate ?? null;
  if (typeof r === "number" && Number.isFinite(r) && r > 0) return r;
  return 1;
}
