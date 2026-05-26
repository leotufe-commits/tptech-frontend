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
import { Mail, X, Save } from "lucide-react";
import Modal from "../ui/Modal";
import TPInput from "../ui/TPInput";
import TPTextarea from "../ui/TPTextarea";
import { TPButton } from "../ui/TPButton";
import {
  interpolateEmailTemplate,
  type EmailTemplateVars,
} from "../../lib/sales/interpolateEmailTemplate";

export type SendInvoiceEmailPayload = {
  to:      string;
  subject: string;
  message: string;
};

/** Payload del boton "Guardar como predeterminado" — strings con o sin
 *  variables `{{...}}`. Se guardan tal cual en `DocumentTemplate.emailSubject/MessageTemplate`. */
export type SendInvoiceEmailTemplatePayload = {
  subjectTemplate: string;
  messageTemplate: string;
};

/** Estados que el modal sabe distinguir para componer subject/body
 *  state-aware. Mapean al `SalesInvoiceStatus` del frontend
 *  (`DRAFT | PENDING | PARTIAL | PAID | CANCELLED`). DRAFT y CANCELLED
 *  prefijan el subject; resto = "final" (sin prefijo). */
export type SendInvoiceEmailStatus = "DRAFT" | "PENDING" | "PARTIAL" | "PAID" | "CANCELLED";

export interface SendInvoiceEmailModalProps {
  open:           boolean;
  loading?:       boolean;
  /** Numero oficial del comprobante (Receipt.code) o codigo interno
   *  del draft (Sale.code) como fallback. Aparece en el subtitulo y
   *  en los defaults de subject/message. */
  invoiceNumber:  string;
  /** Estado del comprobante — determina si el subject/body usan el
   *  formato BORRADOR / ANULADA / final. Default: undefined → final. */
  status?:        SendInvoiceEmailStatus;
  /** Email del cliente — precarga el campo `to` si esta presente. */
  customerEmail?: string | null;
  /** Nombre del cliente para el "Hola <name>," del body. */
  customerName?:  string | null;
  /** Nombre de la joyeria — aparece en subject + firma del body. */
  jewelryName?:   string | null;
  /** Fecha del comprobante (display). Usada en `{{fecha}}`. */
  invoiceDate?:   string | null;
  /** Plantilla persistida (DocumentTemplate.emailSubjectTemplate) — si
   *  esta presente y no vacia, se INTERPOLA con las variables y se usa
   *  como default del campo Asunto, en vez del default state-aware
   *  hardcoded. */
  defaultSubjectTemplate?: string | null;
  /** Plantilla persistida (DocumentTemplate.emailMessageTemplate) —
   *  mismo concepto que `defaultSubjectTemplate` pero para el body. */
  defaultMessageTemplate?: string | null;
  onClose():      void;
  onSubmit(payload: SendInvoiceEmailPayload): Promise<void>;
  /** Opcional: callback para guardar lo escrito actualmente como
   *  plantilla predeterminada (tenant-wide, kind=FACTURA). Si no se
   *  pasa, el boton "Guardar como predeterminado" no se renderea
   *  (caller puede ocultarlo si el usuario no tiene permiso). */
  onSaveAsTemplate?(payload: SendInvoiceEmailTemplatePayload): Promise<void>;
}

// Misma regex que usa el backend (sales.controller.sendEmail). Mantener
// sincronizadas para que un email valido en frontend no sea rechazado
// por el server (o viceversa).
const EMAIL_RX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Pivot funcional — subject state-aware. Defaults pedidos por producto:
 *    · DRAFT     → "BORRADOR <N°> - <Joyería>"
 *    · CANCELLED → "FACTURA ANULADA <N°> - <Joyería>"
 *    · final     → "Factura <N°> - <Joyería>" */
function buildDefaultSubject(
  invoiceNumber: string,
  status:        SendInvoiceEmailStatus | undefined,
  jewelryName?:  string | null,
): string {
  const tenantSuffix = jewelryName?.trim() ? ` - ${jewelryName.trim()}` : "";
  switch (status) {
    case "DRAFT":     return `BORRADOR ${invoiceNumber}${tenantSuffix}`;
    case "CANCELLED": return `FACTURA ANULADA ${invoiceNumber}${tenantSuffix}`;
    default:          return `Factura ${invoiceNumber}${tenantSuffix}`;
  }
}

/** Pivot funcional — body state-aware. Cambia solo la linea descriptiva
 *  del adjunto; greeting y firma quedan iguales. */
function buildDefaultMessage(
  invoiceNumber: string,
  status:        SendInvoiceEmailStatus | undefined,
  customerName?: string | null,
  jewelryName?:  string | null,
): string {
  const greeting = customerName?.trim() ? `Hola ${customerName.trim()},` : "Hola,";
  const firm     = jewelryName?.trim() || "";
  let attachmentLine: string;
  switch (status) {
    case "DRAFT":
      attachmentLine = `Te enviamos adjunto el borrador ${invoiceNumber}.`;
      break;
    case "CANCELLED":
      attachmentLine = `Te enviamos adjunta la factura anulada ${invoiceNumber}.`;
      break;
    default:
      attachmentLine = `Te enviamos adjunta la factura ${invoiceNumber}.`;
  }
  return [
    greeting,
    "",
    attachmentLine,
    "",
    "Muchas gracias.",
    firm,
  ].join("\n");
}

