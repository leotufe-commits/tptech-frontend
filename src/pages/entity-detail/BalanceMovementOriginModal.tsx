// src/pages/entity-detail/BalanceMovementOriginModal.tsx
// =============================================================================
// T62 (Fase 4.4) — Modal premium "Ver origen" para un movimiento canónico.
//
// READ-ONLY. NO recalcula. NO edita. Solo muestra metadata legible del
// movimiento + breakdown (metales + saldo monetario) + origen documental.
//
// Permite también navegar al documento origen (Sale/Purchase) si existe.
// =============================================================================

import { useNavigate } from "react-router-dom";
import { ExternalLink } from "lucide-react";
import { Modal } from "../../components/ui/Modal";
import { TPButton } from "../../components/ui/TPButton";
import { formatByType } from "../../lib/pricing/format";
import { vt } from "../../lib/pricing/visualTokens";
import type { BalanceMovementDTO } from "../../services/commercial-entities";
import {
  sourceDocumentLabel,
  sourceTypeLabel,
  kindLabel,
  balanceModeLabel,
  fmtDateTime,
} from "./balance-movements-helpers";

export interface BalanceMovementOriginModalProps {
  open: boolean;
  movement: BalanceMovementDTO | null;
  onClose: () => void;
}

export function BalanceMovementOriginModal({
  open,
  movement,
  onClose,
}: BalanceMovementOriginModalProps) {
  const navigate = useNavigate();

  if (!movement) {
    return (
      <Modal open={open} onClose={onClose} title="Origen del movimiento">
        <div className="text-sm text-muted py-6 text-center">
          Sin datos del movimiento.
        </div>
      </Modal>
    );
  }

  const isBreakdown = movement.balanceMode === "BREAKDOWN" && movement.metalEntries.length > 0;
  const canNavigate = !!movement.sourceDocumentId && !!movement.sourceDocumentType;

  const handleNavigate = () => {
    if (!canNavigate) return;
    switch (movement.sourceDocumentType) {
      case "SALE":
        navigate(`/ventas?saleId=${movement.sourceDocumentId}`);
        onClose();
        break;
      case "PURCHASE":
        navigate(`/compras?purchaseId=${movement.sourceDocumentId}`);
        onClose();
        break;
      case "CROSS_SETTLEMENT":
        navigate(`/finanzas/liquidaciones?id=${movement.sourceDocumentId}`);
        onClose();
        break;
      default:
        // tipo no mapeado — nada que hacer
        break;
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Origen del movimiento"
      subtitle={sourceDocumentLabel(movement.sourceDocumentType)}
      footer={
        <div className="flex justify-between items-center gap-2">
          <TPButton variant="ghost" onClick={onClose}>
            Cerrar
          </TPButton>
          {canNavigate && (
            <TPButton
              variant="primary"
              onClick={handleNavigate}
              data-testid="origin-modal-navigate"
            >
              <ExternalLink size={14} className="mr-1.5" />
              Abrir documento
            </TPButton>
          )}
        </div>
      }
    >
      <div className="space-y-4" data-testid="origin-modal-body">
        {/* Metadata principal */}
        <section
          className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-2"
          data-testid="origin-modal-meta"
        >
          <Field label="Tipo de documento" value={sourceDocumentLabel(movement.sourceDocumentType)} />
          <Field label="Fecha" value={fmtDateTime(movement.movementDate)} />
          <Field label="Operación" value={kindLabel(movement.kind)} />
          <Field label="Modo de saldo" value={balanceModeLabel(movement.balanceMode)} />
          {movement.sourceDocumentId && (
            <Field label="ID del documento" value={movement.sourceDocumentId} mono />
          )}
          {movement.receiptId && (
            <Field label="Comprobante asociado" value={sourceTypeLabel(movement.source)} />
          )}
        </section>

        {/* Metales (solo BREAKDOWN con entries) */}
        {isBreakdown && (
          <section data-testid="origin-modal-metals">
            <div className={`${vt.text.subtotalRow} mb-2`}>Metales</div>
            <div className="border border-border/40 rounded-lg overflow-hidden">
              <table className="w-full text-xs">
                <thead className="bg-muted/30">
                  <tr>
                    <th className="text-left px-3 py-2 font-medium text-muted">Metal padre</th>
                    <th className="text-right px-3 py-2 font-medium text-muted">Gramos originales</th>
                    <th className="text-right px-3 py-2 font-medium text-muted">Pureza</th>
                    <th className="text-right px-3 py-2 font-medium text-muted">Gramos puros</th>
                  </tr>
                </thead>
                <tbody>
                  {movement.metalEntries.map((e) => (
                    <tr
                      key={e.id}
                      className="border-t border-border/40"
                      data-testid={`origin-modal-metal-row-${e.metalParentId ?? e.metalParentName}`}
                    >
                      <td className="px-3 py-2">{e.metalParentName}</td>
                      <td className="px-3 py-2 text-right tabular-nums">
                        {formatByType(e.gramsOriginal, "METAL_GRAMS")}
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums">
                        {e.purity != null ? formatByType(e.purity, "PURITY") : "—"}
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums font-semibold">
                        {formatByType(e.gramsPure, "METAL_GRAMS")}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}

        {/* Saldo monetario */}
        <section data-testid="origin-modal-monetary">
          <div className={`${vt.text.subtotalRow} mb-2`}>Saldo monetario</div>
          <div className={`${vt.card.outer}`}>
            <div className={vt.card.inner}>
              <div className={vt.row.flexBetween}>
                <span className="text-xs text-muted">Moneda del documento</span>
                <span className={vt.text.totalCard}>
                  {movement.currencyCode || "BASE"}{" "}
                  {formatByType(movement.amountOriginal, "MONEY")}
                </span>
              </div>
              <div className={`${vt.row.flexBetween} mt-1`}>
                <span className="text-xs text-muted">Equivalente en moneda base</span>
                <span className="text-xs text-muted tabular-nums">
                  {formatByType(movement.amountBase, "MONEY")}
                </span>
              </div>
              {movement.currencyRate && movement.currencyRate !== 1 && (
                <div className={`${vt.row.flexBetween} mt-1`}>
                  <span className="text-xs text-muted">Cotización snapshot</span>
                  <span className="text-xs text-muted tabular-nums">
                    1 {movement.currencyCode} = {formatByType(movement.currencyRate, "FX_RATE")}
                  </span>
                </div>
              )}
            </div>
          </div>
        </section>

        {/* Nota interna */}
        {movement.notes && (
          <section>
            <div className="text-xs text-muted mb-1">Nota</div>
            <div className="text-xs text-foreground/80">{movement.notes}</div>
          </section>
        )}
      </div>
    </Modal>
  );
}

function Field({
  label, value, mono,
}: { label: string; value: string; mono?: boolean }) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-wide text-muted">{label}</div>
      <div className={`text-sm ${mono ? "font-mono text-xs" : ""}`}>{value}</div>
    </div>
  );
}

export default BalanceMovementOriginModal;
