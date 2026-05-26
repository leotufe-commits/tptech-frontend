// tptech-frontend/src/components/sales/SendInvoiceEmailModal.tsx
// ============================================================================
// 1.E parte 2 — Modal reutilizable "Enviar factura por mail".
//
// Componente PRESENTACIONAL: recibe defaults via props, mantiene estado
// local de los 3 campos (to / subject / message) y emite el payload al
// callback `onSubmit`. NO conoce el endpoint backend ni el id del sale —
// el caller (VentasFacturas) hace la llamada a `salesApi.sendEmail`.
//
// Reglas UX:
//   · Defaults precargados al abrir (y se resetean al re-abrir, asi
//     editar y cancelar no contamina la siguiente apertura).
//   · Si el cliente NO tiene email, el campo `to` queda vacio + hint
//     visible. NO bloquea — el operador puede ingresar uno manualmente.
//   · Validacion inline: email regex + asunto/mensaje non-empty.
//   · El boton "Enviar" se deshabilita mientras hay errores o loading.
//   · El message se preserva con saltos de linea (textarea simple, sin
//     rich text — el backend lo envuelve en <pre white-space:pre-wrap>).
//   · Tras exito el caller cierra el modal via `onClose`.
// ============================================================================

import React, { useEffect, useMemo, useState } from "react";
import { Mail, X } from "lucide-react";
import Modal from "../ui/Modal";
import TPInput from "../ui/TPInput";
import TPTextarea from "../ui/TPTextarea";
import { TPButton } from "../ui/TPButton";

export type SendInvoiceEmailPayload = {
  to:      string;
  subject: string;
  message: string;
};

export interface SendInvoiceEmailModalProps {
  open:           boolean;
  loading?:       boolean;
  /** Numero oficial del comprobante (Receipt.code) o codigo interno
   *  del draft (Sale.code) como fallback. Aparece en el subtitulo y
   *  en los defaults de subject/message. */
  invoiceNumber:  string;
  /** Email del cliente — precarga el campo `to` si esta presente. */
  customerEmail?: string | null;
  /** Nombre del cliente para el "Hola <name>," del body. */
  customerName?:  string | null;
  /** Nombre de la joyeria — aparece en subject + firma del body. */
  jewelryName?:   string | null;
  onClose():      void;
  onSubmit(payload: SendInvoiceEmailPayload): Promise<void>;
}

// Misma regex que usa el backend (sales.controller.sendEmail). Mantener
// sincronizadas para que un email valido en frontend no sea rechazado
// por el server (o viceversa).
const EMAIL_RX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function buildDefaultSubject(invoiceNumber: string, jewelryName?: string | null): string {
  const tenant = jewelryName?.trim();
  return tenant ? `Factura ${invoiceNumber} - ${tenant}` : `Factura ${invoiceNumber}`;
}

function buildDefaultMessage(
  invoiceNumber: string,
  customerName?:  string | null,
  jewelryName?:   string | null,
): string {
  const greeting = customerName?.trim() ? `Hola ${customerName.trim()},` : "Hola,";
  const firm     = jewelryName?.trim() || "";
  return [
    greeting,
    "",
    `Te enviamos adjunta la factura ${invoiceNumber}.`,
    "",
    "Muchas gracias.",
    firm,
  ].join("\n");
}

export default function SendInvoiceEmailModal(props: SendInvoiceEmailModalProps): React.ReactElement {
  const { open, loading, invoiceNumber, customerEmail, customerName, jewelryName, onClose, onSubmit } = props;

  const defaultSubject = useMemo(
    () => buildDefaultSubject(invoiceNumber, jewelryName),
    [invoiceNumber, jewelryName],
  );
  const defaultMessage = useMemo(
    () => buildDefaultMessage(invoiceNumber, customerName, jewelryName),
    [invoiceNumber, customerName, jewelryName],
  );

  const [to,      setTo]      = useState<string>(customerEmail ?? "");
  const [subject, setSubject] = useState<string>(defaultSubject);
  const [message, setMessage] = useState<string>(defaultMessage);
  // `touched` controla cuando mostramos errores: no irritamos al operador
  // marcando "email invalido" antes de que escriba/edite.
  const [touched, setTouched] = useState<{ to?: boolean; subject?: boolean; message?: boolean }>({});

  // Reset al ABRIR: defaults frescos, errores limpios.
  useEffect(() => {
    if (!open) return;
    setTo(customerEmail ?? "");
    setSubject(defaultSubject);
    setMessage(defaultMessage);
    setTouched({});
  }, [open, customerEmail, defaultSubject, defaultMessage]);

  const errors = useMemo(() => {
    const e: { to?: string; subject?: string; message?: string } = {};
    if (!to.trim())                            e.to      = "Ingresá el email del destinatario.";
    else if (!EMAIL_RX.test(to.trim()))        e.to      = "El email no es válido.";
    if (!subject.trim())                       e.subject = "El asunto es requerido.";
    if (!message.trim())                       e.message = "El mensaje es requerido.";
    return e;
  }, [to, subject, message]);

  const hasErrors            = !!(errors.to || errors.subject || errors.message);
  const customerHasNoEmail   = !customerEmail || !customerEmail.trim();
  const visibleToError       = touched.to      ? errors.to      ?? null : null;
  const visibleSubjectError  = touched.subject ? errors.subject ?? null : null;
  const visibleMessageError  = touched.message ? errors.message ?? null : null;

  async function handleSubmitClick(): Promise<void> {
    // Forzamos "touched" en submit para que cualquier error oculto se vea.
    setTouched({ to: true, subject: true, message: true });
    if (hasErrors || loading) return;
    await onSubmit({
      to:      to.trim(),
      subject: subject.trim(),
      // `message` SIN trim — preservamos saltos de linea exactos.
      message,
    });
  }

  return (
    <Modal
      open={open}
      onClose={loading ? () => undefined : onClose}
      title="Enviar factura por mail"
      subtitle={`Comprobante ${invoiceNumber}`}
      maxWidth="2xl"
      footer={
        <div className="flex items-center justify-end gap-2">
          <TPButton
            variant="ghost"
            onClick={onClose}
            disabled={loading}
            iconLeft={<X size={14} />}
          >
            Cancelar
          </TPButton>
          <TPButton
            variant="primary"
            onClick={handleSubmitClick}
            disabled={hasErrors || loading}
            loading={loading}
            iconLeft={<Mail size={14} />}
          >
            {loading ? "Enviando…" : "Enviar"}
          </TPButton>
        </div>
      }
    >
      <div className="space-y-4">
        <TPInput
          label="Destinatario"
          value={to}
          onChange={(v) => { setTo(v); setTouched((t) => ({ ...t, to: true })); }}
          placeholder="cliente@email.com"
          error={visibleToError}
          hint={
            customerHasNoEmail && !visibleToError
              ? "El cliente no tiene email registrado. Ingresá uno manualmente."
              : undefined
          }
          disabled={loading}
          autoFocus
          inputMode="email"
          autoComplete="email"
        />
        <TPInput
          label="Asunto"
          value={subject}
          onChange={(v) => { setSubject(v); setTouched((t) => ({ ...t, subject: true })); }}
          error={visibleSubjectError}
          disabled={loading}
        />
        <TPTextarea
          label="Mensaje"
          value={message}
          onChange={(v) => { setMessage(v); setTouched((t) => ({ ...t, message: true })); }}
          error={visibleMessageError}
          minH={200}
          disabled={loading}
          hint="Se adjunta el PDF oficial automáticamente. Se preservan los saltos de línea."
        />
      </div>
    </Modal>
  );
}