/** Mapea status del modal al label que usa la variable `{{estado}}` de la
 *  plantilla. Mismo vocabulario que el subject del default state-aware. */
function statusToVariableLabel(status: SendInvoiceEmailStatus | undefined): string {
  switch (status) {
    case "DRAFT":     return "BORRADOR";
    case "CANCELLED": return "FACTURA ANULADA";
    default:          return "Factura";
  }
}

export default function SendInvoiceEmailModal(props: SendInvoiceEmailModalProps): React.ReactElement {
  const {
    open, loading, invoiceNumber, status,
    customerEmail, customerName, jewelryName, invoiceDate,
    defaultSubjectTemplate, defaultMessageTemplate,
    onClose, onSubmit, onSaveAsTemplate,
  } = props;

  // Variables disponibles para `interpolateEmailTemplate` cuando hay
  // plantilla persistida. `{{estado}}` usa el mismo label que el subject
  // state-aware (BORRADOR / FACTURA ANULADA / Factura) para que ambos
  // caminos den el mismo resultado visual.
  const templateVars: EmailTemplateVars = useMemo(() => ({
    cliente: customerName?.trim() || "",
    numero:  invoiceNumber,
    joyeria: jewelryName?.trim() || "",
    estado:  statusToVariableLabel(status),
    fecha:   invoiceDate?.trim() || "",
  }), [customerName, invoiceNumber, jewelryName, status, invoiceDate]);

  // Defaults: si hay plantilla persistida del tenant, la interpolamos
  // y la usamos. Si no, caemos al default state-aware hardcoded.
  const defaultSubject = useMemo(() => {
    const tpl = defaultSubjectTemplate?.trim();
    if (tpl) return interpolateEmailTemplate(tpl, templateVars);
    return buildDefaultSubject(invoiceNumber, status, jewelryName);
  }, [defaultSubjectTemplate, templateVars, invoiceNumber, status, jewelryName]);

  const defaultMessage = useMemo(() => {
    const tpl = defaultMessageTemplate?.trim();
    if (tpl) return interpolateEmailTemplate(tpl, templateVars);
    return buildDefaultMessage(invoiceNumber, status, customerName, jewelryName);
  }, [defaultMessageTemplate, templateVars, invoiceNumber, status, customerName, jewelryName]);

  const [to,      setTo]      = useState<string>(customerEmail ?? "");
  const [subject, setSubject] = useState<string>(defaultSubject);
  const [message, setMessage] = useState<string>(defaultMessage);
  // `touched` controla cuando mostramos errores: no irritamos al operador
  // marcando "email invalido" antes de que escriba/edite.
  const [touched, setTouched] = useState<{ to?: boolean; subject?: boolean; message?: boolean }>({});
  // Estado del boton "Guardar como predeterminado" (loading propio para
  // no bloquear el resto del modal).
  const [savingTemplate, setSavingTemplate] = useState<boolean>(false);

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
    try {
      await onSubmit({
        to:      to.trim(),
        subject: subject.trim(),
        // `message` SIN trim — preservamos saltos de linea exactos.
        message,
      });
    } catch {
      // 1.G — Cazamos para evitar `unhandled promise rejection` cuando
      // el caller hace re-throw. El error ya lo maneja el caller con un
      // toast usando `ApiError.data.message`; el modal NO se cierra (lo
      // decide el caller via `open` prop).
    }
  }

  /** Guarda el subject + message ACTUALES (con las variables `{{...}}` que
   *  el operador haya escrito) como plantilla tenant-wide. NO cierra el
   *  modal — el operador puede seguir enviando el mail actual. */
  async function handleSaveAsTemplate(): Promise<void> {
    if (!onSaveAsTemplate || savingTemplate) return;
    setSavingTemplate(true);
    try {
      await onSaveAsTemplate({
        subjectTemplate: subject,
        messageTemplate: message,
      });
    } catch {
      // El caller muestra el toast. Aca solo liberamos el loading.
    } finally {
      setSavingTemplate(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={loading ? () => undefined : onClose}
      title="Enviar factura por mail"
      subtitle={`Comprobante ${invoiceNumber}`}
      maxWidth="2xl"
      footer={
        <div className="flex items-center justify-between gap-2">
          {/* Lado izquierdo: "Guardar como predeterminado" (si el caller
              expone `onSaveAsTemplate`). Visualmente separado de las
              acciones primarias (Cancelar/Enviar) — es accion de config,
              no del envio actual. */}
          <div>
            {onSaveAsTemplate ? (
              <TPButton
                variant="ghost"
                onClick={handleSaveAsTemplate}
                disabled={loading || savingTemplate || hasErrors}
                loading={savingTemplate}
                iconLeft={<Save size={14} />}
                title="Guardar el asunto y mensaje actuales como plantilla predeterminada para futuras facturas (tenant-wide)"
              >
                {savingTemplate ? "Guardando…" : "Guardar como predeterminado"}
              </TPButton>
            ) : null}
          </div>
          <div className="flex items-center gap-2">
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
        {onSaveAsTemplate ? (
          <div className="text-[11px] text-muted">
            Variables disponibles en asunto y mensaje:
            {" "}
            <code>{"{{cliente}}"}</code>{" "}
            <code>{"{{numero}}"}</code>{" "}
            <code>{"{{joyeria}}"}</code>{" "}
            <code>{"{{estado}}"}</code>{" "}
            <code>{"{{fecha}}"}</code>.
          </div>
        ) : null}
      </div>
    </Modal>
  );
}
