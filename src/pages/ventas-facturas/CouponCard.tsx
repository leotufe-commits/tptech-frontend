// src/pages/ventas-facturas/CouponCard.tsx
// ============================================================================
// CouponCard — input + acciones para el cupón de venta del documento.
//
// REGLA OBLIGATORIA: este card NO calcula descuentos. Solo:
//   1. Valida el código contra `couponsApi.validate()` (backend).
//   2. Persiste `couponCode` en el draft si es válido.
//   3. Llama al callback `onApplied()` para que el padre dispare un refetch
//      a `pricing-preview`. El motor aplica el descuento del cupón.
//   4. Muestra el estado (válido / inválido + motivo) y el descuento que
//      el motor reportó.
// ============================================================================

import React, { useEffect, useRef, useState } from "react";
import { Ticket, Check, X as XIcon, Loader2 } from "lucide-react";
import { TPCard } from "../../components/ui/TPCard";
import TPInput from "../../components/ui/TPInput";
import { TPButton } from "../../components/ui/TPButton";
import { TPBadge } from "../../components/ui/TPBadges";
import { couponsApi } from "../../services/coupons";
import { COUPON_DISCOUNT_TYPE_LABELS } from "../../services/coupons";

// ── Persistencia de estado colapsado/expandido del card ────────────────────
const COUPON_CARD_STORAGE_KEY = "tptech.couponCard.collapsed";

/**
 * Lee la preferencia guardada. Default: colapsado (true) si no hay valor.
 * Cualquier error de acceso a localStorage → fallback al default.
 */
function readSavedCollapsed(): boolean {
  try {
    const raw = window.localStorage.getItem(COUPON_CARD_STORAGE_KEY);
    if (raw === null) return true;
    return raw === "true";
  } catch {
    return true;
  }
}

function writeSavedCollapsed(collapsed: boolean): void {
  try {
    window.localStorage.setItem(COUPON_CARD_STORAGE_KEY, collapsed ? "true" : "false");
  } catch {
    /* ignore — storage no disponible (modo incógnito, etc.) */
  }
}

type Draft = {
  couponCode?: string;
  couponStatus?: {
    code:           string;
    valid:          boolean;
    name?:          string;
    reason?:        string;
    discountType?:  string;
    discountValue?: number;
  };
};

export type CouponCardProps<D extends Draft> = {
  draft:     D;
  onChange:  (d: D) => void;
  /** Cliente actual del documento — se manda al validate para soportar cupones por cliente. */
  clientId?: string;
  /** Callback que el padre invoca para refrescar pricing tras aplicar/limpiar. */
  onApplied: () => void;
};

export function CouponCard<D extends Draft>({
  draft,
  onChange,
  clientId,
  onApplied,
}: CouponCardProps<D>) {
  const [code, setCode] = useState<string>(draft.couponCode ?? "");
  const [busy, setBusy] = useState(false);
  const status = draft.couponStatus;
  const applied = !!draft.couponCode && status?.valid === true;

  // ── Colapsado/expandido — persistido en localStorage ────────────────────
  // Regla:
  //   · Si hay cupón aplicado → expandido (auto, ignora estado guardado).
  //   · Si no hay cupón → respeta el estado guardado del usuario.
  //   · Default sin valor guardado → colapsado.
  // Para que la persistencia refleje SOLO la elección manual del usuario,
  // los auto-expand/auto-collapse disparados por transiciones de `applied`
  // no se escriben en localStorage.
  const [open, setOpen] = useState<boolean>(() => {
    if (applied) return true;
    return !readSavedCollapsed();
  });
  const lastAppliedRef = useRef<boolean>(applied);
  useEffect(() => {
    const wasApplied = lastAppliedRef.current;
    if (!wasApplied && applied) {
      // Cupón recién aplicado → forzar expandido.
      setOpen(true);
    } else if (wasApplied && !applied) {
      // Cupón recién quitado → volver al estado guardado del usuario.
      setOpen(!readSavedCollapsed());
    }
    lastAppliedRef.current = applied;
  }, [applied]);

  function handleOpenChange(next: boolean) {
    setOpen(next);
    // Solo persistimos la preferencia cuando NO hay cupón aplicado: así
    // los auto-expand por aplicación de cupón no contaminan la elección
    // manual del usuario.
    if (!applied) {
      writeSavedCollapsed(!next);
    }
  }

  async function handleApply() {
    const trimmed = code.trim();
    if (!trimmed) return;
    setBusy(true);
    try {
      const result = await couponsApi.validate(trimmed, { clientId });
      onChange({
        ...draft,
        couponCode: result.valid ? trimmed : undefined,
        couponStatus: {
          code:          trimmed,
          valid:         result.valid,
          name:          result.name,
          reason:        result.reason,
          discountType:  result.discountType,
          discountValue: result.discountValue,
        },
      });
      // Solo recalcular si quedó aplicado.
      if (result.valid) onApplied();
    } catch (e: any) {
      onChange({
        ...draft,
        couponCode: undefined,
        couponStatus: {
          code:   trimmed,
          valid:  false,
          reason: e?.message || "No se pudo validar el cupón.",
        },
      });
    } finally {
      setBusy(false);
    }
  }

  function handleClear() {
    setCode("");
    onChange({ ...draft, couponCode: undefined, couponStatus: undefined });
    onApplied();
  }

  return (
    <TPCard
      title="Cupón de venta"
      bodyClassName="!p-3"
      headerClassName="!py-2"
      collapsible
      open={open}
      onOpenChange={handleOpenChange}
      right={
        applied
          ? <TPBadge tone="success" size="sm">Aplicado</TPBadge>
          : status && !status.valid
            ? <TPBadge tone="danger" size="sm">Inválido</TPBadge>
            : <span className="text-[11px] text-muted">Opcional</span>
      }
    >
      <div className="space-y-2">
        <div className="flex items-stretch gap-2">
          <div className="flex-1">
            <TPInput
              value={code}
              onChange={(v: string) => setCode(v.toUpperCase())}
              placeholder="Código de cupón"
              disabled={busy}
            />
          </div>
          {applied ? (
            <TPButton
              variant="ghost"
              onClick={handleClear}
              title="Limpiar cupón"
              disabled={busy}
            >
              <XIcon size={14} />
              Quitar
            </TPButton>
          ) : (
            <TPButton
              variant="primary"
              onClick={handleApply}
              disabled={busy || !code.trim()}
            >
              {busy ? <Loader2 size={14} className="animate-spin" /> : <Ticket size={14} />}
              Aplicar
            </TPButton>
          )}
        </div>

        {/* Feedback */}
        {status && (
          <div className="text-[11px]">
            {status.valid ? (
              <div className="flex items-center gap-1.5 text-emerald-500">
                <Check size={12} />
                <span>
                  {status.name ?? "Cupón válido"}
                  {typeof status.discountValue === "number" && status.discountType && (
                    <span className="ml-1 text-muted">
                      ({status.discountValue}
                      {status.discountType === "PERCENTAGE" ? "%" : " $"}
                      {" — "}
                      {COUPON_DISCOUNT_TYPE_LABELS[status.discountType as keyof typeof COUPON_DISCOUNT_TYPE_LABELS] ?? status.discountType})
                    </span>
                  )}
                </span>
              </div>
            ) : (
              <div className="text-red-500">
                {status.reason ?? "El cupón no se pudo aplicar."}
              </div>
            )}
          </div>
        )}

        <p className="text-[10px] text-muted/80">
          El descuento se calcula en el backend al recalcular cada línea. El frontend solo envía el código.
        </p>
      </div>
    </TPCard>
  );
}

export default CouponCard;
