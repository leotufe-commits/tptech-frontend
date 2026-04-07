import React, { useState } from "react";
import { useParams, useNavigate, useLocation } from "react-router-dom";
import { ArrowLeft, Printer, Mail, Loader2, AlertCircle } from "lucide-react";
import { TPCard } from "../../components/ui/TPCard";
import { TPField } from "../../components/ui/TPField";
import TPInput from "../../components/ui/TPInput";
import { TPButton } from "../../components/ui/TPButton";
import { Modal } from "../../components/ui/Modal";
import { toast } from "../../lib/toast";
import {
  commercialEntitiesApi,
  type AccountStatement,
  type StatementBalance,
  type StatementMovement,
} from "../../services/commercial-entities";

// ---------------------------------------------------------------------------
// Print styles
// ---------------------------------------------------------------------------
const PRINT_STYLE = `
@media print {
  body * { visibility: hidden; }
  #account-statement-print, #account-statement-print * { visibility: visible; }
  #account-statement-print { position: absolute; left: 0; top: 0; width: 100%; }
  .no-print { display: none !important; }
}
`;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function fmtDate(iso: string | null | undefined): string {
  if (!iso) return "–";
  const d = new Date(iso);
  return d.toLocaleDateString("es-AR", { day: "2-digit", month: "2-digit", year: "numeric" });
}

function fmtDateTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString("es-AR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function fmtGrams(v: number): string {
  const abs = Math.abs(v).toLocaleString("es-AR", { minimumFractionDigits: 3, maximumFractionDigits: 3 });
  return (v >= 0 ? "+" : "−") + abs + " g";
}

function fmtMoney(v: number, currency: string): string {
  const abs = Math.abs(v).toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const sign = v >= 0 ? "+" : "−";
  return `${sign}${currency} ${abs}`;
}

function isNegligible(v: number): boolean {
  return Math.abs(v) < 0.0001;
}

