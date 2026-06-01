// src/components/sales/CommercialPolicyConfirmModal.tsx
// ============================================================================
// Modal de "confirmación reforzada" cuando el comprobante tiene líneas en
// nivel CRITICAL (la política comercial detecta alertas bloqueantes).
//
// NO bloquea la venta — el operador puede confirmar igualmente. Solo:
//   · resume las líneas con riesgo,
//   · muestra el motivo (códigos del motor traducidos a español),
//   · exige una decisión explícita ("Volver y revisar" / "Confirmar
//     igualmente").
//
// Cero matemática: solo lee `policy.blockingAlerts` + `alerts[]` de cada
// línea (datos que ya provee el pricing-engine en el preview).
// Preparado para Fase C: si en el futuro se agrega un campo "motivo de
// excepción", el shape del payload permitirá pasarlo al backend sin
// reescribir esta UI.
// ============================================================================

import React from "react";
import { AlertTriangle, ShieldAlert } from "lucide-react";
import Modal from "../ui/Modal";
import { TPButton } from "../ui/TPButton";
import {
  type CommercialPolicyLineLike,
  COMMERCIAL_ALERT_LABELS,
  labelForAlertCode,
} from "../../lib/sales/commercialPolicy";

export type CommercialPolicyConfirmModalProps = {
  open: boolean;
  onClose: () => void;
  /** Líneas del comprobante que tienen nivel CRITICAL. Cada item incluye
   *  un label corto identificatorio (ej. nombre del artículo) y la
   *  política/alertas correspondientes. */
  criticalLines: ReadonlyArray<{
    label: string;
    line: CommercialPolicyLineLike;
  }>;
  /** Confirmación explícita — sigue adelante con la venta. */
  onConfirm: () => void;
  /** Texto del CTA primario. Default: "Confirmar igualmente". */
  confirmLabel?: string;
};

export default function CommercialPolicyConfirmModal({
  open,
  onClose,
  criticalLines,
  onConfirm,
  confirmLabel = "Confirmar igualmente",
}: CommercialPolicyConfirmModalProps) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      title="La venta presenta condiciones comerciales de riesgo"
      maxWidth="lg"
      footer={
        <div className="flex items-center justify-end gap-2 w-full">
          <TPButton variant="secondary" onClick={onClose}>
            Volver y revisar
          </TPButton>
          <TPButton
            variant="primary"
            onClick={() => { onConfirm(); }}
            iconLeft={<ShieldAlert size={14} />}
          >
            {confirmLabel}
          </TPButton>
        </div>
      }
    >
      <div className="space-y-4" data-tp-commercial-policy-confirm-modal>
        {/* Lead — explicación general. */}
        <div className="flex items-start gap-3 rounded-xl border border-red-200/60 bg-red-50/50 px-3 py-2.5 dark:border-red-900/30 dark:bg-red-950/20">
          <AlertTriangle size={18} className="shrink-0 mt-0.5 text-red-600 dark:text-red-400" aria-hidden />
          <p className="text-sm text-text leading-relaxed">
            Detectamos <span className="font-semibold">{criticalLines.length}</span>{" "}
            {criticalLines.length === 1 ? "línea" : "líneas"} con alertas que la
            política comercial del tenant marca como bloqueantes. Podés volver
            a revisar la venta o confirmar igualmente si sabés lo que estás
            haciendo.
          </p>
        </div>

        {/* Detalle por línea. */}
        <ul className="space-y-2" data-tp-commercial-policy-critical-list>
          {criticalLines.map((item, idx) => {
            const blocking = item.line.policy?.blockingAlerts ?? [];
            const alerts   = item.line.alerts ?? [];
            // R6 E1 — keys estables. El `line.id` no está garantizado en el
            // tipo `CommercialPolicyLineLike`, pero las líneas de Factura
            // (DocumentLine) sí lo tienen; el fallback compuesto cubre el
            // resto. Evita el warning de React por `key={idx}` sin coste.
            const lineKey =
              ((item.line as { id?: string }).id ?? `${item.label || "linea"}-${idx}`);
            return (
              <li
                key={lineKey}
                className="rounded-xl border border-border bg-card px-3 py-2.5"
                data-tp-commercial-policy-critical-item
              >
                <div className="text-sm font-semibold text-text mb-1 truncate">
                  {item.label || `Línea ${idx + 1}`}
                </div>
                {blocking.length > 0 && (
                  <div className="text-[12px] text-red-600 dark:text-red-400 leading-relaxed">
                    <span className="font-medium">Motivo bloqueante: </span>
                    {blocking.map(labelForAlertCode).join(" · ")}
                  </div>
                )}
                {alerts.length > 0 && (
                  <ul className="mt-1 space-y-0.5">
                    {alerts.map((a, i) => (
                      <li
                        // `a.code` es único por línea en la práctica (el motor
                        // no emite el mismo código dos veces). Sufijo `i` por
                        // defensa contra payloads inesperados.
                        key={`${a.code}-${i}`}
                        className="text-[11px] text-muted leading-snug"
                      >
                        <span className="font-medium text-text/80">
                          {COMMERCIAL_ALERT_LABELS[a.code] ?? a.code}:
                        </span>{" "}
                        {a.message}
                      </li>
                    ))}
                  </ul>
                )}
              </li>
            );
          })}
        </ul>

        {/* Nota legal / trazabilidad. */}
        <p className="text-[11px] text-muted leading-relaxed border-t border-border/40 pt-3">
          La confirmación queda registrada en el comprobante para
          trazabilidad. En próximas versiones podrá requerirse un motivo
          de excepción o autorización adicional.
        </p>
      </div>
    </Modal>
  );
}
