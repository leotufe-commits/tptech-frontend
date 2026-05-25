// tptech-frontend/src/pages/ventas-facturas/InvoiceEditorModal/layout/useInvoiceViewPreset.ts
//
// Hook que gobierna la plantilla de vista preferida del modal de Factura.
// Hidrata desde UserPreference.preferredInvoiceViewPreset al abrir el
// modal, persiste inmediatamente al cambiar.

import { useCallback, useEffect, useMemo, useState } from "react";
import { userPreferencesApi } from "../../../../services/user-preferences";
import {
  migrateLegacyPreset,
  resolveInvoiceViewPreset,
  type InvoiceViewPreset,
  type ResolvedInvoiceViewPreset,
} from "../../../../lib/sales/invoiceViewPresets";

export type UseInvoiceViewPresetResult = {
  preset: InvoiceViewPreset | null;
  resolved: ResolvedInvoiceViewPreset;
  setPreset: (next: InvoiceViewPreset) => void;
};

export function useInvoiceViewPreset(open: boolean): UseInvoiceViewPresetResult {
  const [preset, setPresetState] = useState<InvoiceViewPreset | null>(null);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    userPreferencesApi
      .get()
      .then((pref) => {
        if (cancelled) return;
        // Default para usuarios sin preferencia: COMPACT. Valores legacy
        // persistidos (BALANCED / FINANCIAL) se migran via
        // `migrateLegacyPreset` → COMPACT, sin perder la preferencia
        // explicita de quien ya guardo CLASSIC u ONE_LINE.
        const migrated = migrateLegacyPreset(pref?.preferredInvoiceViewPreset ?? null);
        setPresetState(migrated ?? "COMPACT");
      })
      .catch(() => {
        if (cancelled) return;
        setPresetState("COMPACT");
      });
    return () => {
      cancelled = true;
    };
  }, [open]);

  const setPreset = useCallback((next: InvoiceViewPreset) => {
    setPresetState(next);
    void userPreferencesApi
      .update({ preferredInvoiceViewPreset: next })
      .catch(() => {
        // El cambio igual se aplica localmente; si falla la red el
        // operador puede reintentar tocando otra plantilla.
      });
  }, []);

  const resolved = useMemo(() => resolveInvoiceViewPreset(preset), [preset]);

  return useMemo(
    () => ({ preset, resolved, setPreset }),
    [preset, resolved, setPreset],
  );
}