// ---------------------------------------------------------------------------
// BalanceSummary — renders a StatementBalance card
// ---------------------------------------------------------------------------
function BalanceSummary({ balance, label }: { balance: StatementBalance; label: string }) {
  const metalEntries = Object.entries(balance.metal).filter(([, v]) => !isNegligible(v));
  const hechuraEntries = Object.entries(balance.hechura).filter(([, v]) => !isNegligible(v));
  const isEmpty = metalEntries.length === 0 && hechuraEntries.length === 0;

  return (
    <TPCard className="p-4 space-y-3">
      <div className="text-sm font-semibold">{label}</div>
      {isEmpty && (
        <div className="text-xs text-muted italic">Sin saldo registrado.</div>
      )}
      {metalEntries.length > 0 && (
        <div>
          <div className="text-xs font-medium text-amber-600 mb-1.5 uppercase tracking-wide">Metal</div>
          <div className="flex flex-wrap gap-3">
            {metalEntries.map(([key, val]) => (
              <div key={key} className="flex items-center gap-1.5">
                <span className="text-xs font-semibold text-amber-700 bg-amber-50 border border-amber-200 rounded px-2 py-0.5">
                  {key}
                </span>
                <span
                  className={`text-sm font-mono font-medium ${
                    val > 0 ? "text-amber-700" : val < 0 ? "text-red-500" : "text-muted"
                  }`}
                >
                  {fmtGrams(val)}
                </span>
                {val < 0 && (
                  <span className="text-xs text-emerald-600 font-medium">(saldo a favor)</span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
      {hechuraEntries.length > 0 && (
        <div>
          <div className="text-xs font-medium text-sky-600 mb-1.5 uppercase tracking-wide">Hechura</div>
          <div className="flex flex-wrap gap-3">
            {hechuraEntries.map(([currency, val]) => (
              <div key={currency} className="flex items-center gap-1.5">
                <span className="text-xs font-semibold text-sky-700 bg-sky-50 border border-sky-200 rounded px-2 py-0.5">
                  {currency}
                </span>
                <span
                  className={`text-sm font-mono font-medium ${
                    val > 0 ? "text-sky-700" : val < 0 ? "text-red-500" : "text-muted"
                  }`}
                >
                  {fmtMoney(val, currency)}
                </span>
                {val < 0 && (
                  <span className="text-xs text-emerald-600 font-medium">(saldo a favor)</span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </TPCard>
  );
}

// ---------------------------------------------------------------------------
// DeltaCell — renders metal or hechura delta in a table cell
// ---------------------------------------------------------------------------
function DeltaCell({
  delta,
  type,
}: {
  delta: Record<string, number>;
  type: "metal" | "hechura";
}) {
  const entries = Object.entries(delta).filter(([, v]) => !isNegligible(v));
  if (entries.length === 0) return <span className="text-muted text-xs">–</span>;

  return (
    <div className="space-y-0.5">
      {entries.map(([key, val]) => (
        <div key={key} className="flex items-center gap-1 whitespace-nowrap">
          <span
            className={`text-xs font-mono font-medium ${
              val > 0
                ? type === "metal"
                  ? "text-amber-700"
                  : "text-sky-700"
                : "text-emerald-600"
            }`}
          >
            {type === "metal" ? fmtGrams(val) : fmtMoney(val, key)}
          </span>
          <span className="text-xs text-muted">{type === "metal" ? key : ""}</span>
        </div>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// RunningCell — running balance after each row
// ---------------------------------------------------------------------------
function RunningCell({ mov }: { mov: StatementMovement }) {
  const metalEntries = Object.entries(mov.runningMetal).filter(([, v]) => !isNegligible(v));
  const hechuraEntries = Object.entries(mov.runningHechura).filter(([, v]) => !isNegligible(v));

  if (metalEntries.length === 0 && hechuraEntries.length === 0) {
    return <span className="text-muted text-xs">–</span>;
  }

  return (
    <div className="space-y-1">
      {metalEntries.map(([key, val]) => (
        <div key={key} className="flex items-center gap-1 whitespace-nowrap">
          <span className={`text-xs font-mono font-medium ${val < 0 ? "text-red-500" : "text-amber-700"}`}>
            {fmtGrams(val)}
          </span>
          <span className="text-xs text-muted">{key}</span>
        </div>
      ))}
      {hechuraEntries.map(([currency, val]) => (
        <div key={currency} className="flex items-center gap-1 whitespace-nowrap">
          <span className={`text-xs font-mono font-medium ${val < 0 ? "text-red-500" : "text-sky-700"}`}>
            {fmtMoney(val, currency)}
          </span>
        </div>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// MovementsTable
// ---------------------------------------------------------------------------
function MovementsTable({ movements }: { movements: StatementMovement[] }) {
  if (movements.length === 0) {
    return (
      <TPCard className="p-4">
        <div className="text-sm text-muted italic text-center py-6">
          No hay movimientos en el período seleccionado.
        </div>
      </TPCard>
    );
  }

  return (
    <TPCard className="p-0 overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr className="bg-muted/30 border-b border-border">
              <th className="text-left text-xs font-semibold text-muted px-3 py-2.5 whitespace-nowrap">Fecha</th>
              <th className="text-left text-xs font-semibold text-muted px-3 py-2.5 whitespace-nowrap">Tipo</th>
              <th className="text-left text-xs font-semibold text-muted px-3 py-2.5 whitespace-nowrap">Comprobante</th>
              <th className="text-left text-xs font-semibold text-muted px-3 py-2.5">Descripción</th>
              <th className="text-left text-xs font-semibold text-muted px-3 py-2.5 whitespace-nowrap">Metal (Δ)</th>
              <th className="text-left text-xs font-semibold text-muted px-3 py-2.5 whitespace-nowrap">Hechura (Δ)</th>
              <th className="text-left text-xs font-semibold text-muted px-3 py-2.5 whitespace-nowrap">Saldo acumulado</th>
            </tr>
          </thead>
          <tbody>
            {movements.map((mov, i) => (
              <tr
                key={mov.id}
                className={[
                  "border-b border-border last:border-b-0",
                  mov.isVoided ? "opacity-50 line-through" : "",
                  i % 2 === 0 ? "" : "bg-muted/10",
                ].join(" ")}
              >
                <td className="px-3 py-2.5 text-xs whitespace-nowrap text-muted">
                  {fmtDate(mov.date)}
                </td>
                <td className="px-3 py-2.5 whitespace-nowrap">
                  <span className="text-xs font-medium">{mov.typeLabel}</span>
                  {mov.isVoided && (
                    <span className="ml-1 text-xs text-red-500">(Anulado)</span>
                  )}
                </td>
                <td className="px-3 py-2.5 text-xs whitespace-nowrap font-mono text-muted">
                  {mov.reference || "–"}
                </td>
                <td className="px-3 py-2.5 text-xs text-muted max-w-[200px]">
                  {mov.description || "–"}
                </td>
                <td className="px-3 py-2.5">
                  <DeltaCell delta={mov.metalDelta} type="metal" />
                </td>
                <td className="px-3 py-2.5">
                  <DeltaCell delta={mov.hechuraDelta} type="hechura" />
                </td>
                <td className="px-3 py-2.5">
                  <RunningCell mov={mov} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </TPCard>
  );
}

// ---------------------------------------------------------------------------
// EmailModal
// ---------------------------------------------------------------------------
function EmailModal({
  open,
  onClose,
  entityId,
  defaultEmail,
  fromDate,
  toDate,
}: {
  open: boolean;
  onClose: () => void;
  entityId: string;
  defaultEmail: string;
  fromDate: string;
  toDate: string;
}) {
  const [email, setEmail] = useState(defaultEmail);
  const [busy, setBusy] = useState(false);

  async function send() {
    if (!email.trim()) {
      toast.error("Ingresá un email destinatario.");
      return;
    }
    setBusy(true);
    try {
      await commercialEntitiesApi.emailStatement(entityId, {
        recipientEmail: email.trim(),
        from: fromDate || undefined,
        to: toDate || undefined,
      });
      toast.success("Extracto enviado correctamente.");
      onClose();
    } catch (e: any) {
      toast.error(e?.message || "Error al enviar el email.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Enviar extracto por email" maxWidth="sm">
      <div className="space-y-4 p-1">
        <TPField label="Email destinatario">
          <TPInput
            type="email"
            value={email}
            onChange={(v) => setEmail(v)}
            placeholder="ejemplo@correo.com"
            disabled={busy}
          />
        </TPField>
        <div className="flex justify-end gap-2 pt-1">
          <TPButton variant="secondary" onClick={onClose} disabled={busy}>
            Cancelar
          </TPButton>
          <TPButton onClick={send} disabled={busy}>
            {busy ? (
              <>
                <Loader2 size={14} className="mr-1.5 animate-spin" /> Enviando…
              </>
            ) : (
              <>
                <Mail size={14} className="mr-1.5" /> Enviar
              </>
            )}
          </TPButton>
        </div>
      </div>
    </Modal>
  );
}

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------
export default function EntityAccountStatement() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const location = useLocation();

  const isSupplierContext = location.pathname.startsWith("/proveedores");

  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [statement, setStatement] = useState<AccountStatement | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [emailModalOpen, setEmailModalOpen] = useState(false);

  const backPath = isSupplierContext ? `/proveedores/${id}` : `/clientes/${id}`;

  async function generate() {
    if (!id) return;
    setLoading(true);
    setError(null);
    try {
      const data = await commercialEntitiesApi.getAccountStatement(id, {
        from: fromDate || undefined,
        to: toDate || undefined,
      });
      setStatement(data);
    } catch (e: any) {
      setError(e?.message || "Error al cargar el extracto.");
    } finally {
      setLoading(false);
    }
  }

  function handlePrint() {
    window.print();
  }

  return (
    <>
      <style>{PRINT_STYLE}</style>

      <div className="max-w-5xl mx-auto p-4 space-y-4">

        {/* Back button */}
        <div className="no-print">
          <TPButton variant="secondary" onClick={() => navigate(backPath)} iconLeft={<ArrowLeft size={14} />}>
            Volver al detalle
          </TPButton>
        </div>

        {/* Period selector */}
        <TPCard className="p-4 no-print">
          <div className="text-sm font-semibold mb-3">Período del extracto</div>
          <div className="flex flex-wrap items-end gap-3">
            <TPField label="Desde" className="flex-1 min-w-[160px]">
              <TPInput
                type="date"
                value={fromDate}
                onChange={(v) => setFromDate(v)}
                disabled={loading}
              />
            </TPField>
            <TPField label="Hasta" className="flex-1 min-w-[160px]">
              <TPInput
                type="date"
                value={toDate}
                onChange={(v) => setToDate(v)}
                disabled={loading}
              />
            </TPField>
            <div className="pb-0.5">
              <TPButton onClick={generate} disabled={loading}>
                {loading ? (
                  <>
                    <Loader2 size={14} className="mr-1.5 animate-spin" /> Generando…
                  </>
                ) : (
                  "Generar extracto"
                )}
              </TPButton>
            </div>
          </div>
        </TPCard>

        {/* Error state */}
        {error && (
          <div className="flex items-center gap-2 text-sm text-red-500 bg-red-50 border border-red-200 rounded-lg px-4 py-3 no-print">
            <AlertCircle size={16} className="shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Empty state */}
        {!loading && !error && !statement && (
          <div className="text-sm text-muted text-center py-12 border border-dashed border-border rounded-xl">
            Seleccioná un período y generá el extracto.
          </div>
        )}

        {/* Statement content */}
        {statement && (
          <div id="account-statement-print" className="space-y-4">

            {/* Header card */}
            <TPCard className="p-5">
              <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
                <div>
                  <div className="text-xl font-bold">{statement.entity.displayName}</div>
                  <div className="flex flex-wrap items-center gap-3 mt-1">
                    {statement.entity.code && (
                      <span className="text-xs text-muted font-mono bg-muted/20 rounded px-1.5 py-0.5">
                        {statement.entity.code}
                      </span>
                    )}
                    {statement.entity.documentNumber && (
                      <span className="text-xs text-muted">
                        CUIT / DNI: <span className="font-mono">{statement.entity.documentNumber}</span>
                      </span>
                    )}
                    {statement.entity.email && (
                      <span className="text-xs text-muted">{statement.entity.email}</span>
                    )}
                  </div>
                  <div className="mt-2 text-xs text-muted">
                    <span className="font-medium">Período: </span>
                    {statement.period.from ? fmtDate(statement.period.from) : "Inicio"}{" "}
                    →{" "}
                    {statement.period.to ? fmtDate(statement.period.to) : "Hoy"}
                  </div>
                  <div className="text-xs text-muted">
                    <span className="font-medium">Generado el: </span>
                    {fmtDateTime(statement.period.generatedAt)}
                  </div>
                </div>

                {/* Action buttons */}
                <div className="flex gap-2 shrink-0 no-print">
                  <TPButton variant="secondary" onClick={handlePrint}>
                    <Printer size={14} className="mr-1.5" /> Imprimir / PDF
                  </TPButton>
                  <TPButton variant="secondary" onClick={() => setEmailModalOpen(true)}>
                    <Mail size={14} className="mr-1.5" /> Enviar por email
                  </TPButton>
                </div>
              </div>
            </TPCard>

            {/* Opening balance */}
            <BalanceSummary
              balance={statement.openingBalance}
              label={`Saldo inicial al ${statement.period.from ? fmtDate(statement.period.from) : "inicio"}`}
            />

            {/* Movements table */}
            <div>
              <div className="text-sm font-semibold mb-2 px-1">Movimientos</div>
              <MovementsTable movements={statement.movements} />
            </div>

            {/* Closing balance */}
            <BalanceSummary
              balance={statement.closingBalance}
              label={`Saldo final al ${statement.period.to ? fmtDate(statement.period.to) : "hoy"}`}
            />

          </div>
        )}
      </div>

      {/* Email modal */}
      {statement && id && (
        <EmailModal
          open={emailModalOpen}
          onClose={() => setEmailModalOpen(false)}
          entityId={id}
          defaultEmail={statement.entity.email || ""}
          fromDate={fromDate}
          toDate={toDate}
        />
      )}
    </>
  );
}
