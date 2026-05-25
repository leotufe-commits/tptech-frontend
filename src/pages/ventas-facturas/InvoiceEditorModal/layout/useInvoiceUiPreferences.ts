// tptech-frontend/src/pages/ventas-facturas/InvoiceEditorModal/layout/useInvoiceUiPreferences.ts
//
// Hook que gobierna las preferencias finas de UI del modal de Factura.
//
// Estado HOY (post layout V2):
//   - visibleCards — toggle por card del aside.
//
// `density` y `stickyActions` fueron eliminados con el rediseno del
// layout V2: la densidad la gobierna el preset + el auto-grow por
// contenido, y las acciones de fila siempre quedan sticky. El
// resolver ignora silenciosamente esos campos si vienen persistidos
// en DB de versiones anteriores — el sanitizador del backend tampoco
// los rechaza (campo opaco), simplemente quedan ignorados.

import { useCallback, useEffect, useMemo, useState } from "react";
import { userPreferencesApi } from "../../../../services/user-preferences";

export type InvoiceVisibleCards = {
  accountImpact: boolean;
  discount: boolean;
  shipping: boolean;
  coupon: boolean;
  totals: boolean;
  payments: boolean;
  observations: boolean;
};

export type InvoiceUiPreferences = {
  visibleCards: InvoiceVisibleCards;
};

const DEFAULT_VISIBLE: InvoiceVisibleCards = {
  accountImpact: true,
  discount: true,
  shipping: true,
  coupon: true,
  totals: true,
  payments: true,
  observations: true,
};

function resolveUiPreferences(raw: unknown): InvoiceUiPreferences {
  if (!raw || typeof raw !== "object") return { visibleCards: { ...DEFAULT_VISIBLE } };
  const r = raw as { visibleCards?: Partial<InvoiceVisibleCards> };
  const vc = (r.visibleCards ?? {}) as Partial<InvoiceVisibleCards>;
  return {
    visibleCards: {
      accountImpact: vc.accountImpact !== false,
      discount: vc.discount !== false,
      shipping: vc.shipping !== false,
      coupon: vc.coupon !== false,
      totals: vc.totals !== false,
      payments: vc.payments !== false,
      observations: vc.observations !== false,
    },
  };
}

export type UseInvoiceUiPreferencesResult = {
  resolved: InvoiceUiPreferences;
  update: (patch: Partial<{ visibleCards: Partial<InvoiceVisibleCards> }>) => void;
};

export function useInvoiceUiPreferences(open: boolean): UseInvoiceUiPreferencesResult {
  const [resolved, setResolved] = useState<InvoiceUiPreferences>(() => ({
    visibleCards: { ...DEFAULT_VISIBLE },
  }));

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    userPreferencesApi
      .get()
      .then((pref) => {
        if (cancelled) return;
        setResolved(resolveUiPreferences(pref?.invoiceUiPreferences));
      })
      .catch(() => {
        if (cancelled) return;
        setResolved({ visibleCards: { ...DEFAULT_VISIBLE } });
      });
    return () => {
      cancelled = true;
    };
  }, [open]);

  const update = useCallback(
    (patch: Partial<{ visibleCards: Partial<InvoiceVisibleCards> }>) => {
      setResolved((prev) => {
        const visibleCardsPatch = patch.visibleCards;
        const next: InvoiceUiPreferences = {
          visibleCards: visibleCardsPatch
            ? { ...prev.visibleCards, ...visibleCardsPatch }
            : prev.visibleCards,
        };
        void userPreferencesApi.update({ invoiceUiPreferences: next }).catch(() => {});
        return next;
      });
    },
    [],
  );

  return useMemo(() => ({ resolved, update }), [resolved, update]);
}
